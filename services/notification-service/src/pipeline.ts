import { prisma } from "./prisma.js";
import { redis } from "./redis.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import crypto from "crypto";
import { sendEmail } from "./channels/email.js";
import { sendPush } from "./channels/push.js";
import { sendSms } from "./channels/sms.js";
import { sendInapp } from "./channels/inapp.js";

type NotifChannel = "EMAIL" | "PUSH" | "SMS" | "INAPP";

export async function checkChannelQuota(userId: string, channel: NotifChannel): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `notif:quota:${userId}:${channel}:${day}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 24 * 3600);
  const LIMITS: Record<NotifChannel, number> = { EMAIL: 30, PUSH: 60, SMS: 5, INAPP: 200 };
  return n <= LIMITS[channel];
}

export interface PlanInput {
  userId: string;
  type: string;
  channels: NotifChannel[];
  subject?: string;
  body: string;
  data?: any;
  dedupeKey?: string;
}

export async function plan(input: PlanInput) {
  const prefs = await prisma.notifPreference.findMany({
    where: { userId: input.userId, type: input.type, channel: { in: input.channels } },
  });
  
  // Default: channel is ON unless explicit OFF exists
  const explicitOff = new Set(prefs.filter(p => !p.enabled).map(p => p.channel));
  const active = input.channels.filter(c => !explicitOff.has(c));

  // Dedup
  if (input.dedupeKey) {
    const key = `notif:dedup:${input.userId}:${input.dedupeKey}`;
    const first = await redis.set(key, "1", { NX: true, EX: 6 * 3600 });
    if (!first) return [];
  }

  const rows = await Promise.all(active.map(channel =>
    prisma.notification.create({ data: { 
      userId: input.userId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      data: input.data || {},
      channel, 
      status: "QUEUED" 
    } })
  ));
  return rows;
}

export async function dispatch(n: any) {
  const underQuota = await checkChannelQuota(n.userId, n.channel);
  if (!underQuota) {
    await prisma.notification.update({
      where: { id: n.id },
      data: { status: "SUPPRESSED", error: "Rate limit exceeded" },
    });
    return;
  }

  const handler = { EMAIL: sendEmail, PUSH: sendPush, SMS: sendSms, INAPP: sendInapp }[n.channel as NotifChannel];
  try {
    const providerRef = await handler(n);
    await prisma.notification.update({
      where: { id: n.id },
      data: { status: "SENT", sentAt: new Date(), providerRef },
    });
    await publishEvent("notification.dispatched", {
      id: crypto.randomUUID(),
      notifId: n.id, userId: n.userId, channel: n.channel, type: n.type,
    });
  } catch (e: any) {
    await prisma.notification.update({
      where: { id: n.id },
      data: { status: "FAILED", error: e.message?.slice(0, 500) },
    });
  }
}

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { redis } from "../redis.js";
import { publishEvent } from "../events/publisher.js";
import crypto from "crypto";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

function today() {
  return new Date().toISOString().split("T")[0];
}

export async function sendRec(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { toUserId, businessId, note } = req.body;

  if (toUserId === ctx.id) {
    return res.status(400).json({ error: "Cannot rec yourself" });
  }

  // Daily quotas
  const sentKey = `rec_quota:sent:${ctx.id}:${today()}`;
  const recvKey = `rec_quota:recv:${toUserId}:${today()}`;

  const sent = await redis.incr(sentKey);
  if (sent === 1) await redis.expire(sentKey, 24 * 3600);
  if (sent > 20) {
    return res.status(429).json({ error: "Daily send limit reached" });
  }

  const recv = await redis.incr(recvKey);
  if (recv === 1) await redis.expire(recvKey, 24 * 3600);
  if (recv > 50) {
    await redis.decr(sentKey);
    return res.status(429).json({ error: "Recipient inbox full for today" });
  }

  try {
    const rec = await prisma.recommendation.create({
      data: { fromUserId: ctx.id, toUserId, businessId, note: note ? note.substring(0, 280) : null },
    });
    
    await publishEvent("rec.sent", {
      id: crypto.randomUUID(),
      recId: rec.id, fromUserId: ctx.id, toUserId, businessId,
    });
    
    res.status(201).json(rec);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Already recommended" });
    }
    throw e;
  }
}

export async function getInbox(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const unseenOnly = req.query.unseenOnly === "true";
  
  const recs = await prisma.recommendation.findMany({
    where: {
      toUserId: ctx.id,
      ...(unseenOnly ? { seenAt: null } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  // Hydrate via internal HTTP or just return the DB objects for now.
  res.json(recs);
}

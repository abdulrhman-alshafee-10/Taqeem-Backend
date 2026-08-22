import { redis } from "@taqeem/shared/lib/redis.js";
import { publishEvent } from "../events/publisher.js";
import crypto from "node:crypto";

export async function assessLoginRisk(userId: string, ctx: { ip: string, userAgent: string, geoCountry: string }) {
  const historyKey = `login:history:${userId}`;
  const historyRaw = await redis.lRange(historyKey, 0, 4);   // last 5

  const signals: string[] = [];

  if (historyRaw.length > 0) {
    const knownCountries = historyRaw.map((h) => JSON.parse(h).geoCountry);
    if (!knownCountries.includes(ctx.geoCountry)) signals.push("new_country");

    const knownAgents = historyRaw.map((h) => JSON.parse(h).userAgent);
    if (!knownAgents.includes(ctx.userAgent)) signals.push("new_device");
  }

  // Record this login
  await redis.lPush(historyKey, JSON.stringify({ ...ctx, at: Date.now() }));
  await redis.lTrim(historyKey, 0, 9);   // keep last 10
  await redis.expire(historyKey, 30 * 24 * 60 * 60); // 30 days

  if (signals.length > 0) {
    await publishEvent("user.suspicious_login", {
      id: crypto.randomUUID(),
      userId,
      signals,
      ip: ctx.ip,
      geoCountry: ctx.geoCountry,
      userAgent: ctx.userAgent,
      at: new Date().toISOString(),
    }).catch((err) => console.error("Failed to publish suspicious login event", err));
  }

  return { risk: signals.length > 0 ? "elevated" : "normal", signals };
}

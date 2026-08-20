import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { publishEvent } from "../events/publisher.js";
import { createClient } from "redis";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
redis.connect().catch(console.error);

function getUserContext(req: Request) {
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

export async function getInsights(req: Request, res: Response) {
  const { id } = req.params; // businessId
  const weeks = parseInt(req.query.weeks as string) || 6;

  const insights = await prisma.weeklyInsight.findMany({
    where: { businessId: id },
    orderBy: { weekStart: "desc" },
    take: weeks
  });

  res.json(insights);
}

export async function getReplySuggestions(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { reviewId } = req.params;
  const businessId = req.body.businessId;

  if (!businessId) {
    return res.status(400).json({ error: "Missing businessId in body" });
  }

  // Rate limit: 20 per owner per hour
  const quotaKey = `suggest_quota:${ctx.id}`;
  const count = await redis.incr(quotaKey);
  if (count === 1) await redis.expire(quotaKey, 3600);
  if (count > 20) return res.status(429).json({ error: "Hourly suggestion limit reached" });

  try {
    const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://agent-service:4004";
    const response = await axios.post(`${agentServiceUrl}/internal/reviews/${reviewId}/reply-suggestions`, {
      businessId,
      ownerId: ctx.id
    });

    await publishEvent("reply_suggestion.requested", { reviewId, businessId, ownerId: ctx.id });
    res.json(response.data);
  } catch (error: any) {
    console.error("Agent service failed:", error.message);
    res.status(500).json({ error: "Failed to generate AI suggestions" });
  }
}

import { z } from "zod";
import { Request, Response } from "express";
import { redis, BUFFER_KEY } from "../redis.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

const EventSchema = z.object({
  type:       z.string().min(1).max(60),
  ts:         z.string().datetime().optional(),
  businessId: z.string().uuid().optional(),
  reviewId:   z.string().uuid().optional(),
  metadata:   z.record(z.any()).optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(200),
});

export async function ingest(req: Request, res: Response) {
  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad batch", issues: parsed.error.issues });

  const ctx = getUserContext(req);
  const now = new Date().toISOString();

  const payloads = parsed.data.events.map(e => JSON.stringify({
    id:         crypto.randomUUID(),
    type:       e.type,
    ts:         e.ts ?? now,
    userId:     ctx.id ?? null,
    businessId: e.businessId ?? null,
    reviewId:   e.reviewId ?? null,
    metadata:   e.metadata ?? {},
  }));

  await redis.rPush(BUFFER_KEY, payloads);
  res.status(202).json({ accepted: payloads.length });
}

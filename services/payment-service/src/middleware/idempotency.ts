import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client-payment";
import { createClient } from "redis";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

export class HTTPError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function withIdempotency(key: string, handler: () => Promise<{ status: number, body: any }>) {
  if (!key) throw new HTTPError(400, "Idempotency-Key required");
  if (key.length > 64) throw new HTTPError(400, "Idempotency-Key too long");

  const cached = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (cached) return { status: cached.status, body: cached.body as any, cached: true };

  const lock = `idem:${key}`;
  const acquired = await redis.set(lock, "1", { NX: true, EX: 30 });
  
  if (!acquired) {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      const c = await prisma.idempotencyRecord.findUnique({ where: { key } });
      if (c) return { status: c.status, body: c.body as any, cached: true };
    }
    throw new HTTPError(409, "In-flight request timed out");
  }

  try {
    const { status, body } = await handler();
    await prisma.idempotencyRecord.create({
      data: {
        key,
        status,
        body,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    return { status, body, cached: false };
  } finally {
    await redis.del(lock);
  }
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.header("Idempotency-Key");
  if (!key && req.method !== "GET" && req.method !== "OPTIONS") {
    return res.status(400).json({ error: "Idempotency-Key header is required" });
  }
  next();
}

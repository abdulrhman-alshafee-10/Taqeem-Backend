import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { writeOutboxEvent } from "@taqeem/shared/outbox/outbox.js";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = createClient({ url: redisUrl });
redisClient.connect().catch(console.error);

export async function initiateErasure(userId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Anonymise user record (preserve referential integrity)
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${randomUUID()}@taqeem.deleted`,
        name: "Deleted User",
        phone: null,
        avatarUrl: null,
        bio: null,
        deletedAt: new Date(),
        status: "deleted",
      },
    });

    // 2. Revoke all tokens via generation counter
    await redisClient.incr(`token:gen:${userId}`);

    // 3. Enqueue async erasure job
    await writeOutboxEvent(tx, "user.erasure_requested", {
      id: randomUUID(),
      userId,
      requestedAt: new Date().toISOString(),
    });

    return { status: "erasure_queued", completionDeadline: "30 days" };
  });
}

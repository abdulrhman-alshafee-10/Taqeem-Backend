import { initConsumerDedupe, startConsumer } from "@taqeem/shared/events/consumer.js";
import { redis, BUFFER_KEY } from "../redis.js";
import crypto from "node:crypto";

const KEEP = new Set([
  "review.created","review.updated","review.deleted","review.replied",
  "business.viewed","business.created","business.claim_submitted",
  "user.registered","profile.viewed",
]);

export async function startConsumers() {
  await initConsumerDedupe();
  await startConsumer({
    queue: "analytics.events.queue",
    prefetch: 50,
    bindings: Array.from(KEEP),
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (!type || !KEEP.has(type)) return;

      const evt = {
        id: payload.id ?? crypto.randomUUID(),
        type,
        ts: payload.at ?? payload.createdAt ?? payload.updatedAt ?? new Date().toISOString(),
        userId:     payload.userId    ?? payload.viewerId ?? payload.authorId ?? null,
        businessId: payload.businessId ?? payload.business?.id ?? null,
        reviewId:   payload.reviewId  ?? null,
        metadata:   { source: headers["x-source"] ?? "unknown" },
      };
      await redis.rPush(BUFFER_KEY, JSON.stringify(evt));
    },
  });
}

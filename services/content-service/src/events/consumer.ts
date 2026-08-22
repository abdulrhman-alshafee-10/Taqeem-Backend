import { startConsumer } from '@taqeem/shared/events/consumer.js';
import { PrismaClient } from '@prisma/client';
import { redis } from '../redis.js';

const prisma = new PrismaClient();

export async function startFeedConsumers() {
  await startConsumer({
    queue: 'feed.recent.queue',
    bindings: ['business.viewed'],
    handler: async (payload, headers) => {
      const type = headers['x-event-type'];
      if (type !== 'business.viewed') return;
      if (!payload.viewerId) return;

      const key = `recent:business:${payload.viewerId}`;
      const meta = `recent:business:meta:${payload.viewerId}:${payload.businessId}`;

      const pipe = redis.multi();
      pipe.lRem(key, 0, payload.businessId);
      pipe.lPush(key, payload.businessId);
      pipe.lTrim(key, 0, 19);
      pipe.expire(key, 30 * 24 * 3600);

      pipe.hIncrBy(meta, "count", 1);
      pipe.hSet(meta, "lastAt", new Date().toISOString());
      pipe.hSetNX(meta, "firstAt", new Date().toISOString());
      pipe.expire(meta, 30 * 24 * 3600);
      await pipe.exec();
    }
  });

  await startConsumer({
    queue: 'feed.ingest.queue',
    bindings: ['review.created', 'owner.post_published'],
    handler: async (payload, headers) => {
      const type = headers['x-event-type'];
      
      if (type === 'review.created') {
        const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000);
        await prisma.feedItem.create({
          data: {
            kind: 'REVIEW',
            refId: payload.reviewId,
            businessId: payload.businessId,
            authorId: payload.authorId,
            score: 0.8, // Basic score
            expiresAt: daysFromNow(7)
          }
        });
      } else if (type === 'owner.post_published') {
        const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000);
        await prisma.feedItem.create({
          data: {
            kind: 'OWNER_POST',
            refId: payload.postId,
            businessId: payload.businessId,
            score: 0.5 + (payload.type === 'OFFER' ? 0.2 : 0),
            expiresAt: payload.validTo ? new Date(payload.validTo) : daysFromNow(7)
          }
        });
      }
    }
  });
}

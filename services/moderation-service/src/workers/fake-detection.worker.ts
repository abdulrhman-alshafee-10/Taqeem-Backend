import { PrismaClient } from '@prisma/client';
import { publishEvent } from '../events/publisher';
import crypto from 'crypto';
// Assuming we have a startConsumer utility in events/consumer.ts
// import { startConsumer } from '../events/consumer';

const prisma = new PrismaClient();

export async function handleFakeDetectionScore(payload: any) {
  const { reviewId, businessId, score, signals, authorId } = payload;

  const entry = await prisma.queueEntry.upsert({
    where: { contentKind_contentId: { contentKind: "REVIEW", contentId: reviewId } },
    create: {
      contentKind: "REVIEW",
      contentId:   reviewId,
      authorId:    authorId,
      aiScore:     score,
      aiSignals:   signals,
      priority:    Math.round(score * 100),
      status:      score >= 0.7 ? "PENDING" : "AUTO_APPROVED",
    },
    update: {
      aiScore:  score,
      aiSignals: signals,
      priority: { set: Math.round(score * 100) },
    },
  });

  if (score >= 0.7) {
    // Hide the review until moderator decides
    await publishEvent("moderation.autohidden", {
      id: crypto.randomUUID(),
      contentKind: "REVIEW", 
      contentId: reviewId, 
      businessId,
      reason: "fake_score_high",
    });
  }
}

// Check for bulk attack
export async function checkBulkAttack(businessId: string) {
  // Query pending reviews for this business with high score in last 1 hour
  // Need to join via review service or if we store businessId in entry, it would be faster.
  // For now, since queueEntry doesn't have businessId, we might need a worker that queries ReviewService
  // Or we just rely on the event payload to track recently flagged reviews per business in Redis.
}

/*
startConsumer({
  queue: "moderation.review_scored.queue",
  handler: handleFakeDetectionScore
});
*/

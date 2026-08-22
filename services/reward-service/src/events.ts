import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient } from "@prisma/client-reward";

const prisma = new PrismaClient();

// Simple point map for events
const EARN_MAP: Record<string, number> = {
  "review.created": 5,
  "review.verified_visit": 5, // stacked with review.created
  "review.helpful_voted": 1,
  "media.uploaded": 2, // simplified proxy for +2 media bonus
  "user.badge_awarded": 25,
};

export async function setupEvents() {
  await startConsumer({
    queue: "reward.points.queue",
    handler: async (payload, headers) => {
      const type = headers["x-event-type"] as string;
      const points = EARN_MAP[type];
      
      if (!points) return;
      
      const userId = payload.userId ?? payload.authorId ?? payload.voterId;
      if (!userId) return;

      // Ensure balance exists
      await prisma.rewardBalance.upsert({
        where: { userId },
        create: { userId, points },
        update: { points: { increment: points } }
      });
      
      await prisma.rewardTx.create({
        data: {
          userId,
          points,
          reason: `earn:${type}`,
          refId: payload.reviewId ?? payload.mediaId ?? payload.badgeKey
        }
      });
    }
  });
}

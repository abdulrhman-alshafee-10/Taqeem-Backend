import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { publishEvent } from "../events/publisher.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function recomputeLevel(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;

  const next =
    u.reputationScore >= 5000  ? "LOCAL_GUIDE" :
    u.reputationScore >= 1500  ? "GUIDE" :
    u.reputationScore >= 500   ? "TRUSTED" :
    u.reputationScore >= 100   ? "CONTRIBUTOR" : "EXPLORER";

  if (next !== u.reputationLevel) {
    await prisma.user.update({ where: { id: userId }, data: { reputationLevel: next } });
    await publishEvent("user.level_up", { userId, from: u.reputationLevel, to: next });
  }
}

export async function startReputationConsumer() {
  await startConsumer({
    queue: "user.reputation.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];

      if (type === "review.created" && payload.approved !== false) {
        await prisma.user.update({
          where: { id: payload.authorId },
          data: {
            reviewsCount:    { increment: 1 },
            reputationScore: { increment: 5 + (payload.aspects ? Object.keys(payload.aspects).length : 0) * 1 }, // Simplification of photo bonus for now
          },
        });
        await recomputeLevel(payload.authorId);
      }

      if (type === "review.helpful_voted") {
        const scoreDelta = payload.value === 1 ? 1 : -3;
        await prisma.user.update({
          where: { id: payload.authorId },
          data: {
            helpfulReceived: payload.value === 1 ? { increment: 1 } : undefined,
            reputationScore: { increment: scoreDelta },
          },
        });
        await recomputeLevel(payload.authorId);
      }

      if (type === "review.verified_visit") {
        await prisma.user.update({
          where: { id: payload.authorId },
          data: { reputationScore: { increment: payload.weight === 2 ? 10 : 3 } },
        });
        await recomputeLevel(payload.authorId);
      }
    },
  });
}

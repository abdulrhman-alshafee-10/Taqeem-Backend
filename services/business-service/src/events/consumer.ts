import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "./publisher.js";

const prisma = new PrismaClient();

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function initConsumer() {
  await startConsumer({
    queue: "business.reviews.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (type === "review.created") await onReviewCreated(payload);
      // We should also handle updated/deleted but for Phase 6.1 focus on created
    },
  });
}

async function onReviewCreated({ businessId, aspects, rating }: any) {
  await prisma.$transaction(async (tx) => {
    const b = await tx.business.findUnique({ where: { id: businessId } });
    if (!b) return;

    const nAll = b.reviewCount + 1;
    const avgAll = (b.avgRating * b.reviewCount + rating) / nAll;

    const patch: any = { avgRating: avgAll, reviewCount: nAll };

    if (aspects) {
      for (const key of ["food", "service", "ambience", "value", "cleanliness"]) {
        if (aspects[key] == null) continue;
        const capKey = cap(key);
        const curAvg = (b as any)[`aspectAvg${capKey}`];
        const curCount = (b as any)[`aspectCount${capKey}`];
        const n = curCount + 1;
        patch[`aspectAvg${capKey}`] = (curAvg * curCount + aspects[key]) / n;
        patch[`aspectCount${capKey}`] = n;
      }
    }

    await tx.business.update({ where: { id: businessId }, data: patch });
  });

  await publishEvent("business.aspects_updated", { businessId });
}

import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "./publisher.js";
import { wilsonLower } from "../utils/tier-calc.js";
import crypto from "node:crypto";

const prisma = new PrismaClient();

export async function initConsumer() {
  await startConsumer({
    queue: "business.reviews.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (type === "review.created") await onReviewCreated(payload);
      if (type === "review.verified_visit") await onReviewVerified(payload);
    },
  });
}

async function recomputeQuality(businessId: string, tx: any) {
  const b = await tx.business.findUnique({ where: { id: businessId } });
  if (!b) return;

  const wl = wilsonLower(b.ratingAvg, b.ratingCount);
  const vr = b.ratingCount === 0 ? 0 : b.verifiedReviewCount / b.ratingCount;

  const next =
    b.ratingCount >= 500 && wl >= 4.6 && vr >= 0.4 ? "HALL_OF_FAME" :
    b.ratingCount >= 200 && wl >= 4.4              ? "ACCLAIMED"    :
    b.ratingCount >= 50  && wl >= 4.1              ? "POPULAR"      :
    b.ratingCount >= 5   && b.ratingAvg >= 4.0     ? "RISING"       :
                                                     "UNRATED";
  
  if (next !== b.qualityTier) {
    await tx.business.update({ where: { id: businessId }, data: { qualityTier: next, levelUpdatedAt: new Date() } });
    await publishEvent("business.tier_changed", {
      id: crypto.randomUUID(),
      businessId, from: b.qualityTier, to: next, track: "quality",
    });
  }
}

async function onReviewCreated({ businessId, aspects, rating }: any) {
  const ratingCount = await prisma.$transaction(async (tx) => {
    const b = await tx.business.findUnique({ where: { id: businessId } });
    if (!b) return 0;

    const nAll = b.ratingCount + 1;
    const avgAll = (b.ratingAvg * b.ratingCount + rating) / nAll;

    const patch: any = { ratingAvg: avgAll, ratingCount: nAll };

    if (aspects) {
      const aspectAvgs: any = typeof b.aspectAvgs === "object" ? b.aspectAvgs : {};
      const aspectCounts: any = typeof b.aspectCounts === "object" ? b.aspectCounts : {};

      for (const [key, val] of Object.entries(aspects)) {
        if (typeof val !== "number") continue;
        const curAvg = aspectAvgs[key] ?? 0;
        const curCount = aspectCounts[key] ?? 0;
        const n = curCount + 1;
        aspectAvgs[key] = (curAvg * curCount + val) / n;
        aspectCounts[key] = n;
      }
      patch.aspectAvgs = aspectAvgs;
      patch.aspectCounts = aspectCounts;
    }

    const updated = await tx.business.update({ where: { id: businessId }, data: patch });
    await recomputeQuality(businessId, tx);
    return updated.ratingCount;
  });

  await publishEvent("business.aspects_updated", { businessId });
  if (ratingCount > 0 && ratingCount % 5 === 0) {
    await publishEvent("business.summary_requested", { businessId });
  }
}

async function onReviewVerified({ businessId }: any) {
  await prisma.$transaction(async (tx) => {
    const b = await tx.business.findUnique({ where: { id: businessId } });
    if (!b) return;
    await tx.business.update({
      where: { id: businessId },
      data: { verifiedReviewCount: { increment: 1 } }
    });
    await recomputeQuality(businessId, tx);
  });
}

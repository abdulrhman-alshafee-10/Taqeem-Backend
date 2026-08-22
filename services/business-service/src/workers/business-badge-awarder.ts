import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient, Prisma } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import { wilsonLower } from "../utils/tier-calc.js";

const prisma = new PrismaClient();

const MILESTONE_REVIEW: Record<number, string> = {
  50: "milestone_50_reviews",
  200: "milestone_200_reviews",
  1000: "milestone_1000_reviews",
  10000: "milestone_10000_reviews",
};

export async function tryAward(businessId: string, key: string, metadata: any = null) {
  // If the same badge key with EXACT metadata exists, don't award it again.
  // Because metadata is JSON, Prisma's `equals` is strict on order and type.
  const existing = await prisma.businessBadge.findFirst({
    where: { businessId, badgeKey: key, ...(metadata ? { metadata: { equals: metadata } } : {}) },
  });

  if (existing) return;

  await prisma.businessBadge.create({ 
    data: { businessId, badgeKey: key, metadata: metadata ?? Prisma.JsonNull } 
  });
  
  await publishEvent("business.badge_awarded", { businessId, badgeKey: key, metadata });
}

export async function startBadgeConsumers() {
  // review.created / review.deleted → milestone counts
  await startConsumer({
    queue: "business.badges.reviews.queue",
    handler: async (payload: any, headers: any) => {
      if (!["review.created", "review.deleted"].includes(headers["x-event-type"])) return;
      const b = await prisma.business.findUnique({ where: { id: payload.businessId } });
      if (!b) return;

      // Milestone
      for (const [threshold, key] of Object.entries(MILESTONE_REVIEW)) {
        if (b.ratingCount >= Number(threshold)) await tryAward(b.id, key);
      }
      
      // 4.5★ with 100+
      if (b.ratingCount >= 100 && b.ratingAvg >= 4.5) await tryAward(b.id, "quality_45plus_100");
      
      // Hall of Fame
      if (b.qualityTier === "HALL_OF_FAME") await tryAward(b.id, "quality_hall_of_fame");
    },
  });

  // business.tier_changed engagement → owner_pro
  await startConsumer({
    queue: "business.badges.tiers.queue",
    handler: async (payload: any, headers: any) => {
      if (headers["x-event-type"] !== "business.tier_changed") return;
      if (payload.track === "engagement" && payload.to === "PRO") {
        await tryAward(payload.businessId, "owner_pro");
      }
    },
  });
}

// Seniority Badges (intended to be called by a cron job)
export async function runSeniorityAwards() {
  const now = new Date();
  const thresholds = [
    { years: 1, key: "since_taqeem_1y" },
    { years: 3, key: "since_taqeem_3y" },
    { years: 5, key: "since_taqeem_5y" },
    { years: 10, key: "since_taqeem_10y" },
  ];

  for (const { years, key } of thresholds) {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - years);

    // Find businesses older than cutoff that don't have the badge yet
    const eligible = await prisma.business.findMany({
      where: {
        createdAt: { lte: cutoff },
        NOT: { badges: { some: { badgeKey: key } } }
      },
      select: { id: true }
    });

    for (const b of eligible) {
      await tryAward(b.id, key);
    }
  }
}

export async function runYearlyAwards(year: number) {
  // Simplified mock: In a real system this would use ReviewSnapshotYear
  // Here we just pick businesses that have 30+ reviews, and calculate their score inline
  // for all cities and verticals.
  
  const candidates = await prisma.business.findMany({
    where: { ratingCount: { gte: 30 } },
  });
  
  // Group by City + Vertical
  const grouped: Record<string, any[]> = {};
  for (const b of candidates) {
    const bucket = `${b.city}_${b.vertical}`;
    if (!grouped[bucket]) grouped[bucket] = [];
    
    // awardScore = 0.55*wilsonLower + 0.20*log10(reviews+1) + 0.15*verifiedRatio + 0.05*engagementBonus
    const wl = wilsonLower(b.ratingAvg, b.ratingCount);
    const logReviews = Math.log10(b.ratingCount + 1);
    const vr = b.ratingCount === 0 ? 0 : b.verifiedReviewCount / b.ratingCount;
    const eb = b.engagementTier === "PRO" ? 1 : (b.engagementTier === "ACTIVE_OWNER" ? 0.5 : 0);
    
    const score = (0.55 * wl) + (0.20 * logReviews) + (0.15 * vr) + (0.05 * eb);
    grouped[bucket].push({ ...b, score });
  }

  for (const [bucket, list] of Object.entries(grouped)) {
    // Sort desc by score
    list.sort((a, b) => b.score - a.score);
    const top10 = list.slice(0, 10);
    
    for (const b of top10) {
      const metadata = { year, city: b.city, vertical: b.vertical };
      await tryAward(b.id, "award_best_of_year", metadata);
    }
  }
}

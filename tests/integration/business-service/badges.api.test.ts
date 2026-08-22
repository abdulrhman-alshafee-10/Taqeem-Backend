import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../services/business-service/src/index.js";
import { tryAward, runYearlyAwards, runSeniorityAwards } from "../../../services/business-service/src/workers/business-badge-awarder.js";

// Mock prisma completely
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    businessBadge: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    }
  }
}));

vi.mock("@prisma/client", () => {
  return { 
    PrismaClient: vi.fn(() => prismaMock),
    Prisma: { JsonNull: 'DbNull' }
  };
});

describe("Business Badges & Awards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tryAward should create a badge if not already existing", async () => {
    prismaMock.businessBadge.findFirst.mockResolvedValueOnce(null);
    prismaMock.businessBadge.create.mockResolvedValueOnce({ id: "badge-1" } as any);

    await tryAward("biz-1", "quality_45plus_100", null);

    expect(prismaMock.businessBadge.findFirst).toHaveBeenCalledWith({
      where: { businessId: "biz-1", badgeKey: "quality_45plus_100" }
    });
    expect(prismaMock.businessBadge.create).toHaveBeenCalled();
  });

  it("tryAward should not create a badge if already existing", async () => {
    prismaMock.businessBadge.findFirst.mockResolvedValueOnce({ id: "badge-1" } as any);

    await tryAward("biz-1", "quality_45plus_100", null);

    expect(prismaMock.businessBadge.create).not.toHaveBeenCalled();
  });

  it("runYearlyAwards should rank businesses and award best_of_year", async () => {
    prismaMock.business.findMany.mockResolvedValueOnce([
      { id: "b1", city: "Cairo", vertical: "FOOD_DRINK", ratingCount: 100, ratingAvg: 4.8, verifiedReviewCount: 80, engagementTier: "PRO" } as any,
      { id: "b2", city: "Cairo", vertical: "FOOD_DRINK", ratingCount: 50, ratingAvg: 4.0, verifiedReviewCount: 10, engagementTier: "UNCLAIMED" } as any,
    ]);

    prismaMock.businessBadge.findFirst.mockResolvedValue(null);

    await runYearlyAwards(2026);

    expect(prismaMock.businessBadge.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.businessBadge.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        businessId: "b1",
        badgeKey: "award_best_of_year",
        metadata: { year: 2026, city: "Cairo", vertical: "FOOD_DRINK" }
      })
    }));
  });

  it("GET /api/businesses/:id/badges should return earned badges", async () => {
    prismaMock.businessBadge.findMany.mockResolvedValueOnce([
      { badgeKey: "milestone_50_reviews", awardedAt: new Date() } as any
    ]);

    const res = await request(app).get("/api/businesses/biz-1/badges");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].badgeKey).toBe("milestone_50_reviews");
  });
});

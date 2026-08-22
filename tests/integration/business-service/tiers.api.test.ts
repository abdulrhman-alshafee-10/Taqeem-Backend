import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../../services/business-service/src/index.js";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: {
      findUnique: vi.fn(),
      create: vi.fn(),
    }
  }
}));

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: vi.fn(() => prismaMock)
  };
});

describe("Business Tiers & Levels API", () => {
  let bizId = "biz-123";

  it("should calculate and return business level and tiers", async () => {
    // Mock the findUnique response
    prismaMock.business.findUnique.mockResolvedValueOnce({
      id: bizId,
      name: "Tier Test Biz",
      slug: "tier-test-biz-123",
      vertical: "FOOD_DRINK",
      ratingCount: 50,
      ratingAvg: 4.8,
      verifiedReviewCount: 20,
      qualityTier: "POPULAR",
      seniorityTier: "ESTABLISHED",
      engagementTier: "ACTIVE_OWNER",
      createdAt: new Date("2022-01-01T00:00:00Z"),
    });

    const res = await request(app)
      .get(`/api/businesses/${bizId}/level`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      seniorityTier: "ESTABLISHED",
      qualityTier: "POPULAR",
      engagementTier: "ACTIVE_OWNER",
      headlineLevel: "POPULAR",
      reviewCount: 50,
      avgRating: 4.8,
    });
    
    expect(res.body.wilsonLower).toBeGreaterThan(4.0);
    expect(res.body.verifiedRatio).toBe(0.4);
  });
});

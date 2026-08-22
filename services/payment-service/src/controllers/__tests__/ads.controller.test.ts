import { describe, it, expect, vi } from "vitest";
import { recordClick } from "../ads.controller.js";
import { Request, Response } from "express";

vi.mock("@prisma/client-payment", () => {
  const mPrisma = {
    adCampaign: {
      findUnique: vi.fn().mockResolvedValue({
        id: "c-1",
        businessId: "b-1",
        status: "APPROVED",
        cpcBidCents: 15,
        dailyBudgetCents: 1000,
        currency: "USD",
        kind: "PROMOTED_SEARCH"
      }),
      update: vi.fn().mockResolvedValue({ spendCents: 15 }),
    },
    adImpression: {
      create: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { costCents: 15 } })
    },
    ledgerEntry: {
      createMany: vi.fn().mockResolvedValue({ count: 2 })
    },
    $transaction: vi.fn(async (cb) => cb(mPrisma))
  };
  return { PrismaClient: vi.fn(() => mPrisma) };
});

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(true),
    set: vi.fn().mockResolvedValue(true)
  }))
}));

describe("Ads Controller", () => {
  it("should record ad click and charge CPC", async () => {
    const req = {
      ip: "127.0.0.1",
      user: { id: "u-1" },
      body: { campaignId: "c-1", surface: "search" }
    } as unknown as Request;
    
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as unknown as Response;

    await recordClick(req, res);

    expect(res.json).toHaveBeenCalledWith({ counted: true });
  });
});

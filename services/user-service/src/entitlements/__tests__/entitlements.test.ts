import { describe, it, expect, vi } from "vitest";
import { hasEntitlement, ENTITLEMENT_TIER_MIN, resolveQuotaLimit, consumeQuota } from "../index.js";
import { getActiveTier } from "../index.js";
import * as quotas from "../quotas.js";

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    connect: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue("PRO"),
    set: vi.fn().mockResolvedValue(true),
    incrBy: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    decrBy: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock("redis", () => ({
  createClient: vi.fn(() => redisMock)
}));

describe("Entitlements & Quotas", () => {
  it("should validate active tier", async () => {
    const ok = await hasEntitlement({ businessId: "biz-1" }, "weekly_insights");
    expect(ok).toBe(true);
  });

  it("should fail for higher tiers", async () => {
    // If user has PRO, but feature needs CHAIN
    redisMock.get.mockResolvedValue("BASIC");
    const ok = await hasEntitlement({ businessId: "biz-1" }, "weekly_insights");
    expect(ok).toBe(false);
    redisMock.get.mockResolvedValue("PRO"); // reset for other tests
  });

  it("should resolve quota limit correctly", async () => {
    const limit = await quotas.resolveQuotaLimit({ businessId: "biz-1" }, "qna_ai_drafts_monthly");
    expect(limit).toBe(200); // Because getActiveTier returns PRO in mock
  });

  it("should consume quota successfully", async () => {
    const ok = await quotas.consumeQuota({ businessId: "biz-1" }, "qna_ai_drafts_monthly", 1);
    expect(ok).toBe(true);
  });
});

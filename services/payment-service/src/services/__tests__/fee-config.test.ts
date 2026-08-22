import { describe, it, expect, vi } from "vitest";
import { resolveFeeConfig } from "../fee-config.js";

vi.mock("@prisma/client-payment", () => {
  return {
    PrismaClient: vi.fn(() => ({
      feeConfig: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.scope_scopeKey.scope === "PLATFORM") {
            return Promise.resolve({ transactionFeePct: 3.5, waiveUntil: null });
          }
          if (where.scope_scopeKey.scope === "VERTICAL" && where.scope_scopeKey.scopeKey === "FINE_DINING") {
            return Promise.resolve({ transactionFeePct: 4.0, waiveUntil: null });
          }
          if (where.scope_scopeKey.scope === "BUSINESS" && where.scope_scopeKey.scopeKey === "b-waive") {
            return Promise.resolve({ waiveUntil: new Date(Date.now() + 86400000) });
          }
          return Promise.resolve(null);
        })
      }
    }))
  };
});

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true)
  }))
}));

describe("Fee Config Resolver", () => {
  it("should resolve basic platform fee", async () => {
    const cfg = await resolveFeeConfig({});
    expect(cfg.transactionFeePct).toBe(3.5);
  });

  it("should override with vertical fee", async () => {
    const cfg = await resolveFeeConfig({ vertical: "FINE_DINING" });
    expect(cfg.transactionFeePct).toBe(4.0);
  });

  it("should retain base values while overriding others", async () => {
    const cfg = await resolveFeeConfig({ businessId: "b-waive", vertical: "FINE_DINING" });
    expect(cfg.transactionFeePct).toBe(4.0); // from vertical
    expect(cfg.waiveUntil).not.toBeNull(); // from business
  });
});

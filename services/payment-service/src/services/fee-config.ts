import { PrismaClient } from "@prisma/client-payment";
import { createClient } from "redis";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

export const DEFAULT_CONFIG = {
  transactionFeePct: 3.000,
  minFeeCents: 0,
  maxFeeCents: null,
  bookingFeePerCoverCents: null,
  useBookingFee: false,
  waiveUntil: null,
};

export async function resolveFeeConfig(params: { businessId?: string, vertical?: string }) {
  const { businessId, vertical } = params;
  const cacheKey = `feeCfg:${businessId || "-"}:${vertical || "-"}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }

  const queries = [
    prisma.feeConfig.findUnique({ where: { scope_scopeKey: { scope: "PLATFORM", scopeKey: "*" } } })
  ];
  if (vertical) {
    queries.push(prisma.feeConfig.findUnique({ where: { scope_scopeKey: { scope: "VERTICAL", scopeKey: vertical } } }));
  }
  if (businessId) {
    queries.push(prisma.feeConfig.findUnique({ where: { scope_scopeKey: { scope: "BUSINESS", scopeKey: businessId } } }));
  }

  const results = await Promise.all(queries);
  
  // Results will be [platform, vertical?, business?]
  // Precedence: BUSINESS > VERTICAL > PLATFORM
  let config: any = { ...DEFAULT_CONFIG };
  for (const r of results) {
    if (r) {
      if (r.transactionFeePct != null) config.transactionFeePct = Number(r.transactionFeePct);
      if (r.minFeeCents != null) config.minFeeCents = r.minFeeCents;
      if (r.maxFeeCents != null) config.maxFeeCents = r.maxFeeCents;
      if (r.bookingFeePerCoverCents != null) config.bookingFeePerCoverCents = r.bookingFeePerCoverCents;
      if (r.useBookingFee != null) config.useBookingFee = r.useBookingFee;
      if (r.waiveUntil != null) config.waiveUntil = r.waiveUntil;
    }
  }

  await redis.set(cacheKey, JSON.stringify(config), { EX: 60 });
  return config;
}

export async function ensureLaunchWaiver(businessId: string) {
  const waiveDays = 90; // MONETIZATION_CFG.waiveFeesFirstDays
  await prisma.feeConfig.upsert({
    where: { scope_scopeKey: { scope: "BUSINESS", scopeKey: businessId } },
    create: {
      scope: "BUSINESS",
      scopeKey: businessId,
      transactionFeePct: 0,
      waiveUntil: new Date(Date.now() + waiveDays * 24 * 3600 * 1000),
      reason: "launch_waiver_90d",
    },
    update: {},
  });
}

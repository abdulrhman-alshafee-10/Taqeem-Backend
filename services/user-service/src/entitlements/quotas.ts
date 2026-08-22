import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";
import { getActiveTier } from "./index.js";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

export const QUOTAS: Record<string, Record<string, number | "unlimited">> = {
  menu_ocr_monthly:       { FREE: 2,   BASIC: 10,  PRO: "unlimited", CHAIN: "unlimited" },
  owner_posts_weekly:     { FREE: 3,   BASIC: 5,   PRO: 10,          CHAIN: 20 },
  qna_ai_drafts_monthly:  { FREE: 5,   BASIC: 20,  PRO: 200,         CHAIN: 500 },
  reply_suggestions_hourly: { FREE: 0, BASIC: 5,   PRO: 20,          CHAIN: 40 },
};

export async function resolveQuotaLimit(scope: { businessId?: string, userId?: string }, name: string) {
  const tier = await getActiveTier(scope);
  return QUOTAS[name]?.[tier] ?? 0;
}

export async function consumeQuota(scope: { businessId?: string, userId?: string }, name: string, cost = 1) {
  const period = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth()+1}`;
  const key = `quota:${name}:${scope.businessId ?? scope.userId}:${period}`;
  const limit = await resolveQuotaLimit(scope, name);
  
  if (limit === "unlimited") return true;

  const used = await redis.incrBy(key, cost);
  if (used === cost) {
    await redis.expire(key, 32 * 24 * 3600); // clears after ~month
  }
  
  if (used > (limit as number)) {
    await redis.decrBy(key, cost);
    return false;
  }
  
  return true;
}

export function requireQuota(name: string, scopeExtractor: (req: Request) => { businessId?: string, userId?: string }, cost = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const scope = scopeExtractor(req);
    const ok = await consumeQuota(scope, name, cost);
    if (ok) return next();
    
    return res.status(429).json({
      error: "QUOTA_EXCEEDED",
      quota: name,
      upgradeUrl: "/api/subscriptions/checkout",
    });
  };
}

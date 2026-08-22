import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

export const ENTITLEMENT_TIER_MIN: Record<string, string> = {
  "reply_templates":            "BASIC",
  "inbox":                      "BASIC",
  "weekly_insights":            "PRO",
  "extended_analytics":         "PRO",
  "qna_ai_drafts":              "PRO",
  "verified_pro_badge":         "PRO",
  "multi_location_dashboard":   "CHAIN",
  "sso":                        "CHAIN",
};

const TIER_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, CHAIN: 3 };
const CACHE_TTL = 60; // seconds

export async function getActiveTier(scope: { businessId?: string, groupId?: string, userId?: string }) {
  const key = `ent:${scope.businessId ?? "-"}:${scope.groupId ?? "-"}:${scope.userId ?? "-"}`;
  const cached = await redis.get(key);
  if (cached) return cached;

  const tier = await fetchTierFromDatabase(scope);
  await redis.set(key, tier, { EX: CACHE_TTL });
  return tier;
}

async function fetchTierFromDatabase(scope: { businessId?: string, groupId?: string, userId?: string }): Promise<string> {
  try {
    const res = await fetch(`http://payment-service:3000/api/internal/subscriptions/tier?businessId=${scope.businessId || ""}&userId=${scope.userId || ""}`);
    if (res.ok) {
      const data = await res.json();
      return data.tier || "FREE";
    }
  } catch (e) {
    console.error("Failed to fetch tier from payment service", e);
  }
  return "FREE";
}

export async function hasEntitlement(scope: { businessId?: string, groupId?: string, userId?: string }, name: string) {
  const tier = await getActiveTier(scope);
  const need = ENTITLEMENT_TIER_MIN[name];
  if (!need) return false;
  return TIER_RANK[tier] >= TIER_RANK[need];
}

export function requireEntitlement(name: string, scopeExtractor: (req: Request) => { businessId?: string, groupId?: string, userId?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const scope = scopeExtractor(req);
    const ok = await hasEntitlement(scope, name);
    if (ok) return next();
    
    return res.status(402).json({
      error: "ENTITLEMENT_REQUIRED",
      entitlement: name,
      requiredTier: ENTITLEMENT_TIER_MIN[name],
      upgradeUrl: "/api/subscriptions/checkout",
    });
  };
}

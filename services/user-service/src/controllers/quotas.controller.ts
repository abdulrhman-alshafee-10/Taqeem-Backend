import { Request, Response } from "express";
import { resolveQuotaLimit, QUOTAS } from "../entitlements/quotas.js";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

export async function getOwnerQuotas(req: Request, res: Response) {
  const { id } = req.params; // businessId
  const scope = { businessId: id };

  const period = `${new Date().getUTCFullYear()}-${new Date().getUTCMonth() + 1}`;
  const responseData: Record<string, any> = {};

  for (const quotaName of Object.keys(QUOTAS)) {
    const key = `quota:${quotaName}:${id}:${period}`;
    const usedStr = await redis.get(key);
    const used = usedStr ? parseInt(usedStr, 10) : 0;
    
    const limit = await resolveQuotaLimit(scope, quotaName);
    
    // Default reset at start of next month for basic monthlies
    const nextMonth = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1);
    
    responseData[quotaName] = {
      used,
      limit,
      resetAt: nextMonth.toISOString(),
    };
  }

  res.json(responseData);
}

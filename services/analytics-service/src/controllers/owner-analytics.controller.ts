import { z } from "zod";
import { Request, Response } from "express";
import { query } from "../db/pg.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import axios from "axios";

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
  granularity: z.enum(["day", "hour"]).default("day"),
});

async function assertOwnership(businessId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  try {
    const { data } = await axios.get(
      `http://business-service:4002/api/businesses/${businessId}`,
      { timeout: 3000 }
    );
    return data?.ownerId === userId;
  } catch (e) {
    return false;
  }
}

export async function ownerAnalytics(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Bad query", issues: parsed.error.issues });

  const businessId = req.params.id;
  const ok = await assertOwnership(businessId, ctx.id as string, ctx.isAdmin);
  if (!ok) return res.status(403).json({ error: "Not the owner" });

  const from = parsed.data.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to   = parsed.data.to   ?? new Date().toISOString();

  const view = parsed.data.granularity === "hour"
    ? "analytics_business_hourly"
    : "analytics_business_daily";
  const bucketCol = parsed.data.granularity === "hour" ? "bucket" : "day";

  const timeseries = await query(
    `
    SELECT
      ${bucketCol} AS t,
      SUM(events) FILTER (WHERE event_type = 'business.viewed')   AS views,
      SUM(events) FILTER (WHERE event_type = 'review.created')    AS new_reviews,
      SUM(events) FILTER (WHERE event_type = 'review.replied')    AS replies
    FROM ${view}
    WHERE business_id = $1
      AND ${bucketCol} >= $2::timestamptz
      AND ${bucketCol} <  $3::timestamptz
    GROUP BY ${bucketCol}
    ORDER BY ${bucketCol} ASC
    `,
    [businessId, from, to]
  );

  const totals = await query(
    `
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'business.viewed')  AS total_views,
      COUNT(*) FILTER (WHERE event_type = 'review.created')   AS total_new_reviews,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'business.viewed') AS unique_visitors
    FROM analytics_events
    WHERE business_id = $1
      AND ts >= $2::timestamptz
      AND ts <  $3::timestamptz
    `,
    [businessId, from, to]
  );

  res.json({
    businessId,
    from, to,
    granularity: parsed.data.granularity,
    totals: totals[0],
    timeseries,
  });
}

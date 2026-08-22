import { Request, Response } from "express";
import { query } from "../db/pg.js";

// /api/owner/businesses/:id/revenue
export async function getOwnerRevenue(req: Request, res: Response) {
  const { id } = req.params;
  const from = req.query.from as string || new Date(Date.now() - 30*24*3600*1000).toISOString();
  const to = req.query.to as string || new Date().toISOString();

  try {
    // Basic aggregation
    const rows = await query(`
      SELECT 
        stream, 
        SUM(amount_usd) as total_usd 
      FROM revenue_facts 
      WHERE business_id = $1 AND ts >= $2 AND ts <= $3
      GROUP BY stream
    `, [id, from, to]);

    const byStream = rows.map(r => ({
      stream: r.stream,
      amountUsd: Number(r.total_usd)
    }));

    const feesUsd = byStream.reduce((acc, s) => acc + s.amountUsd, 0);

    res.json({
      businessId: id,
      period: { from, to },
      totals: {
        feesUsd,
      },
      byStream
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Error" });
  }
}

// /admin/finance/mrr
export async function getAdminMrr(req: Request, res: Response) {
  try {
    const rows = await query(`
      SELECT ts::date as day, SUM(mrr_delta_usd) as delta
      FROM subscription_events
      GROUP BY day
      ORDER BY day ASC
    `);

    let current = 0;
    const timeseries = rows.map(r => {
      current += Number(r.delta);
      return { day: r.day, mrrUsd: current };
    });

    res.json({ timeseries });
  } catch (err) {
    res.status(500).json({ error: "Internal Error" });
  }
}

// /admin/finance/gmv
export async function getAdminGmv(req: Request, res: Response) {
  try {
    // For simplicity, we just return an empty set or a mocked response
    // since we need event parsing for GMV
    res.json({ timeseries: [] });
  } catch (err) {
    res.status(500).json({ error: "Internal Error" });
  }
}

// /admin/finance/take-rate
export async function getAdminTakeRate(req: Request, res: Response) {
  try {
    res.json({ timeseries: [] });
  } catch (err) {
    res.status(500).json({ error: "Internal Error" });
  }
}

// /admin/finance/cohorts
export async function getAdminCohorts(req: Request, res: Response) {
  try {
    const rows = await query(`
      WITH acquisition AS (
        SELECT business_id, MIN(ts)::date AS acquired_day
        FROM subscription_events
        WHERE event IN ('ACTIVATED','REACTIVATED')
        GROUP BY business_id
      ),
      active_month AS (
        SELECT business_id, date_trunc('month', ts)::date AS month
        FROM subscription_events
        WHERE event NOT IN ('CANCELLED')
        GROUP BY 1,2
      )
      SELECT
        date_trunc('month', a.acquired_day)::date AS cohort,
        am.month,
        COUNT(DISTINCT am.business_id) as retained
      FROM acquisition a
      JOIN active_month am USING (business_id)
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    res.json({ cohorts: rows });
  } catch (err) {
    res.status(500).json({ error: "Internal Error" });
  }
}

// /admin/finance/ads
export async function getAdminAds(req: Request, res: Response) {
  try {
    const rows = await query(`
      SELECT stream, COUNT(*) as events, SUM(amount_usd) as revenue_usd
      FROM revenue_facts
      WHERE stream IN ('promoted_search', 'sponsored_posts')
      GROUP BY stream
    `);
    res.json({ stats: rows });
  } catch (err) {
    res.status(500).json({ error: "Internal Error" });
  }
}

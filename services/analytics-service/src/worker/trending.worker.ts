import { pool } from "../db/pg.js";
import { redis } from "../redis.js";

const INIT_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_trending_7d
WITH (timescaledb.continuous) AS
SELECT
  business_id,
  time_bucket('1 day', ts) AS day,
  COUNT(*) FILTER (WHERE event_type = 'business.viewed')   AS views,
  COUNT(*) FILTER (WHERE event_type = 'review.created')    AS new_reviews,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'business.viewed') AS unique_visitors
FROM analytics_events
WHERE ts >= now() - INTERVAL '8 days'
GROUP BY business_id, day
WITH NO DATA;
`;

const POLICY_SQL = `
SELECT add_continuous_aggregate_policy('analytics_trending_7d',
  start_offset => INTERVAL '10 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes');
`;

const COMPUTE_SQL = `
  WITH rollup AS (
    SELECT business_id,
           SUM(views)        AS v,
           SUM(new_reviews)  AS r,
           SUM(unique_visitors) AS u
    FROM analytics_trending_7d
    WHERE day >= now() - INTERVAL '7 days'
    GROUP BY business_id
  ),
  stats AS (
    SELECT
      AVG(v)::float AS mv, STDDEV_POP(v)::float AS sv,
      AVG(r)::float AS mr, STDDEV_POP(r)::float AS sr,
      AVG(u)::float AS mu, STDDEV_POP(u)::float AS su
    FROM rollup
  )
  SELECT r.business_id,
         0.6 * ((r.v - s.mv) / NULLIF(s.sv,0))
       + 0.3 * ((r.r - s.mr) / NULLIF(s.sr,0))
       + 0.1 * ((r.u - s.mu) / NULLIF(s.su,0)) AS score,
         r.v AS views, r.r AS new_reviews
  FROM rollup r CROSS JOIN stats s
  ORDER BY score DESC NULLS LAST
  LIMIT 500;
`;

export async function setupTrending() {
  try {
    await pool.query(INIT_SQL);
    try {
      await pool.query(POLICY_SQL);
    } catch (e: any) {
      // Ignore if policy already exists
      if (!e.message.includes("already exists")) {
        console.warn("Failed to add continuous aggregate policy:", e.message);
      }
    }
  } catch (e: any) {
    console.error("Failed to init trending view:", e.message);
  }

  // Run immediately and every 30 mins
  computeTrending().catch(console.error);
  setInterval(() => {
    computeTrending().catch(console.error);
  }, 30 * 60 * 1000);
}

export async function computeTrending() {
  try {
    const rows = await pool.query(COMPUTE_SQL).then(r => r.rows);
    if (!rows.length) return;

    const pipe = redis.multi();
    pipe.del("trending:global");
    for (const row of rows) {
      pipe.zAdd("trending:global", { score: row.score ?? 0, value: row.business_id });
      pipe.hSet(`trending:meta:${row.business_id}`, { views: row.views, newReviews: row.new_reviews });
    }
    pipe.expire("trending:global", 3600);
    await pipe.exec();
    console.log(`Computed trending for ${rows.length} businesses`);
  } catch (e: any) {
    console.error("computeTrending failed:", e.message);
  }
}

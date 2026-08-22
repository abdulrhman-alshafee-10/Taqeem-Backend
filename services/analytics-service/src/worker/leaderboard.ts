import { pool } from "../db/pg.js";
import { redis } from "../redis.js";

const INIT_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS contributions_monthly
WITH (timescaledb.continuous) AS
SELECT
  user_id,
  metadata->>'city' AS city,
  time_bucket('1 day', ts)::date AS day,
  COUNT(*) FILTER (WHERE event_type = 'review.created')         AS reviews,
  COUNT(*) FILTER (WHERE event_type = 'review.helpful_voted')   AS helpful_received,
  COUNT(*) FILTER (WHERE event_type = 'checkin.created')        AS checkins,
  COUNT(*) FILTER (WHERE event_type = 'media.uploaded')         AS photos
FROM analytics_events
WHERE metadata ? 'city'
GROUP BY user_id, metadata->>'city', time_bucket('1 day', ts)::date
WITH NO DATA;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs 
    WHERE proc_name = 'policy_refresh_continuous_aggregate' 
    AND hypertable_name = 'analytics_events'
  ) THEN
    PERFORM add_continuous_aggregate_policy('contributions_monthly',
      start_offset => INTERVAL '45 days',
      end_offset   => INTERVAL '1 day',
      schedule_interval => INTERVAL '30 minutes');
  END IF;
END $$;
`;

const SQL = `
  SELECT user_id,
         SUM(3*reviews + 2*checkins + 1*helpful_received + 1*photos) AS score
  FROM contributions_monthly
  WHERE city = $1 AND day >= date_trunc('month', now())
  GROUP BY user_id
  ORDER BY score DESC
  LIMIT 200;
`;

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export async function refreshLeaderboards(cities: string[]) {
  for (const city of cities) {
    const { rows } = await pool.query(SQL, [city]);
    const key = `leaderboard:city:${city}:${monthKey()}`;
    const pipe = redis.multi();
    pipe.del(key);
    for (const r of rows) {
      pipe.zAdd(key, { score: Number(r.score), value: r.user_id });
    }
    pipe.expire(key, 60 * 60 * 24 * 45); // Keep around for 45 days
    await pipe.exec();
  }
}

export async function setupLeaderboardWorker() {
  try {
    await pool.query(INIT_SQL);
  } catch (err: any) {
    // Ignore if already exists and DO block fails
    console.error("Leaderboard init info:", err.message);
  }

  // Naive cron, every 12 hours
  setInterval(async () => {
    try {
      // In a real app we'd query distinct cities from DB or config
      await refreshLeaderboards(["Cairo", "Dubai", "Riyadh"]); 
    } catch (err) {
      console.error("Leaderboard refresh error:", err);
    }
  }, 12 * 60 * 60 * 1000);
}

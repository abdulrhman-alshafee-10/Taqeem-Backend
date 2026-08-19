CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID        NOT NULL,
  event_type   TEXT        NOT NULL,
  ts           TIMESTAMPTZ NOT NULL,
  user_id      UUID,
  business_id  UUID,
  review_id    UUID,
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, ts)
);

-- Turn it into a hypertable partitioned by day
SELECT create_hypertable(
  'analytics_events',
  'ts',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists       => TRUE
);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_ae_business_ts ON analytics_events (business_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ae_type_ts ON analytics_events (event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ae_user_ts ON analytics_events (user_id, ts DESC);

-- Keep 90 days of raw events
SELECT add_retention_policy('analytics_events', INTERVAL '90 days');

-- Compress chunks older than 7 days
ALTER TABLE analytics_events SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'ts DESC',
  timescaledb.compress_segmentby = 'business_id, event_type'
);
SELECT add_compression_policy('analytics_events', INTERVAL '7 days');

-- Hourly continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_business_hourly
WITH (timescaledb.continuous) AS
SELECT
  business_id,
  event_type,
  time_bucket('1 hour', ts)                 AS bucket,
  COUNT(*)                                  AS events,
  COUNT(DISTINCT user_id)                   AS unique_users
FROM analytics_events
WHERE business_id IS NOT NULL
GROUP BY business_id, event_type, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'analytics_business_hourly',
  start_offset      => INTERVAL '2 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes'
);

-- Daily continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_business_daily
WITH (timescaledb.continuous) AS
SELECT
  business_id,
  event_type,
  time_bucket('1 day', bucket)              AS day,
  SUM(events)                               AS events,
  SUM(unique_users)                         AS approx_unique_users
FROM analytics_business_hourly
GROUP BY business_id, event_type, day
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'analytics_business_daily',
  start_offset      => INTERVAL '30 days',
  end_offset        => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour'
);

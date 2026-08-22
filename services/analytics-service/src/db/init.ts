import { pool } from "./pg.js";

export async function initDb() {
  const client = await pool.connect();
  try {
    // Basic events
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL,
        event_type TEXT NOT NULL,
        user_id UUID,
        business_id UUID,
        review_id UUID,
        metadata JSONB
      );
    `);
    
    try {
      await client.query(`SELECT create_hypertable('analytics_events', 'ts', if_not_exists => TRUE);`);
    } catch(e) {} // May fail if not timescaledb or already hypertable

    // Revenue Facts
    await client.query(`
      CREATE TABLE IF NOT EXISTS revenue_facts (
        id           UUID PRIMARY KEY,
        ts           TIMESTAMPTZ NOT NULL,
        stream       TEXT NOT NULL,
        business_id  UUID,
        user_id      UUID,
        vertical     TEXT,
        city         TEXT,
        currency     TEXT NOT NULL,
        amount_native NUMERIC(14,4) NOT NULL,
        amount_usd    NUMERIC(14,4) NOT NULL,
        meta         JSONB
      );
    `);
    try {
      await client.query(`SELECT create_hypertable('revenue_facts', 'ts', if_not_exists => TRUE);`);
    } catch(e) {}
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rev_stream ON revenue_facts (stream, ts DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rev_biz ON revenue_facts (business_id, ts DESC);`);

    // Subscription events
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_events (
        id             UUID PRIMARY KEY,
        ts             TIMESTAMPTZ NOT NULL,
        subscription_id UUID NOT NULL,
        business_id    UUID,
        user_id        UUID,
        tier           TEXT,
        event          TEXT,
        mrr_delta_usd  NUMERIC(10,2)
      );
    `);
    
  } finally {
    client.release();
  }
}

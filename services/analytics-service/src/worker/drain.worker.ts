import { redis, BUFFER_KEY } from "../redis.js";
import { pool as pg } from "../db/pg.js";

const BATCH_SIZE     = 500;
const DRAIN_INTERVAL = 500;  // ms
const MAX_PER_TICK   = 5;    // up to 2500 events / tick

const INSERT_SQL = `
  INSERT INTO analytics_events
    (id, event_type, ts, user_id, business_id, review_id, metadata)
  VALUES
    ($1::uuid, $2, $3::timestamptz, $4::uuid, $5::uuid, $6::uuid, $7::jsonb)
  ON CONFLICT (id, ts) DO NOTHING;
`;

async function drainOnce() {
  for (let i = 0; i < MAX_PER_TICK; i++) {
    // using lPopCount isn't available in some versions of node-redis, so we fallback to multi lPop if needed
    // LPOP key count is supported in redis 6.2+
    let chunk: string[] = [];
    try {
      chunk = await (redis as any).lPopCount(BUFFER_KEY, BATCH_SIZE);
    } catch {
      // Fallback if lPopCount not working in this typed version
      const multi = redis.multi();
      for (let k = 0; k < BATCH_SIZE; k++) {
        multi.lPop(BUFFER_KEY);
      }
      const results = await multi.exec();
      chunk = results.filter(Boolean) as string[];
    }
    
    if (!chunk || chunk.length === 0) return;

    const client = await pg.connect();
    try {
      await client.query("BEGIN");
      for (const raw of chunk) {
        const e = JSON.parse(raw);
        await client.query(INSERT_SQL, [
          e.id, e.type, e.ts, e.userId, e.businessId, e.reviewId, e.metadata,
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("drain error, requeue", err);
      // Requeue for retry
      await redis.rPush(BUFFER_KEY, chunk);
      return;
    } finally {
      client.release();
    }
  }
}

export function startDrain() {
  setInterval(() => {
    drainOnce().catch(e => console.error("drainOnce failed", e));
  }, DRAIN_INTERVAL);
  console.log("Drain worker started.");
}

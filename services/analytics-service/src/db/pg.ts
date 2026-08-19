import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.TIMESCALE_URL || "postgresql://taqeem:taqeem_pw@timescaledb:5432/taqeem_analytics",
  max: 20,
  idleTimeoutMillis: 30_000,
});

export async function query(sql: string, params?: any[]) {
  const res = await pool.query(sql, params);
  return res.rows;
}

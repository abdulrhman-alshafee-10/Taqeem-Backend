import express, { Request, Response } from "express";
import analyticsRoutes from "./routes/analytics.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import revenueRoutes from "./routes/revenue.routes.js";
import { startConsumers } from "./consumers/index.js";
import { startRevenueConsumers } from "./consumers/revenue.js";
import { initDb } from "./db/init.js";
import { startDrain } from "./worker/drain.worker.js";
import { setupTrending } from "./worker/trending.worker.js";
import { setupLeaderboardWorker } from "./worker/leaderboard.js";
import { redis } from "./redis.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/analytics", analyticsRoutes);
app.use("/api/owner",     analyticsRoutes);   // exposes /api/owner/businesses/:id/analytics
app.use("/api/leaderboards", leaderboardRoutes);
app.use("/api/revenue", revenueRoutes);

const PORT = process.env.PORT || 4005;

async function start() {
  await initDb();
  await redis.connect();
  await startConsumers();
  await startRevenueConsumers();
  startDrain();
  setupTrending();
  setupLeaderboardWorker();

  app.listen(PORT, () => {
    console.log(`analytics-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

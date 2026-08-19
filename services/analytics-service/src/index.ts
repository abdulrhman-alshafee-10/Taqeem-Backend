import express, { Request, Response } from "express";
import analyticsRoutes from "./routes/analytics.routes.js";
import { startConsumers } from "./consumers/index.js";
import { startDrain } from "./worker/drain.worker.js";
import { redis } from "./redis.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/analytics", analyticsRoutes);
app.use("/api/owner",     analyticsRoutes);   // exposes /api/owner/businesses/:id/analytics

const PORT = process.env.PORT || 4005;

async function start() {
  await redis.connect();
  await startConsumers();
  startDrain();

  app.listen(PORT, () => {
    console.log(`analytics-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

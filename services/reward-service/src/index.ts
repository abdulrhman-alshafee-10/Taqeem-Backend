import "@taqeem/shared/tracing/tracing.js";
import express from "express";
import { PrismaClient } from "@prisma/client-reward";
import rewardsRoutes from "./routes/rewards.routes.js";
import { setupEvents } from "./events.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export const app = express();
app.use(express.json());

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "reward-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "reward-service"));

app.use("/api/rewards", rewardsRoutes);

const port = process.env.PORT || 4014;

export async function start() {
  await setupEvents();
  app.listen(port, () => {
    console.log(`Reward service listening on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

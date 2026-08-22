import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import feedRoutes from "./routes/feed.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { startFeedConsumers } from "./events/consumer.js";
import { connectRedis } from "./redis.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export const app = express();
app.use(express.json({ limit: "200kb" }));

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "feed-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "feed-service"));

const healthRouter = createHealthRouter("feed-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/feed", feedRoutes);

const PORT = process.env.PORT || 4013;

export async function start() {
  await initPublisher();
  await connectRedis();
  await startFeedConsumers();

  app.listen(PORT, () => {
    console.log(`feed-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

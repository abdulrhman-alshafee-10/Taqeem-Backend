import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { connectRedis } from "./redis.js";
import { connectMongo } from "./db/mongo.js";
import tipsRoutes from "./routes/tips.routes.js";
import checkinsRoutes from "./routes/checkins.routes.js";
import shortsRoutes from "./routes/shorts.routes.js";
import journalsRoutes from "./routes/journals.routes.js";
import { startContentConsumers } from "./events/consumer.js";
import { startShortTranscoder } from "./workers/short-transcode.worker.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export const app = express();
app.use(express.json({ limit: "200kb" }));

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "content-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "content-service"));

const healthRouter = createHealthRouter("content-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/tips", tipsRoutes);
app.use("/api/checkins", checkinsRoutes);
app.use("/api/shorts", shortsRoutes);
app.use("/api/journals", journalsRoutes);

const PORT = process.env.PORT || 4011;

export async function start() {
  await connectMongo();
  await initPublisher();
  await connectRedis();
  await startContentConsumers();
  await startShortTranscoder();

  app.listen(PORT, () => {
    console.log(`content-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

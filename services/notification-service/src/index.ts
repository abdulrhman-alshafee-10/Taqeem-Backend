import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import { startAlertMatcher } from "./matchers/index.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { connectRedis } from "./redis.js";
import { startConsumers } from "./consumers/index.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import streamRoutes from "./routes/stream.routes.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export const app = express();
app.use(express.json());

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "notification-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "notification-service"));

const healthRouter = createHealthRouter("notification-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/notifications", notificationsRoutes);
app.use("/api/notifications", streamRoutes);

const PORT = process.env.PORT || 4008;

export async function start() {
  await connectRedis();
  await initPublisher();
  await startConsumers();
  await startAlertMatcher();
  app.listen(PORT, () => {
    console.log(`notification-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

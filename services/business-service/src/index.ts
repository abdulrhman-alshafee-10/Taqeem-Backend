import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import businessRoutes from "./routes/business.routes.js";
import ownerRoutes from "./routes/owner.routes.js";
import groupRoutes from "./routes/group.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import postRoutes from "./routes/post.routes.js";
import qaRoutes from "./routes/qa.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import internalRoutes from "./routes/internal.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { initConsumer } from "./events/consumer.js";
import { startPrismaOutboxPoller } from "@taqeem/shared/outbox/prismaPoller.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const app = express();
app.use(express.json({ limit: "200kb" }));

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "business-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "business-service"));

const healthRouter = createHealthRouter("business-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/internal", internalRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/owner",      ownerRoutes);
app.use("/api", groupRoutes);
app.use("/api", menuRoutes);
app.use("/api", postRoutes);
app.use("/api", qaRoutes);
app.use("/api", aiRoutes);
app.use("/api/businesses/:businessId/deals", dealRoutes);

const PORT = process.env.PORT || 4002;

import { startBadgeConsumers } from "./workers/business-badge-awarder.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export async function start() {
  await initPublisher();
  await initConsumer();
  await startBadgeConsumers();
  const outboxPoller = startPrismaOutboxPoller(prisma, "business-service");
  app.listen(PORT, () => {
    console.log(`business-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

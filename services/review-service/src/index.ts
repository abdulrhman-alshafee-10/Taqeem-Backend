import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import path from "node:path";
import { connectMongo } from "./db/mongo.js";
import reviewRoutes from "./routes/review.routes.js";
import mediaRoutes  from "./routes/media.routes.js";
import ownerRoutes  from "./routes/owner.routes.js";
import { getBusinessAggregates } from "./controllers/internal.controller.js";
import { initPublisher } from "./events/publisher.js";
import { startReviewConsumer } from "./events/consumer.js";
import { startAltTextConsumer } from "./workers/alt-text.consumer.js";

export const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "review-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "review-service"));

// Serve the local uploads directory so images/videos can be fetched
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

import { internalRoutes } from "./routes/internal.routes.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

app.use("/api/reviews", reviewRoutes);
app.use("/api/media",   mediaRoutes);
app.use("/api/owner",   ownerRoutes);
app.use("/internal",    internalRoutes);

app.get("/internal/businesses/:businessId/aggregates", getBusinessAggregates as any);

const PORT = process.env.PORT || 4003;

export async function start() {
  await connectMongo();
  await initPublisher();
  await startReviewConsumer();
  await startAltTextConsumer();
  app.listen(PORT, () => console.log(`review-service on :${PORT}`));
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

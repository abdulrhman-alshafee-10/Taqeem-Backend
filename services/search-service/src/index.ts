import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import searchRoutes from "./routes/search.routes.js";
import { startConsumers } from "./consumers/index.js";
import { connectRedis } from "./redis.js";
import { internalRoutes } from "./routes/internal.routes.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export const app = express();
app.use(express.json());

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "search-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "search-service"));


const healthRouter = createHealthRouter("search-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
app.use("/internal", internalRoutes);
app.use("/api/search", searchRoutes);

const PORT = process.env.PORT || 4004;

export async function start() {
  await connectRedis();
  await startConsumers();
  app.listen(PORT, () => {
    console.log(`search-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

const app = express();
app.use(express.json());

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "order-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "order-service"));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

import ordersRouter from "./routes/orders.routes.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";
app.use("/api/orders", ordersRouter);

const PORT = process.env.PORT || 4011;

async function start() {
  await initPublisher();
  app.listen(PORT, () => {
    console.log(`order-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

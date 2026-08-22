
import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

export const app = express();
// Webhook route must be parsed raw, before express.json()
import webhooksRouter from "./routes/webhooks.routes.js";
import adsRouter from "./routes/ads.routes.js";
import affiliatesRouter from "./routes/affiliates.routes.js";

app.use("/webhooks", webhooksRouter);

app.use(express.json());

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "payment-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "payment-service"));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

import paymentsRouter from "./routes/payments.routes.js";
app.use("/api/payments", paymentsRouter);
app.use("/api/ads", adsRouter);
app.use("/api", affiliatesRouter);

const PORT = process.env.PORT || 4009;

export async function start() {
  await initPublisher();
  app.listen(PORT, () => {
    console.log(`payment-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

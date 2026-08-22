import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import reservationRoutes from "./routes/reservation.routes.js";
import waitlistRoutes from "./routes/waitlist.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

export const app = express();
app.use(express.json());

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "reservation-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "reservation-service"));


const healthRouter = createHealthRouter("reservation-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/reservations", reservationRoutes);
app.use("/api/waitlist", waitlistRoutes);

const PORT = process.env.PORT || 4007;

export async function start() {
  await initPublisher();
  
  app.listen(PORT, () => {
    console.log(`reservation-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

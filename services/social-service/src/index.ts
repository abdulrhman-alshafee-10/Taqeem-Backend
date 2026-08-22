import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import listRoutes from "./routes/list.routes.js";
import followRoutes from "./routes/follow.routes.js";
import recRoutes from "./routes/rec.routes.js";
import guideRoutes from "./routes/guide.routes.js";
import meetupRoutes from "./routes/meetup.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { connectRedis } from "./redis.js";

const app = express();
app.use(express.json({ limit: "200kb" }));

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "social-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "social-service"));

const healthRouter = createHealthRouter("social-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/lists", listRoutes);
app.use("/api/social", followRoutes);
app.use("/api/social", recRoutes);
import systemListsRoutes from "./routes/system-lists.routes.js";
app.use("/api/social", systemListsRoutes);
app.use("/api/social", guideRoutes);
app.use("/api/meetups", meetupRoutes);

const PORT = process.env.PORT || 4010;

import { startSocialConsumers } from "./events/consumer.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

async function start() {
  await initPublisher();
  await connectRedis();
  await startSocialConsumers();
  app.listen(PORT, () => {
    console.log(`social-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

import { createHealthRouter } from "@taqeem/shared/health/healthRouter.js";
import { registerGracefulShutdown } from "@taqeem/shared/shutdown/gracefulShutdown.js";
import http from "node:http";
import "@taqeem/shared/tracing/tracing.js";
import express from "express";
import agentRoutes from "./routes/agent.routes.js";
import { initPublisher } from "./events/publisher.js";
import { buildHelpIndex } from "./rag/loader.js";
import path from "node:path";
import { startMediaTagger } from "./workers/media-tagger.js";

import internalRoutes from "./routes/internal.routes.js";

export const app = express();
app.use(express.json({ limit: "200kb" }));

app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "agent-service"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "agent-service"));

const healthRouter = createHealthRouter("agent-service");
app.use(healthRouter);


app.get("/metrics", async (_req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
app.use("/api/agent", agentRoutes);
app.use("/internal", internalRoutes);

import { startAspectScorer } from "./workers/aspect-scorer.js";
import { startAltTextWorker } from "./workers/alt-text.worker.js";
import { startSummaryGenerator } from "./workers/summary-generator.js";
import { startRagIndexer } from "./workers/rag-indexer.js";
import { startFraudDetector } from "./workers/fraud-detector.js";

import { httpLogger } from "@taqeem/shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "@taqeem/shared/metrics/httpMetricsMiddleware.js";
import { register } from "@taqeem/shared/metrics/metrics.js";

const PORT = Number(process.env.PORT || 4006);

export async function startWorkers() {
  await initPublisher();
  await startMediaTagger();
  await startAspectScorer();
  await startAltTextWorker();
  await startSummaryGenerator();
  await startRagIndexer();
  await startFraudDetector();

  if (process.env.INDEX_HELP_DOCS_ON_START === "true") {
    await buildHelpIndex(path.join(process.cwd(), "knowledge"));
  }

  
  const server = http.createServer(app);
  registerGracefulShutdown(server, { drainMs: 5000 });
  server.listen(PORT, () => console.log(`agent-service on :${PORT}`));
}

if (process.env.NODE_ENV !== "test") {
  startWorkers().catch(console.error);
}

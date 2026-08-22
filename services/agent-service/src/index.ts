import express from "express";
import agentRoutes from "./routes/agent.routes.js";
import { initPublisher } from "./events/publisher.js";
import { buildHelpIndex } from "./rag/loader.js";
import path from "node:path";
import { startMediaTagger } from "./workers/media-tagger.js";

import internalRoutes from "./routes/internal.routes.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/agent", agentRoutes);
app.use("/internal", internalRoutes);

import { startAspectScorer } from "./workers/aspect-scorer.js";
import { startAltTextWorker } from "./workers/alt-text.worker.js";
import { startSummaryGenerator } from "./workers/summary-generator.js";
import { startRagIndexer } from "./workers/rag-indexer.js";
import { startFraudDetector } from "./workers/fraud-detector.js";

const PORT = Number(process.env.PORT || 4006);

async function startWorkers() {
  await initPublisher();
  await startMediaTagger();
  await startAspectScorer();
  await startAltTextWorker();
  await startSummaryGenerator();
  await startRagIndexer();
  await startFraudDetector();

  // Idempotent — checks RediSearch index existence before rebuilding
  if (process.env.INDEX_HELP_DOCS_ON_START === "true") {
    await buildHelpIndex(path.join(process.cwd(), "knowledge"));
  }

  app.listen(PORT, () => console.log(`agent-service on :${PORT}`));
}

startWorkers().catch(console.error);

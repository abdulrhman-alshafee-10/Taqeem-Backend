import express from "express";
import agentRoutes from "./routes/agent.routes.js";
import { initPublisher } from "./events/publisher.js";
import { buildHelpIndex } from "./rag/loader.js";
import path from "node:path";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/agent", agentRoutes);

await initPublisher();

// Idempotent — checks RediSearch index existence before rebuilding
if (process.env.INDEX_HELP_DOCS_ON_START === "true") {
  await buildHelpIndex(path.join(process.cwd(), "knowledge"));
}

const PORT = Number(process.env.PORT || 4006);
app.listen(PORT, () => console.log(`agent-service on :${PORT}`));

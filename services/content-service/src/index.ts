import express, { Request, Response } from "express";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { connectRedis } from "./redis.js";
import { connectMongo } from "./db/mongo.js";
import tipsRoutes from "./routes/tips.routes.js";
import checkinsRoutes from "./routes/checkins.routes.js";
import shortsRoutes from "./routes/shorts.routes.js";
import journalsRoutes from "./routes/journals.routes.js";
import { startContentConsumers } from "./events/consumer.js";
import { startShortTranscoder } from "./workers/short-transcode.worker.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/tips", tipsRoutes);
app.use("/api/checkins", checkinsRoutes);
app.use("/api/shorts", shortsRoutes);
app.use("/api/journals", journalsRoutes);

const PORT = process.env.PORT || 4011;

async function start() {
  await connectMongo();
  await initPublisher();
  await connectRedis();
  await startContentConsumers();
  await startShortTranscoder();

  app.listen(PORT, () => {
    console.log(`content-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

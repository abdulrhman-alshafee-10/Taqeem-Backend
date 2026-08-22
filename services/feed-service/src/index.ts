import express, { Request, Response } from "express";
import feedRoutes from "./routes/feed.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { startFeedConsumers } from "./events/consumer.js";
import { connectRedis } from "./redis.js";

export const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/feed", feedRoutes);

const PORT = process.env.PORT || 4013;

export async function start() {
  await initPublisher();
  await connectRedis();
  await startFeedConsumers();

  app.listen(PORT, () => {
    console.log(`feed-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

import express, { Request, Response } from "express";
import { startAlertMatcher } from "./matchers/index.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { connectRedis } from "./redis.js";
import { startConsumers } from "./consumers/index.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import streamRoutes from "./routes/stream.routes.js";

const app = express();
app.use(express.json());
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/notifications", notificationsRoutes);
app.use("/api/notifications", streamRoutes);

const PORT = process.env.PORT || 4008;

async function start() {
  await connectRedis();
  await initPublisher();
  await startConsumers();
  await startAlertMatcher();
  app.listen(PORT, () => {
    console.log(`notification-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

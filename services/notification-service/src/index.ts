import express, { Request, Response } from "express";
import { startAlertMatcher } from "./matchers/index.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

const app = express();
app.use(express.json());
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

const PORT = process.env.PORT || 4007;

async function start() {
  await initPublisher();
  await startAlertMatcher();
  app.listen(PORT, () => {
    console.log(`notification-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

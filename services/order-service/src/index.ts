import express, { Request, Response } from "express";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

const app = express();
app.use(express.json());
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

import ordersRouter from "./routes/orders.routes.js";
app.use("/api/orders", ordersRouter);

const PORT = process.env.PORT || 4011;

async function start() {
  await initPublisher();
  app.listen(PORT, () => {
    console.log(`order-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

import express, { Request, Response } from "express";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

const app = express();
// Webhook route must be parsed raw, before express.json()
import webhooksRouter from "./routes/webhooks.routes.js";
app.use("/webhooks", webhooksRouter);

app.use(express.json());
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

import paymentsRouter from "./routes/payments.routes.js";
app.use("/api/payments", paymentsRouter);

const PORT = process.env.PORT || 4009;

async function start() {
  await initPublisher();
  app.listen(PORT, () => {
    console.log(`payment-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

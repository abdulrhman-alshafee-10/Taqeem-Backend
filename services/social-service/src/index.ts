import express, { Request, Response } from "express";
import listRoutes from "./routes/list.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/lists", listRoutes);

const PORT = process.env.PORT || 4006;

async function start() {
  await initPublisher();
  app.listen(PORT, () => {
    console.log(`social-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

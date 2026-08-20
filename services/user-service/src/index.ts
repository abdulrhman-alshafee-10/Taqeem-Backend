import express, { Request, Response, NextFunction } from "express";
import userRoutes from "./routes/user.routes.js";
import { initPublisher } from "./events/publisher.js";
import { startReputationConsumer } from "./workers/reputation.consumer.js";

const app = express();
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });
app.use("/api/users", userRoutes);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal error" });
});

const PORT = process.env.PORT || 4001;
initPublisher().then(async () => {
  await startReputationConsumer();
  app.listen(PORT, () => console.log(`user-service on :${PORT}`));
});

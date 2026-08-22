import express, { Request, Response, NextFunction } from "express";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import gamificationRoutes from "./routes/gamification.routes.js";
import quotasRoutes from "./routes/quotas.routes.js";
import { setupSwagger } from "@taqeem/shared/swagger/index.js";
import { startBadgeAwarder } from "./workers/badge-awarder.js";
import { startStreakUpdater } from "./workers/streak-updater.js";
import { initPublisher } from "./events/publisher.js";
import { startReputationConsumer } from "./workers/reputation.consumer.js";

export const app = express();
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api", quotasRoutes);

setupSwagger(app, "User Service", "1.0.0");

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal error" });
});

const PORT = process.env.PORT || 4001;

export async function start() {
  await initPublisher();
  await startReputationConsumer();
  await startBadgeAwarder();
  await startStreakUpdater();
  app.listen(PORT, () => console.log(`user-service on :${PORT}`));
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

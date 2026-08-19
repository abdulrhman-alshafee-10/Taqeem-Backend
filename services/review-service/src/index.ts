import express, { Request, Response } from "express";
import path from "node:path";
import { connectMongo } from "./db/mongo.js";
import reviewRoutes from "./routes/review.routes.js";
import mediaRoutes  from "./routes/media.routes.js";
import ownerRoutes  from "./routes/owner.routes.js";
import { getBusinessAggregates } from "./controllers/internal.controller.js";
import { initPublisher } from "./events/publisher.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Serve the local uploads directory so images/videos can be fetched
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/reviews", reviewRoutes);
app.use("/api/media",   mediaRoutes);
app.use("/api/owner",   ownerRoutes);

app.get("/internal/businesses/:businessId/aggregates", getBusinessAggregates as any);

const PORT = process.env.PORT || 4003;

async function start() {
  await connectMongo();
  await initPublisher();
  app.listen(PORT, () => console.log(`review-service on :${PORT}`));
}

start().catch(console.error);

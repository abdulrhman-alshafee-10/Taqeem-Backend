import express, { Request, Response } from "express";
import businessRoutes from "./routes/business.routes.js";
import ownerRoutes from "./routes/owner.routes.js";
import groupRoutes from "./routes/group.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import postRoutes from "./routes/post.routes.js";
import qaRoutes from "./routes/qa.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import internalRoutes from "./routes/internal.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { initConsumer } from "./events/consumer.js";

export const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/internal", internalRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/owner",      ownerRoutes);
app.use("/api", groupRoutes);
app.use("/api", menuRoutes);
app.use("/api", postRoutes);
app.use("/api", qaRoutes);
app.use("/api", aiRoutes);
app.use("/api/businesses/:businessId/deals", dealRoutes);

const PORT = process.env.PORT || 4002;

export async function start() {
  await initPublisher();
  await initConsumer();
  app.listen(PORT, () => {
    console.log(`business-service listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

import express, { Request, Response } from "express";
import listRoutes from "./routes/list.routes.js";
import followRoutes from "./routes/follow.routes.js";
import recRoutes from "./routes/rec.routes.js";
import guideRoutes from "./routes/guide.routes.js";
import meetupRoutes from "./routes/meetup.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";
import { connectRedis } from "./redis.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/lists", listRoutes);
app.use("/api/social", followRoutes);
app.use("/api/social", recRoutes);
app.use("/api/social", guideRoutes);
app.use("/api/meetups", meetupRoutes);

const PORT = process.env.PORT || 4010;

async function start() {
  await initPublisher();
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`social-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

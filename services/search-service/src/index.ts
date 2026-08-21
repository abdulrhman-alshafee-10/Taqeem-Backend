import express, { Request, Response } from "express";
import searchRoutes from "./routes/search.routes.js";
import { startConsumers } from "./consumers/index.js";
import { connectRedis } from "./redis.js";

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });
app.use("/api/search", searchRoutes);

const PORT = process.env.PORT || 4004;

async function start() {
  await connectRedis();
  await startConsumers();
  app.listen(PORT, () => {
    console.log(`search-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

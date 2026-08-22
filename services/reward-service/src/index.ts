import express from "express";
import { PrismaClient } from "@prisma/client-reward";
import rewardsRoutes from "./routes/rewards.routes.js";
import { setupEvents } from "./events.js";

export const app = express();
app.use(express.json());

app.use("/api/rewards", rewardsRoutes);

const port = process.env.PORT || 4014;

export async function start() {
  await setupEvents();
  app.listen(port, () => {
    console.log(`Reward service listening on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(console.error);
}

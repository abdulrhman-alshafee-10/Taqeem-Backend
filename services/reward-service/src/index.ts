import express from "express";
import { PrismaClient } from "@prisma/client-reward";
import rewardsRoutes from "./routes/rewards.routes.js";
import { setupEvents } from "./events.js";

const app = express();
app.use(express.json());

app.use("/api/rewards", rewardsRoutes);

const port = process.env.PORT || 4014;
app.listen(port, async () => {
  console.log(`Reward service listening on port ${port}`);
  await setupEvents();
});

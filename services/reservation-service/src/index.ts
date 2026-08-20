import express, { Request, Response } from "express";
import reservationRoutes from "./routes/reservation.routes.js";
import waitlistRoutes from "./routes/waitlist.routes.js";
import { initPublisher } from "@taqeem/shared/events/publisher.js";

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

app.use("/api/reservations", reservationRoutes);
app.use("/api/waitlist", waitlistRoutes);

const PORT = process.env.PORT || 4007;

async function start() {
  await initPublisher();
  
  app.listen(PORT, () => {
    console.log(`reservation-service listening on port ${PORT}`);
  });
}

start().catch(console.error);

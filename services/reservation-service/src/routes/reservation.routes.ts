import { Router } from "express";
import { getAvailability, createReservation } from "../controllers/reservation.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.get("/availability/:businessId", getAvailability);
r.post("/", requireAuth as any, createReservation);

export default r;

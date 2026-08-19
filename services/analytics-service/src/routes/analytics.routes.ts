import { Router } from "express";
import { ingest } from "../controllers/ingest.controller.js";
import { ownerAnalytics } from "../controllers/owner-analytics.controller.js";
import { requireAuth, requireRole } from "@taqeem/shared/auth/context.js";

const r = Router();

// Public ingest — anonymous events allowed for pageview tracking
r.post("/events", ingest);

// Owner analytics — restricted
r.get("/businesses/:id/analytics",
  requireAuth as any,
  requireRole("OWNER", "ADMIN") as any,
  ownerAnalytics
);

export default r;

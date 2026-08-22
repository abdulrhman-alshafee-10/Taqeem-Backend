import { Router } from "express";
import { myBusinesses, updateMyBusiness } from "../controllers/owner.controller.js";
import { requireBusinessOwner } from "../middleware/ownership.js";
import { validate, PatchBusinessSchema } from "../middleware/validate.js";
import { requireAuth, requireRole } from "@taqeem/shared/auth/context.js";

const r = Router();

r.use(requireAuth as any, requireRole("OWNER", "ADMIN") as any);

import { toggleReservations } from "../controllers/business.controller.js";

r.get("/businesses",                              myBusinesses);
r.put("/businesses/:businessId",                  requireBusinessOwner as any, validate(PatchBusinessSchema), updateMyBusiness);
r.patch("/businesses/:id/reservations/toggle",    requireBusinessOwner as any, toggleReservations);

import { updateAccessibility } from "../controllers/accessibility.controller.js";
r.patch("/businesses/:id/accessibility",          requireBusinessOwner as any, updateAccessibility);

// The following two routes are proxied at the Gateway to Review Service —
// they are documented here only for surface completeness.
// POST /api/owner/reviews/:reviewId/reply   → review-service
// GET  /api/owner/businesses/:businessId/reviews → review-service

export default r;

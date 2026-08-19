import { Router } from "express";
import { myBusinesses, updateMyBusiness } from "../controllers/owner.controller.js";
import { requireBusinessOwner } from "../middleware/ownership.js";
import { validate, PatchBusinessSchema } from "../middleware/validate.js";
import { requireAuth, requireRole } from "@taqeem/shared/auth/context.js";

const r = Router();

r.use(requireAuth as any, requireRole("OWNER", "ADMIN") as any);

r.get("/businesses",                              myBusinesses);
r.put("/businesses/:businessId",                  requireBusinessOwner as any, validate(PatchBusinessSchema), updateMyBusiness);

// The following two routes are proxied at the Gateway to Review Service —
// they are documented here only for surface completeness.
// POST /api/owner/reviews/:reviewId/reply   → review-service
// GET  /api/owner/businesses/:businessId/reviews → review-service

export default r;

import { Router, Request, Response, NextFunction } from "express";
import { list, getById, create, patch, claim, getSummary, askBusiness, confirmHalal, toggleReservations } from "../controllers/business.controller.js";
import { requireBusinessOwner } from "../middleware/ownership.js";
import { validate, CreateBusinessSchema, PatchBusinessSchema, ClaimSchema, ListQuerySchema } from "../middleware/validate.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.get   ("/",              (req: Request, _res: Response, next: NextFunction) => { req.query = ListQuerySchema.parse(req.query) as any; next(); }, list);
r.get   ("/:id",           getById);
r.get   ("/:id/summary",   getSummary);
r.post  ("/:id/ask",       askBusiness);
r.post  ("/",              requireAuth as any, validate(CreateBusinessSchema), create);
r.patch ("/:id",           requireAuth as any, requireBusinessOwner as any, validate(PatchBusinessSchema), patch);
r.post  ("/:id/claim",     requireAuth as any, validate(ClaimSchema), claim);
r.post  ("/:id/halal/confirm", requireAuth as any, confirmHalal);
r.patch ("/:id/reservations", requireAuth as any, toggleReservations);

import { getAccessibility, confirmAccessibility } from "../controllers/accessibility.controller.js";
r.get   ("/:id/accessibility", getAccessibility);
r.post  ("/:id/accessibility/confirm", requireAuth as any, confirmAccessibility);

export default r;

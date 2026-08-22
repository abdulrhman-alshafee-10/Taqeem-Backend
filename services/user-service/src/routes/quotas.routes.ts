import { Router } from "express";
import { getOwnerQuotas } from "../controllers/quotas.controller.js";
import { authenticate } from "@taqeem/shared/middleware/auth.js";

const router = Router();

// /api/owner/businesses/:id/quotas
router.get("/owner/businesses/:id/quotas", authenticate, getOwnerQuotas);

export default router;

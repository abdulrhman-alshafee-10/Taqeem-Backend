import { Router } from "express";
import { getOwnerRevenue, getAdminMrr, getAdminGmv, getAdminTakeRate, getAdminCohorts, getAdminAds } from "../controllers/revenue.controller.js";

const router = Router();

router.get("/api/owner/businesses/:id/revenue", getOwnerRevenue);
router.get("/admin/finance/mrr", getAdminMrr);
router.get("/admin/finance/gmv", getAdminGmv);
router.get("/admin/finance/take-rate", getAdminTakeRate);
router.get("/admin/finance/cohorts", getAdminCohorts);
router.get("/admin/finance/ads", getAdminAds);

export default router;

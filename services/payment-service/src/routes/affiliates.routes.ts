import { Router } from "express";
import { onAffiliateSettlement, recordAffiliateClick } from "../controllers/affiliates.controller.js";

const router = Router();

// Endpoint for users clicking external affiliate links
router.post("/affiliates/click", recordAffiliateClick);

// Webhook endpoint for partners to send settlement reports
router.post("/webhooks/affiliates/:partner", onAffiliateSettlement);

export default router;

import { Router } from "express";
import { getInsights, getReplySuggestions } from "../controllers/ai.controller.js";
import { requireBusinessPermission } from "../middleware/permissions.js";

const router = Router();

router.get("/owner/businesses/:id/insights", requireBusinessPermission("viewAnalytics"), getInsights);
router.post("/owner/reviews/:reviewId/reply-suggestions", getReplySuggestions); // Will check permission manually or rely on businessId in body

export default router;

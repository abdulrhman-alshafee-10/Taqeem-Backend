import express from "express";
import { getPreferences, putPreferences } from "../controllers/preferences.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const router = express.Router();

router.use(requireAuth);

router.get("/preferences", getPreferences);
router.put("/preferences", putPreferences);

export default router;

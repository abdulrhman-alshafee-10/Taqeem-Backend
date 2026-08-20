import { Router } from "express";
import { applyForGuide, getGuideProfile } from "../controllers/guide.controller.js";

const router = Router();

router.post("/guides/apply", applyForGuide);
router.get("/guides/:userId", getGuideProfile);

export default router;

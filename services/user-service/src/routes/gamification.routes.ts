import { Router } from "express";
import { getMyBadges, getMyStreaks, getCatalogue } from "../controllers/gamification.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.get("/me/badges", requireAuth as any, getMyBadges);
r.get("/me/streaks", requireAuth as any, getMyStreaks);
r.get("/badges", getCatalogue);

export default r;

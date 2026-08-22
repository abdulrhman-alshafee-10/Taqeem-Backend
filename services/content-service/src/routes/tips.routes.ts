import { Router } from "express";
import { createTip, listTips, voteTip } from "../controllers/tips.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/", requireAuth as any, createTip);
r.get("/business/:id", listTips);
r.post("/:id/helpful", requireAuth as any, voteTip);

export default r;

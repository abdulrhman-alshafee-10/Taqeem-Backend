import { Router } from "express";
import { presign, mediaCallback } from "../controllers/media.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();
r.post("/presign", requireAuth as any, presign);
r.post("/callback", requireAuth as any, mediaCallback);
export default r;

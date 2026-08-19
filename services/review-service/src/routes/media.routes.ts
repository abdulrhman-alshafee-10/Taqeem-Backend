import { Router } from "express";
import { upload, uploadMedia } from "../controllers/media.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();
r.post("/upload", requireAuth as any, upload.single("file"), uploadMedia);
export default r;

import { Router } from "express";
import { createCheckin, listCheckins } from "../controllers/checkins.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/", requireAuth as any, createCheckin);
r.get("/business/:id", listCheckins);

export default r;

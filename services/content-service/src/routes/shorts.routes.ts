import { Router } from "express";
import { createShort, listShorts } from "../controllers/shorts.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/", requireAuth as any, createShort);
r.get("/business/:id", listShorts);

export default r;

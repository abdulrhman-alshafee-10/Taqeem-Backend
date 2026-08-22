import { Router } from "express";
import { requireAuth } from "@taqeem/shared/auth/context.js";
import { redeem, verify, consume } from "../controllers/rewards.controller.js";

const r = Router();

r.post("/redeem", requireAuth as any, redeem);
r.post("/owner/vouchers/verify", requireAuth as any, verify);
r.post("/owner/vouchers/consume", requireAuth as any, consume);

export default r;

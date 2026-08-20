import { Router } from "express";
import { joinWaitlist, dropWaitlist } from "../controllers/waitlist.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/", requireAuth as any, joinWaitlist);
r.delete("/:id", requireAuth as any, dropWaitlist);

export default r;

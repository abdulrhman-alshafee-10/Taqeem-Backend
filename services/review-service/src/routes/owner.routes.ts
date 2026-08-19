import { Router } from "express";
import { reply, listBusinessReviews } from "../controllers/owner.controller.js";
import { validate, ReplySchema } from "../middleware/validate.js";
import { requireAuth, requireRole } from "@taqeem/shared/auth/context.js";

const r = Router();
r.use(requireAuth as any, requireRole("OWNER", "ADMIN") as any);

r.post("/reviews/:reviewId/reply",           validate(ReplySchema), reply);
r.get ("/businesses/:businessId/reviews",    listBusinessReviews);
export default r;

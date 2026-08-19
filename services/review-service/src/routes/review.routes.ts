import { Router } from "express";
import { listByBusiness, create, update, remove } from "../controllers/review.controller.js";
import { validate, CreateReviewSchema, UpdateReviewSchema } from "../middleware/validate.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();
r.get   ("/business/:businessId",        listByBusiness);
r.post  ("/business/:businessId",        requireAuth as any, validate(CreateReviewSchema), create);
r.put   ("/:reviewId",                   requireAuth as any, validate(UpdateReviewSchema), update);
r.delete("/:reviewId",                   requireAuth as any, remove);
export default r;

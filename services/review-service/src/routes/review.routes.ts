import { Router } from "express";
import { listByBusiness, create, update, remove, updateFacts, vote, translate, postThreadMessage } from "../controllers/review.controller.js";
import { validate, CreateReviewSchema, UpdateReviewSchema } from "../middleware/validate.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();
r.get   ("/business/:businessId",        listByBusiness);
r.post  ("/business/:businessId",        requireAuth as any, validate(CreateReviewSchema), create);
r.put   ("/:reviewId",                   requireAuth as any, validate(UpdateReviewSchema), update);
r.patch ("/:reviewId/facts",             requireAuth as any, updateFacts);
r.post  ("/:reviewId/vote",              requireAuth as any, vote);
r.get   ("/:reviewId/translation",       translate);
r.post  ("/:reviewId/thread",            requireAuth as any, postThreadMessage);
r.delete("/:reviewId",                   requireAuth as any, remove);
export default r;

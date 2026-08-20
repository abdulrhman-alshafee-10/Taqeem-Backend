import { Router } from "express";
import { generateReplySuggestions } from "../controllers/reply.controller.js";

const router = Router();

router.post("/reviews/:reviewId/reply-suggestions", generateReplySuggestions);

export default router;

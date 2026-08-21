import { Router } from "express";
import { generateReplySuggestions } from "../controllers/reply.controller.js";
import { parseSearch, askBusiness } from "../controllers/search.controller.js";
import { parseMenuOcr } from "../controllers/ocr.controller.js";

const router = Router();

router.post("/reviews/:reviewId/reply-suggestions", generateReplySuggestions);
router.post("/parse-search", parseSearch);
router.post("/rag/ask", askBusiness);
router.post("/ocr/menu", parseMenuOcr);

export default router;

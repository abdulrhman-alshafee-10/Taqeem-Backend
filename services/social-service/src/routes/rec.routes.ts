import { Router } from "express";
import { sendRec, getInbox } from "../controllers/rec.controller.js";

const router = Router();

router.post("/recs", sendRec);
router.get("/recs/inbox", getInbox);

export default router;

import { Router } from "express";
import { recordClick } from "../controllers/ads.controller.js";

const router = Router();

// Used when a user clicks on an ad on the client side
router.post("/click", recordClick);

export default router;

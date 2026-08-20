import express from "express";
import { handleStripeWebhook } from "../controllers/webhooks.controller.js";

const router = express.Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook as any
);

export default router;

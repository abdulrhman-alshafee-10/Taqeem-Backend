import express from "express";
import { createOrder, getOrder, checkoutOrder, webhookHandler } from "../controllers/orders.controller.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/:id", getOrder);
router.post("/:id/checkout", checkoutOrder);
router.post("/webhook", webhookHandler);

export default router;

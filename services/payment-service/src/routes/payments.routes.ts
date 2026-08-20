import express from "express";
import { createIntent, getPayment } from "../controllers/payments.controller.js";
import { subscriptionCheckout, customerPortal } from "../controllers/subscriptions.controller.js";
import { purchaseGiftCard, redeemGiftCard } from "../controllers/gift-cards.controller.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";

const router = express.Router();

router.post("/intents", idempotencyMiddleware, createIntent);
router.get("/:id", getPayment);

router.post("/subscriptions/checkout", subscriptionCheckout);
router.post("/subscriptions/portal", customerPortal);

router.post("/gift-cards/purchase", idempotencyMiddleware, purchaseGiftCard);
router.post("/gift-cards/redeem", redeemGiftCard);

export default router;

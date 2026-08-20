import { Request, Response } from "express";
import { stripe } from "../services/stripe.js";
import { PrismaClient } from "@prisma/client-payment";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { recordLedger } from "../services/ledger.js";
import { createClient } from "redis";
import crypto from "crypto";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.header("stripe-signature");
  if (!sig) return res.status(400).send("No signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const seenKey = `stripe:evt:${event.id}`;
  const first = await redis.set(seenKey, "1", { NX: true, EX: 60 * 60 * 24 });
  if (!first) return res.status(200).send("dup");

  try {
    await route(event);
    res.status(200).send("ok");
  } catch (err: any) {
    await redis.del(seenKey);
    console.error("Webhook handler failed", err);
    res.status(500).send("retry");
  }
}

async function route(event: any) {
  switch (event.type) {
    case "payment_intent.succeeded": return onPISucceeded(event.data.object);
    case "payment_intent.payment_failed": return onPIFailed(event.data.object);
    case "charge.refunded": return onChargeRefunded(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": return onSubscriptionChanged(event.data.object);
    default: return;
  }
}

async function onPISucceeded(pi: any) {
  const payment = await prisma.payment.findFirst({ where: { providerRef: pi.id } });
  if (!payment) return;
  if (payment.status === "SUCCEEDED") return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    await recordLedger(tx, payment, "SUCCEEDED");
  });

  await publishEvent("payment.succeeded", {
    id: crypto.randomUUID(),
    paymentId: payment.id,
    entity: payment.entity,
    entityId: payment.entityId,
    amount: payment.amount,
    currency: payment.currency,
    userId: payment.userId,
  });

  if (payment.purpose === "GIFT_CARD_PURCHASE") {
    await afterGiftCardPurchase(payment.entityId);
  }
}

async function onPIFailed(pi: any) {
  const payment = await prisma.payment.findFirst({ where: { providerRef: pi.id } });
  if (!payment) return;
  
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  await publishEvent("payment.failed", {
    id: crypto.randomUUID(),
    paymentId: payment.id,
    entity: payment.entity,
    entityId: payment.entityId,
    reason: pi.last_payment_error?.message || "Unknown error",
  });
}

async function onChargeRefunded(charge: any) {
  // Handled actively in the refund endpoint, but we can capture it here if we want to be safe.
}

async function onSubscriptionChanged(sub: any) {
  const subscription = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (!subscription) return;

  const statusMap: Record<string, string> = {
    "active": "ACTIVE",
    "past_due": "PAST_DUE",
    "canceled": "CANCELLED",
    "unpaid": "PAST_DUE",
  };

  const newStatus = statusMap[sub.status] || "ACTIVE";
  
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { 
      status: newStatus,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null
    }
  });

  await publishEvent(`subscription.${newStatus.toLowerCase()}`, {
    id: crypto.randomUUID(),
    subscriptionId: subscription.id,
    userId: subscription.userId,
    plan: subscription.plan,
    businessId: subscription.businessId,
  });
}

async function afterGiftCardPurchase(giftCardId: string) {
  const gc = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  if (!gc || !gc.code) return;

  await publishEvent("gift_card.purchased", {
    id: crypto.randomUUID(),
    giftCardId: gc.id,
    buyerUserId: gc.buyerUserId,
    recipientEmail: gc.recipientEmail,
    amount: gc.amountInitial,
    currency: gc.currency,
    plaintextCode: gc.code,
  });

  await prisma.giftCard.update({ where: { id: gc.id }, data: { code: null } });
}

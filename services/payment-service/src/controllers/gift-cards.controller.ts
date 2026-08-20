import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client-payment";
import { stripe } from "../services/stripe.js";
import { withIdempotency } from "../middleware/idempotency.js";
import crypto from "crypto";
import { publishEvent } from "@taqeem/shared/events/publisher.js";

const prisma = new PrismaClient();

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}`;
}

function sha256(str: string) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

export async function purchaseGiftCard(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const key = req.header("Idempotency-Key") as string;
  const { amount, currency = "EGP", recipientEmail, message, businessScoped } = req.body;

  const { status, body } = await withIdempotency(key, async () => {
    const rawCode = generateCode();
    const codeHash = sha256(rawCode);

    const gc = await prisma.giftCard.create({
      data: {
        code: rawCode,
        codeHash,
        buyerUserId: userId,
        recipientEmail,
        message,
        amountInitial: amount,
        amountRemaining: amount,
        currency,
        businessScoped: businessScoped ?? null,
      },
    });

    const pi = await stripe.paymentIntents.create(
      {
        amount: Math.round(Number(amount) * 100),
        currency: currency.toLowerCase(),
        metadata: { giftCardId: gc.id },
      },
      { idempotencyKey: `gc-${gc.id}` }
    );

    await prisma.payment.create({
      data: {
        userId,
        purpose: "GIFT_CARD_PURCHASE",
        entity: "gift_card",
        entityId: gc.id,
        amount,
        currency,
        provider: "STRIPE",
        providerRef: pi.id,
        idempotencyKey: key,
      },
    });

    return { status: 201, body: { giftCardId: gc.id, clientSecret: pi.client_secret } };
  });

  res.status(status).json(body);
}

export async function redeemGiftCard(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const code = req.body.code?.trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Code required" });
  const codeHash = sha256(code);

  const gc = await prisma.giftCard.findUnique({ where: { codeHash } });
  if (!gc) return res.status(404).json({ error: "Invalid code" });
  if (gc.status === "REDEEMED" || Number(gc.amountRemaining) <= 0)
    return res.status(409).json({ error: "Already fully redeemed" });
  if (gc.expiresAt && gc.expiresAt < new Date())
    return res.status(410).json({ error: "Expired" });

  await prisma.giftCard.update({
    where: { id: gc.id },
    data: {
      metadata: { ...(gc.metadata as object || {}), redeemerUserIds: [...((gc.metadata as any)?.redeemerUserIds ?? []), userId] },
    },
  });

  await publishEvent("gift_card.redeemed", {
    id: crypto.randomUUID(),
    giftCardId: gc.id,
    redeemerUserId: userId,
  });

  res.json({ giftCardId: gc.id, amountRemaining: gc.amountRemaining });
}

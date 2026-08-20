import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client-payment";
import { stripe } from "../services/stripe.js";
import { withIdempotency } from "../middleware/idempotency.js";

const prisma = new PrismaClient();

export async function createIntent(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const key = req.header("Idempotency-Key") as string;
  const { purpose, entity, entityId, amount, currency = "EGP", metadata = {} } = req.body;

  const { status, body } = await withIdempotency(key, async () => {
    const payment = await prisma.payment.create({
      data: {
        userId,
        businessId: metadata.businessId ?? null,
        purpose,
        entity,
        entityId,
        amount,
        currency,
        provider: "STRIPE",
        idempotencyKey: key,
        metadata,
      },
    });

    const pi = await stripe.paymentIntents.create(
      {
        amount: toStripeAmount(amount, currency),
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: { paymentId: payment.id, entity, entityId, userId },
      },
      { idempotencyKey: `pay-${payment.id}` }
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: pi.id },
    });

    return {
      status: 201,
      body: {
        paymentId: payment.id,
        clientSecret: pi.client_secret,
        amount,
        currency,
      },
    };
  });

  res.status(status).json(body);
}

export async function getPayment(req: Request, res: Response) {
  const userId = req.headers["x-user-id"] as string;
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { ledger: true, refunds: true },
  });

  if (!payment) return res.status(404).json({ error: "Payment not found" });
  if (payment.userId !== userId) return res.status(403).json({ error: "Forbidden" });

  res.json(payment);
}

function toStripeAmount(decimal: number, currency: string) {
  const zeroDec = new Set(["JPY","KRW","VND","BIF","CLP"]);
  const n = Number(decimal);
  return zeroDec.has(currency.toUpperCase()) ? Math.round(n) : Math.round(n * 100);
}

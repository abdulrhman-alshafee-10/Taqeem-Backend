import { Prisma } from "@prisma/client-payment";

const PLATFORM_FEE_RATE = 0.03;

export async function recordLedger(tx: Prisma.TransactionClient, payment: any, event: string) {
  if (event !== "SUCCEEDED") return;

  const amount = Number(payment.amount);
  const fee = round2(amount * PLATFORM_FEE_RATE);
  const business = amount - fee;

  const memoTag = `${payment.entity}:${payment.entityId}`;

  // Cash side
  await tx.ledgerEntry.createMany({
    data: [
      { paymentId: payment.id, account: "stripe:cash", side: "DEBIT", amount, currency: payment.currency, memo: memoTag },
      { paymentId: payment.id, account: `user:${payment.userId}`, side: "CREDIT", amount, currency: payment.currency, memo: `paid ${memoTag}` },
    ]
  });

  // Attribution side
  if (payment.businessId) {
    await tx.ledgerEntry.createMany({
      data: [
        { paymentId: payment.id, account: `user:${payment.userId}`, side: "DEBIT", amount: amount, currency: payment.currency, memo: memoTag },
        { paymentId: payment.id, account: `business:${payment.businessId}`, side: "CREDIT", amount: business, currency: payment.currency, memo: `payout ${memoTag}` },
        { paymentId: payment.id, account: "platform:fees", side: "CREDIT", amount: fee, currency: payment.currency, memo: `fee ${memoTag}` },
      ]
    });
  } else if (payment.purpose === "GIFT_CARD_PURCHASE") {
    await tx.ledgerEntry.createMany({
      data: [
        { paymentId: payment.id, account: `user:${payment.userId}`, side: "DEBIT", amount: amount, currency: payment.currency, memo: memoTag },
        { paymentId: payment.id, account: `giftcard_float:${payment.entityId}`, side: "CREDIT", amount: amount, currency: payment.currency, memo: `float ${memoTag}` },
      ]
    });
  }
}

export function round2(n: number) { 
  return Math.round(n * 100) / 100; 
}

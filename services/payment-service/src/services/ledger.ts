import { Prisma } from "@prisma/client-payment";
import { resolveFeeConfig } from "./fee-config.js";

const RAILS_MARKUP: any = {
  "FAWRY": { markupBps: 50 },
  "INSTAPAY": { markupBps: 50 },
  "VODAFONE_CASH": { markupBps: 100 }
};

export async function recordLedger(tx: Prisma.TransactionClient, payment: any, event: string) {
  if (event !== "SUCCEEDED") return;

  const amount = Number(payment.amount);
  const meta: any = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : (payment.metadata || {});
  const cfg = await resolveFeeConfig({ businessId: payment.businessId, vertical: meta?.vertical });

  const isWaived = cfg.waiveUntil && new Date(cfg.waiveUntil) > new Date();
  let fee = isWaived ? 0 : round2(amount * (Number(cfg.transactionFeePct) / 100));

  if (cfg.minFeeCents && fee * 100 < cfg.minFeeCents) fee = cfg.minFeeCents / 100;
  if (cfg.maxFeeCents && fee * 100 > cfg.maxFeeCents) fee = cfg.maxFeeCents / 100;

  const businessCut = round2(amount - fee);
  const memoTag = `${payment.entity}:${payment.entityId}`;

  // Cash side (stripe:clearing instead of stripe:cash)
  await tx.ledgerEntry.createMany({
    data: [
      { paymentId: payment.id, account: "stripe:clearing", side: "DEBIT", amount, currency: payment.currency, memo: `cash from ${payment.provider}` },
      { paymentId: payment.id, account: `user:${payment.userId}`, side: "CREDIT", amount, currency: payment.currency, memo: `paid ${memoTag}` },
    ]
  });

  // Attribution side
  if (payment.businessId) {
    await tx.ledgerEntry.createMany({
      data: [
        { paymentId: payment.id, account: `user:${payment.userId}`, side: "DEBIT", amount: amount, currency: payment.currency, memo: memoTag },
        { paymentId: payment.id, account: `business:${payment.businessId}`, side: "CREDIT", amount: businessCut, currency: payment.currency, memo: `payout ${memoTag}` },
        { paymentId: payment.id, account: "platform:fees", side: "DEBIT", amount: fee, currency: payment.currency, memo: `fee ${cfg.transactionFeePct}%` },
        { paymentId: payment.id, account: "revenue:transaction_fees", side: "CREDIT", amount: fee, currency: payment.currency, memo: `fee ${cfg.transactionFeePct}%` },
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

  // Local Rails markup
  if (payment.provider && payment.provider !== "STRIPE" && payment.provider !== "GIFT_CARD") {
    const bps = RAILS_MARKUP[payment.provider]?.markupBps ?? 0;
    const markup = round2(amount * (bps / 10000));
    if (markup > 0) {
      await tx.ledgerEntry.createMany({
        data: [
          { paymentId: payment.id, account: "platform:fees", side: "DEBIT", amount: markup, currency: payment.currency, memo: `rails markup ${bps}bps` },
          { paymentId: payment.id, account: "revenue:payment_markup", side: "CREDIT", amount: markup, currency: payment.currency },
        ]
      });
    }
  }
}

export function round2(n: number) { 
  return Math.round(n * 100) / 100; 
}

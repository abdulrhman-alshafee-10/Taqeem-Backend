import { PrismaClient } from "@prisma/client-payment";
import { resolveFeeConfig } from "../services/fee-config.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function aggregateBookingFees(dateISO: string) {
  // In a microservices architecture, payment-service does not have direct access to Reservation tables.
  // Instead, reservation-service should emit `reservation.completed` events which payment-service listens to
  // and aggregates, OR we fetch from an internal API.
  // We'll mock a fetch from reservation-service.
  
  try {
    const res = await fetch(`http://reservation-service:4010/api/internal/reservations/completed-stats?date=${dateISO}`);
    if (!res.ok) return;

    const rows = await res.json();
    // rows: [{ businessId, currency, covers }]

    for (const r of rows) {
      const cfg = await resolveFeeConfig({ businessId: r.businessId });
      
      // Only charge if the business opted into per-cover booking fees
      if (!cfg.useBookingFee) continue;

      const feeCents = (cfg.bookingFeePerCoverCents ?? 100) * Number(r.covers);
      const amount = feeCents / 100;

      await prisma.$transaction(async (tx) => {
        // Debit business, credit revenue
        await tx.ledgerEntry.createMany({ data: [
          { account: `business:${r.businessId}`, side: "DEBIT",  amount, currency: r.currency, memo: `booking fee ${r.covers} covers ${dateISO}` },
          { account: "revenue:booking_fee",      side: "CREDIT", amount, currency: r.currency, memo: `booking fee ${r.covers} covers ${dateISO}` },
        ]});
      });

      await publishEvent("booking_fee.accrued", { 
        id: crypto.randomUUID(),
        businessId: r.businessId, 
        dateISO, 
        covers: r.covers, 
        amount,
        currency: r.currency
      });
    }
  } catch (err) {
    console.error("Failed to aggregate booking fees", err);
  }
}

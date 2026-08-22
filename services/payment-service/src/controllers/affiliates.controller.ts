import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client-payment";

const prisma = new PrismaClient();

export async function onAffiliateSettlement(req: Request, res: Response) {
  const { partner } = req.params;
  
  // Example for Talabat payload
  // In reality, each partner has a different payload and signature validation.
  const events = req.body.events || [];

  try {
    for (const e of events) {
      // Find referral matching this user/business. Simplified mapping.
      const ref = await prisma.affiliateReferral.findFirst({
        where: { partner, externalRef: e.order_id }
      });
      
      const amount = Math.round((e.order_total_cents || 0) * 0.05); // 5% negotiated commission

      if (amount > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.affiliatePayout.create({ 
            data: { 
              partner, 
              referralId: ref?.id, 
              amountCents: amount, 
              currency: e.currency || "USD", 
              status: "PENDING", 
              externalRef: e.order_id 
            } 
          });

          await tx.ledgerEntry.createMany({ data: [
            { account: `receivable:${partner}`, side: "DEBIT",  amount: amount / 100, currency: e.currency || "USD", memo: `${partner} commission ${e.order_id}` },
            { account: "revenue:affiliate:delivery", side: "CREDIT", amount: amount / 100, currency: e.currency || "USD", memo: `${partner}` },
          ]});
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Affiliate settlement error", err);
    res.status(500).json({ error: "Internal Error" });
  }
}

export async function recordAffiliateClick(req: Request, res: Response) {
  const { partner, businessId, externalRef } = req.body;
  const userId = (req as any).user?.id;

  if (!partner || !businessId) return res.status(400).json({ error: "Missing fields" });

  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days window
    
    await prisma.affiliateReferral.create({
      data: {
        partner,
        businessId,
        userId: userId || null,
        externalRef: externalRef || null,
        expiresAt
      }
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Error" });
  }
}

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client-payment";
import { createClient } from "redis";
import { recordLedger } from "../services/ledger.js";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

function startOfDay() {
  const d = new Date();
  d.setUTCHours(0,0,0,0);
  return d;
}

export async function recordClick(req: Request, res: Response) {
  // @ts-ignore - Assuming auth middleware sets user
  const userId = req.user?.id;
  const ip = req.ip;
  const { campaignId, surface } = req.body;

  if (!campaignId || !surface) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const c = await prisma.adCampaign.findUnique({ where: { id: campaignId } });
  if (!c || c.status !== "APPROVED") return res.status(410).json({ error: "Not active" });

  // Bot / duplicate detection (1 per 10 min per user/IP)
  const dupKey = `ad:click:${userId ?? ip}:${campaignId}:${Math.floor(Date.now() / 600000)}`;
  const first = await redis.set(dupKey, "1", { NX: true, EX: 600 });
  if (!first) return res.status(200).json({ counted: false });

  const cost = c.cpcBidCents ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      // Update spend
      const updated = await tx.adCampaign.update({
        where: { id: campaignId },
        data:  { spendCents: { increment: cost } },
      });

      // Impression row
      await tx.adImpression.create({
        data: {
          campaignId, 
          businessId: c.businessId, 
          userId: userId ?? null,
          surface, 
          clicked: true, 
          charged: true, 
          costCents: cost,
          clickedAt: new Date(),
        },
      });

      // Ledger (revenue accrual)
      if (cost > 0) {
        const amount = Number((cost / 100).toFixed(2));
        const streamAccount = c.kind === "PROMOTED_SEARCH" ? "revenue:promoted_search" : "revenue:sponsored_posts";
        
        // Use standard double entry directly here since we don't have a paymentId for a pre-funded wallet right now
        // We assume they prepay and it's in a ledger account, but for simplicity we'll just credit revenue
        await tx.ledgerEntry.createMany({ data: [
          { account: "platform:fees", side: "DEBIT", amount, currency: c.currency, memo: `campaign:${campaignId} click` },
          { account: streamAccount, side: "CREDIT", amount, currency: c.currency, memo: `campaign:${campaignId} click` },
        ]});
      }

      // Stop if daily budget hit
      const spentAgg = await tx.adImpression.aggregate({
        where: { campaignId, createdAt: { gte: startOfDay() }, charged: true },
        _sum: { costCents: true },
      });
      
      const spentToday = spentAgg._sum.costCents ?? 0;
      if (spentToday >= c.dailyBudgetCents) {
        await tx.adCampaign.update({ where: { id: campaignId }, data: { status: "SPENT_OUT" } });
      }
      if (c.totalBudgetCents && updated.spendCents >= c.totalBudgetCents) {
        await tx.adCampaign.update({ where: { id: campaignId }, data: { status: "ENDED" } });
      }
    });

    res.json({ counted: true });
  } catch (err: any) {
    console.error("Ad click error", err);
    res.status(500).json({ error: "Internal Error" });
  }
}

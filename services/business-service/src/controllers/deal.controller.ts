import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { isFeatureApplicable } from "@taqeem/shared/utils/features.js";

const prisma = new PrismaClient();

const DEAL_TYPE_FEATURES: Record<string, string> = {
  BOGO: "deals_bogo",
  FREE_ITEM: "deals_free_item",
  PERCENT_OFF: "deals_percent_off",
  FIXED_OFF: "deals_percent_off"
};

export async function createDeal(req: Request, res: Response) {
  const businessId = req.params.businessId;
  const biz = await prisma.business.findUnique({ where: { id: businessId }});
  if (!biz) return res.status(404).json({ error: "Not found" });

  const feature = DEAL_TYPE_FEATURES[req.body.type] || "deals_percent_off";
  if (!isFeatureApplicable(feature, biz.vertical)) {
    return res.status(400).json({ error: `${req.body.type} deals are not available for ${biz.vertical}` });
  }

  const deal = await prisma.deal.create({
    data: { ...req.body, businessId },
  });
  res.status(201).json(deal);
}

export async function updateDeal(req: Request, res: Response) {
  const { businessId, dealId } = req.params;
  
  if (req.body.type) {
    const biz = await prisma.business.findUnique({ where: { id: businessId }});
    if (!biz) return res.status(404).json({ error: "Not found" });
    const feature = DEAL_TYPE_FEATURES[req.body.type] || "deals_percent_off";
    if (!isFeatureApplicable(feature, biz.vertical)) {
      return res.status(400).json({ error: `${req.body.type} deals are not available for ${biz.vertical}` });
    }
  }

  const deal = await prisma.deal.update({
    where: { id: dealId, businessId },
    data: req.body,
  });
  res.json(deal);
}

export async function deleteDeal(req: Request, res: Response) {
  const { businessId, dealId } = req.params;
  const deal = await prisma.deal.update({
    where: { id: dealId, businessId },
    data: { isActive: false },
  });
  res.json({ success: true });
}

export async function listDeals(req: Request, res: Response) {
  const { businessId } = req.params;
  const deals = await prisma.deal.findMany({
    where: { businessId, isActive: true },
  });
  res.json(deals);
}

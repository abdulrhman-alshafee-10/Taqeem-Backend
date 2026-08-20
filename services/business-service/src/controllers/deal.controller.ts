import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createDeal(req: Request, res: Response) {
  const businessId = req.params.businessId;
  const deal = await prisma.deal.create({
    data: { ...req.body, businessId },
  });
  res.status(201).json(deal);
}

export async function updateDeal(req: Request, res: Response) {
  const { businessId, dealId } = req.params;
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

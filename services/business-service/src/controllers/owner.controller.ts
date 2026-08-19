import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

const prisma = new PrismaClient();

export async function myBusinesses(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const items = await prisma.business.findMany({
    where: { ownerId: ctx.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ items });
}

export async function updateMyBusiness(req: Request, res: Response) {
  // requireBusinessOwner middleware already populated req.business
  const updated = await prisma.business.update({
    where: { id: req.business!.id },
    data: req.body,
    include: { hours: true },
  });
  await publishEvent("business.updated", { id: crypto.randomUUID(), business: updated });
  res.json(updated);
}

import slugify from "slugify";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

const prisma = new PrismaClient();

export async function list(req: Request, res: Response) {
  const { q, city, category, cursor, limit } = req.query as any;
  const where = {
    isActive: true,
    ...(city && { city }),
    ...(category && { categories: { has: category } }),
    ...(q && { name: { contains: q, mode: "insensitive" } }),
  };
  const items = await prisma.business.findMany({
    where,
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: "desc" },
  });
  const nextCursor = items.length > limit ? items.pop()!.id : null;
  res.json({ items, nextCursor });
}

export async function getById(req: Request, res: Response) {
  const biz = await prisma.business.findUnique({
    where: { id: req.params.id },
    include: { hours: true },
  });
  if (!biz || !biz.isActive) return res.status(404).json({ error: "Not found" });

  const ctx = getUserContext(req);
  await publishEvent("business.viewed", {
    id: crypto.randomUUID(),
    businessId: biz.id,
    viewerId: ctx.id,
    at: new Date().toISOString(),
  });

  res.json(biz);
}

export async function create(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const data = req.body;
  const slug = `${slugify(data.name, { lower: true })}-${crypto.randomUUID().slice(0, 6)}`;
  const biz = await prisma.business.create({
    data: { ...data, slug, ownerId: ctx.isOwner || ctx.isAdmin ? ctx.id : null },
  });
  await publishEvent("business.created", { id: crypto.randomUUID(), business: biz });
  res.status(201).json(biz);
}

export async function patch(req: Request, res: Response) {
  const updated = await prisma.business.update({
    where: { id: req.params.id },
    data: req.body,
  });
  await publishEvent("business.updated", { id: crypto.randomUUID(), business: updated });
  res.json(updated);
}

export async function claim(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const businessId = req.params.id;
  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz) return res.status(404).json({ error: "Not found" });
  if (biz.ownerId) return res.status(409).json({ error: "Already claimed" });

  const claim = await prisma.businessClaim.create({
    data: { businessId, claimantId: ctx.id as string, proofUrl: req.body.proofUrl, status: "PENDING" },
  });
  await prisma.business.update({
    where: { id: businessId },
    data: { claimStatus: "PENDING" },
  });
  await publishEvent("business.claim_submitted", {
    id: crypto.randomUUID(), claimId: claim.id, businessId, claimantId: ctx.id,
  });
  res.status(202).json(claim);
}

export async function toggleReservations(req: Request, res: Response) {
  const businessId = req.params.id;
  const { enabled } = req.body; // boolean

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { isReservationsEnabled: enabled },
  });

  await publishEvent("business.updated", { id: crypto.randomUUID(), business: updated });
  res.json({ isReservationsEnabled: updated.isReservationsEnabled });
}

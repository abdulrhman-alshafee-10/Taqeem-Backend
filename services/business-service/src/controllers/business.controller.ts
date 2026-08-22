import slugify from "slugify";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import { localizeEntity } from "@taqeem/shared/middlewares/localize.js";
import { getPrayerTimes } from "../services/prayer.js";
import crypto from "node:crypto";
import axios from "axios";

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
  const lang = (req as any).lang || "ar";
  res.json({ items: items.map(i => localizeEntity(i, lang)), nextCursor });
}

export async function getById(req: Request, res: Response) {
  const biz = await prisma.business.findUnique({
    where: { id: req.params.id },
    include: { hours: true },
  });
  if (!biz || !biz.isActive) return res.status(404).json({ error: "Not found" });

  let isOpenNow = true;
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const prayers = await getPrayerTimes(biz.city, biz.country, today);
    if (prayers && biz.closesDuringPrayers?.length) {
      const now = new Date();
      for (const p of biz.closesDuringPrayers) {
        const t = prayers[p];
        if (!t) continue;
        const [h, m] = t.split(":").map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);
        const end = new Date(start.getTime() + (biz.prayerCloseMinutes || 20) * 60_000);
        if (now >= start && now < end) {
          isOpenNow = false;
          break;
        }
      }
    }
  } catch (err) {
    console.error("Prayer time error:", err);
  }

  const lang = (req as any).lang || "ar";
  const localizedBiz = localizeEntity(biz, lang);
  localizedBiz.isOpenNow = isOpenNow;

  let aspectsTemplate = [];
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const templatesPath = path.resolve(__dirname, "../../../../shared/catalogues/aspect-templates.json");
    const templates = JSON.parse(fs.readFileSync(templatesPath, "utf-8"));
    aspectsTemplate = templates[biz.vertical]?.aspects || [];
  } catch (err) {
    console.error("Failed to load aspects template", err);
  }
  localizedBiz.aspectsTemplate = aspectsTemplate;

  const ctx = getUserContext(req);
  await publishEvent("business.viewed", {
    id: crypto.randomUUID(),
    businessId: biz.id,
    viewerId: ctx.id,
    at: new Date().toISOString(),
  });

  res.json(localizedBiz);
}

export async function create(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx || (ctx.role !== "OWNER" && ctx.role !== "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const data = req.body;
  const slug = `${slugify(data.nameEn, { lower: true })}-${crypto.randomUUID().slice(0, 6)}`;
  const biz = await prisma.business.create({
    data: {
      ...req.body,
      slug,
      ownerId: ctx.id
    },
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

export async function getSummary(req: Request, res: Response) {
  const summary = await prisma.businessSummary.findUnique({
    where: { businessId: req.params.id }
  });
  
  if (!summary) return res.status(404).json({ error: "Summary not found" });
  res.json(summary);
}

export async function confirmHalal(req: Request, res: Response) {
  const ctx = getUserContext(req);
  
  try {
    const userSvcUrl = process.env.USER_SERVICE_URL || "http://user-service:4001";
    const trustReq = await axios.get(`${userSvcUrl}/internal/users/${ctx.id}`);
    const trust = trustReq.data;
    
    if (trust.reviewsCount < 10 && !trust.reputationLevel?.includes("GUIDE")) {
      return res.status(403).json({ error: "Not enough reputation yet to confirm Halal" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify user trust" });
  }

  const businessId = req.params.id;
  await prisma.halalConfirmation.upsert({
    where:  { businessId_userId: { businessId, userId: ctx.id as string } },
    create: { businessId, userId: ctx.id as string, photoUrl: req.body.photoUrl },
    update: { photoUrl: req.body.photoUrl },
  });

  const count = await prisma.halalConfirmation.count({ where: { businessId } });
  if (count >= 5) {
    await publishEvent("business.halal_community_ready", { businessId });
  }
  res.json({ confirmations: count });
}

export async function askBusiness(req: Request, res: Response) {
  try {
    const businessId = req.params.id;
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question required" });
    
    // Check if business exists first? Not strictly necessary if agent service checks it.
    
    const agentUrl = process.env.AGENT_SERVICE_URL || "http://agent-service:4006";
    const { data } = await axios.post(`${agentUrl}/internal/rag/ask`, {
      businessId,
      question
    });
    
    res.json(data);
  } catch (err: any) {
    console.error("Ask Business error:", err.message);
    res.status(500).json({ error: "Failed to answer question" });
  }
}

export async function getBusinessInternal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const business = await prisma.business.findUnique({
      where: { id },
    });
    if (!business) return res.status(404).end();
    res.json(business);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
import { wilsonLower, headlineLevel } from "../utils/tier-calc.js";

export async function getLevel(req: Request, res: Response) {
  const biz = await prisma.business.findUnique({
    where: { id: req.params.id },
  });
  if (!biz) return res.status(404).json({ error: "Not found" });

  const wl = wilsonLower(biz.ratingAvg, biz.ratingCount);
  const vr = biz.ratingCount === 0 ? 0 : biz.verifiedReviewCount / biz.ratingCount;

  res.json({
    seniorityTier: biz.seniorityTier,
    qualityTier: biz.qualityTier,
    engagementTier: biz.engagementTier,
    headlineLevel: headlineLevel(biz),
    since: biz.createdAt.toISOString(),
    reviewCount: biz.ratingCount,
    avgRating: biz.ratingAvg,
    wilsonLower: parseFloat(wl.toFixed(2)),
    verifiedRatio: parseFloat(vr.toFixed(2))
  });
}

export async function getBadges(req: Request, res: Response) {
  const badges = await prisma.businessBadge.findMany({
    where: { businessId: req.params.id },
    orderBy: { awardedAt: 'desc' }
  });
  res.json(badges);
}

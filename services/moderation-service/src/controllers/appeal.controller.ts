import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { publishEvent } from '../events/publisher';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function appealReview(req: Request, res: Response) {
  try {
    const ctx = req.user!;
    const { reviewId } = req.params;
    const { reason, detail, evidenceUrls } = req.body;

    // Fetch review to get businessId
    const review = await axios.get(`${process.env.REVIEW_SERVICE_URL}/internal/reviews/${reviewId}`).then(r => r.data).catch(() => null);
    if (!review) return res.status(404).json({ error: "Review not found" });

    // Verify ownership
    const isOwner = await axios.get(`${process.env.BUSINESS_SERVICE_URL}/internal/businesses/${review.businessId}`).then(r => r.data.ownerId === ctx.id).catch(() => false);
    if (!isOwner && !ctx.isAdmin) return res.status(403).json({ error: "Not the owner" });

    // Check if appeal already exists
    const existingAppeal = await prisma.reviewAppeal.findUnique({
      where: { reviewId_ownerId: { reviewId, ownerId: ctx.id } }
    });
    if (existingAppeal) {
      return res.status(409).json({ error: "An appeal for this review has already been submitted" });
    }

    const appeal = await prisma.reviewAppeal.create({
      data: {
        reviewId,
        businessId: review.businessId,
        ownerId: ctx.id,
        reason,
        detail,
        evidenceUrls: evidenceUrls ?? [],
      },
    });

    // Create/refresh moderation queue entry
    await prisma.queueEntry.upsert({
      where: { contentKind_contentId: { contentKind: "REVIEW", contentId: reviewId } },
      create: { contentKind: "REVIEW", contentId: reviewId, priority: 75, status: "PENDING" },
      update: { priority: { increment: 20 } },
    });

    await publishEvent("moderation.appeal_submitted", {
      id: crypto.randomUUID(),
      appealId: appeal.id,
      reviewId,
      ownerId: ctx.id,
    });

    res.status(202).json(appeal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

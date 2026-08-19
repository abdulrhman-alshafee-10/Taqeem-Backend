import { Request, Response } from "express";
import { Review } from "../models/review.model.js";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import axios from "axios";
import crypto from "node:crypto";

// Verifies the caller owns the business referenced by the review.
async function assertOwnership(businessId: string, ownerId: string) {
  try {
    const { data } = await axios.get(
      `http://business-service:4002/api/businesses/${businessId}`,
      { timeout: 3000 }
    );
    return data?.ownerId === ownerId;
  } catch (e) {
    return false;
  }
}

export async function reply(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { reviewId } = req.params;

  const doc = await Review.findOne({ _id: reviewId, isDeleted: false });
  if (!doc) return res.status(404).json({ error: "Not found" });

  const ok = ctx.isAdmin || await assertOwnership(doc.businessId, ctx.id as string);
  if (!ok) return res.status(403).json({ error: "Not the owner" });

  doc.reply = {
    ownerId: ctx.id as string,
    body: req.body.body,
    createdAt: doc.reply?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
  await doc.save();

  await publishEvent("review.replied", {
    id: crypto.randomUUID(),
    reviewId: doc._id.toString(),
    businessId: doc.businessId,
    ownerId: ctx.id,
  });
  res.json(doc);
}

export async function listBusinessReviews(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { businessId } = req.params;

  const ok = ctx.isAdmin || await assertOwnership(businessId, ctx.id as string);
  if (!ok) return res.status(403).json({ error: "Not the owner" });

  const items = await Review.find({ businessId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ items });
}

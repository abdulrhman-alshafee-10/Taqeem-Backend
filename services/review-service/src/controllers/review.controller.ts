import { Request, Response } from "express";
import { Review } from "../models/review.model.js";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

export async function listByBusiness(req: Request, res: Response) {
  const { businessId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const cursor = req.query.cursor as string;

  const query: any = { businessId, isDeleted: false };
  if (cursor) query.createdAt = { $lt: new Date(cursor) };

  const items = await Review.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const nextCursor = items.length > limit ? items.pop()!.createdAt.toISOString() : null;
  res.json({ items, nextCursor });
}

export async function create(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const { businessId } = req.params;

  try {
    let rating = req.body.rating;
    if (req.body.aspects) {
      const vals = Object.values(req.body.aspects).filter(v => typeof v === "number") as number[];
      if (vals.length > 0) {
        rating = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) || rating;
      }
    }

    const doc = await Review.create({
      businessId,
      authorId:   ctx.id,
      authorName: req.header("x-user-name") || "Anonymous",
      ...req.body,
      rating,
    });

    await publishEvent("review.created", {
      id: crypto.randomUUID(),
      reviewId:   doc._id.toString(),
      businessId: doc.businessId,
      authorId:   doc.authorId,
      rating:     doc.rating,
      aspects:    doc.aspects,
      createdAt:  doc.createdAt,
    });
    res.status(201).json(doc);
  } catch (e: any) {
    if (e.code === 11000) return res.status(409).json({ error: "You already reviewed this business" });
    res.status(500).json({ error: e.message });
  }
}

export async function update(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { reviewId } = req.params;

  const doc = await Review.findOne({ _id: reviewId, isDeleted: false });
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (doc.authorId !== ctx.id && !ctx.isAdmin) return res.status(403).json({ error: "Forbidden" });

  let rating = req.body.rating ?? doc.rating;
  if (req.body.aspects) {
    const vals = Object.values(req.body.aspects).filter(v => typeof v === "number") as number[];
    if (vals.length > 0) {
      rating = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) || rating;
    }
  }

  Object.assign(doc, req.body, { rating });
  await doc.save();

  await publishEvent("review.updated", {
    id: crypto.randomUUID(),
    reviewId: doc._id.toString(),
    businessId: doc.businessId,
    rating: doc.rating,
    aspects: doc.aspects,
    updatedAt: doc.updatedAt,
  });
  res.json(doc);
}

export async function remove(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { reviewId } = req.params;

  const doc = await Review.findOne({ _id: reviewId, isDeleted: false });
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (doc.authorId !== ctx.id && !ctx.isAdmin) return res.status(403).json({ error: "Forbidden" });

  doc.isDeleted = true;
  await doc.save();

  await publishEvent("review.deleted", {
    id: crypto.randomUUID(),
    reviewId: doc._id.toString(),
    businessId: doc.businessId,
    priorRating: doc.rating,
  });
  res.status(204).end();
}

import { Request, Response } from "express";
import { Review } from "../models/review.model.js";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";
import { computeVerification } from "../services/verification.service.js";
import { translateReview } from "../services/translation.service.js";
import { assertOwnership } from "./owner.controller.js";

export async function listByBusiness(req: Request, res: Response) {
  const { businessId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const cursor = req.query.cursor as string;

  const query: any = { businessId, isDeleted: false };
  if (cursor) query.createdAt = { $lt: new Date(cursor) };

  const sortField = req.query.sort === "helpful" ? { helpfulCount: -1, createdAt: -1 } : { createdAt: -1 };

  const items = await Review.find(query)
    .sort(sortField as any)
    .limit(limit + 1)
    .lean();

  const mappedItems = items.map((r: any) => ({
    ...r,
    verifiedBadge: r.verification?.weight > 0 ? "Verified visit" : undefined
  }));

  const nextCursor = mappedItems.length > limit ? mappedItems.pop()!.createdAt.toISOString() : null;
  res.json({ items: mappedItems, nextCursor });
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

    const verification = await computeVerification({
      authorId: ctx.id as string,
      businessId,
      reservationId: req.body.reservationId,
      orderId: req.body.orderId,
      checkinId: req.body.checkinId
    });

    const doc = await Review.create({
      businessId,
      authorId:   ctx.id,
      authorName: req.header("x-user-name") || "Anonymous",
      ...req.body,
      rating,
      verification
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

    if (verification.weight > 0) {
      await publishEvent("review.verified_visit", {
        id: crypto.randomUUID(),
        reviewId: doc._id.toString(),
        authorId: doc.authorId,
        weight: verification.weight
      });
    }

    res.status(201).json({
      review: doc,
      prompts: [
        { id: "orderedItems", q: "What did you order?", type: "chips", options: ["latte", "cappuccino", "brunch plate"] },
        { id: "wouldReturn",  q: "Would you go back?",  type: "yesno" },
        { id: "visitTime",    q: "When did you visit?", type: "enum", options: ["breakfast", "lunch", "dinner", "late_night"] }
      ]
    });
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

export async function updateFacts(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { reviewId } = req.params;

  const doc = await Review.findOne({ _id: reviewId, isDeleted: false });
  if (!doc) return res.status(404).json({ error: "Not found" });
  if (doc.authorId !== ctx.id) return res.status(403).json({ error: "Forbidden" });

  const { orderedItems, wouldReturn, visitTime, partySize, waitMin, spendPerPerson } = req.body;
  if (!doc.facts) doc.facts = {} as any;
  if (orderedItems !== undefined) doc.facts!.orderedItems = orderedItems;
  if (wouldReturn !== undefined) doc.facts!.wouldReturn = wouldReturn;
  if (visitTime !== undefined) doc.facts!.visitTime = visitTime;
  if (partySize !== undefined) doc.facts!.partySize = partySize;
  if (waitMin !== undefined) doc.facts!.waitMin = waitMin;
  if (spendPerPerson !== undefined) doc.facts!.spendPerPerson = spendPerPerson;

  await doc.save();
  res.json(doc);
}

export async function vote(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { reviewId } = req.params;
  const value = req.body.vote === 1 ? 1 : -1;

  const doc = await Review.findById(reviewId);
  if (!doc || doc.isDeleted) return res.status(404).json({ error: "Not found" });
  if (doc.authorId === ctx.id) return res.status(400).json({ error: "Cannot vote your own review" });

  const existing = doc.votes.find((v: any) => v.userId === ctx.id);
  if (existing && existing.vote === value) {
    return res.status(200).json({ helpfulCount: doc.helpfulCount, unhelpfulCount: doc.unhelpfulCount });
  }

  if (existing) {
    if (existing.vote === 1) doc.helpfulCount--; else doc.unhelpfulCount--;
    existing.vote = value;
    existing.at = new Date();
  } else {
    doc.votes.push({ userId: ctx.id, vote: value });
  }
  
  if (value === 1) doc.helpfulCount++; else doc.unhelpfulCount++;

  await doc.save();
  await publishEvent("review.helpful_voted", {
    id: crypto.randomUUID(),
    reviewId: doc._id.toString(),
    authorId: doc.authorId,
    voterId: ctx.id,
    value,
    helpfulCount: doc.helpfulCount,
  });
  
  res.json({ helpfulCount: doc.helpfulCount, unhelpfulCount: doc.unhelpfulCount });
}

export async function translate(req: Request, res: Response) {
  const { reviewId } = req.params;
  const to = (req.query.to as string) || "en";

  const doc = await Review.findById(reviewId);
  if (!doc || doc.isDeleted) return res.status(404).json({ error: "Not found" });

  const result = await translateReview(reviewId, to, doc.body, doc.language);
  res.json({ reviewId, ...result });
}

export async function postThreadMessage(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const doc = await Review.findById(req.params.reviewId);
  if (!doc || doc.isDeleted) return res.status(404).json({ error: "Not found" });
  if (doc.threadClosed) return res.status(409).json({ error: "Thread closed" });

  const requestedRole = req.route.path.includes("/owner") ? "owner" : "author";
  const nextRole = doc.thread.length % 2 === 0 ? "owner" : "author";

  if (requestedRole !== nextRole) {
    return res.status(409).json({ error: `Waiting for ${nextRole} response` });
  }

  if (requestedRole === "owner") {
    const owns = ctx.isAdmin || await assertOwnership(doc.businessId, ctx.id as string);
    if (!owns) return res.status(403).json({ error: "Not the owner" });
  } else if (doc.authorId !== ctx.id) {
    return res.status(403).json({ error: "Only the reviewer can respond" });
  }

  doc.thread.push({ role: requestedRole, userId: ctx.id, body: req.body.body });
  if (doc.thread.length >= 3) doc.threadClosed = true;
  await doc.save();

  await publishEvent(`review.thread.${requestedRole}_replied`, {
    id: crypto.randomUUID(),
    reviewId: doc._id.toString(),
    businessId: doc.businessId,
    authorId: doc.authorId,
    threadClosed: doc.threadClosed,
  });
  
  res.status(201).json(doc.thread);
}

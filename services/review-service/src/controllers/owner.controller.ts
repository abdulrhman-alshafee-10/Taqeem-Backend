import { Request, Response } from "express";
import { Review } from "../models/review.model.js";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import axios from "axios";
import crypto from "node:crypto";

// Verifies the caller owns the business referenced by the review.
export async function assertOwnership(businessId: string, ownerId: string) {
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

// The owner reply logic has been moved to review.controller.ts to support multi-turn threads

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

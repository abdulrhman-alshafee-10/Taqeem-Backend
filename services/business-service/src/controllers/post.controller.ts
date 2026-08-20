import { Request, Response } from "express";
import { PrismaClient, OwnerPostType } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import crypto from "crypto";

// Need redis for rate limiting
import { createClient } from "redis";
const redis = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
redis.connect().catch(console.error);

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

export async function getPosts(req: Request, res: Response) {
  const { id } = req.params; // businessId
  const posts = await prisma.ownerPost.findMany({
    where: { 
      businessId: id,
      isPublished: true,
      validFrom: { lte: new Date() },
      OR: [
        { validTo: null },
        { validTo: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(posts);
}

export async function createPost(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params; // businessId
  const data = req.body;

  // Rate limit: 10 posts / business / week
  const quotaKey = `posts_quota:${id}`;
  const count = await redis.incr(quotaKey);
  if (count === 1) await redis.expire(quotaKey, 7 * 24 * 3600); // expire in 7 days
  if (count > 10) return res.status(429).json({ error: "Weekly post limit reached" });

  const post = await prisma.ownerPost.create({
    data: {
      businessId: id,
      authorId: ctx.id,
      type: data.type as OwnerPostType,
      title: data.title,
      body: data.body,
      photoUrl: data.photoUrl,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : null,
      couponCode: data.couponCode,
      ctaUrl: data.ctaUrl,
      isPublished: data.isPublished !== undefined ? data.isPublished : true,
    }
  });

  if (post.isPublished) {
    await publishEvent("owner.post_published", {
      id: crypto.randomUUID(),
      postId: post.id,
      businessId: id,
      type: post.type,
      validTo: post.validTo
    });
  }

  res.status(201).json(post);
}

export async function updatePost(req: Request, res: Response) {
  const { postId } = req.params;
  const data = req.body;

  const post = await prisma.ownerPost.update({
    where: { id: postId },
    data: {
      title: data.title,
      body: data.body,
      photoUrl: data.photoUrl,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
      couponCode: data.couponCode,
      ctaUrl: data.ctaUrl,
      isPublished: data.isPublished,
    }
  });

  await publishEvent("owner.post_updated", { postId, delta: data });
  res.json(post);
}

export async function deletePost(req: Request, res: Response) {
  const { postId } = req.params;
  
  await prisma.ownerPost.delete({ where: { id: postId } });
  
  // Note: an event could be published here if needed by Search to remove it from index.
  res.json({ success: true });
}

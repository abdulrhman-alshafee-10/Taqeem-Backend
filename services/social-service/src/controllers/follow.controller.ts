import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { redis } from "../redis.js";
import { publishEvent } from "../events/publisher.js";
import crypto from "crypto";
import { FollowTarget } from "@prisma/client";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  // Mock user context, in reality this comes from auth middleware
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

export async function follow(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { target, targetId } = req.body;

  if (target === "USER" && targetId === ctx.id) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_target_targetId: { followerId: ctx.id, target, targetId } },
  });
  if (existing) return res.status(200).json(existing);

  const created = await prisma.follow.create({
    data: { followerId: ctx.id, target: target as FollowTarget, targetId },
  });

  // Redis fan-out
  const pipe = redis.multi();
  pipe.sAdd(`followers:${target.toLowerCase()}:${targetId}`, ctx.id);
  pipe.sAdd(`follows:${ctx.id}`, `${target}:${targetId}`);
  await pipe.exec();

  await publishEvent("follow.created", {
    id: crypto.randomUUID(),
    followerId: ctx.id, target, targetId,
  });
  res.status(201).json(created);
}

export async function unfollow(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { target, targetId } = req.body;

  const existing = await prisma.follow.findUnique({
    where: { followerId_target_targetId: { followerId: ctx.id, target, targetId } },
  });
  
  if (!existing) return res.status(404).json({ error: "Follow not found" });

  await prisma.follow.delete({
    where: { id: existing.id }
  });

  const pipe = redis.multi();
  pipe.sRem(`followers:${target.toLowerCase()}:${targetId}`, ctx.id);
  pipe.sRem(`follows:${ctx.id}`, `${target}:${targetId}`);
  await pipe.exec();

  await publishEvent("follow.removed", {
    followerId: ctx.id, target, targetId,
  });

  res.status(200).json({ success: true });
}

export async function getFollowers(req: Request, res: Response) {
  const { target, id } = req.params;
  const followers = await redis.sMembers(`followers:${target.toLowerCase()}:${id}`);
  
  // if empty, we might need to fallback to DB, but for now we assume redis is source of truth or empty
  if (followers.length === 0) {
    const rows = await prisma.follow.findMany({ where: { target: target as FollowTarget, targetId: id } });
    const dbFollowers = rows.map(r => r.followerId);
    if (dbFollowers.length > 0) {
      await redis.sAdd(`followers:${target.toLowerCase()}:${id}`, dbFollowers);
    }
    return res.json(dbFollowers);
  }
  
  res.json(followers);
}

export async function getFollowing(req: Request, res: Response) {
  const { userId } = req.params;
  const set = await redis.sMembers(`follows:${userId}`);
  const grouped: Record<string, string[]> = { USER: [], BUSINESS: [], LIST: [] };
  
  for (const s of set) {
    const [t, id] = s.split(":");
    if (grouped[t]) {
      grouped[t].push(id);
    }
  }

  if (Object.values(grouped).every(a => a.length === 0)) {
    const rows = await prisma.follow.findMany({ where: { followerId: userId } });
    for (const r of rows) {
      if (grouped[r.target]) {
        grouped[r.target].push(r.targetId);
      }
    }
    // Update Redis
    const pipe = redis.multi();
    for (const r of rows) {
      pipe.sAdd(`follows:${userId}`, `${r.target}:${r.targetId}`);
    }
    if (rows.length > 0) await pipe.exec();
  }

  res.json(grouped);
}

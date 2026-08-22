import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserContext } from "@taqeem/shared/auth/context.js";

const prisma = new PrismaClient();

export async function getMyBadges(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const userBadges = await prisma.userBadge.findMany({
    where: { userId: ctx.id as string },
    include: { badge: true }
  });
  res.json(userBadges);
}

export async function getMyStreaks(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const streaks = await prisma.streak.findMany({
    where: { userId: ctx.id as string }
  });
  res.json(streaks);
}

export async function getCatalogue(req: Request, res: Response) {
  const badges = await prisma.badge.findMany({
    where: { isRetired: false }
  });
  res.json(badges);
}

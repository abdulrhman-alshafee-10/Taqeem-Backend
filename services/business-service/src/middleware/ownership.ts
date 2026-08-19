import { Request, Response, NextFunction } from "express";
import { PrismaClient, Business } from "@prisma/client";
import { getUserContext } from "@taqeem/shared/auth/context.js";

const prisma = new PrismaClient();

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      business?: Partial<Business>;
    }
  }
}

export async function requireBusinessOwner(req: Request, res: Response, next: NextFunction) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const id = req.params.id || req.params.businessId;
  const biz = await prisma.business.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!biz) return res.status(404).json({ error: "Business not found" });

  const isOwner = biz.ownerId && biz.ownerId === ctx.id;
  if (!isOwner && !ctx.isAdmin) {
    return res.status(403).json({ error: "Not the owner" });
  }
  req.business = biz;
  next();
}

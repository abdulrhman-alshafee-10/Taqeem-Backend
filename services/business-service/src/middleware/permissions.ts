import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { 
    id: req.headers["x-user-id"] as string,
    isAdmin: req.headers["x-user-role"] === "ADMIN"
  };
}

const REQ: Record<string, Set<string>> = {
  editProfile:        new Set(["OWNER", "MANAGER"]),
  manageReservations: new Set(["OWNER", "MANAGER", "STAFF"]),
  viewAnalytics:      new Set(["OWNER", "MANAGER"]),
  billing:            new Set(["OWNER"]),
  invite:             new Set(["OWNER"]),
};

export function requireBusinessPermission(perm: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = getUserContext(req);
      if (!ctx.id) return res.status(401).json({ error: "Unauthorized" });
      if (ctx.isAdmin) return next();

      const businessId = req.params.id || req.params.businessId;
      if (!businessId) return res.status(400).json({ error: "Missing business ID" });

      const biz = await prisma.business.findUnique({ 
        where: { id: businessId }, 
        select: { ownerId: true } 
      });
      
      if (!biz) return res.status(404).json({ error: "Business not found" });
      if (biz.ownerId === ctx.id) return next();

      const m = await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId, userId: ctx.id } },
      });

      if (m && REQ[perm]?.has(m.role)) return next();

      return res.status(403).json({ error: "Forbidden", required: perm });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

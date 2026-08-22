import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { isFeatureApplicable } from "@taqeem/shared/utils/features.js";

const prisma = new PrismaClient();

export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.params.id || req.params.businessId || req.body.businessId;
    if (!businessId) return next();

    try {
      const b = await prisma.business.findUnique({
        where: { id: businessId },
        select: { vertical: true },
      });
      if (!b) return res.status(404).json({ error: "Business not found" });

      if (!isFeatureApplicable(featureKey, b.vertical)) {
        return res.status(409).json({
          error: "FEATURE_NOT_APPLICABLE",
          feature: featureKey,
          vertical: b.vertical,
        });
      }
      
      // Attach basic business vertical info to req for downstream usage
      (req as any).business = { ...((req as any).business ?? {}), ...b };
      next();
    } catch (err) {
      next(err);
    }
  };
}

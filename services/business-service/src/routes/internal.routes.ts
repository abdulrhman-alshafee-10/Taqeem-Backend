import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.post("/businesses/:businessId/summary", async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const { data, reviewsUpTo } = req.body;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.businessSummary.findUnique({ where: { businessId } });
      if (existing) {
        await tx.businessSummaryHistory.create({
          data: {
            businessId,
            data: existing.data as any,
            reviewsUpTo: existing.reviewsUpTo,
            createdAt: existing.updatedAt,
          }
        });
      }

      await tx.businessSummary.upsert({
        where: { businessId },
        update: {
          data,
          reviewsUpTo: new Date(reviewsUpTo),
        },
        create: {
          businessId,
          data,
          reviewsUpTo: new Date(reviewsUpTo),
        }
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("internal update summary error:", err);
    res.status(500).json({ error: "Failed to update summary" });
  }
});

import { mergeBusinesses, unmergeBusinesses, closeBusiness } from '../controllers/internal.controller.js';
import { getBusinessInternal } from '../controllers/business.controller.js';

// Used by Moderation Service saga
router.post('/businesses/merge', mergeBusinesses);
router.post('/businesses/unmerge', unmergeBusinesses);
router.post('/businesses/:id/close', closeBusiness);
router.get('/businesses/:id', getBusinessInternal);

export default router;

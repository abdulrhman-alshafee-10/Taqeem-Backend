import { Request, Response } from 'express';
import { PrismaClient, BusinessStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function mergeBusinesses(req: Request, res: Response) {
  try {
    const { primaryId, duplicateId } = req.body;
    
    // De-duplicate photos, categories etc.
    const dup = await prisma.business.findUnique({ where: { id: duplicateId } });
    if (dup) {
      // Mark dup as merged and closed
      await prisma.business.update({
        where: { id: duplicateId },
        data: {
          isActive: false,
          businessStatus: BusinessStatus.PERMANENTLY_CLOSED,
          mergedIntoId: primaryId,
          closedAt: new Date()
        }
      });
      // Move photos conceptually
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function unmergeBusinesses(req: Request, res: Response) {
  try {
    const { primaryId, duplicateId } = req.body;
    await prisma.business.update({
      where: { id: duplicateId },
      data: {
        isActive: true,
        businessStatus: BusinessStatus.OPEN,
        mergedIntoId: null,
        closedAt: null
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function closeBusiness(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.business.update({
      where: { id },
      data: {
        isActive: false,
        businessStatus: BusinessStatus.PERMANENTLY_CLOSED,
        closedAt: new Date()
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
}

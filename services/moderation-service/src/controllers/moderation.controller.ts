import { Request, Response } from 'express';
import { PrismaClient, DecisionAction, QueueStatus } from '@prisma/client';
import axios from 'axios';
import { publishEvent } from '../events/publisher';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function getQueue(req: Request, res: Response) {
  try {
    const { kind, status } = req.query;
    const entries = await prisma.queueEntry.findMany({
      where: {
        ...(kind ? { contentKind: kind as any } : {}),
        ...(status ? { status: status as QueueStatus } : { status: 'PENDING' }),
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 50
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function assignEntry(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const modId = req.user!.id;
    const entry = await prisma.queueEntry.update({
      where: { id },
      data: { assignedModId: modId, status: 'IN_REVIEW' }
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

function mapStatus(action: DecisionAction): QueueStatus {
  if (action === 'REJECT') return 'REJECTED'; // rejected the content (so the report was approved)
  if (action === 'APPROVE') return 'APPROVED'; // approved the content (so report was rejected)
  return 'APPROVED'; 
}

export async function decideEntry(req: Request, res: Response) {
  try {
    const modId = req.user!.id;
    const { action, note } = req.body as { action: DecisionAction, note: string };
    const { id } = req.params;

    const entry = await prisma.queueEntry.findUnique({ where: { id } });
    if (!entry) return res.status(404).end();

    await prisma.$transaction([
      prisma.modAction.create({
        data: { queueEntryId: entry.id, moderatorId: modId, action, note }
      }),
      prisma.queueEntry.update({
        where: { id: entry.id },
        data: { status: mapStatus(action) }
      })
    ]);

    await publishEvent('moderation.decided', {
      id: crypto.randomUUID(),
      entryId: entry.id,
      contentKind: entry.contentKind,
      contentId: entry.contentId,
      authorId: entry.authorId,
      action,
      moderatorId: modId,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function mergeBusinesses(req: Request, res: Response) {
  const adminId = req.user!.id;
  const { primaryBusinessId, duplicateBusinessId, note } = req.body;
  
  const done: string[] = [];
  try {
    await prisma.businessMergeRequest.create({
      data: {
        primaryBusinessId, duplicateBusinessId, note, reporterId: adminId, status: 'ACCEPTED'
      }
    });

    // Run the Saga
    await axios.post(`${process.env.BUSINESS_SERVICE_URL}/internal/businesses/merge`, { primaryId: primaryBusinessId, duplicateId: duplicateBusinessId }); 
    done.push('business');
    
    await axios.post(`${process.env.REVIEW_SERVICE_URL}/internal/businesses/rebind-reviews`, { from: duplicateBusinessId, to: primaryBusinessId }); 
    done.push('reviews');
    
    await axios.post(`${process.env.CONTENT_SERVICE_URL}/internal/businesses/rebind`, { from: duplicateBusinessId, to: primaryBusinessId }); 
    done.push('content');
    
    await axios.post(`${process.env.RESERVATION_SERVICE_URL}/internal/businesses/cancel-future`, { businessId: duplicateBusinessId, reason: 'MERGED' }); 
    done.push('reservations');

    await publishEvent('business.merged', {
      id: crypto.randomUUID(),
      primaryId: primaryBusinessId,
      duplicateId: duplicateBusinessId,
      decidedBy: adminId
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Merge Saga failed, compensating...', err);
    // Best-effort compensations
    for (const step of done.reverse()) {
      try {
        if (step === 'reservations') {
          // In real implementation we'd restore reservations
        } else if (step === 'content') {
          await axios.post(`${process.env.CONTENT_SERVICE_URL}/internal/businesses/rebind`, { from: primaryBusinessId, to: duplicateBusinessId }); 
        } else if (step === 'reviews') {
          await axios.post(`${process.env.REVIEW_SERVICE_URL}/internal/businesses/rebind-reviews`, { from: primaryBusinessId, to: duplicateBusinessId }); 
        } else if (step === 'business') {
          await axios.post(`${process.env.BUSINESS_SERVICE_URL}/internal/businesses/unmerge`, { primaryId: primaryBusinessId, duplicateId: duplicateBusinessId }); 
        }
      } catch (compErr) {
        console.error(`Compensation failed for ${step}`, compErr);
      }
    }
    res.status(500).json({ error: 'Merge failed, partially compensated' });
  }
}

export async function closeBusiness(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await axios.post(`${process.env.BUSINESS_SERVICE_URL}/internal/businesses/${id}/close`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

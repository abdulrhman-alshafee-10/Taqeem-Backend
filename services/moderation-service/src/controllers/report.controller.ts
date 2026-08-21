import { Request, Response } from 'express';
import { PrismaClient, ContentKind } from '@prisma/client';
import { RateLimiter } from '../utils/rate-limiter';
import { priorityFor } from '../utils/priority';

const prisma = new PrismaClient();

export async function createReport(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { contentKind, contentId, reason, detail, authorId } = req.body;

    // Robust Rate Limiting
    const isDailyAllowed = await RateLimiter.checkDailyReportLimit(userId);
    if (!isDailyAllowed) {
      return res.status(429).json({ error: "Report limit reached for today" });
    }

    if (authorId) {
      const isPairAllowed = await RateLimiter.checkPairReportLimit(userId, authorId);
      if (!isPairAllowed) {
        return res.status(429).json({ error: "Too many reports on this user" });
      }
    }

    // Create Report
    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        contentKind: contentKind as ContentKind,
        contentId,
        reason,
        detail,
      },
    });

    const priorityBump = priorityFor(reason);

    // Create or Update Queue Entry
    const entry = await prisma.queueEntry.upsert({
      where: {
        contentKind_contentId: {
          contentKind: report.contentKind,
          contentId: report.contentId,
        },
      },
      create: {
        contentKind: report.contentKind,
        contentId: report.contentId,
        authorId: authorId,
        reportCount: 1,
        priority: priorityBump,
        status: "PENDING",
      },
      update: {
        reportCount: { increment: 1 },
        priority: { increment: priorityBump },
        // if it was previously auto-approved or decided, returning it to PENDING if we want it re-reviewed?
        // simple approach: just keep it PENDING if new reports come in, or escalate it.
      },
    });

    await prisma.report.update({
      where: { id: report.id },
      data: { queueEntryId: entry.id },
    });

    return res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getMyReports(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    const reports = await prisma.report.findMany({
      where: { reporterId: userId },
      include: {
        queueEntry: {
          include: {
            actions: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response as requested
    const formatted = reports.map(r => {
      const entry = r.queueEntry;
      const latestAction = entry?.actions[0];
      return {
        ...r,
        status: entry?.status || 'UNKNOWN',
        decision: latestAction ? latestAction.action : null,
        // Redact moderator note if needed, or share a sanitized reason
        note: latestAction?.note || null
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import { businessClient } from "../lib/httpClients.js";

const prisma = new PrismaClient();

async function checkBusinessReservationsEnabled(businessId: string): Promise<boolean> {
  try {
    const resBiz = await businessClient.fetch(`${process.env.BUSINESS_SERVICE_URL || "http://business-service:4002"}/api/businesses/${businessId}`);
    const data = await resBiz.json();
    return data.isReservationsEnabled === true;
  } catch (err) {
    return false; 
  }
}

export async function joinWaitlist(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { businessId, partySize, desiredAt, windowMin } = req.body;

  if (!await checkBusinessReservationsEnabled(businessId)) {
    return res.status(403).json({ error: "Reservations are not enabled for this business" });
  }

  const entry = await prisma.waitlistEntry.create({
    data: {
      businessId,
      userId: ctx.id as string,
      partySize,
      desiredAt: new Date(desiredAt),
      windowMin: windowMin || 60,
    }
  });

  res.status(201).json(entry);
}

export async function dropWaitlist(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const entryId = req.params.id;

  const entry = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, userId: ctx.id as string },
    data: { status: "EXPIRED" } // mark dropped
  });

  res.json({ success: true });
}

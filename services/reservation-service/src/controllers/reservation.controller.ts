import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import { businessClient } from "../lib/httpClients.js";

const prisma = new PrismaClient();

// Helper to fetch Business status
async function checkBusinessReservationsEnabled(businessId: string): Promise<boolean> {
  try {
    const resBiz = await businessClient.fetch(`${process.env.BUSINESS_SERVICE_URL || "http://business-service:4002"}/api/businesses/${businessId}`);
    const data = await resBiz.json();
    return data.isReservationsEnabled === true;
  } catch (err) {
    return false; // safe default
  }
}

// Ensure policy exists
async function getOrInitPolicy(businessId: string) {
  let policy = await prisma.availabilityPolicy.findUnique({ where: { businessId } });
  if (!policy) {
    policy = await prisma.availabilityPolicy.create({ data: { businessId } });
  }
  return policy;
}

export async function getAvailability(req: Request, res: Response) {
  const { businessId } = req.params;
  const { date, partySize } = req.query;

  if (!await checkBusinessReservationsEnabled(businessId)) {
    return res.status(403).json({ error: "Reservations are not enabled for this business" });
  }

  const policy = await getOrInitPolicy(businessId);
  const requestedDate = new Date(date as string);
  
  // Here we would fetch BusinessHours from business-service.
  // For the sake of the mock, we assume 09:00 to 22:00.
  const slots: string[] = [];
  let cur = new Date(requestedDate);
  cur.setHours(9, 0, 0, 0);
  const end = new Date(requestedDate);
  end.setHours(22, 0, 0, 0);
  const lastStart = new Date(end.getTime() - policy.turnMinutes * 60000);

  while (cur <= lastStart) {
    // Check if table available at this time
    const count = await prisma.$queryRaw<{ count: number }[]>`
      WITH candidate_tables AS (
        SELECT id FROM tables
        WHERE business_id = ${businessId}::uuid AND is_active = true AND capacity >= ${Number(partySize)}
      ),
      booked AS (
        SELECT table_id FROM reservations
        WHERE business_id = ${businessId}::uuid
          AND status IN ('PENDING', 'CONFIRMED')
          AND starts_at < ${new Date(cur.getTime() + policy.turnMinutes * 60000)}
          AND ends_at > ${cur}
      )
      SELECT COUNT(id) as count FROM candidate_tables
      WHERE id NOT IN (SELECT table_id FROM booked WHERE table_id IS NOT NULL);
    `;
    
    if (count[0] && Number(count[0].count) > 0) {
      slots.push(cur.toISOString());
    }
    cur = new Date(cur.getTime() + policy.slotMinutes * 60000);
  }

  res.json({ slots, policy });
}

export async function createReservation(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { businessId, partySize, startsAt, source } = req.body;

  if (!await checkBusinessReservationsEnabled(businessId)) {
    return res.status(403).json({ error: "Reservations are not enabled for this business" });
  }

  const policy = await getOrInitPolicy(businessId);
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + policy.turnMinutes * 60000);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Serializable-ish: lock table row for the chosen table
      const rows = await tx.$queryRaw<{ id: string; capacity: number }[]>`
        SELECT t.id, t.capacity
        FROM tables t
        WHERE t.business_id = ${businessId}::uuid
          AND t.is_active = true
          AND t.capacity >= ${partySize}
          AND NOT EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.table_id = t.id
              AND r.status IN ('PENDING','CONFIRMED')
              AND r.starts_at < ${end}
              AND r.ends_at > ${start}
          )
        ORDER BY t.capacity ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
      `;
      
      const row = rows[0];
      if (!row) throw new Error("No table available");

      return await tx.reservation.create({
        data: {
          businessId,
          userId: ctx.id as string,
          tableId: row.id,
          partySize,
          startsAt: start,
          endsAt: end,
          status: policy.depositRequired ? "PENDING" : "CONFIRMED",
          source: source ?? "web",
        },
      });
    }, { isolationLevel: "Serializable" });

    await publishEvent("reservation.created", { id: reservation.id, reservation });
    res.status(201).json(reservation);

  } catch (err: any) {
    if (err.message === "No table available") {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
}

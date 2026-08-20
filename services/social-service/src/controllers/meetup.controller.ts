import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import crypto from "crypto";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

export async function createMeetup(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const data = req.body;

  const meetup = await prisma.meetup.create({ 
    data: { 
      organizerId: ctx.id,
      businessId: data.businessId,
      title: data.title,
      description: data.description,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      capacity: data.capacity,
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      tags: data.tags || [],
      requireApproval: data.requireApproval || false,
    } 
  });

  // Best-effort reservation would go here (mocking successful creation without auto-reserve for now)
  // or we could use fetch/axios to call reservation service.

  await publishEvent("meetup.created", {
    id: crypto.randomUUID(),
    meetupId: meetup.id,
    organizerId: ctx.id,
    businessId: data.businessId,
    startsAt: meetup.startsAt,
  });

  res.status(201).json(meetup);
}

export async function updateMeetup(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params;
  const data = req.body;

  const meetup = await prisma.meetup.findUnique({ where: { id } });
  if (!meetup) return res.status(404).json({ error: "Not found" });
  if (meetup.organizerId !== ctx.id) return res.status(403).json({ error: "Forbidden" });

  const updated = await prisma.meetup.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      capacity: data.capacity,
      isPublic: data.isPublic,
      status: data.status,
    }
  });

  await publishEvent("meetup.updated", { meetupId: id, delta: data });
  res.json(updated);
}

export async function cancelMeetup(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params;

  const meetup = await prisma.meetup.findUnique({ where: { id } });
  if (!meetup) return res.status(404).json({ error: "Not found" });
  if (meetup.organizerId !== ctx.id) return res.status(403).json({ error: "Forbidden" });

  await prisma.meetup.update({
    where: { id },
    data: { status: "CANCELLED" }
  });

  await publishEvent("meetup.cancelled", { meetupId: id, reason: "Organizer cancelled" });
  res.json({ success: true });
}

export async function listMeetups(req: Request, res: Response) {
  const { city, businessId } = req.query;
  const where: any = { status: "SCHEDULED" };
  if (businessId) where.businessId = businessId as string;
  // city filter requires joining with Business model or passing city to Meetup
  
  const meetups = await prisma.meetup.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: 20
  });

  res.json(meetups);
}

export async function getMeetupDetails(req: Request, res: Response) {
  const { id } = req.params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: { rsvps: true }
  });

  if (!meetup) return res.status(404).json({ error: "Not found" });
  res.json(meetup);
}

export async function rsvpToMeetup(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params;
  const { status } = req.body; // GOING | MAYBE | DECLINED

  const meetup = await prisma.meetup.findUnique({ 
    where: { id },
    include: { rsvps: { where: { status: "GOING" } } }
  });
  
  if (!meetup) return res.status(404).json({ error: "Not found" });

  let finalStatus = status;

  if (status === "GOING") {
    if (meetup.requireApproval) {
      finalStatus = "MAYBE";
    } else if (meetup.capacity && meetup.rsvps.length >= meetup.capacity) {
      finalStatus = "MAYBE"; // waitlist behavior
    }
  }

  const rsvp = await prisma.meetupRsvp.upsert({
    where: { meetupId_userId: { meetupId: id, userId: ctx.id } },
    update: { status: finalStatus },
    create: { meetupId: id, userId: ctx.id, status: finalStatus },
  });

  await publishEvent("meetup.rsvp", { meetupId: id, userId: ctx.id, status: finalStatus });
  res.json(rsvp);
}

export async function removeRsvp(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params;

  await prisma.meetupRsvp.deleteMany({
    where: { meetupId: id, userId: ctx.id }
  });

  await publishEvent("meetup.rsvp", { meetupId: id, userId: ctx.id, status: "DECLINED" });
  res.json({ success: true });
}

import { Request, Response } from "express";
import { PrismaClient, BusinessMemberRole } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import crypto from "crypto";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000" };
}

export async function createGroup(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { name, slug, logoUrl, websiteUrl } = req.body;

  try {
    const group = await prisma.businessGroup.create({
      data: { ownerId: ctx.id, name, slug, logoUrl, websiteUrl }
    });
    
    await publishEvent("group.created", { groupId: group.id, ownerId: ctx.id });
    res.status(201).json(group);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    throw e;
  }
}

export async function getGroups(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const groups = await prisma.businessGroup.findMany({
    where: { ownerId: ctx.id },
    include: { businesses: true }
  });
  res.json(groups);
}

export async function attachBusiness(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id, businessId } = req.params;

  const group = await prisma.businessGroup.findUnique({ where: { id } });
  if (!group || group.ownerId !== ctx.id) return res.status(403).json({ error: "Forbidden" });

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.ownerId !== ctx.id) return res.status(403).json({ error: "Forbidden" });

  await prisma.business.update({
    where: { id: businessId },
    data: { groupId: id }
  });

  await publishEvent("group.business_attached", { groupId: id, businessId });
  res.json({ success: true });
}

export async function detachBusiness(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id, businessId } = req.params;

  const group = await prisma.businessGroup.findUnique({ where: { id } });
  if (!group || group.ownerId !== ctx.id) return res.status(403).json({ error: "Forbidden" });

  await prisma.business.update({
    where: { id: businessId },
    data: { groupId: null }
  });

  res.json({ success: true });
}

export async function getGroupAnalytics(req: Request, res: Response) {
  // Pass-through to Analytics Service
  // In reality we would call the analytics-service with a list of business IDs.
  res.json({ status: "mocked group analytics" });
}

export async function inviteMember(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { id } = req.params; // businessId
  const { email, role } = req.body;

  // Real world: create an invite token, save to db, and publish event.
  const token = crypto.randomBytes(20).toString("hex");
  
  // Here we assume member.invited will be consumed by notification-service to send the email.
  await publishEvent("member.invited", { 
    email, 
    businessId: id, 
    role, 
    token 
  });
  
  res.status(200).json({ success: true, message: "Invite sent" });
}

// Endpoint to simulate a user accepting an invite
export async function acceptInvite(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { token, businessId, role } = req.body; 
  // Normally we would verify the token from the DB. 
  // For Phase 9 simulation we just create the membership directly.
  
  const member = await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId, userId: ctx.id } },
    update: { role: role as BusinessMemberRole },
    create: { businessId, userId: ctx.id, role: role as BusinessMemberRole, invitedById: "system" }
  });

  await publishEvent("member.joined", { businessId, userId: ctx.id, role });
  res.status(200).json(member);
}

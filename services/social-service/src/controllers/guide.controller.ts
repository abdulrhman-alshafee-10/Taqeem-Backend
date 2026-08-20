import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";

const prisma = new PrismaClient();

function getUserContext(req: Request) {
  return { 
    id: req.headers["x-user-id"] as string || "00000000-0000-0000-0000-000000000000",
    reputation: (req.headers["x-user-reputation"] as string) || "EXPLORER" 
  };
}

export async function applyForGuide(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const { city, text } = req.body;

  // In reality we would check if they have >= 15 reviews in the target city via internal HTTP call.
  // For now we mock the gate pass.
  
  // Gate check (mocked)
  if (ctx.reputation !== "TRUSTED" && ctx.reputation !== "GUIDE") {
     return res.status(403).json({ error: "Reputation must be TRUSTED or higher" });
  }

  // Auto-approve logic (mocked review count)
  const isGuide = ctx.reputation === "GUIDE";
  const has30Reviews = true; // mock

  let status = "APPLIED";
  let perks: string[] = [];
  
  if (isGuide && has30Reviews) {
    status = "APPROVED";
    perks = ["priority_support", "early_features", "editorial_publish", "verified_badge"];
  }

  const guide = await prisma.localGuide.upsert({
    where: { userId: ctx.id },
    create: {
      userId: ctx.id,
      city,
      applicationText: text,
      status,
      perks,
      approvedAt: status === "APPROVED" ? new Date() : null,
      approvedById: status === "APPROVED" ? "system" : null,
    },
    update: {
      city,
      applicationText: text,
      status,
    }
  });

  if (status === "APPROVED") {
    await publishEvent("guide.approved", { userId: ctx.id, city, approvedById: "system" });
  } else {
    await publishEvent("guide.applied", { userId: ctx.id, city });
  }

  res.status(201).json(guide);
}

export async function getGuideProfile(req: Request, res: Response) {
  const { userId } = req.params;
  
  const guide = await prisma.localGuide.findUnique({
    where: { userId }
  });

  if (!guide) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(guide);
}

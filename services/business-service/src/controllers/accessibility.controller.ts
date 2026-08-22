import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserContext } from "@taqeem/shared/auth/context.js";

const prisma = new PrismaClient();

export async function getAccessibility(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const business = await prisma.business.findUnique({
      where: { id },
      select: { accessibility: true }
    });
    if (!business) return res.status(404).json({ error: "Business not found" });
    res.json(business.accessibility);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function confirmAccessibility(req: Request, res: Response) {
  try {
    const ctx = getUserContext(req);
    const { id } = req.params;
    const { path, value, photoUrl } = req.body;

    if (!path || !value) return res.status(400).json({ error: "Path and value required" });

    await prisma.accessibilityConfirmation.upsert({
      where: { businessId_userId_path: { businessId: id, userId: ctx.id as string, path } },
      create: { businessId: id, userId: ctx.id as string, path, value, photoUrl },
      update: { value, photoUrl }
    });

    // Check threshold (3 matching confirmations)
    const confirmations = await prisma.accessibilityConfirmation.findMany({
      where: { businessId: id, path, value }
    });

    if (confirmations.length >= 3) {
      const b = await prisma.business.findUnique({ where: { id } });
      if (b) {
        const acc = (b.accessibility as any) || {};
        const parts = path.split(".");
        let curr = acc;
        for (let i = 0; i < parts.length - 1; i++) {
          curr[parts[i]] = curr[parts[i]] || {};
          curr = curr[parts[i]];
        }
        
        // If owner didn't set it (UNKNOWN or missing), we update it
        if (!curr[parts[parts.length - 1]] || curr[parts[parts.length - 1]] === "UNKNOWN") {
          curr[parts[parts.length - 1]] = value;
          await prisma.business.update({
            where: { id },
            data: { accessibility: acc }
          });
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateAccessibility(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { accessibility } = req.body;

    // We assume owner check is done via middleware or in the route
    const business = await prisma.business.update({
      where: { id },
      data: { accessibility }
    });
    
    // In a real implementation we might publish an event so search-service updates ES
    // But let's assume a generic business updated event handles it, or we do it explicitly
    res.json(business.accessibility);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

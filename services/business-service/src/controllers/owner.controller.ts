import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

const prisma = new PrismaClient();

export async function myBusinesses(req: Request, res: Response) {
  const ctx = getUserContext(req);
  const items = await prisma.business.findMany({
    where: { ownerId: ctx.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ items });
}

export async function updateMyBusiness(req: Request, res: Response) {
  // requireBusinessOwner middleware already populated req.business
  const updated = await prisma.business.update({
    where: { id: req.business!.id },
    data: req.body,
    include: { hours: true },
  });
  await publishEvent("business.updated", { id: crypto.randomUUID(), business: updated });
  res.json(updated);
}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const badgesCataloguePath = path.resolve(__dirname, "../../../../../shared/catalogues/business-badges.json");

export async function getOwnerBadges(req: Request, res: Response) {
  const b = req.business!;
  const earned = await prisma.businessBadge.findMany({
    where: { businessId: b.id },
    orderBy: { awardedAt: 'desc' }
  });

  const catalogue = JSON.parse(fs.readFileSync(badgesCataloguePath, "utf-8"));

  const results = catalogue.map((def: any) => {
    const isEarned = earned.filter((e) => e.badgeKey.startsWith(def.key));
    const isEligible = def.scope === "*" || def.scope.split(",").includes(b.vertical);

    let progress = null;
    if (!isEarned.length && isEligible && def.category === "milestone") {
      // Very naive progress estimation based on key name
      const match = def.key.match(/_(\d+)_/);
      if (match) {
        const target = parseInt(match[1]);
        progress = { current: b.ratingCount, target };
      }
    }

    return {
      def,
      earned: isEarned,
      isEligible,
      progress
    };
  });

  res.json(results);
}

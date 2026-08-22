import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "../events/publisher.js";

const prisma = new PrismaClient();

export async function getMenu(req: Request, res: Response) {
  const { id } = req.params; // businessId
  
  const menu = await prisma.menu.findFirst({
    where: { businessId: id, isActive: true },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { variants: true }
          }
        }
      }
    }
  });

  res.json(menu || { message: "No active menu found" });
}

export async function createMenu(req: Request, res: Response) {
  const { id } = req.params; // businessId
  const data = req.body;

  const menu = await prisma.menu.create({
    data: {
      businessId: id,
      name: data.name,
      currency: data.currency || "EGP",
      isActive: data.isActive !== undefined ? data.isActive : true,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
    }
  });

  await publishEvent("menu.created", { menuId: menu.id, businessId: id });
  res.status(201).json(menu);
}

export async function updateMenuMetadata(req: Request, res: Response) {
  const { menuId } = req.params;
  const data = req.body;

  const menu = await prisma.menu.update({
    where: { id: menuId },
    data: {
      name: data.name,
      isActive: data.isActive,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
    }
  });

  await publishEvent("menu.updated", { menuId, businessId: menu.businessId });
  res.json(menu);
}

export async function addSection(req: Request, res: Response) {
  const { menuId } = req.params;
  const { title, position } = req.body;

  const section = await prisma.menuSection.create({
    data: { menuId, title, position: position || 0 }
  });

  res.status(201).json(section);
}

export async function addItem(req: Request, res: Response) {
  const { sectionId } = req.params;
  const data = req.body;

  const item = await prisma.menuItem.create({
    data: {
      sectionId,
      nameEn: data.nameEn || data.name,
      nameAr: data.nameAr,
      descriptionEn: data.descriptionEn || data.description,
      descriptionAr: data.descriptionAr,
      basePrice: data.basePrice,
      photoUrl: data.photoUrl,
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
      dietary: data.dietary || [],
      spiciness: data.spiciness,
      caloriesKcal: data.caloriesKcal,
      tags: data.tags || [],
      position: data.position || 0,
      variants: data.variants ? {
        create: data.variants
      } : undefined
    },
    include: { variants: true }
  });

  // Fetch businessId to publish full event
  const section = await prisma.menuSection.findUnique({ 
    where: { id: sectionId }, include: { menu: true }
  });
  
  if (section) {
    await publishEvent("menu.item_created", { 
      menuId: section.menuId, 
      businessId: section.menu.businessId,
      itemId: item.id
    });
  }

  res.status(201).json(item);
}

export async function updateItem(req: Request, res: Response) {
  const { itemId } = req.params;
  const data = req.body;

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      nameEn: data.nameEn || data.name,
      nameAr: data.nameAr,
      descriptionEn: data.descriptionEn || data.description,
      descriptionAr: data.descriptionAr,
      basePrice: data.basePrice,
      photoUrl: data.photoUrl,
      isAvailable: data.isAvailable,
      dietary: data.dietary,
      spiciness: data.spiciness,
      caloriesKcal: data.caloriesKcal,
      tags: data.tags,
      position: data.position,
    }
  });

  const section = await prisma.menuSection.findUnique({ 
    where: { id: item.sectionId }, include: { menu: true }
  });

  if (section) {
    if (data.isAvailable === false) {
      await publishEvent("menu.item_unavailable", { itemId: item.id, businessId: section.menu.businessId });
    }
    await publishEvent("menu.item_updated", { itemId: item.id, businessId: section.menu.businessId });
  }

  res.json(item);
}

export async function reorderMenu(req: Request, res: Response) {
  const { menuId } = req.params;
  const { sections } = req.body;
  // Payload: { sections: [ { id: "sec1", position: 0, items: [ { id: "it1", position: 0 } ] } ] }
  
  const transactions: any[] = [];
  
  for (const sec of sections) {
    transactions.push(prisma.menuSection.update({
      where: { id: sec.id },
      data: { position: sec.position }
    }));
    
    if (sec.items) {
      for (const item of sec.items) {
        transactions.push(prisma.menuItem.update({
          where: { id: item.id },
          data: { position: item.position, sectionId: sec.id }
        }));
      }
    }
  }

  await prisma.$transaction(transactions);
  
  const menu = await prisma.menu.findUnique({ where: { id: menuId }});
  if (menu) {
    await publishEvent("menu.updated", { menuId, businessId: menu.businessId });
  }
  
  res.json({ success: true });
}

import axios from "axios";

export async function importOcr(req: Request, res: Response) {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) return res.status(400).json({ error: "Missing photoUrl" });

    const agentUrl = process.env.AGENT_SERVICE_URL || "http://agent-service:4006";
    const { data } = await axios.post(`${agentUrl}/internal/ocr/menu`, { photoUrl });
    
    res.json(data);
  } catch (err: any) {
    console.error("importOcr error:", err.message);
    res.status(500).json({ error: "Failed to parse menu" });
  }
}

export async function importOcrConfirm(req: Request, res: Response) {
  try {
    const { menuId } = req.params;
    const { draft, replaceExisting } = req.body;

    const menu = await prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) return res.status(404).json({ error: "Menu not found" });

    await prisma.$transaction(async (tx) => {
      if (replaceExisting) {
        await tx.menuSection.deleteMany({ where: { menuId } });
      }
      for (const [i, s] of draft.sections.entries()) {
        const sec = await tx.menuSection.create({ data: { menuId, title: s.title, position: i } });
        for (const [j, item] of s.items.entries()) {
          const it = await tx.menuItem.create({
            data: {
              sectionId: sec.id,
              nameEn: item.nameEn || item.name,
              nameAr: item.nameAr,
              descriptionEn: item.descriptionEn || item.description,
              descriptionAr: item.descriptionAr,
              basePrice: item.basePrice,
              dietary: item.dietary,
              position: j,
            },
          });
          if (item.variants) {
            for (const v of item.variants) {
              await tx.menuVariant.create({ data: { itemId: it.id, label: v.label, priceDelta: v.priceDelta } });
            }
          }
        }
      }
    });

    await publishEvent("menu.updated", { menuId, businessId: menu.businessId, source: "ocr" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("importOcrConfirm error:", err.message);
    res.status(500).json({ error: "Failed to confirm menu draft" });
  }
}

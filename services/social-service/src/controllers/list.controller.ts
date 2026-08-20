import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { getUserContext } from "@taqeem/shared/auth/context.js";
import crypto from "node:crypto";

const prisma = new PrismaClient();

export async function createList(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const { title, description, isPublic, type = "USER_LIST" } = req.body;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + crypto.randomBytes(4).toString("hex");

  const list = await prisma.collection.create({
    data: {
      ownerId: ctx.id!,
      title,
      slug,
      description,
      type,
      visibility: isPublic ? "PUBLIC" : "PRIVATE",
    },
  });

  await publishEvent("list.created", {
    id: crypto.randomUUID(),
    listId: list.id,
    ownerId: list.ownerId,
    type: list.type,
    visibility: list.visibility,
  });

  res.status(201).json(list);
}

export async function addItem(req: Request, res: Response) {
  const ctx = getUserContext(req);
  if (!ctx.isAuthenticated) return res.status(401).json({ error: "Unauthenticated" });

  const { id } = req.params;
  const list = await prisma.collection.findUnique({
    where: { id },
    include: { collaborators: true },
  });
  
  if (!list) return res.status(404).json({ error: "Not found" });

  const canEdit =
    list.ownerId === ctx.id ||
    list.collaborators.some(c => c.userId === ctx.id && c.role === "EDITOR") ||
    ctx.isAdmin;
    
  if (!canEdit) return res.status(403).json({ error: "Forbidden" });

  const item = await prisma.collectionItem.create({
    data: {
      collectionId: id,
      businessId: req.body.businessId,
      note:       req.body.note,
      position:   req.body.position ?? 999,
      addedById:  ctx.id!,
    },
  });

  await publishEvent("list.item_added", {
    id: crypto.randomUUID(),
    listId: id,
    businessId: item.businessId,
    addedById: ctx.id,
  });
  
  res.status(201).json(item);
}

export async function getList(req: Request, res: Response) {
  const { slug } = req.params;
  const list = await prisma.collection.findUnique({
    where: { slug },
    include: { items: { orderBy: { position: "asc" } } },
  });
  
  if (!list) return res.status(404).json({ error: "Not found" });
  if (list.visibility === "PRIVATE") {
    const ctx = getUserContext(req);
    if (list.ownerId !== ctx.id && !ctx.isAdmin) return res.status(403).json({ error: "Forbidden" });
  }

  res.json(list);
}

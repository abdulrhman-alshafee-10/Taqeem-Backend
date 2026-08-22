import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function addToList(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { businessId } = req.params;
    const { list } = req.params; // "save", "want", "been"
    const systemKey = list.toUpperCase();

    const collection = await prisma.collection.findUnique({
      where: { ownerId_systemKey: { ownerId: userId, systemKey } }
    });

    if (!collection) {
      return res.status(404).json({ error: 'System list not found' });
    }

    await prisma.collectionItem.upsert({
      where: {
        collectionId_businessId: { collectionId: collection.id, businessId }
      },
      create: {
        collectionId: collection.id,
        businessId,
        addedById: userId
      },
      update: {} // already exists
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function removeFromList(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { businessId } = req.params;
    const { list } = req.params; 
    const systemKey = list.toUpperCase();

    const collection = await prisma.collection.findUnique({
      where: { ownerId_systemKey: { ownerId: userId, systemKey } }
    });

    if (!collection) {
      return res.status(404).json({ error: 'System list not found' });
    }

    await prisma.collectionItem.deleteMany({
      where: { collectionId: collection.id, businessId }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getList(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { list } = req.params; 
    const systemKey = list.toUpperCase();

    const collection = await prisma.collection.findUnique({
      where: { ownerId_systemKey: { ownerId: userId, systemKey } },
      include: { items: { orderBy: { addedAt: 'desc' } } }
    });

    if (!collection) {
      return res.status(404).json({ error: 'System list not found' });
    }

    res.json(collection.items);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function createWantAlert(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { businessId } = req.params;
    const { windowMin } = req.body;

    const alert = await prisma.wantAlert.upsert({
      where: { userId_businessId: { userId, businessId } },
      create: { userId, businessId, windowMin: windowMin || 120 },
      update: { windowMin: windowMin || 120 }
    });

    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteWantAlert(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { businessId } = req.params;

    await prisma.wantAlert.deleteMany({
      where: { userId, businessId }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

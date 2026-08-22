import { Request, Response } from "express";
import { Tip } from "../models/tip.model.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { redis } from "../redis.js";

export async function createTip(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { businessId, body, photoUrl } = req.body;
    if (!businessId || !body) return res.status(400).json({ error: "Missing fields" });

    const today = new Date().toISOString().split("T")[0];
    const dayKey = `tip:${userId}:${businessId}:${today}`;
    const first = await redis.set(dayKey, "1", { NX: true, EX: 24 * 3600 });
    if (!first) return res.status(429).json({ error: "One tip per day per business" });

    const doc = await Tip.create({ businessId, authorId: userId, body, photoUrl });
    
    await publishEvent("tip.posted", {
      id: crypto.randomUUID(),
      tipId: doc._id.toString(),
      businessId,
      authorId: userId,
    });
    
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listTips(req: Request, res: Response) {
  try {
    const { id: businessId } = req.params;
    const sort = req.query.sort === "helpful" ? { helpfulCount: -1, createdAt: -1 } : { createdAt: -1 };
    const limit = parseInt(req.query.limit as string) || 20;

    const tips = await Tip.find({ businessId, isDeleted: false })
      .sort(sort as any)
      .limit(limit);
      
    res.json({ items: tips });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function voteTip(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    const { id } = req.params;
    const doc = await Tip.findByIdAndUpdate(id, { $inc: { helpfulCount: 1 } }, { new: true });
    if (!doc) return res.status(404).json({ error: "Not found" });
    
    await publishEvent("tip.helpful_voted", { tipId: id, voterId: userId, authorId: doc.authorId });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

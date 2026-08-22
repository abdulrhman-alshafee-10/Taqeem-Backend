import { Request, Response } from "express";
import { Short } from "../models/short.model.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import crypto from "crypto";

export async function createShort(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { businessId, caption, tags, durationSec, key } = req.body;
    if (!businessId || !key) return res.status(400).json({ error: "Missing fields" });

    const doc = await Short.create({
      businessId,
      authorId: userId,
      caption,
      tags,
      durationSec,
      videoUrl: "processing", // temp
      status: "processing"
    });
    
    await publishEvent("short.uploaded", {
      id: crypto.randomUUID(),
      shortId: doc._id.toString(),
      businessId,
      authorId: userId,
      sourceKey: key
    });
    
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listShorts(req: Request, res: Response) {
  try {
    const { id: businessId } = req.params;
    const shorts = await Short.find({ businessId, status: "ready" })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ items: shorts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

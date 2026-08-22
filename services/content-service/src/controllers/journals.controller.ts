import { Request, Response } from "express";
import { Journal } from "../models/journal.model.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";

export async function createJournal(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, intro, city, coverUrl, stops, visibility } = req.body;
    if (!stops || stops.length < 2) return res.status(400).json({ error: "Journal must have at least 2 stops" });

    const doc = await Journal.create({
      authorId: userId,
      title, intro, city, coverUrl, stops, visibility
    });
    
    if (doc.visibility === "public") {
      await publishEvent("journal.published", {
        id: crypto.randomUUID(),
        journalId: doc._id.toString(),
        authorId: userId,
        city: doc.city,
        stopCount: doc.stops.length,
      });
    }
    
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getJournal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await Journal.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

import { Request, Response } from "express";
import crypto from "node:crypto";

export async function presign(req: Request, res: Response) {
  const { count, kind } = req.body;
  const uploads = [];
  
  // TODO: Replace with real AWS S3 SDK for production. See docs/production-checklist.md
  
  for (let i = 0; i < count; i++) {
    const key = `reviews/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${kind === "video" ? "mp4" : "jpg"}`;
    const url = `http://localhost:9000/mock-s3-bucket/${key}?signature=mock`;
    uploads.push({ url, key, publicUrl: `http://localhost:9000/cdn-mock/${key}` });
  }
  
  res.json({ uploads });
}

import { publishEvent } from "../events/publisher.js";

export async function mediaCallback(req: Request, res: Response) {
  const { key, kind, reviewId } = req.body;
  const url = `http://localhost:9000/cdn-mock/${key}`;
  
  await publishEvent("media.uploaded", {
    mediaId: crypto.randomUUID(),
    url,
    kind,
    reviewId,
  });
  
  res.json({ success: true });
}

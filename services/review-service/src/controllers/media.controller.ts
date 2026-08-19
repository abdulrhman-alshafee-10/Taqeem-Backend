import { Request, Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

// For local testing without AWS, we write to the local filesystem and serve it statically,
// OR if using MinIO, we would use the S3 SDK pointing to localhost:9000.
// Per user's request, we'll write directly to a local 'uploads' directory to keep it 100% local without S3 complexities for now,
// but structure it such that the transition to S3 is easy (or we can use S3 SDK with MinIO in a bit).

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error("Unsupported media type") as any, ok);
  },
});

export async function uploadMedia(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Returning a local URL that we will serve via Express static middleware
  const url = `http://localhost:4003/uploads/${req.file.filename}`;
  
  res.status(201).json({ 
    url, 
    type: req.file.mimetype.startsWith("image") ? "image" : "video" 
  });
}

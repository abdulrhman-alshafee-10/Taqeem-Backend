import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load catalogue
const CATALOGUE_PATH = path.resolve(__dirname, "../../../../../shared/catalogues/notifications.json");
let CATALOGUE: any = { groups: [], channels: [], defaults: {} };
try {
  CATALOGUE = JSON.parse(fs.readFileSync(CATALOGUE_PATH, "utf-8"));
} catch (e) {
  console.warn("Could not load notifications catalogue, using defaults.");
}

const knownTypes = new Set(CATALOGUE.groups.flatMap((g: any) => g.types));
const knownChannels = new Set(CATALOGUE.channels);

const PrefBatchSchema = z.record(
  z.string(), // type
  z.record(z.string(), z.boolean()) // channel -> enabled
);

export async function getPreferences(req: Request, res: Response) {
  const userId = (req as any).user?.id || "mock-user-id";
  const rows = await prisma.notifPreference.findMany({ where: { userId } });
  
  const shape: any = {};
  for (const r of rows) {
    shape[r.type] ??= {};
    shape[r.type][r.channel] = r.enabled;
  }
  
  res.json({ preferences: shape, catalogue: CATALOGUE });
}

export async function putPreferences(req: Request, res: Response) {
  const userId = (req as any).user?.id || "mock-user-id";
  const parsed = PrefBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad payload", details: parsed.error });
    return;
  }

  const ops = [];
  for (const [type, channels] of Object.entries(parsed.data)) {
    // If not strict mode, comment this out:
    // if (!knownTypes.has(type)) continue;
    
    for (const [channel, enabled] of Object.entries(channels)) {
      // if (!knownChannels.has(channel)) continue;
      
      ops.push(prisma.notifPreference.upsert({
        where: { userId_type_channel: { userId, type, channel: channel as any } },
        create: { userId, type, channel: channel as any, enabled },
        update: { enabled },
      }));
    }
  }
  
  await prisma.$transaction(ops);
  res.json({ ok: true });
}

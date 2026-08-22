import { Router } from "express";
import { getFeed, getRecent, purgeRecent, hydrateRecent } from "../controllers/feed.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.get("/", requireAuth as any, getFeed);
r.get("/recent", requireAuth as any, getRecent);
r.delete("/recent", requireAuth as any, purgeRecent);
r.post("/recent/hydrate", hydrateRecent);

export default r;

import { Router } from "express";
import { createJournal, getJournal } from "../controllers/journals.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/", requireAuth as any, createJournal);
r.get("/:id", getJournal);

export default r;

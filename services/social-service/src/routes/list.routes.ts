import { Router } from "express";
import { createList, addItem, getList } from "../controllers/list.controller.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";

const r = Router();

r.post("/", requireAuth as any, createList);
r.get("/:slug", getList);
r.post("/:id/items", requireAuth as any, addItem);

export default r;

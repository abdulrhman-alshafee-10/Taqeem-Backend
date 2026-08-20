import { Router, Request, Response, NextFunction } from "express";
import { chatStream, chatSync, getThread, deleteThread } from "../controllers/agent.controller.js";

const r = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.headers["x-user-id"]) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

r.post  ("/chat",             chatStream);
r.post  ("/chat/sync",        chatSync);
r.get   ("/threads/:threadId", requireAuth as any, getThread as any);
r.delete("/threads/:threadId", requireAuth as any, deleteThread as any);

export default r;

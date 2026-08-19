import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";

// Extend Express Request to include id
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers["x-request-id"] as string || uuid();
  req.id = id;
  res.setHeader("x-request-id", id);
  next();
}

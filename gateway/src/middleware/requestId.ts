import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";

// Extend Express Request to include reqId
declare global {
  namespace Express {
    interface Request {
      reqId?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers["x-request-id"] as string || uuid();
  req.reqId = id;
  res.setHeader("x-request-id", id);
  next();
}

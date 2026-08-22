import { Request, Response, NextFunction } from "express";

/**
 * Ensures that the route is only accessible internally by verifying a shared secret token.
 * This should be applied to any /internal/* endpoints that services expose to each other
 * but which must never be reachable by the public Gateway.
 */
export function internalOnly(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-internal-token"];
  
  if (!token || token !== process.env.INTERNAL_TOKEN) {
    console.warn(`Blocked unauthorized access attempt to internal endpoint: ${req.path}`);
    return res.status(403).json({ error: "Forbidden: Internal access only" });
  }
  
  next();
}

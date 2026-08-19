import { Request, Response, NextFunction } from "express";

export function getUserContext(req: Request) {
  const id = req.header("x-user-id");
  const role = req.header("x-user-role");
  return {
    id: id || null,
    role: role || null,
    isAuthenticated: Boolean(id),
    isOwner: role === "OWNER",
    isAdmin: role === "ADMIN",
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.header("x-user-id")) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  next();
}

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.header("x-user-role");
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, VerifyOptions } from "jsonwebtoken";
import { logger } from "../utils/logger.js";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { role?: string };
    }
  }
}

const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");

const VERIFY_OPTS: VerifyOptions = {
  algorithms: ["RS256"],
  issuer: "taqeem.user-service",
  audience: "taqeem.api",
};

export interface AuthOptions {
  required?: boolean;
  roles?: string[];
}

export function authenticate(opts: AuthOptions = {}) {
  const { required = true, roles } = opts;

  return (req: Request, res: Response, next: NextFunction) => {
    // If public key is missing and auth is required, fail closed
    if (!PUBLIC_KEY && required) {
      logger.error("JWT_PUBLIC_KEY is not configured");
      return res.status(500).json({ error: "Auth configuration error" });
    }

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      if (required) return res.status(401).json({ error: "Missing token" });
      return next();
    }

    if (!PUBLIC_KEY) {
      // Missing public key but auth is optional, treat as unauthenticated
      return next();
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, PUBLIC_KEY, VERIFY_OPTS) as JwtPayload;
      req.user = payload;

      if (roles && !roles.includes(payload.role as string)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    } catch (err: any) {
      logger.warn({ err: err.message, reqId: req.id }, "jwt verify failed");
      if (required) return res.status(401).json({ error: "Invalid token" });
      next();
    }
  };
}

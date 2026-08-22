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

const getKeys = () => {
  if (process.env.JWKS_CONFIG) {
    return JSON.parse(process.env.JWKS_CONFIG);
  }
  if (process.env.JWT_PUBLIC_KEY) {
    return [{ kid: "default", publicKeyPem: process.env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n") }];
  }
  return [];
};

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
    const keys = getKeys();

    if (keys.length === 0 && required) {
      logger.error("No JWT keys configured (JWKS_CONFIG or JWT_PUBLIC_KEY)");
      return res.status(500).json({ error: "Auth configuration error" });
    }

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      if (required) return res.status(401).json({ error: "Missing token" });
      return next();
    }

    if (keys.length === 0) {
      return next();
    }

    const token = header.slice(7);
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === "string" || !decoded.header) {
        throw new Error("Invalid token format");
      }

      const kid = decoded.header.kid || "default";
      const keyObj = keys.find((k: any) => k.kid === kid);
      
      if (!keyObj) {
        throw new Error(`Key ID ${kid} not found in JWKS`);
      }

      const payload = jwt.verify(token, keyObj.publicKeyPem, VERIFY_OPTS) as JwtPayload;
      req.user = payload;

      if (roles && !roles.includes(payload.role as string)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    } catch (err: any) {
      logger.warn({ err: err.message, reqId: (req as any).reqId }, "jwt verify failed");
      if (required) return res.status(401).json({ error: "Invalid token" });
      next();
    }
  };
}

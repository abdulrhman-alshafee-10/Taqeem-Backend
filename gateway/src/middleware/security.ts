import helmet from "helmet";
import cors from "cors";
import express from "express";
import { Application } from "express";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

/**
 * Apply the full security middleware stack.
 */
export function applySecurity(app: Application) {
  // 1. Remove X-Powered-By header
  app.disable("x-powered-by");

  // 2. Helmet — sets secure HTTP headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", "data:", "https://cdn.taqeem.app"],
        connectSrc:  ["'self'", "https://api.taqeem.app"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com"],
        objectSrc:   ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge:            63_072_000,   // 2 years
      includeSubDomains: true,
      preload:           true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false,   // disable if serving media cross-origin
  }));

  // 3. CORS
  app.use(cors({
    origin: (origin, cb) => {
      // Allow server-to-server requests (no origin) and whitelisted origins
      if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*")) {
        return cb(null, true);
      }
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods:          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders:   ["Content-Type", "Authorization", "x-request-id"],
    exposedHeaders:   ["x-request-id", "X-RateLimit-Remaining"],
    credentials:      true,
    maxAge:           86_400,    // 24 h preflight cache
  }));

  // 4. Body size limits (prevent large payload DoS)
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: true, limit: "256kb" }));

  // 5. Trust proxy for accurate IP (Kubernetes ingress)
  app.set("trust proxy", 1);
}

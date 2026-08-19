import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";

import { routeTable } from "./config/routes.js";
import { requestId } from "./middleware/requestId.js";
import { globalLimiter, authLimiter } from "./middleware/rateLimit.js";
import { authenticate } from "./middleware/auth.js";
import { logger } from "./utils/logger.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
app.use(globalLimiter);

// Tighter limits on auth endpoints
app.use(["/api/users/login", "/api/users/register"], authLimiter);

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });

for (const route of routeTable) {
  const middlewares: any[] = [];

  if (route.auth === "required") {
    middlewares.push(authenticate({ required: true, roles: route.roles }));
  } else if (route.auth === "optional" || route.auth === "mixed") {
    middlewares.push(authenticate({ required: false }));
  }

  middlewares.push(
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      xfwd: true,
      proxyTimeout: 15_000,
      timeout: 15_000,
      on: {
        proxyReq: (proxyReq, req: any) => {
          // Strip incoming Authorization; downstream trusts injected headers only
          proxyReq.removeHeader("authorization");
          if (req.user) {
            proxyReq.setHeader("x-user-id", req.user.sub as string);
            proxyReq.setHeader("x-user-role", req.user.role as string);
          }
          proxyReq.setHeader("x-request-id", req.id);
        },
        error: (err, req, res: any) => {
          logger.error({ err, path: req.path }, "proxy error");
          if (!res.headersSent) {
            res.status(502).json({ error: "Bad gateway" });
          }
        },
      },
    })
  );

  app.use(route.context, ...middlewares);
}

app.use((req: Request, res: Response) => { res.status(404).json({ error: "Not found" }) });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Gateway listening on :${PORT}`));

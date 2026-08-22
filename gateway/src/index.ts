import "../../shared/tracing/tracing.js";
import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

import { routeTable } from "./config/routes.js";
import { requestId } from "./middleware/requestId.js";
import { globalLimiter, authLimiter } from "./middleware/rateLimit.js";
import { authenticate } from "./middleware/auth.js";
import { tracingMiddleware } from "./middleware/tracing.js";
import { httpLogger } from "../../shared/logger/httpLogger.js";
import { httpMetricsMiddleware } from "../../shared/metrics/httpMetricsMiddleware.js";
import { register } from "../../shared/metrics/metrics.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(tracingMiddleware);
app.use(httpLogger(process.env.OTEL_SERVICE_NAME ?? "gateway"));
app.use(httpMetricsMiddleware(process.env.OTEL_SERVICE_NAME ?? "gateway"));
app.use(globalLimiter);

// Tighter limits on auth endpoints
app.use(["/api/users/login", "/api/users/register"], authLimiter);

app.get("/health", (_req: Request, res: Response) => { res.json({ status: "ok" }) });
app.get("/metrics", async (req: Request, res: Response) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

for (const route of routeTable) {
  const middlewares: any[] = [];

  if (route.auth === "required") {
    middlewares.push(authenticate({ required: true, roles: route.roles }));
  } else if (route.auth === "optional" || route.auth === "mixed") {
    middlewares.push(authenticate({ required: false }));
  }

  // Removed req.url mutation

  middlewares.push(
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      xfwd: true,
      proxyTimeout: route.context === "/api/agent" ? 120_000 : 15_000,
      timeout: route.context === "/api/agent" ? 120_000 : 15_000,
      pathRewrite: (path, req) => (req as any).originalUrl,
      on: {
        proxyReq: (proxyReq, req: any) => {
          // Strip incoming Authorization; downstream trusts injected headers only
          proxyReq.removeHeader("authorization");
          if (req.user) {
            proxyReq.setHeader("x-user-id", req.user.sub as string);
            proxyReq.setHeader("x-user-role", req.user.role as string);
          }
          proxyReq.setHeader("x-request-id", req.reqId);
        },
        error: (err, req: any, res: any) => {
          console.error("proxy error", err, req.path);
          if (!res.headersSent) {
            res.status(502).json({ error: "Bad gateway" });
          }
        },
      },
    })
  );

  app.use(route.context, ...middlewares);
}

app.use((req: Request, res: Response) => { res.status(404).json({ error: "Gateway Route Not Found" }) });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gateway listening on :${PORT}`));

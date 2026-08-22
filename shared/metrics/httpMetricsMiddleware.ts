import { Request, Response, NextFunction } from "express";
import { httpRequestDuration, httpRequestTotal } from "./metrics.js";

export function httpMetricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route  = req.route?.path ?? req.path ?? "unknown";
      const labels = {
        method:      req.method,
        route,
        status_code: String(res.statusCode),
        service:     serviceName,
      };

      httpRequestDuration.observe(labels, durationSec);
      httpRequestTotal.inc(labels);
    });

    next();
  };
}

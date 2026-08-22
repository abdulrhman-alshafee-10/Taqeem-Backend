import pinoHttp from "pino-http";
import { createLogger } from "./logger.js";
import { Request, Response } from "express";

export function httpLogger(serviceName: string) {
  return pinoHttp({
    logger: createLogger(serviceName),
    autoLogging: {
      ignore: (req) =>
        req.url === "/health" ||
        req.url === "/healthz" ||
        req.url === "/readyz" ||
        req.url === "/metrics",   // suppress health + metrics probe noise
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage(req, res, err) {
      return `${req.method} ${req.url} ${res.statusCode} — ${err.message}`;
    },
    serializers: {
      req: (req) => ({
        method:    req.method,
        url:       req.url,
        requestId: (req.headers as any)["x-request-id"],
        userId:    (req.headers as any)["x-user-id"] ?? null,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}

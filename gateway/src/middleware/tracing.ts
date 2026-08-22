import { trace } from "@opentelemetry/api";
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  // If client sends W3C traceparent, OTel will extract it automatically.
  // We additionally surface the trace ID as x-request-id for log correlation.
  const span = trace.getActiveSpan();
  const traceId = span ? span.spanContext().traceId : randomUUID().replace(/-/g, "");

  (req as any).traceId = traceId;
  res.setHeader("x-request-id", traceId);
  req.headers["x-request-id"] = traceId;

  // Inject x-user-id into the active span for audit trails
  const userId = req.headers["x-user-id"];
  if (userId && span) {
    span.setAttribute("enduser.id", typeof userId === "string" ? userId : userId[0]);
    span.setAttribute("enduser.role", req.headers["x-user-role"] ?? "anonymous");
  }

  next();
}

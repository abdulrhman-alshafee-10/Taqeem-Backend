import pino from "pino";
import { trace } from "@opentelemetry/api";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "body.password",
  "body.newPassword",
  "body.cardNumber",
  "body.cvv",
  "*.token",
  "*.secret",
];

export function createLogger(serviceName: string) {
  return pino({
    name:   serviceName,
    level:  process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),

    redact: {
      paths:   REDACT_PATHS,
      censor:  "[REDACTED]",
    },

    formatters: {
      level: (label) => ({ level: label }),   // use string level names
    },

    // Inject OTel trace context into every log line
    mixin() {
      const span = trace.getActiveSpan();
      if (!span) return {};
      const ctx = span.spanContext();
      return {
        traceId: ctx.traceId,
        spanId:  ctx.spanId,
      };
    },

    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

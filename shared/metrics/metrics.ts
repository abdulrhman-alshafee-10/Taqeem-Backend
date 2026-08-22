import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";

export const register = new Registry();

// Default Node.js metrics (event loop lag, heap, GC, etc.)
collectDefaultMetrics({ register });

// ── HTTP ──────────────────────────────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name:       "http_request_duration_seconds",
  help:       "HTTP request latency",
  labelNames: ["method", "route", "status_code", "service"],
  buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers:  [register],
});

export const httpRequestTotal = new Counter({
  name:       "http_requests_total",
  help:       "Total HTTP requests",
  labelNames: ["method", "route", "status_code", "service"],
  registers:  [register],
});

// ── Events ────────────────────────────────────────────────────────────────────
export const eventsPublishedTotal = new Counter({
  name:       "events_published_total",
  help:       "Events published to RabbitMQ",
  labelNames: ["routing_key", "service"],
  registers:  [register],
});

export const eventsConsumedTotal = new Counter({
  name:       "events_consumed_total",
  help:       "Events consumed from RabbitMQ",
  labelNames: ["routing_key", "queue", "service", "result"],  // result: success|error
  registers:  [register],
});

export const dlqDepth = new Gauge({
  name:       "rabbitmq_dlq_depth",
  help:       "Messages currently in dlq.events.queue",
  labelNames: ["queue"],
  registers:  [register],
});

// ── Database ──────────────────────────────────────────────────────────────────
export const dbQueryDuration = new Histogram({
  name:       "db_query_duration_seconds",
  help:       "Database query latency",
  labelNames: ["operation", "model", "service"],
  buckets:    [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers:  [register],
});

// ── Business ──────────────────────────────────────────────────────────────────
export const reviewsCreatedTotal = new Counter({
  name:       "reviews_created_total",
  help:       "Reviews created",
  labelNames: ["vertical"],
  registers:  [register],
});

export const reservationsBookedTotal = new Counter({
  name:       "reservations_booked_total",
  help:       "Reservations booked",
  labelNames: ["status"],   // confirmed|cancelled|no_show
  registers:  [register],
});

export const paymentsProcessedTotal = new Counter({
  name:       "payments_processed_total",
  help:       "Payment transactions",
  labelNames: ["status", "provider"],  // status: succeeded|failed|refunded
  registers:  [register],
});

export const activeSubscriptions = new Gauge({
  name:       "subscriptions_active_total",
  help:       "Currently active business subscriptions",
  labelNames: ["tier"],
  registers:  [register],
});

export const agentQueryDuration = new Histogram({
  name:       "agent_query_duration_seconds",
  help:       "AI agent query latency (first token)",
  buckets:    [0.1, 0.2, 0.5, 0.8, 1.5, 3, 5],
  registers:  [register],
});

import CircuitBreaker from "opossum";
import { createLogger } from "../logger/logger.js";
const logger = createLogger("circuit-breaker");
import { Counter, Gauge } from "prom-client";
import { register } from "../metrics/metrics.js";

// Prometheus metrics
const cbState = new Gauge({
  name:       "circuit_breaker_state",
  help:       "Circuit breaker state: 0=closed, 1=open, 2=half-open",
  labelNames: ["name"],
  registers:  [register],
});

const cbFailures = new Counter({
  name:       "circuit_breaker_failures_total",
  help:       "Total circuit breaker failures",
  labelNames: ["name"],
  registers:  [register],
});

const cbFallbacks = new Counter({
  name:       "circuit_breaker_fallbacks_total",
  help:       "Total circuit breaker fallback activations",
  labelNames: ["name"],
  registers:  [register],
});

const DEFAULT_OPTIONS = {
  timeout:              5_000,
  errorThresholdPercentage: 50,
  resetTimeout:         30_000,
  volumeThreshold:      10,
  rollingCountTimeout:  10_000,
};

export function createCircuitClient(name: string, opts: any = {}) {
  const log = logger.child({ component: "circuit-breaker", downstream: name });

  async function doFetch(url: string, options: any) {
    const res = await fetch(url, { 
      ...options, 
      signal: AbortSignal.timeout(opts.timeout ?? 5_000) 
    });
    if (res.status >= 500) {
      throw Object.assign(new Error(`${name} responded ${res.status}`), { status: res.status });
    }
    return res;
  }

  const breaker = new CircuitBreaker(doFetch, {
    ...DEFAULT_OPTIONS,
    ...opts,
    name,
  });

  breaker.on("open",     () => { cbState.set({ name }, 1); log.warn("circuit OPEN"); });
  breaker.on("halfOpen", () => { cbState.set({ name }, 2); log.info("circuit HALF-OPEN"); });
  breaker.on("close",    () => { cbState.set({ name }, 0); log.info("circuit CLOSED"); });
  breaker.on("failure",  () => cbFailures.inc({ name }));
  breaker.on("fallback", () => cbFallbacks.inc({ name }));

  breaker.fallback(() => {
    throw Object.assign(
      new Error(`${name} is currently unavailable (circuit open)`),
      { status: 503, code: "CIRCUIT_OPEN" }
    );
  });

  return {
    fetch: (url: string, options: any) => breaker.fire(url, options),
    breaker,
  };
}

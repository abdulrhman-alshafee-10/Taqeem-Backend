import { Router } from "express";

export function createHealthRouter(serviceName: string, deps: any = {}) {
  const router = Router();

  router.get("/healthz", (req, res) => {
    res.status(200).json({
      status:  "ok",
      service: serviceName,
      uptime:  process.uptime(),
    });
  });

  router.get("/readyz", async (req, res) => {
    const checks: any = {};
    let allOk = true;

    if (deps.checkDb) {
      try {
        checks.db = await deps.checkDb() ? "ok" : "fail";
      } catch {
        checks.db = "fail";
      }
      if (checks.db !== "ok") allOk = false;
    }

    if (deps.checkRedis) {
      try {
        checks.redis = await deps.checkRedis() ? "ok" : "fail";
      } catch {
        checks.redis = "fail";
      }
      if (checks.redis !== "ok") allOk = false;
    }

    if (deps.checkBroker) {
      try {
        checks.broker = await deps.checkBroker() ? "ok" : "fail";
      } catch {
        checks.broker = "fail";
      }
      if (checks.broker !== "ok") allOk = false;
    }

    const status = allOk ? 200 : 503;
    res.status(status).json({
      status:  allOk ? "ok" : "degraded",
      service: serviceName,
      checks,
    });
  });

  return router;
}

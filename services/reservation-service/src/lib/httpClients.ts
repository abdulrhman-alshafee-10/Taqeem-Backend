import { createCircuitClient } from "@taqeem/shared/http/circuitClient.js";

export const businessClient = createCircuitClient("business-service", {
  timeout:  3_000,
  resetTimeout: 15_000,
});

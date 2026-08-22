import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "services/*/vitest.config.ts",
  "shared/vitest.config.ts",
]);

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths({ root: path.resolve(__dirname, "../../..") })],
  resolve: {
    alias: [
      { find: /^@taqeem\/shared\/(.*)\.js$/, replacement: path.resolve(__dirname, "../../../shared/$1.ts") },
      { find: /^@taqeem\/shared\/(.*)$/, replacement: path.resolve(__dirname, "../../../shared/$1") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["../../shared/test-utils/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});

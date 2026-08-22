import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    // Base URL is typically dynamically mapped based on environment, 
    // for this monorepo we'll target localhost APIs for now.
    baseURL: 'http://localhost:4002', 
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
});

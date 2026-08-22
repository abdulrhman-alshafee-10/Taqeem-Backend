# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.e2e.spec.ts >> API E2E Tests >> Can fetch businesses (Search Service)
- Location: tests\e2e\api.e2e.spec.ts:21:7

# Error details

```
Error: apiRequestContext.get: socket hang up
Call log:
  - → GET http://localhost:4005/health
    - user-agent: Playwright/1.62.1 (x64; windows 10.0) node/23.11
    - accept: application/json
    - accept-encoding: gzip,deflate,br

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe("API E2E Tests", () => {
  4  |   // This test hits the actual running service ports directly
  5  |   test("User Service is healthy", async ({ request }) => {
  6  |     const response = await request.get("http://localhost:4001/health");
  7  |     expect(response.ok()).toBeTruthy();
  8  |     const data = await response.json();
  9  |     expect(data.status).toBe("ok");
  10 |   });
  11 | 
  12 |   test("Review Service is healthy", async ({ request }) => {
  13 |     const response = await request.get("http://localhost:4003/health");
  14 |     expect(response.ok()).toBeTruthy();
  15 |     const data = await response.json();
  16 |     expect(data.status).toBe("ok");
  17 |   });
  18 | 
  19 |   // Example of a deeper E2E flow across services via API Gateway / load balancer
  20 |   // if one were running, but hitting direct service ports for backend monorepo setup:
  21 |   test("Can fetch businesses (Search Service)", async ({ request }) => {
> 22 |     const response = await request.get("http://localhost:4005/health");
     |                                    ^ Error: apiRequestContext.get: socket hang up
  23 |     expect(response.ok()).toBeTruthy();
  24 |   });
  25 | });
  26 | 
```
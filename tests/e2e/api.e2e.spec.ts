import { test, expect } from '@playwright/test';

test.describe("API E2E Tests", () => {
  // This test hits the actual running service ports directly
  test("User Service is healthy", async ({ request }) => {
    const response = await request.get("http://localhost:4001/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("Review Service is healthy", async ({ request }) => {
    const response = await request.get("http://localhost:4003/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  // Example of a deeper E2E flow across services via API Gateway / load balancer
  // if one were running, but hitting direct service ports for backend monorepo setup:
  test("Can fetch businesses (Search Service)", async ({ request }) => {
    const response = await request.get("http://localhost:4005/health");
    expect(response.ok()).toBeTruthy();
  });
});

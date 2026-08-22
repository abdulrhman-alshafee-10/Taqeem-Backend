import { vi, beforeEach } from "vitest";
import { publishedEvents, clearEvents } from "./mock-publisher.js";

// Provide default test environment variables to prevent initialization errors
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock?schema=public";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://mock:6379";
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://mock";

// Globally mock redis to prevent ENOTFOUND during health checks in tests
vi.mock("redis", async (importOriginal) => {
  return {
    createClient: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      exists: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      lPush: vi.fn(),
      lRange: vi.fn(),
      lTrim: vi.fn(),
      del: vi.fn(),
      ping: vi.fn().mockResolvedValue("PONG"),
      disconnect: vi.fn()
    }))
  };
});


// Mock the publisher globally
vi.mock("../events/publisher.js", () => ({
  initPublisher: vi.fn(),
  publishEvent: vi.fn((key, payload) => {
    publishedEvents().push({ key, payload });
    return Promise.resolve();
  }),
  closePublisher: vi.fn()
}));

// Mock the shared publisher if used
vi.mock("@taqeem/shared/events/publisher.js", () => ({
  initPublisher: vi.fn(),
  publishEvent: vi.fn((key, payload) => {
    publishedEvents().push({ key, payload });
    return Promise.resolve();
  }),
  closePublisher: vi.fn()
}));

beforeEach(() => {
  clearEvents();
});

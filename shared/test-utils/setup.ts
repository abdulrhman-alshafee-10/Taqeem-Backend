import { vi } from "vitest";
import { publishedEvents, clearEvents } from "./mock-publisher.js";

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

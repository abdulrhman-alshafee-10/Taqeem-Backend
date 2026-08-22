import { describe, it, expect } from "vitest";
import { RegisterSchema } from "../validate.js";

describe("RegisterSchema", () => {
  it("accepts valid input", () => {
    const result = RegisterSchema.safeParse({
      email:    "user@example.com",
      password: "P@ssw0rd!",
      name:     "Ahmed",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = RegisterSchema.safeParse({
      email: "user@example.com", password: "abc", name: "Ahmed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("password");
    }
  });

  it("rejects invalid email", () => {
    const result = RegisterSchema.safeParse({
      email: "not-an-email", password: "P@ssw0rd!", name: "Ahmed",
    });
    expect(result.success).toBe(false);
  });
});

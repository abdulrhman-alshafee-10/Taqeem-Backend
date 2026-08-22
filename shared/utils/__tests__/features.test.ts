import { describe, it, expect, vi } from "vitest";
import { isFeatureApplicable } from "../features.js";
import fs from "node:fs";

describe("isFeatureApplicable", () => {
  it("returns true if feature applies to all verticals (*)", () => {
    expect(isFeatureApplicable("deals_percent_off", "FOOD_DRINK")).toBe(true);
    expect(isFeatureApplicable("deals_percent_off", "CULTURE")).toBe(true);
  });

  it("returns true if feature specifically applies to vertical", () => {
    expect(isFeatureApplicable("menu", "FOOD_DRINK")).toBe(true);
  });

  it("returns false if feature does not apply to vertical", () => {
    expect(isFeatureApplicable("menu", "CULTURE")).toBe(false);
    expect(isFeatureApplicable("menu", "FITNESS")).toBe(false);
  });

  it("returns false for unknown feature", () => {
    expect(isFeatureApplicable("teleportation", "FOOD_DRINK")).toBe(false);
  });
});

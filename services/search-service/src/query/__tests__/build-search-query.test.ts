import { describe, it, expect } from "vitest";
import { buildSearchQuery } from "../build-search-query.js";

describe("buildSearchQuery", () => {
  it("builds a basic query with no parameters", () => {
    const query = buildSearchQuery({});
    expect(query).toHaveProperty("query.function_score.query.bool.filter");
    expect(query.query.function_score.query.bool.filter).toContainEqual({ term: { isActive: true } });
  });

  it("adds terms filters for categories and price tier", () => {
    const query = buildSearchQuery({ categories: ["cafe"], priceTier: ["$$"] });
    const filters = query.query.function_score.query.bool.filter;
    expect(filters).toContainEqual({ terms: { categories: ["cafe"] } });
    expect(filters).toContainEqual({ terms: { priceTier: ["$$"] } });
  });

  it("handles accessibility nested mapping", () => {
    const query = buildSearchQuery({ accessibility: ["mobility.wheelchair:FULL"] });
    const filters = query.query.function_score.query.bool.filter;
    expect(filters).toContainEqual({ term: { "accessibility.mobility.wheelchair": "FULL" } });
  });

  it("handles geo distance queries", () => {
    const query = buildSearchQuery({ lat: 24.7, lng: 46.7, radiusKm: 5 });
    const filters = query.query.function_score.query.bool.filter;
    expect(filters).toContainEqual({
      geo_distance: { distance: "5km", location: { lat: 24.7, lon: 46.7 } }
    });
    // script fields for distance
    expect(query.script_fields).toHaveProperty("distanceKm");
  });
});

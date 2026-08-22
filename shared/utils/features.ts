import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(__dirname, "../catalogues/feature-applicability.json");

let FEATURE_APPLICABILITY: Record<string, string[]> = {};
try {
  const fileContent = fs.readFileSync(cataloguePath, "utf-8");
  FEATURE_APPLICABILITY = JSON.parse(fileContent);
} catch (error) {
  console.error("Failed to load feature-applicability.json", error);
}

export function isFeatureApplicable(feature: string, vertical: string): boolean {
  const apply = FEATURE_APPLICABILITY[feature];
  if (!apply) return false;
  return apply.includes("*") || apply.includes(vertical);
}

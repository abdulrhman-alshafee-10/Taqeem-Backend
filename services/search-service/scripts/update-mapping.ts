import { client } from "../src/es.js";
import fs from "node:fs";
import path from "node:path";

const mappingsPath = path.resolve(process.cwd(), "scripts/index/mappings.json");
const mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf8"));

const INDEX = "businesses_v1";

async function main() {
  await client.indices.putMapping({
    index: INDEX,
    properties: mappings.mappings.properties
  });
  console.log(`Updated mapping for ${INDEX}`);
}

main().catch(err => { console.error(err); process.exit(1); });

import { client } from "../src/es.js";
import fs from "node:fs";
import path from "node:path";

const settingsPath = path.resolve(process.cwd(), "scripts/index/settings.json");
const mappingsPath = path.resolve(process.cwd(), "scripts/index/mappings.json");

const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
const mappings = JSON.parse(fs.readFileSync(mappingsPath, "utf8"));

const INDEX = "businesses_v1";
const ALIAS = "businesses";

async function main() {
  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    await client.indices.create({
      index: INDEX,
      settings: settings.settings,
      mappings: mappings.mappings,
    });
    console.log(`Created ${INDEX}`);
  }
  
  let aliases: any = {};
  try {
    aliases = await client.indices.getAlias({ name: ALIAS });
  } catch (e) {
    // Alias does not exist
  }
  
  if (!aliases[INDEX]) {
    await client.indices.putAlias({ index: INDEX, name: ALIAS });
    console.log(`Alias ${ALIAS} → ${INDEX}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

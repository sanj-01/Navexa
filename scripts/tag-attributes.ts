// Bulk-tag chunks with attributes_hint from a CSV mapping. §6.3.
//
// CSV format (no header):
//   chunk_id,attr1|attr2|attr3
//
// Usage:
//   npm run tag-attributes -- data/attribute-hints.csv

import { promises as fs } from "fs";
import { createClient } from "@supabase/supabase-js";

const ATTR_ALLOWED = new Set([
  "handles_food","prepares_food_onsite","manufactures","assembles_only","services_only",
  "trades_goods","professional_regulated","customer_premises","home_based","storage_goods",
  "owns_premises","signage","operates_vehicles","employees_none","employees_micro",
  "employees_small","employees_medium","employees_large","employs_women_night",
  "employs_contract_labour","turnover_below_threshold","turnover_above_threshold",
  "interstate_supply","sells_online","imports_exports","effluent_discharge_low",
  "effluent_discharge_high","emissions_air","fire_risk_public","packaged_goods_by_weight",
  "alcohol","hazardous_handling",
]);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run tag-attributes -- <csv>");
    process.exit(1);
  }
  const raw = await fs.readFile(file, "utf-8");
  const rows = raw.split(/\r?\n/).filter(Boolean);

  const sb = createClient(reqEnv("NEXT_PUBLIC_SUPABASE_URL"), reqEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  let updated = 0;
  const bad: string[] = [];
  for (const line of rows) {
    const [chunkId, attrsRaw] = line.split(",", 2);
    if (!chunkId) continue;
    const attrs = (attrsRaw ?? "")
      .split("|")
      .map((a) => a.trim())
      .filter(Boolean);
    const unknown = attrs.filter((a) => !ATTR_ALLOWED.has(a));
    if (unknown.length > 0) {
      bad.push(`${chunkId}: unknown attribute(s) ${unknown.join(", ")}`);
      continue;
    }
    const { error } = await sb.from("chunks").update({ attributes_hint: attrs }).eq("chunk_id", chunkId);
    if (error) bad.push(`${chunkId}: ${error.message}`);
    else updated++;
  }

  console.log(`[tag-attributes] updated ${updated} chunks`);
  if (bad.length > 0) {
    console.error(`[tag-attributes] ${bad.length} error(s):`);
    for (const b of bad) console.error("  - " + b);
    process.exit(1);
  }
}

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

main().catch((err) => {
  console.error("[tag-attributes] failed:", err);
  process.exit(1);
});

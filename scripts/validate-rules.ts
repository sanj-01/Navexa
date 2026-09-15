// Fails the build if data/rules/obligations.json contains any:
//   - null citation.verified_on              (Gate 3, ANVIL-SPEC.md §4.2)
//   - attribute id outside src/lib/attributes.ts §3.2 enumeration
//   - depends_on target that does not exist in the file
//   - duplicate obligation id
//
// Run with: npm run validate-rules
// Wired into `npm run build` via the "prebuild" hook in package.json.

import { promises as fs } from "fs";
import path from "path";

// Inline the attribute enumeration so this script has no compile-time coupling
// to the app's @/ path aliases (tsx can be picky under different runners).
// If this list drifts from src/lib/attributes.ts, the mismatch itself is a bug
// — keep them in sync manually. There are only 31 ids.
const ATTRS = new Set<string>([
  "handles_food",
  "prepares_food_onsite",
  "manufactures",
  "assembles_only",
  "services_only",
  "trades_goods",
  "professional_regulated",
  "customer_premises",
  "home_based",
  "storage_goods",
  "owns_premises",
  "signage",
  "operates_vehicles",
  "employees_none",
  "employees_micro",
  "employees_small",
  "employees_medium",
  "employees_large",
  "employs_women_night",
  "employs_contract_labour",
  "turnover_below_threshold",
  "turnover_above_threshold",
  "interstate_supply",
  "sells_online",
  "imports_exports",
  "effluent_discharge_low",
  "effluent_discharge_high",
  "emissions_air",
  "fire_risk_public",
  "packaged_goods_by_weight",
  "alcohol",
  "hazardous_handling",
]);

interface Rule {
  id: string;
  depends_on?: string[];
  blocks?: string[];
  triggers?: {
    all?: string[];
    any?: string[];
    none?: string[];
    universal_base?: boolean;
  };
  citation?: { verified_on?: string | null };
}

async function main() {
  // Escape hatch for demo deploys — set SKIP_RULES_VALIDATION=1 to warn
  // instead of failing. Gate 3 (§4.5) still applies before real production
  // ship; this only unblocks Vercel builds where the human sweep hasn't
  // happened yet.
  const skip = process.env.SKIP_RULES_VALIDATION === "1";

  const file = path.join(process.cwd(), "data", "rules", "obligations.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    fail(`could not read ${file}: ${(err as Error).message}`);
  }

  let rules: Rule[];
  try {
    rules = JSON.parse(raw) as Rule[];
  } catch (err) {
    return fail(`obligations.json is not valid JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(rules)) return fail("obligations.json must be a JSON array of rule objects");

  const errors: string[] = [];
  const ids = new Set<string>();

  for (const r of rules) {
    if (!r.id) {
      errors.push("rule missing id field");
      continue;
    }
    if (ids.has(r.id)) errors.push(`duplicate obligation id: ${r.id}`);
    ids.add(r.id);

    // Attribute id checks
    const attrLists: [string, string[] | undefined][] = [
      ["triggers.all", r.triggers?.all],
      ["triggers.any", r.triggers?.any],
      ["triggers.none", r.triggers?.none],
    ];
    for (const [label, list] of attrLists) {
      for (const a of list ?? []) {
        if (!ATTRS.has(a)) errors.push(`${r.id}: unknown attribute in ${label}: ${a}`);
      }
    }

    // verified_on gate (§4.2)
    if (!r.citation || r.citation.verified_on === null || r.citation.verified_on === undefined) {
      errors.push(`${r.id}: citation.verified_on is null — Gate 3 requires a primary-source verification`);
    }
  }

  // depends_on dangling target check
  for (const r of rules) {
    for (const d of r.depends_on ?? []) {
      if (!ids.has(d)) errors.push(`${r.id}: depends_on references unknown obligation id: ${d}`);
    }
    for (const b of r.blocks ?? []) {
      if (!ids.has(b)) errors.push(`${r.id}: blocks references unknown obligation id: ${b}`);
    }
  }

  if (errors.length > 0) {
    const level = skip ? "warn" : "error";
    console[level](`\n[validate-rules] ${errors.length} issue(s) in data/rules/obligations.json:\n`);
    for (const e of errors) console[level]("  - " + e);
    console[level](
      "\nSee ANVIL-SPEC.md §4.2 and §4.5. Values that cannot be verified against\n" +
        "a primary source are deleted, not guessed. The obligation may still\n" +
        "render with the number replaced by \"confirm with authority.\"\n"
    );
    if (skip) {
      console.warn("[validate-rules] SKIP_RULES_VALIDATION=1 — allowing build to continue.");
      return;
    }
    process.exit(1);
  }

  console.log(`[validate-rules] ok — ${rules.length} rules, ${ids.size} unique ids, all citations verified.`);
}

function fail(msg: string): never {
  console.error(`[validate-rules] ${msg}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[validate-rules] unexpected failure:", err);
  process.exit(1);
});

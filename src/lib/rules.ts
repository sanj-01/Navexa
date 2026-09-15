// Loads and caches data/rules/obligations.json. The file is authored data — the
// validator (scripts/validate-rules.ts) is what protects it, not this loader.

import { promises as fs } from "fs";
import path from "path";
import type { Rule } from "@/types/rules";

let cache: Rule[] | null = null;

export async function loadRules(): Promise<Rule[]> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "rules", "obligations.json");
  const raw = await fs.readFile(file, "utf-8");
  const parsed = JSON.parse(raw) as Rule[];
  cache = parsed;
  return parsed;
}

// Test/dev only — never call from route handlers.
export function __resetRuleCache() {
  cache = null;
}

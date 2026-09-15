// Feasibility model — pure calculator, ANVIL-SPEC.md §11.5 and §14 risk register.
// Never routes any part of this through a model.

import { promises as fs } from "fs";
import path from "path";
import type { Attribute } from "@/lib/attributes";
import type { CostLine, FeasibilityVerdict } from "@/types/api";

interface CostModel {
  sector: string;
  label: string;
  capex: CostLine[];
  opex: CostLine[];
  assumptions: string[];
}

// Map from attribute profile to sector cost file. Five sectors are modelled —
// the four named in §11.5 plus a "general" fallback so every business sees a
// populated Feasibility view rather than the empty state.
export function sectorForAttributes(attrs: Attribute[]): string {
  const has = (a: string) => attrs.includes(a as Attribute);
  if (has("handles_food") && (has("prepares_food_onsite") || has("customer_premises"))) return "food-service";
  if (has("manufactures") || has("assembles_only")) return "small-manufacturing";
  if (has("trades_goods") && has("customer_premises")) return "retail";
  if (has("professional_regulated") || (has("services_only") && !has("trades_goods"))) return "professional-services";
  return "general";
}

export async function loadCostModel(sector: string): Promise<CostModel | null> {
  const file = path.join(process.cwd(), "data", "costs", `${sector}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as CostModel;
  } catch {
    return null;
  }
}

export function verdict(runwayMonths: number, budget: number | undefined, capexTotal: number): FeasibilityVerdict {
  if (budget === undefined) return "unavailable";
  if (budget < capexTotal) return "insufficient";
  if (runwayMonths >= 3) return "covers_with_runway";
  if (runwayMonths >= 0.5) return "tight";
  return "insufficient";
}

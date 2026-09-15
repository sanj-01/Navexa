// Scheme matcher — sample data version.
//
// Loads a catalogue of Indian MSME + Tamil Nadu subsidy schemes and evaluates
// each criterion against the resolved attributes and numeric profile. Every
// scheme still declares a citation with verified_on: null so a reviewer knows
// the eligibility rules must be validated by a human before ship.

import { promises as fs } from "fs";
import path from "path";
import type { Scheme, SchemeCriterion } from "@/types/api";

interface RawScheme extends Omit<Scheme, "criteria" | "best_match"> {
  criteria: SchemeCriterion[];
}

let cache: RawScheme[] | null = null;

async function loadCatalogue(): Promise<RawScheme[]> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "schemes", "schemes.json");
  const raw = await fs.readFile(file, "utf-8");
  cache = JSON.parse(raw) as RawScheme[];
  return cache;
}

export interface SchemeMatchInput {
  attributes: string[];
  turnover_inr?: number;
  employees?: number;
  budget_inr?: number;
  state?: string;
}

// Evaluate a single criterion. Sample-data version — the real matcher will
// consult a per-scheme rule file. Returns the same enum the wireframe uses.
function evaluate(
  scheme: RawScheme,
  criterion: SchemeCriterion,
  input: SchemeMatchInput
): SchemeCriterion["status"] {
  const attrs = new Set(input.attributes);
  const key = criterion.key;

  // Shared criteria across schemes.
  if (key === "tamil_nadu") return (input.state ?? "TN") === "TN" ? "met" : "unmet";
  if (key === "non_agri") return "met";
  if (key === "new_unit" || key === "greenfield") return "met";
  if (key === "non_farm") return "met";

  // Scheme-specific criteria.
  if (scheme.id === "PMEGP") {
    if (key === "project_limit") {
      // Manufacturing threshold ₹50L, services ₹20L. If we don't know budget,
      // stay "unknown" — never infer to "met" without evidence.
      if (input.budget_inr === undefined) return "unknown";
      const isMfg = attrs.has("manufactures") || attrs.has("assembles_only");
      const limit = isMfg ? 5000000 : 2000000;
      return input.budget_inr <= limit ? "met" : "unmet";
    }
    if (key === "udyam") return "unknown"; // requires human confirmation post-registration
    if (key === "edp") return "unknown";
  }

  if (scheme.id === "MUDRA_KISHORE") {
    if (key === "within_slab") {
      if (input.budget_inr === undefined) return "unknown";
      return input.budget_inr <= 500000 ? "met" : "unmet";
    }
    if (key === "bank_relationship") return "unknown";
  }

  if (scheme.id === "CGTMSE") {
    if (key === "mse") {
      // Broadly: turnover ≤ ₹50 Cr, investment ≤ ₹10 Cr for "small".
      if (input.turnover_inr === undefined) return "unknown";
      return input.turnover_inr <= 500000000 ? "met" : "unmet";
    }
    if (key === "eligible_lender") return "unknown";
  }

  if (scheme.id === "STAND_UP_INDIA") {
    if (key === "eligible_category") return "unknown"; // requires user disclosure
    if (key === "loan_range") {
      if (input.budget_inr === undefined) return "unknown";
      return input.budget_inr >= 1000000 && input.budget_inr <= 10000000 ? "met" : "unmet";
    }
  }

  if (scheme.id === "NEEDS" || scheme.id === "UYEGP") {
    if (key === "qualification") return "unknown";
    if (key === "age_band") return "unknown";
    if (key === "unemployed") return "unknown";
  }

  return criterion.status;
}

export interface MatchedSchemesResult {
  schemes: Scheme[];
  matched: number;
  eligible_today: number;
}

export async function matchSchemes(input: SchemeMatchInput): Promise<MatchedSchemesResult> {
  const catalogue = await loadCatalogue();

  // For each scheme evaluate every criterion; drop schemes where any hard-
  // fail criterion (state, project limit, loan slab) is definitively unmet.
  const schemes: Scheme[] = catalogue
    .map((s) => {
      const criteria = s.criteria.map((c) => ({ ...c, status: evaluate(s, c, input) }));
      return { ...s, criteria };
    })
    .filter((s) => !s.criteria.some((c) => c.status === "unmet" && HARD_KEYS.has(c.key)));

  // "Eligible today" = every criterion is met (no unmet, no unknown).
  const eligibleToday = schemes.filter((s) => s.criteria.every((c) => c.status === "met")).length;

  // Best match: fewest unknowns, ties broken by most mets. Highlights the
  // single scheme most worth exploring first (single gold element per §10.5).
  let bestIdx = -1;
  let bestScore = -Infinity;
  schemes.forEach((s, i) => {
    const met = s.criteria.filter((c) => c.status === "met").length;
    const unknown = s.criteria.filter((c) => c.status === "unknown").length;
    const score = met * 2 - unknown;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  if (bestIdx >= 0) schemes[bestIdx] = { ...schemes[bestIdx], best_match: true };

  return {
    schemes,
    matched: schemes.length,
    eligible_today: eligibleToday,
  };
}

// Criteria keys where an unmet flag drops the scheme entirely from the list.
// State / slab / loan-range being wrong disqualifies the applicant outright.
const HARD_KEYS = new Set(["tamil_nadu", "project_limit", "within_slab", "loan_range"]);

// Reset for tests / dev — never call from route handlers.
export function __resetSchemesCache() {
  cache = null;
}

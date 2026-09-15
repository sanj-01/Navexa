// Internal shape of one entry in data/rules/obligations.json.
// See ANVIL-SPEC.md §4.1 for the canonical field list.

import type { Attribute } from "@/lib/attributes";
import type { Confidence, Phase } from "@/types/api";

export interface RuleThresholds {
  annual_turnover_inr?: { min?: number; max?: number };
  employees?: { min?: number; max?: number };
  budget_inr?: { min?: number; max?: number };
}

export interface RuleCitation {
  doc_id: string;
  locator: string;
  url: string;
  verified_on: string | null;
  verified_by: string | null;
}

export interface RuleRenewal {
  cycle_months: number;
  grace_days: number;
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  authority: string;
  portal?: string;
  portal_url?: string;
  triggers: {
    all?: Attribute[];
    any?: Attribute[];
    none?: Attribute[];
    thresholds?: RuleThresholds;
    // universal_base is true when the rule always applies (see §4.4).
    universal_base?: boolean;
  };
  depends_on: string[];
  blocks: string[];
  fee_inr?: number | null;
  fee_note?: string;
  timeline_days?: [number, number];
  documents?: string[];
  renewal?: RuleRenewal;
  penalty_note?: string;
  citation: RuleCitation;
  confidence: Confidence;
  // Optional explicit phase override; if absent the resolver assigns by category.
  phase?: Phase;
  reason?: string;
}

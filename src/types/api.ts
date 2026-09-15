// API contracts for the six route handlers listed in ANVIL-SPEC.md §9.
// Every response carries { generated_at, corpus_version } — see §9.

import type { Attribute, Sector } from "@/lib/attributes";

export type Phase = "pre-launch" | "at-launch" | "ongoing";
export type Confidence = "high" | "medium" | "sector_specific";

export interface Envelope {
  generated_at: string;
  corpus_version: string;
}

// ---------------------------------------------------------------------------
// /api/classify
// ---------------------------------------------------------------------------

export interface ClassifyRequest {
  description: string;
}

export interface UnresolvedQuestion {
  attribute: Attribute;
  question: string;
  options: string[];
}

export interface ClassifyResponse extends Envelope {
  attributes: Attribute[];
  sector: Sector;
  business_label: string;
  unresolved: UnresolvedQuestion[];
  confidence: number;
  dropped?: string[];
}

// ---------------------------------------------------------------------------
// /api/resolve
// ---------------------------------------------------------------------------

export interface ResolveProfile {
  description: string;
  attributes: Attribute[];
  sector: Sector;
  business_label: string;
  state?: string;
  city?: string;
  entity_type?: string;
  turnover_inr?: number;
  employees?: number;
  budget_inr?: number;
  premises?: string;
}

export interface ResolveRequest {
  profile: ResolveProfile;
}

export interface Citation {
  doc_id: string;
  locator: string;
  url: string;
  verified_on: string | null;
  verified_by: string | null;
}

export interface Obligation {
  id: string;
  name: string;
  category: string;
  authority: string;
  portal?: string;
  portal_url?: string;
  fee_inr?: number | null;
  fee_note?: string;
  timeline_days?: [number, number];
  documents?: string[];
  renewal?: { cycle_months: number; grace_days: number };
  penalty_note?: string;
  citation: Citation;
  confidence: Confidence;
  depends_on: string[];
  blocks: string[];
  phase: Phase;
  sort_order: number;
  reason?: string;
}

export interface HandoffResult {
  handoff: true;
  sector: string;
  authority: string;
  starting_point: string;
}

export interface ResolveResponse extends Envelope {
  session_id: string;
  obligations: Obligation[];
  phases: Record<Phase, string[]>;
  handoff?: HandoffResult;
  cycle_warning?: boolean;
}

// ---------------------------------------------------------------------------
// /api/ask
// ---------------------------------------------------------------------------

export interface AskRequest {
  session_id: string;
  question: string;
}

export interface AskCitation {
  n: number;
  chunk_id: string;
  doc_id: string;
  authority: string;
  title: string;
  locator: string;
  verified_on: string | null;
  source_url: string;
}

export interface AskResponse extends Envelope {
  answer: string;
  citations: AskCitation[];
  abstained: boolean;
  top_score: number;
  nearest_authority?: string;
}

// ---------------------------------------------------------------------------
// /api/feasibility
// ---------------------------------------------------------------------------

export interface FeasibilityOverride {
  key: string;
  value: number;
}

export interface FeasibilityRequest {
  session_id: string;
  overrides?: FeasibilityOverride[];
}

export interface CostLine {
  key: string;
  label: string;
  value_inr: number;
  benchmark_range?: [number, number];
  note?: string;
}

export type FeasibilityVerdict = "covers_with_runway" | "tight" | "insufficient" | "unavailable";

export interface FeasibilityResponse extends Envelope {
  available: boolean;
  capex: CostLine[];
  opex: CostLine[];
  capex_total_inr: number;
  opex_monthly_inr: number;
  runway_months: number;
  breakeven_months: number | null;
  verdict: FeasibilityVerdict;
  assumptions: string[];
}

// ---------------------------------------------------------------------------
// /api/schemes
// ---------------------------------------------------------------------------

export type CriterionStatus = "met" | "unmet" | "unknown";

export interface SchemeCriterion {
  key: string;
  label: string;
  status: CriterionStatus;
}

export interface Scheme {
  id: string;
  name: string;
  authority: string;
  summary: string;
  route: string;
  citation: Citation;
  criteria: SchemeCriterion[];
  best_match?: boolean;
}

export interface SchemesRequest {
  session_id: string;
}

export interface SchemesResponse extends Envelope {
  schemes: Scheme[];
  matched: number;
  eligible_today: number;
}

// ---------------------------------------------------------------------------
// /api/export
// ---------------------------------------------------------------------------

export interface ExportRequest {
  session_id: string;
}

// /api/export returns application/pdf, not JSON — but a JSON error envelope is
// used when generation fails or the session is unknown.
export interface ExportError extends Envelope {
  error: string;
}

// ---------------------------------------------------------------------------
// Shared error shape for stubbed / failed responses.
// ---------------------------------------------------------------------------

export interface ApiError extends Envelope {
  error: string;
  code?: string;
}

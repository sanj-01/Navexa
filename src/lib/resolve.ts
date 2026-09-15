// Deterministic rule engine — ANVIL-SPEC.md §4.
//
// Given a profile of resolved attributes + numeric facts, return the ordered,
// phased obligation set. The LLM never touches this path. If a cycle is
// detected in depends_on we fall back to category order and set
// cycle_warning: true on the response (§4.3 step 6).

import { HANDOFF_SET, type Attribute, type Sector } from "@/lib/attributes";
import type { Rule } from "@/types/rules";
import type {
  HandoffResult,
  Obligation,
  Phase,
  ResolveProfile,
} from "@/types/api";

// -- trigger evaluation ------------------------------------------------------

export function triggersSatisfied(rule: Rule, profile: ResolveProfile): boolean {
  if (rule.triggers.universal_base) return true;

  const attrs = new Set<string>(profile.attributes);

  const all = rule.triggers.all ?? [];
  for (const a of all) if (!attrs.has(a)) return false;

  const any = rule.triggers.any ?? [];
  if (any.length > 0 && !any.some((a) => attrs.has(a))) return false;

  const none = rule.triggers.none ?? [];
  for (const a of none) if (attrs.has(a)) return false;

  const t = rule.triggers.thresholds;
  if (t) {
    if (!numericGate(profile.turnover_inr, t.annual_turnover_inr)) return false;
    if (!numericGate(profile.employees, t.employees)) return false;
    if (!numericGate(profile.budget_inr, t.budget_inr)) return false;
  }

  return true;
}

function numericGate(
  value: number | undefined,
  gate: { min?: number; max?: number } | undefined
): boolean {
  if (!gate) return true;
  // A gate with a profile value of undefined is treated as "unknown" — we do
  // not exclude the rule; the UI can render an "unknown" state.
  if (value === undefined) return true;
  if (gate.min !== undefined && value < gate.min) return false;
  if (gate.max !== undefined && value > gate.max) return false;
  return true;
}

// -- topological sort with cycle detection ----------------------------------

export interface OrderResult {
  ordered: Rule[];
  cycle: boolean;
}

export function topoSort(rules: Rule[]): OrderResult {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const state = new Map<string, 0 | 1 | 2>(); // 0 unseen, 1 visiting, 2 done
  const order: Rule[] = [];
  let cycle = false;

  function visit(id: string) {
    const cur = state.get(id) ?? 0;
    if (cur === 2) return;
    if (cur === 1) {
      cycle = true;
      return;
    }
    state.set(id, 1);
    const rule = byId.get(id);
    if (rule) {
      for (const dep of rule.depends_on ?? []) {
        // Only follow deps that exist in the matched set. Cross-set deps are
        // treated as satisfied (validator catches truly-missing ids).
        if (byId.has(dep)) visit(dep);
      }
      state.set(id, 2);
      order.push(rule);
    } else {
      state.set(id, 2);
    }
  }

  for (const r of rules) visit(r.id);

  if (cycle) {
    // Category-order fallback so the demo still renders in a sane order.
    const fallback = [...rules].sort((a, b) =>
      a.category === b.category ? a.id.localeCompare(b.id) : a.category.localeCompare(b.category)
    );
    return { ordered: fallback, cycle: true };
  }
  return { ordered: order, cycle: false };
}

// -- phase assignment --------------------------------------------------------

const CATEGORY_PHASE: Record<string, Phase> = {
  entity: "pre-launch",
  identity: "pre-launch",
  banking: "pre-launch",
  registration: "pre-launch",
  licence: "at-launch",
  premises: "at-launch",
  labour: "ongoing",
  tax: "ongoing",
  compliance: "ongoing",
};

export function assignPhase(rule: Rule): Phase {
  if (rule.phase) return rule.phase;
  return CATEGORY_PHASE[rule.category] ?? "at-launch";
}

// -- main resolver -----------------------------------------------------------

export interface ResolveOutput {
  handoff?: HandoffResult;
  obligations: Obligation[];
  phases: Record<Phase, string[]>;
  cycle_warning: boolean;
}

export function resolveProfile(profile: ResolveProfile, rules: Rule[]): ResolveOutput {
  // Handoff sectors short-circuit — no obligation list is attempted. §3.3.
  if (HANDOFF_SET.has(profile.sector as string)) {
    return {
      handoff: {
        handoff: true,
        sector: profile.sector as string,
        authority: HANDOFF_AUTHORITY[profile.sector as Sector] ?? "The sector regulator",
        starting_point: HANDOFF_START[profile.sector as Sector] ?? "Contact the sector regulator directly.",
      },
      obligations: [],
      phases: { "pre-launch": [], "at-launch": [], ongoing: [] },
      cycle_warning: false,
    };
  }

  const matched = rules.filter((r) => triggersSatisfied(r, profile));
  const { ordered, cycle } = topoSort(matched);

  const obligations: Obligation[] = ordered.map((rule, idx) => ({
    id: rule.id,
    name: rule.name,
    category: rule.category,
    authority: rule.authority,
    portal: rule.portal,
    portal_url: rule.portal_url,
    fee_inr: rule.fee_inr ?? null,
    fee_note: rule.fee_note,
    timeline_days: rule.timeline_days,
    documents: rule.documents,
    renewal: rule.renewal,
    penalty_note: rule.penalty_note,
    citation: {
      doc_id: rule.citation.doc_id,
      locator: rule.citation.locator,
      url: rule.citation.url,
      verified_on: rule.citation.verified_on,
      verified_by: rule.citation.verified_by,
    },
    confidence: rule.confidence,
    depends_on: rule.depends_on ?? [],
    blocks: rule.blocks ?? [],
    phase: assignPhase(rule),
    sort_order: idx,
    reason: rule.reason,
  }));

  const phases: Record<Phase, string[]> = {
    "pre-launch": [],
    "at-launch": [],
    ongoing: [],
  };
  for (const o of obligations) phases[o.phase].push(o.id);

  return { obligations, phases, cycle_warning: cycle };
}

// -- handoff copy ------------------------------------------------------------
// Kept in code — these are not legal thresholds, they are addressed to the
// user and do not need Gate 3 verification.

const HANDOFF_AUTHORITY: Partial<Record<Sector, string>> = {
  pharmaceuticals: "Central Drugs Standard Control Organisation (CDSCO) and the State Drugs Controller",
  banking_nbfc: "Reserve Bank of India (RBI)",
  insurance: "Insurance Regulatory and Development Authority of India (IRDAI)",
  telecom: "Department of Telecommunications (DoT) and TRAI",
  arms_ammunition: "The District Magistrate under the Arms Act, and the Ministry of Home Affairs",
  formal_education: "The State School Education Department; UGC/AICTE for higher education",
  healthcare_clinical: "The State Medical Council and the local health authority under the Clinical Establishments Act",
  aviation: "Directorate General of Civil Aviation (DGCA)",
  mining: "Indian Bureau of Mines and the State Department of Mines and Geology",
  petroleum_lpg: "Petroleum and Explosives Safety Organisation (PESO)",
};

const HANDOFF_START: Partial<Record<Sector, string>> = {
  pharmaceuticals: "Start with the State Drugs Controller for retail/wholesale licence, and CDSCO for manufacture.",
  banking_nbfc: "NBFC registration is granted by RBI's Department of Non-Banking Regulation.",
  insurance: "Broker, agent, and corporate agent categories each have separate IRDAI application routes.",
  telecom: "Unified Licence and specific-service licences are issued by DoT; spectrum-linked services also need TRAI clearance.",
  arms_ammunition: "A District Magistrate arms dealer licence is the starting point; manufacture requires MHA approval.",
  formal_education: "Recognition by the State Education Department is prerequisite; higher education routes differ (UGC, AICTE).",
  healthcare_clinical: "Registration under the Clinical Establishments Act with the district authority; individual practitioner registration is separate.",
  aviation: "Air Operator Permit or Non-Scheduled Operator Permit is issued by DGCA.",
  mining: "Mineral concession (mining lease / prospecting licence) is granted by the State Department of Mines and Geology.",
  petroleum_lpg: "PESO licence is required for storage, filling, or transport of petroleum products and LPG.",
};

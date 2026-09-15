// Closed enumeration from ANVIL-SPEC.md §3.2.
// The classifier may emit only these strings; anything else is dropped in code
// (see §2.2 "the rule that protects the demo").

export const ATTRIBUTE_ENUM = [
  // Nature of activity
  "handles_food",
  "prepares_food_onsite",
  "manufactures",
  "assembles_only",
  "services_only",
  "trades_goods",
  "professional_regulated",

  // Premises and physical footprint
  "customer_premises",
  "home_based",
  "storage_goods",
  "owns_premises",
  "signage",
  "operates_vehicles",

  // People
  "employees_none",
  "employees_micro",
  "employees_small",
  "employees_medium",
  "employees_large",
  "employs_women_night",
  "employs_contract_labour",

  // Scale and market
  "turnover_below_threshold",
  "turnover_above_threshold",
  "interstate_supply",
  "sells_online",
  "imports_exports",

  // Risk and regulated handling
  "effluent_discharge_low",
  "effluent_discharge_high",
  "emissions_air",
  "fire_risk_public",
  "packaged_goods_by_weight",
  "alcohol",
  "hazardous_handling",
] as const;

export type Attribute = (typeof ATTRIBUTE_ENUM)[number];

export const ATTRIBUTE_SET: ReadonlySet<string> = new Set(ATTRIBUTE_ENUM);

export function isAttribute(value: string): value is Attribute {
  return ATTRIBUTE_SET.has(value);
}

// Handoff sectors from ANVIL-SPEC.md §3.3. If the classifier returns one of
// these, the resolver returns a handoff response and does not attempt licence
// coverage.
export const HANDOFF_SECTORS = [
  "pharmaceuticals",
  "banking_nbfc",
  "insurance",
  "telecom",
  "arms_ammunition",
  "formal_education",
  "healthcare_clinical",
  "aviation",
  "mining",
  "petroleum_lpg",
] as const;

export type HandoffSector = (typeof HANDOFF_SECTORS)[number];

export const HANDOFF_SET: ReadonlySet<string> = new Set(HANDOFF_SECTORS);

export function isHandoffSector(value: string): value is HandoffSector {
  return HANDOFF_SET.has(value);
}

export type Sector = HandoffSector | "general";

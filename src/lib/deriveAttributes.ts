// Derive additional attributes from the numeric profile the user enters in
// Step 3. The classifier only sees the free-text description in Step 1 — it
// can't know actual turnover or headcount. Without this bridge, a "small
// home pickle unit" with ₹50L turnover would never trigger GST, EPF, or ESI
// because the trigger attributes wouldn't be set.
//
// Thresholds here follow the working figures in ANVIL-SPEC.md §4.5. They are
// `[VERIFY]` values — the corpus sweep in Gate 3 confirms them against
// primary sources. Nothing in this file is a legal claim; it is a UX bridge
// that maps numbers to the closed attribute enumeration in §3.2.

import type { Attribute } from "@/lib/attributes";

interface NumericProfile {
  turnover_inr?: number;
  employees?: number;
  premises?: string;
}

// Working thresholds. `[VERIFY]` per §4.5.
const GST_GOODS_THRESHOLD = 4000000; // ₹40 lakh
const EMPLOYEES_MICRO_MIN = 1;
const EMPLOYEES_SMALL_MIN = 10;
const EMPLOYEES_MEDIUM_MIN = 20;
const EMPLOYEES_LARGE_MIN = 100;

export interface DeriveResult {
  attributes: Attribute[];
  warnings: string[];
  added: Attribute[];
}

export function deriveAttributes(
  existing: Attribute[],
  profile: NumericProfile
): DeriveResult {
  const set = new Set<Attribute>(existing);
  const added: Attribute[] = [];
  const warnings: string[] = [];

  // Turnover → threshold attribute.
  if (typeof profile.turnover_inr === "number") {
    if (profile.turnover_inr >= GST_GOODS_THRESHOLD) {
      if (!set.has("turnover_above_threshold")) {
        set.add("turnover_above_threshold");
        added.push("turnover_above_threshold");
      }
      set.delete("turnover_below_threshold");
    } else {
      if (!set.has("turnover_below_threshold")) {
        set.add("turnover_below_threshold");
        added.push("turnover_below_threshold");
      }
      set.delete("turnover_above_threshold");
    }

    // Sanity flag: home-based businesses at large scale.
    if (set.has("home_based") && profile.turnover_inr >= 2000000) {
      warnings.push(
        "A home-based business declaring ₹20L+ turnover is unusual. Confirm you meant this — it will trigger GST, and Shops & Establishments applicability may need review."
      );
    }
  }

  // Employees → headcount band.
  if (typeof profile.employees === "number" && profile.employees > 0) {
    // Clear any existing band so we pick exactly one.
    const bands: Attribute[] = [
      "employees_none",
      "employees_micro",
      "employees_small",
      "employees_medium",
      "employees_large",
    ];
    for (const b of bands) set.delete(b);

    let band: Attribute = "employees_none";
    if (profile.employees >= EMPLOYEES_LARGE_MIN) band = "employees_large";
    else if (profile.employees >= EMPLOYEES_MEDIUM_MIN) band = "employees_medium";
    else if (profile.employees >= EMPLOYEES_SMALL_MIN) band = "employees_small";
    else if (profile.employees >= EMPLOYEES_MICRO_MIN) band = "employees_micro";

    if (!existing.includes(band)) added.push(band);
    set.add(band);
  }

  return { attributes: [...set], warnings, added };
}

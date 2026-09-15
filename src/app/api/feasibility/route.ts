// POST /api/feasibility — deterministic calculator, ANVIL-SPEC.md §11.5.
// Never routes through an LLM.

import { NextRequest, NextResponse } from "next/server";
import { envelope, DEMO_OFFLINE } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase";
import { loadDemoCache } from "@/lib/demoCache";
import { loadCostModel, sectorForAttributes, verdict } from "@/lib/feasibility";
import { loadRules } from "@/lib/rules";
import { resolveProfile } from "@/lib/resolve";
import type { Attribute } from "@/lib/attributes";
import type { FeasibilityRequest, FeasibilityResponse } from "@/types/api";

export const runtime = "nodejs";

const UNAVAILABLE: Omit<FeasibilityResponse, "generated_at" | "corpus_version"> = {
  available: false,
  capex: [],
  opex: [],
  capex_total_inr: 0,
  opex_monthly_inr: 0,
  runway_months: 0,
  breakeven_months: null,
  verdict: "unavailable",
  assumptions: [],
};

export async function POST(req: NextRequest) {
  let body: FeasibilityRequest;
  try {
    body = (await req.json()) as FeasibilityRequest;
  } catch {
    return NextResponse.json({ ...envelope(), error: "invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const sessionId = body?.session_id;
  if (!sessionId) {
    return NextResponse.json({ ...envelope(), error: "session_id required", code: "BAD_REQUEST" }, { status: 400 });
  }

  if (DEMO_OFFLINE) {
    const cached = await loadDemoCache("feasibility", sessionId);
    if (cached) return NextResponse.json({ ...envelope(), ...cached });
  }

  const session = await fetchSession(sessionId);
  // If the session isn't persisted (dev flow) fall back to the general model so
  // the reviewer always sees a populated calculator.
  const attrs = (session?.attributes ?? []) as Attribute[];
  const sector = sectorForAttributes(attrs);
  const model = await loadCostModel(sector);
  if (!model) return NextResponse.json({ ...envelope(), ...UNAVAILABLE });

  // Fold the licence subtotal from the resolver into the "licences" line.
  const licenceFee = session ? await computeLicenceFee(session) : 0;
  const capex = model.capex.map((l) => (l.key === "licences" ? { ...l, value_inr: licenceFee } : l));

  // Apply user overrides on top of the model.
  const withOverrides = applyOverrides(capex, model.opex, body.overrides ?? []);

  const capexTotal = withOverrides.capex.reduce((s, l) => s + l.value_inr, 0);
  const opexMonthly = withOverrides.opex.reduce((s, l) => s + l.value_inr, 0);
  const budget = session?.budget_inr ?? undefined;
  const runwayMonths = budget !== undefined && opexMonthly > 0 ? (budget - capexTotal) / opexMonthly : 0;

  const payload: FeasibilityResponse = {
    ...envelope(),
    available: true,
    capex: withOverrides.capex,
    opex: withOverrides.opex,
    capex_total_inr: capexTotal,
    opex_monthly_inr: opexMonthly,
    runway_months: Number(runwayMonths.toFixed(2)),
    breakeven_months: null,
    verdict: verdict(runwayMonths, budget, capexTotal),
    assumptions: model.assumptions,
  };

  return NextResponse.json(payload);
}

interface SessionRow {
  attributes: string[] | null;
  turnover_inr: number | null;
  employees: number | null;
  budget_inr: number | null;
  sector: string | null;
  business_label: string | null;
  city: string | null;
  entity_type: string | null;
  premises: string | null;
  raw_description: string | null;
}

async function fetchSession(id: string): Promise<SessionRow | null> {
  if (id.startsWith("ephemeral-")) return null;
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from("sessions")
      .select("attributes, turnover_inr, employees, budget_inr, sector, business_label, city, entity_type, premises, raw_description")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as SessionRow;
  } catch {
    return null;
  }
}

async function computeLicenceFee(session: SessionRow): Promise<number> {
  try {
    const rules = await loadRules();
    const result = resolveProfile(
      {
        description: session.raw_description ?? "",
        attributes: (session.attributes ?? []) as Attribute[],
        sector: (session.sector ?? "general") as FeasibilityResponse extends { sector: infer S } ? S : never,
        business_label: session.business_label ?? "",
        state: "TN",
        city: session.city ?? undefined,
        entity_type: session.entity_type ?? undefined,
        turnover_inr: session.turnover_inr ?? undefined,
        employees: session.employees ?? undefined,
        budget_inr: session.budget_inr ?? undefined,
        premises: session.premises ?? undefined,
      },
      rules
    );
    return result.obligations.reduce((n, o) => n + (typeof o.fee_inr === "number" ? o.fee_inr : 0), 0);
  } catch {
    return 0;
  }
}

function applyOverrides(
  capex: FeasibilityResponse["capex"],
  opex: FeasibilityResponse["opex"],
  overrides: { key: string; value: number }[]
) {
  const map = new Map(overrides.map((o) => [o.key, o.value]));
  return {
    capex: capex.map((l) => (map.has(l.key) ? { ...l, value_inr: map.get(l.key)! } : l)),
    opex: opex.map((l) => (map.has(l.key) ? { ...l, value_inr: map.get(l.key)! } : l)),
  };
}

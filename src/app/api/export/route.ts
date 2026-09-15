// POST /api/export — server-side PDF of pathway, funding and feasibility.
// ANVIL-SPEC.md §9 (contract), §12 H+26–H+30 (hardening).
//
// GET is also supported so the "Export" link in the results shell can be a
// plain anchor. Both accept session_id (POST body or ?session=…).

import { NextRequest, NextResponse } from "next/server";
import { envelope } from "@/lib/env";
import { renderPdf } from "@/lib/pdf";
import { resolveProfile } from "@/lib/resolve";
import { loadRules } from "@/lib/rules";
import { loadCostModel, sectorForAttributes, verdict } from "@/lib/feasibility";
import { supabaseServer } from "@/lib/supabase";
import type { Attribute, Sector } from "@/lib/attributes";
import type { FeasibilityResponse, ResolveResponse, SchemesResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { session_id?: string };
  return generate(body.session_id ?? "");
}

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("session") ?? "";
  return generate(sessionId);
}

async function generate(sessionId: string) {
  if (!sessionId) {
    return NextResponse.json(
      { ...envelope(), error: "session_id required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const session = await fetchSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { ...envelope(), error: "unknown session", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const rules = await loadRules();
  const attrs = (session.attributes ?? []) as Attribute[];
  const resolveOut = resolveProfile(
    {
      description: session.raw_description ?? "",
      attributes: attrs,
      sector: (session.sector ?? "general") as Sector,
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

  const resolveResponse: ResolveResponse = {
    ...envelope(),
    session_id: sessionId,
    obligations: resolveOut.obligations,
    phases: resolveOut.phases,
    ...(resolveOut.handoff ? { handoff: resolveOut.handoff } : {}),
    ...(resolveOut.cycle_warning ? { cycle_warning: true } : {}),
  };

  const feasibility = await buildFeasibility(attrs, session, resolveOut.obligations);
  const schemes: SchemesResponse | null = await fetchSchemes(sessionId);

  const pdf = await renderPdf({
    resolve: resolveResponse,
    feasibility,
    schemes,
    business_label: session.business_label ?? "Your business",
    profile: {
      city: session.city,
      entity_type: session.entity_type,
      turnover_inr: session.turnover_inr,
      employees: session.employees,
      budget_inr: session.budget_inr,
    },
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="navexa-pathway.pdf"`,
      "cache-control": "no-store",
    },
  });
}

interface SessionRow {
  attributes: string[] | null;
  sector: string | null;
  business_label: string | null;
  city: string | null;
  entity_type: string | null;
  turnover_inr: number | null;
  employees: number | null;
  budget_inr: number | null;
  premises: string | null;
  raw_description: string | null;
}

async function fetchSession(id: string): Promise<SessionRow | null> {
  if (id.startsWith("ephemeral-")) return null;
  try {
    const sb = supabaseServer();
    const { data } = await sb
      .from("sessions")
      .select(
        "attributes, sector, business_label, city, entity_type, turnover_inr, employees, budget_inr, premises, raw_description"
      )
      .eq("id", id)
      .maybeSingle();
    return (data ?? null) as SessionRow | null;
  } catch {
    return null;
  }
}

async function buildFeasibility(
  attrs: Attribute[],
  session: SessionRow,
  obligations: ResolveResponse["obligations"]
): Promise<FeasibilityResponse | null> {
  const sector = sectorForAttributes(attrs);
  const model = await loadCostModel(sector);
  if (!model) return null;

  const licenceFee = obligations.reduce((n, o) => n + (typeof o.fee_inr === "number" ? o.fee_inr : 0), 0);
  const capex = model.capex.map((l) => (l.key === "licences" ? { ...l, value_inr: licenceFee } : l));
  const capexTotal = capex.reduce((s, l) => s + l.value_inr, 0);
  const opexMonthly = model.opex.reduce((s, l) => s + l.value_inr, 0);
  const budget = session.budget_inr ?? undefined;
  const runwayMonths = budget !== undefined && opexMonthly > 0 ? (budget - capexTotal) / opexMonthly : 0;

  return {
    ...envelope(),
    available: true,
    capex,
    opex: model.opex,
    capex_total_inr: capexTotal,
    opex_monthly_inr: opexMonthly,
    runway_months: Number(runwayMonths.toFixed(2)),
    breakeven_months: null,
    verdict: verdict(runwayMonths, budget, capexTotal),
    assumptions: model.assumptions,
  };
}

async function fetchSchemes(sessionId: string): Promise<SchemesResponse | null> {
  // Placeholder: /api/schemes hasn't been implemented as a matcher yet. When
  // it lands, hydrate from the same source here. Returning null lets the PDF
  // skip the Funding section rather than print an empty one.
  void sessionId;
  return null;
}

// POST /api/schemes — sample-data scheme matcher.
// Loads data/schemes/schemes.json, evaluates criteria against the session
// profile, returns the shape defined in §9 / src/types/api.ts.

import { NextRequest, NextResponse } from "next/server";
import { envelope, DEMO_OFFLINE } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase";
import { loadDemoCache } from "@/lib/demoCache";
import { matchSchemes } from "@/lib/schemes";
import type { SchemesRequest, SchemesResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: SchemesRequest;
  try {
    body = (await req.json()) as SchemesRequest;
  } catch {
    return NextResponse.json(
      { ...envelope(), error: "invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const sessionId = body?.session_id;
  if (!sessionId) {
    return NextResponse.json(
      { ...envelope(), error: "session_id required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  if (DEMO_OFFLINE) {
    const cached = await loadDemoCache("schemes", sessionId);
    if (cached) return NextResponse.json({ ...envelope(), ...cached });
  }

  const session = await fetchSession(sessionId);

  const result = await matchSchemes({
    attributes: (session?.attributes ?? []) as string[],
    turnover_inr: session?.turnover_inr ?? undefined,
    employees: session?.employees ?? undefined,
    budget_inr: session?.budget_inr ?? undefined,
    state: session?.state ?? "TN",
  });

  const payload: SchemesResponse = {
    ...envelope(),
    schemes: result.schemes,
    matched: result.matched,
    eligible_today: result.eligible_today,
  };
  return NextResponse.json(payload);
}

interface SessionRow {
  attributes: string[] | null;
  turnover_inr: number | null;
  employees: number | null;
  budget_inr: number | null;
  state: string | null;
}

async function fetchSession(id: string): Promise<SessionRow | null> {
  if (id.startsWith("ephemeral-")) return null;
  try {
    const sb = supabaseServer();
    const { data } = await sb
      .from("sessions")
      .select("attributes, turnover_inr, employees, budget_inr, state")
      .eq("id", id)
      .maybeSingle();
    return (data ?? null) as SessionRow | null;
  } catch {
    return null;
  }
}

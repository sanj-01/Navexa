// POST /api/resolve — deterministic rule engine, ANVIL-SPEC.md §4.
// The LLM never touches this path.

import { NextRequest, NextResponse } from "next/server";
import { envelope, DEMO_OFFLINE } from "@/lib/env";
import { loadRules } from "@/lib/rules";
import { resolveProfile } from "@/lib/resolve";
import { supabaseServer } from "@/lib/supabase";
import { loadDemoCache } from "@/lib/demoCache";
import type { ResolveRequest, ResolveResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: ResolveRequest;
  try {
    body = (await req.json()) as ResolveRequest;
  } catch {
    return NextResponse.json(
      { ...envelope(), error: "invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const profile = body?.profile;
  if (!profile || !profile.description || !Array.isArray(profile.attributes)) {
    return NextResponse.json(
      { ...envelope(), error: "profile.description and profile.attributes required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  if (DEMO_OFFLINE) {
    const cached = await loadDemoCache("resolve", profile.description);
    if (cached) return NextResponse.json({ ...envelope(), ...cached });
  }

  const rules = await loadRules();
  const result = resolveProfile(profile, rules);

  const session_id = await persistSession(profile, result.obligations.map((o) => ({ id: o.id, phase: o.phase, sort_order: o.sort_order })));

  const payload: ResolveResponse = {
    ...envelope(),
    session_id,
    obligations: result.obligations,
    phases: result.phases,
    ...(result.handoff ? { handoff: result.handoff } : {}),
    ...(result.cycle_warning ? { cycle_warning: true } : {}),
  };

  return NextResponse.json(payload);
}

// Best-effort session persistence. If Supabase isn't configured (dev/demo),
// we still return a session_id so the frontend flow works — it just won't
// survive server restart.
async function persistSession(
  profile: ResolveRequest["profile"],
  obligations: { id: string; phase: string; sort_order: number }[]
): Promise<string> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from("sessions")
      .insert({
        raw_description: profile.description,
        attributes: profile.attributes,
        sector: profile.sector,
        business_label: profile.business_label,
        state: profile.state ?? "TN",
        city: profile.city ?? null,
        entity_type: profile.entity_type ?? null,
        turnover_inr: profile.turnover_inr ?? null,
        employees: profile.employees ?? null,
        budget_inr: profile.budget_inr ?? null,
        premises: profile.premises ?? null,
      })
      .select("id")
      .single();

    if (error || !data) throw error ?? new Error("no session row returned");
    const id = data.id as string;

    if (obligations.length > 0) {
      await sb.from("session_obligations").insert(
        obligations.map((o) => ({
          session_id: id,
          obligation_id: o.id,
          phase: o.phase,
          sort_order: o.sort_order,
        }))
      );
    }
    return id;
  } catch (err) {
    // Ephemeral session — dev fallback so the flow still renders.
    // eslint-disable-next-line no-console
    console.warn("[resolve] session not persisted:", (err as Error).message);
    return `ephemeral-${cryptoRandom()}`;
  }
}

function cryptoRandom(): string {
  // Node 20+ has global crypto; guard for older runtimes.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

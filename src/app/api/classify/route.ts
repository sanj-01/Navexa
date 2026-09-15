// POST /api/classify — ANVIL-SPEC.md §5.
// Single Groq call, JSON-only, temp 0, closed-enum validation in code.

import { NextRequest, NextResponse } from "next/server";
import { envelope, DEMO_OFFLINE } from "@/lib/env";
import { classifyDescription } from "@/lib/classify";
import { HANDOFF_SET } from "@/lib/attributes";
import { loadDemoCache } from "@/lib/demoCache";
import type { ClassifyRequest, ClassifyResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: ClassifyRequest;
  try {
    body = (await req.json()) as ClassifyRequest;
  } catch {
    return NextResponse.json(
      { ...envelope(), error: "invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const description = (body?.description ?? "").trim();
  if (description.length < 4) {
    return NextResponse.json(
      { ...envelope(), error: "description too short", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // Offline demo path — DEMO_OFFLINE=1 serves seeded profiles from disk.
  if (DEMO_OFFLINE) {
    const cached = await loadDemoCache("classify", description);
    if (cached) return NextResponse.json({ ...envelope(), ...cached });
  }

  try {
    const clean = await classifyDescription(description);

    const payload: ClassifyResponse = {
      ...envelope(),
      attributes: clean.attributes,
      sector: (clean.sector as ClassifyResponse["sector"]) ?? "general",
      business_label: clean.business_label,
      unresolved: clean.unresolved,
      confidence: clean.confidence,
      dropped: clean.dropped.length > 0 ? clean.dropped : undefined,
    };

    // Handoff short-circuit (§3.3): a specialised regulator, no obligation
    // coverage attempted. The resolver will also return a handoff — this
    // early exit is for the intake UI to shortcut its own questionnaire.
    if (HANDOFF_SET.has(clean.sector)) {
      return NextResponse.json({ ...payload, unresolved: [] });
    }

    return NextResponse.json(payload);
  } catch (err) {
    const message = (err as Error).message ?? "classifier error";
    // eslint-disable-next-line no-console
    console.error("[classify] error:", message);
    return NextResponse.json(
      { ...envelope(), error: message, code: "CLASSIFIER_ERROR" },
      { status: 502 }
    );
  }
}

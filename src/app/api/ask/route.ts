// POST /api/ask — retrieval pipeline, ANVIL-SPEC.md §7.
// Pre-filter → pgvector top-20 → rerank top-5 → abstain? → Groq → scrub → log.

import { NextRequest, NextResponse } from "next/server";
import { envelope, DEMO_OFFLINE, ASK_UNGROUNDED_FALLBACK, GROQ_MODEL } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase";
import { groqChat } from "@/lib/groq";
import {
  buildGenerationSystem,
  buildGenerationUser,
  embed,
  nearestAuthority,
  rerank,
  scrubCitations,
  shouldAbstain,
  vectorSearch,
  warmRetrieval,
  type Chunk,
} from "@/lib/retrieve";
import { loadDemoCache } from "@/lib/demoCache";
import type { AskCitation, AskRequest, AskResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let body: AskRequest;
  try {
    body = (await req.json()) as AskRequest;
  } catch {
    return NextResponse.json({ ...envelope(), error: "invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const question = (body?.question ?? "").trim();
  const sessionId = body?.session_id;
  if (!question || !sessionId) {
    return NextResponse.json({ ...envelope(), error: "session_id and question required", code: "BAD_REQUEST" }, { status: 400 });
  }

  if (DEMO_OFFLINE) {
    const cached = await loadDemoCache("ask", `${sessionId}::${question}`);
    if (cached) return NextResponse.json({ ...envelope(), ...cached });
  }

  await warmRetrieval();

  // 1. Load the session attributes so we can pre-filter.
  const session = await fetchSession(sessionId);
  const attributes = (session?.attributes ?? []) as string[];

  try {
    // 2. Embed the query.
    const qvec = await embed(question);

    // 3. pgvector search.
    const top20 = await vectorSearch(qvec, attributes, 20);

    // 4. Rerank.
    const top5 = await rerank(question, top20, 5);

    const topScore = top5[0]?.score ?? 0;

    if (top5.length === 0 || shouldAbstain(topScore)) {
      await logQa(sessionId, question, "", top5, true, topScore, Date.now() - t0);
      const payload: AskResponse = {
        ...envelope(),
        answer: "",
        citations: [],
        abstained: true,
        top_score: topScore,
        nearest_authority: nearestAuthority(question),
      };
      return NextResponse.json(payload);
    }

    // 5. Generation.
    const system = buildGenerationSystem();
    const user = buildGenerationUser(
      buildProfileLine(session),
      question,
      top5
    );
    const gen = await groqChat({
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "text" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = gen.choices[0]?.message?.content ?? "";
    const { text } = scrubCitations(raw, top5.length);

    const citations: AskCitation[] = await hydrateCitations(top5);

    await logQa(sessionId, question, text, top5, false, topScore, Date.now() - t0);

    const payload: AskResponse = {
      ...envelope(),
      answer: text,
      citations,
      abstained: false,
      top_score: topScore,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message = (err as Error).message ?? "unknown";
    // eslint-disable-next-line no-console
    console.error("[ask] error:", message);

    const retrievalDown =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.startsWith("embed ") ||
      message.startsWith("rerank ");

    // Ungrounded fallback (guarded by env). Violates spec §7; the UI must
    // clearly mark the answer as unverified when this branch is used.
    if (retrievalDown && ASK_UNGROUNDED_FALLBACK) {
      try {
        const gen = await groqChat({
          model: GROQ_MODEL,
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: "text" },
          messages: [
            {
              role: "system",
              content:
                "You are helping a first-time Indian entrepreneur. Answer the question in plain language, in 120 words or less. If you do not know an authoritative answer, say so and name the authority to contact. Do not invent fees, thresholds, or deadlines.",
            },
            { role: "user", content: question },
          ],
        });
        const text = gen.choices[0]?.message?.content ?? "";
        return NextResponse.json({
          ...envelope(),
          answer: text,
          citations: [],
          abstained: false,
          top_score: 0,
          ungrounded: true,
        });
      } catch (fallbackErr) {
        // fall through
        // eslint-disable-next-line no-console
        console.error("[ask] fallback failed:", (fallbackErr as Error).message);
      }
    }

    return NextResponse.json(
      {
        ...envelope(),
        error: retrievalDown
          ? "Retrieval service is not running. The Ask tab needs the Python retrieval sidecar (see scripts/retrieval-server.py) and a loaded corpus. Set ASK_UNGROUNDED_FALLBACK=1 in .env.local to try an unverified Groq-only answer instead."
          : message,
        code: retrievalDown ? "RETRIEVAL_UNAVAILABLE" : "ASK_ERROR",
      },
      { status: 502 }
    );
  }
}

interface SessionRow {
  attributes: string[] | null;
  business_label: string | null;
  city: string | null;
  entity_type: string | null;
  turnover_inr: number | null;
  employees: number | null;
}

async function fetchSession(id: string): Promise<SessionRow | null> {
  if (id.startsWith("ephemeral-")) return null;
  try {
    const sb = supabaseServer();
    const { data } = await sb
      .from("sessions")
      .select("attributes, business_label, city, entity_type, turnover_inr, employees")
      .eq("id", id)
      .maybeSingle();
    return (data ?? null) as SessionRow | null;
  } catch {
    return null;
  }
}

function buildProfileLine(session: SessionRow | null): string {
  if (!session) return "Anonymous, Tamil Nadu.";
  const parts = [session.business_label, session.city, session.entity_type].filter(Boolean).join(", ");
  const nums: string[] = [];
  if (session.turnover_inr !== null) nums.push(`~₹${session.turnover_inr.toLocaleString("en-IN")} turnover`);
  if (session.employees !== null) nums.push(`${session.employees} staff`);
  return [parts, ...nums].filter(Boolean).join(", ");
}

async function hydrateCitations(chunks: Chunk[]): Promise<AskCitation[]> {
  try {
    const sb = supabaseServer();
    const ids = chunks.map((c) => c.doc_id);
    const { data } = await sb
      .from("documents")
      .select("doc_id, authority, title, source_url, verified_on")
      .in("doc_id", ids);
    const docMap = new Map((data ?? []).map((d) => [d.doc_id as string, d]));
    return chunks.map((c, i) => {
      const d = docMap.get(c.doc_id);
      return {
        n: i + 1,
        chunk_id: c.chunk_id,
        doc_id: c.doc_id,
        authority: (d?.authority as string) ?? "",
        title: (d?.title as string) ?? c.title,
        locator: c.locator ?? "",
        verified_on: (d?.verified_on as string) ?? null,
        source_url: (d?.source_url as string) ?? "",
      };
    });
  } catch {
    return chunks.map((c, i) => ({
      n: i + 1,
      chunk_id: c.chunk_id,
      doc_id: c.doc_id,
      authority: "",
      title: c.title,
      locator: c.locator ?? "",
      verified_on: null,
      source_url: "",
    }));
  }
}

async function logQa(
  sessionId: string,
  question: string,
  answer: string,
  chunks: Chunk[],
  abstained: boolean,
  topScore: number,
  latencyMs: number
) {
  if (sessionId.startsWith("ephemeral-")) return;
  try {
    const sb = supabaseServer();
    await sb.from("qa_log").insert({
      session_id: sessionId,
      question,
      answer,
      chunk_ids: chunks.map((c) => c.chunk_id),
      abstained,
      top_score: topScore,
      latency_ms: latencyMs,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ask] qa_log write failed:", (err as Error).message);
  }
}


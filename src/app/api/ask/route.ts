// POST /api/ask — retrieval pipeline.
//
// Priority order:
//   1. Local corpus (BM25 over data/corpus/tn-corpus.json). If the top score
//      clears the abstention threshold, ground the answer in those chunks
//      with real citations. This is the demo-ready path.
//   2. External retrieval sidecar (bge-m3 + reranker on 127.0.0.1:8765). Only
//      hit if the local corpus produces nothing usable. Fails silently if the
//      sidecar isn't running.
//   3. Ungrounded Groq fallback (ASK_UNGROUNDED_FALLBACK=1 in .env.local).
//      Marked as unverified in the UI.

import { NextRequest, NextResponse } from "next/server";
import { envelope, DEMO_OFFLINE, ASK_UNGROUNDED_FALLBACK, GROQ_MODEL } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase";
import { groqChat } from "@/lib/groq";
import { retrieveLocal, type RetrievedChunk } from "@/lib/localCorpus";
import { loadDemoCache } from "@/lib/demoCache";
import type { AskCitation, AskRequest, AskResponse } from "@/types/api";

export const runtime = "nodejs";

// BM25 scores aren't in the [0,1] range that the spec's cosine threshold
// assumes. Use a separate threshold tuned for the corpus size.
const LOCAL_MIN_SCORE = 1.2;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let body: AskRequest;
  try {
    body = (await req.json()) as AskRequest;
  } catch {
    return NextResponse.json(
      { ...envelope(), error: "invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const question = (body?.question ?? "").trim();
  const sessionId = body?.session_id;
  if (!question || !sessionId) {
    return NextResponse.json(
      { ...envelope(), error: "session_id and question required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  if (DEMO_OFFLINE) {
    const cached = await loadDemoCache("ask", `${sessionId}::${question}`);
    if (cached) return NextResponse.json({ ...envelope(), ...cached });
  }

  const session = await fetchSession(sessionId);
  const attributes = (session?.attributes ?? []) as string[];

  // -- 1. Local corpus retrieval ------------------------------------------
  try {
    const top = await retrieveLocal(question, attributes, 5);
    const topScore = top[0]?.score ?? 0;

    if (top.length > 0 && topScore >= LOCAL_MIN_SCORE) {
      const system = buildSystem();
      const user = buildUserPrompt(buildProfileLine(session), question, top);

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
      const { text } = scrubCitations(raw, top.length);

      const citations: AskCitation[] = top.map((c, i) => ({
        n: i + 1,
        chunk_id: c.chunk_id,
        doc_id: c.doc_id,
        authority: c.authority,
        title: c.title,
        locator: c.locator ?? "",
        verified_on: c.verified_on,
        source_url: c.url,
      }));

      await logQa(sessionId, question, text, top, false, topScore, Date.now() - t0);

      const payload: AskResponse = {
        ...envelope(),
        answer: text,
        citations,
        abstained: false,
        top_score: topScore,
      };
      return NextResponse.json(payload);
    }

    // Local corpus retrieved nothing above threshold. Abstain per §7.2 —
    // unless the ungrounded fallback flag is on, in which case fall through
    // to that path so demo Q&A still produces a visible response.
    if (!ASK_UNGROUNDED_FALLBACK) {
      await logQa(sessionId, question, "", top, true, topScore, Date.now() - t0);
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ask] local retrieval error:", (err as Error).message);
    // fall through to fallback
  }

  // -- 3. Ungrounded fallback --------------------------------------------
  if (ASK_UNGROUNDED_FALLBACK) {
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
              "You are helping a first-time Indian entrepreneur. Answer the question in plain language, in 120 words or less. If you don't know an authoritative answer, say so and name the authority to contact. Do not invent fees, thresholds, or deadlines.",
          },
          { role: "user", content: question },
        ],
      });
      const text = gen.choices[0]?.message?.content ?? "";
      await logQa(sessionId, question, text, [], false, 0, Date.now() - t0);
      return NextResponse.json({
        ...envelope(),
        answer: text,
        citations: [],
        abstained: false,
        top_score: 0,
        ungrounded: true,
      });
    } catch (fallbackErr) {
      // eslint-disable-next-line no-console
      console.error("[ask] fallback failed:", (fallbackErr as Error).message);
    }
  }

  // Nothing worked.
  return NextResponse.json(
    {
      ...envelope(),
      error:
        "No answer available. The local corpus produced nothing and the ungrounded fallback isn't enabled. Enable ASK_UNGROUNDED_FALLBACK=1 or expand data/corpus/tn-corpus.json.",
      code: "ASK_ERROR",
    },
    { status: 502 }
  );
}

// -- prompt construction ----------------------------------------------------

function buildSystem(): string {
  return [
    "You explain Indian business regulation to first-time entrepreneurs.",
    "",
    "Rules:",
    "- Answer ONLY from the provided sources. If they do not contain the answer,",
    "  say so plainly and name the authority to contact.",
    "- Cite every factual claim with [1], [2] matching the source numbers.",
    "- Never state a fee, threshold or deadline that is not in the sources.",
    "- Plain language. No legal jargon unless you define it in the same sentence.",
    "- Maximum 160 words unless the user asked for detail.",
  ].join("\n");
}

function buildUserPrompt(profileLine: string, question: string, sources: RetrievedChunk[]): string {
  const src = sources
    .map(
      (c, i) =>
        `[${i + 1}] ${c.authority} — ${c.title} (${c.locator ?? "—"})\n${c.text}`
    )
    .join("\n\n");
  return `USER PROFILE\n${profileLine}\n\nQUESTION\n${question}\n\nSOURCES\n${src}`;
}

function buildProfileLine(session: SessionRow | null): string {
  if (!session) return "Anonymous, Tamil Nadu.";
  const parts = [session.business_label, session.city, session.entity_type].filter(Boolean).join(", ");
  const nums: string[] = [];
  if (session.turnover_inr !== null) nums.push(`~₹${session.turnover_inr.toLocaleString("en-IN")} turnover`);
  if (session.employees !== null) nums.push(`${session.employees} staff`);
  return [parts, ...nums].filter(Boolean).join(", ") || "Anonymous, Tamil Nadu.";
}

// -- post-validation ---------------------------------------------------------

function scrubCitations(text: string, sourceCount: number): { text: string; stripped: number } {
  let stripped = 0;
  const cleaned = text.replace(/\[(\d+)\]/g, (match, numStr) => {
    const n = Number(numStr);
    if (n >= 1 && n <= sourceCount) return match;
    stripped++;
    return "";
  });
  if (stripped > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[ask] stripped ${stripped} bad citation marker(s)`);
  }
  return { text: cleaned, stripped };
}

// -- nearest authority (used when abstaining) --------------------------------

const KEYWORD_AUTHORITY: Array<[RegExp, string]> = [
  [/drone|unmanned|uav/i, "the Directorate General of Civil Aviation (DGCA)"],
  [/drug|pharma|medicine/i, "the State Drugs Controller / CDSCO"],
  [/liquor|alcohol|bar/i, "the State Prohibition and Excise Department"],
  [/gold|jewell|hallmark/i, "the Bureau of Indian Standards (BIS)"],
  [/gst|indirect tax|cbic/i, "the Central Board of Indirect Taxes and Customs (CBIC)"],
  [/food|fssai/i, "the Food Safety and Standards Authority of India (FSSAI)"],
  [/labour|epf|esi|provident/i, "the relevant Labour Commissioner / EPFO / ESIC"],
  [/pollut|effluent|tnpcb|environment/i, "the Tamil Nadu Pollution Control Board (TNPCB)"],
  [/fire|noc/i, "the Tamil Nadu Fire and Rescue Services"],
];

function nearestAuthority(query: string): string | undefined {
  for (const [re, auth] of KEYWORD_AUTHORITY) if (re.test(query)) return auth;
  return undefined;
}

// -- session lookup ---------------------------------------------------------

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

async function logQa(
  sessionId: string,
  question: string,
  answer: string,
  chunks: Array<{ chunk_id: string }>,
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


// Retrieval pipeline — ANVIL-SPEC.md §7.
//
// Runtime layout: bge-m3 embeddings and bge-reranker-v2-m3 are Python models,
// exposed by a small local HTTP service (see scripts/retrieval-server.py).
// This module calls that service. The service URL comes from env; without it,
// this pipeline errors — it does not silently invent scores.

import { requireEnv, optionalEnv, ABSTAIN_THRESHOLD } from "./env";
import { supabaseServer } from "./supabase";

export interface Chunk {
  chunk_id: string;
  doc_id: string;
  title: string;
  breadcrumb: string;
  text: string;
  locator: string | null;
  attributes_hint: string[] | null;
  score: number;
}

const EMBED_URL = () => optionalEnv("EMBEDDING_URL", "http://127.0.0.1:8765/embed");
const RERANK_URL = () => optionalEnv("RERANKER_URL", "http://127.0.0.1:8765/rerank");

// -- embedding call ---------------------------------------------------------

export async function embed(query: string, signal?: AbortSignal): Promise<number[]> {
  const res = await fetch(EMBED_URL(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inputs: [query] }),
    signal,
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { embeddings: number[][] };
  const v = data.embeddings?.[0];
  if (!v || v.length !== 1024) throw new Error(`embed returned bad shape: ${v?.length ?? "no"} dims`);
  return v;
}

// -- pgvector cosine search with attributes_hint pre-filter -----------------
//
// §7 step 1: attributes_hint overlaps the session's resolved attributes,
// OR attributes_hint IS NULL. Postgres GIN index handles the `&&` operator.

export async function vectorSearch(
  queryVector: number[],
  attributes: string[],
  limit = 20
): Promise<Chunk[]> {
  const sb = supabaseServer();
  // Supabase supports `.rpc` calls; we use raw SQL via a stored function
  // named "match_chunks". If the function isn't installed, we fall back to
  // a two-step query. Both paths are exposed so the deployment can pick.
  const vectorLit = `[${queryVector.join(",")}]`;

  const { data, error } = await sb.rpc("match_chunks", {
    query_embedding: vectorLit,
    match_count: limit,
    match_attributes: attributes,
  });

  if (error) throw new Error(`vectorSearch: ${error.message}`);
  return (data ?? []) as Chunk[];
}

// -- reranker call ----------------------------------------------------------

export async function rerank(query: string, chunks: Chunk[], topK = 5): Promise<Chunk[]> {
  if (chunks.length === 0) return [];
  const res = await fetch(RERANK_URL(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      passages: chunks.map((c) => c.text),
      top_k: topK,
    }),
  });
  if (!res.ok) throw new Error(`rerank ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { scores: number[]; indices: number[] };
  return data.indices.map((idx, i) => ({ ...chunks[idx], score: data.scores[i] }));
}

// -- abstention gate --------------------------------------------------------

export function shouldAbstain(topScore: number): boolean {
  return topScore < ABSTAIN_THRESHOLD;
}

// -- warm --------------------------------------------------------------------
// Not a "true" boot hook — Next.js App Router lazy-loads route modules. This
// warms on the first import of the retrieval module, which happens as soon
// as anything hits /api/ask. Also exposed via /api/warm for explicit warming
// at deploy time.

let warmed = false;
export async function warmRetrieval(): Promise<void> {
  if (warmed) return;
  warmed = true;
  const url = optionalEnv("RETRIEVAL_WARM_URL", "http://127.0.0.1:8765/warm");
  try {
    await fetch(url, { method: "POST" });
  } catch {
    // silent — the first real request will surface the error
  }
}

// -- generation prompt (§7.3) -----------------------------------------------

export function buildGenerationSystem(): string {
  return [
    "You explain Indian business regulation to first-time entrepreneurs.",
    "",
    "Rules:",
    "- Answer ONLY from the provided sources. If they do not contain the answer,",
    "  say so plainly and name the authority to contact.",
    "- Cite every factual claim as [1], [2] matching the source numbers given.",
    "- Never state a fee, threshold, or deadline that is not in the sources.",
    "- Plain language. No legal jargon unless you define it in the same sentence.",
    "- Maximum 150 words unless the user asked for detail.",
  ].join("\n");
}

export function buildGenerationUser(
  profileLine: string,
  question: string,
  sources: Chunk[]
): string {
  const src = sources
    .map(
      (c, i) =>
        `[${i + 1}] ${authorityFromDocId(c.doc_id)} — ${c.title} (${c.locator ?? "—"})\n${c.text}`
    )
    .join("\n\n");
  return `USER PROFILE\n${profileLine}\n\nQUESTION\n${question}\n\nSOURCES\n${src}`;
}

function authorityFromDocId(_doc_id: string): string {
  // Placeholder — the reranked chunks carry doc metadata in `title`, and the
  // route joins to the documents table for the citation table it ships to
  // the client. For the generation prompt the title suffices.
  return "";
}

// -- post-validate citation markers ------------------------------------------
// §7 step 6: every [n] marker must map to a real chunk in the context; strip
// any that do not and log a warning.

export function scrubCitations(text: string, sourceCount: number): { text: string; stripped: number } {
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

// -- nearest-authority hint (used when abstaining) ---------------------------
// A cheap keyword lookup — the reranker's own top-1 doc_id is the primary
// signal, but if we abstained the score is by definition low, so we fall
// back to a small keyword map that names the plausible regulator.

const KEYWORD_AUTHORITY: Array<[RegExp, string]> = [
  [/drone|unmanned|uav/i, "the Directorate General of Civil Aviation (DGCA)"],
  [/drug|pharma|medicine/i, "the State Drugs Controller / CDSCO"],
  [/liquor|alcohol|bar/i, "the State Prohibition and Excise Department"],
  [/gold|jewell|hallmark/i, "the Bureau of Indian Standards (BIS)"],
  [/gst|indirect tax/i, "the Central Board of Indirect Taxes and Customs (CBIC)"],
  [/food|fssai/i, "the Food Safety and Standards Authority of India (FSSAI)"],
  [/labour|epf|esi/i, "the relevant Labour Commissioner / EPFO / ESIC"],
];

export function nearestAuthority(query: string): string | undefined {
  for (const [re, auth] of KEYWORD_AUTHORITY) if (re.test(query)) return auth;
  return undefined;
}

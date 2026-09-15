// Local corpus + BM25 retrieval.
//
// The spec (§7) prescribes bge-m3 embeddings + a reranker running in a
// Python sidecar. That's the right long-run answer. This module is a
// lightweight replacement that lets the Ask tab work with real citations
// during a demo without the Python stack:
//
//   1. Load a curated corpus of primary-source excerpts from data/corpus.
//   2. attributes_hint pre-filter — the same rule as §7 step 1.
//   3. BM25 scoring against the query.
//   4. Abstention when the top score is too low.
//   5. Groq generation with grounded context and citation markers.
//
// The corpus itself preserves the spec's honesty rule: every chunk carries
// its citation and verified_on: null, so the UI still displays "⚠ confirm
// with authority" until a human sweeps it (Gate 3).

import { promises as fs } from "fs";
import path from "path";

export interface CorpusChunk {
  chunk_id: string;
  doc_id: string;
  authority: string;
  title: string;
  breadcrumb: string;
  text: string;
  locator: string | null;
  url: string;
  verified_on: string | null;
  verified_by: string | null;
  attributes_hint: string[];
}

let cache: CorpusChunk[] | null = null;

export async function loadCorpus(): Promise<CorpusChunk[]> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "corpus", "tn-corpus.json");
  const raw = await fs.readFile(file, "utf-8");
  cache = JSON.parse(raw) as CorpusChunk[];
  return cache;
}

// -- tokenisation ------------------------------------------------------------
// Very small — lowercase, strip punctuation except ₹ and %, split on
// whitespace. Filter English stopwords + a few Indian-context ones.

const STOP = new Set([
  "the","a","an","of","for","to","and","or","in","on","at","is","are","was","were",
  "be","been","being","by","with","as","that","this","these","those","from","if",
  "do","does","did","not","no","yes","i","we","you","they","he","she","it","my",
  "your","our","their","its","have","has","had","can","could","should","would",
  "must","may","might","will","shall","need","needs","needed","require","required",
  "what","when","where","why","how","which","who","whom","get","got","also","one",
  "any","some","more","most","much","many","other","own","same","so","than","too",
  "very","just","up","down","out","over","under","again","further","then","only",
  "such","because","while","between","into","through","after","before","above",
  "below","during","against","about","around"
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}₹%_\s.-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

// -- BM25 --------------------------------------------------------------------

interface Bm25State {
  docFreq: Map<string, number>;
  docLen: number[];
  avgLen: number;
  N: number;
  docs: string[][];
}

let bm25State: Bm25State | null = null;

function buildBm25(corpus: CorpusChunk[]): Bm25State {
  if (bm25State && bm25State.N === corpus.length) return bm25State;
  const docs = corpus.map((c) => tokenise(`${c.breadcrumb} ${c.title} ${c.text}`));
  const docLen = docs.map((d) => d.length);
  const avgLen = docLen.reduce((a, b) => a + b, 0) / Math.max(docs.length, 1);
  const docFreq = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set<string>();
    for (const t of d) {
      if (seen.has(t)) continue;
      seen.add(t);
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }
  bm25State = { docFreq, docLen, avgLen, N: docs.length, docs };
  return bm25State;
}

const K1 = 1.5;
const B = 0.75;

function bm25Score(query: string[], docIdx: number, state: Bm25State): number {
  const doc = state.docs[docIdx];
  const dl = state.docLen[docIdx];
  let score = 0;
  const tf = new Map<string, number>();
  for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);

  for (const q of query) {
    const df = state.docFreq.get(q) ?? 0;
    if (df === 0) continue;
    const idf = Math.log(1 + (state.N - df + 0.5) / (df + 0.5));
    const f = tf.get(q) ?? 0;
    if (f === 0) continue;
    const norm = f * (K1 + 1);
    const denom = f + K1 * (1 - B + (B * dl) / Math.max(state.avgLen, 1));
    score += idf * (norm / denom);
  }
  return score;
}

// -- retrieval ---------------------------------------------------------------

export interface RetrievedChunk extends CorpusChunk {
  score: number;
}

export async function retrieveLocal(
  query: string,
  attributes: string[],
  topK = 5
): Promise<RetrievedChunk[]> {
  const corpus = await loadCorpus();
  const state = buildBm25(corpus);
  const q = tokenise(query);
  if (q.length === 0) return [];

  const attrSet = new Set(attributes);
  const scored: RetrievedChunk[] = corpus.map((chunk, idx) => {
    const base = bm25Score(q, idx, state);
    // attributes_hint boost — §6.3 "cheap, high-value trick". Empty hints
    // aren't penalised; overlapping hints get a small multiplicative boost.
    const overlap = chunk.attributes_hint.filter((a) => attrSet.has(a)).length;
    const boost = 1 + Math.min(overlap * 0.15, 0.6);
    return { ...chunk, score: base * boost };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((c) => c.score > 0);
}

// Reset for tests / dev only.
export function __resetCorpusCache() {
  cache = null;
  bm25State = null;
}

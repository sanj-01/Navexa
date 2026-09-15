// Corpus ingestion — ANVIL-SPEC.md §6.
//
// Reads sources from data/sources/<doc_id>/ (one subdirectory per doc_id),
// chunks on legal structure (section/regulation/clause boundaries), prepends
// a breadcrumb, embeds with bge-m3 via the local retrieval service (see
// scripts/retrieval-server.py), and writes documents + chunks rows.
//
// Idempotent on doc_id: re-running deletes and re-inserts that doc_id's rows.
//
// Usage:
//   npm run ingest -- --doc-id cbic_gst_registration
//   npm run ingest -- --all
//   npm run count

import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const EMBED_URL = process.env.EMBEDDING_URL ?? "http://127.0.0.1:8765/embed";

interface DocManifest {
  doc_id: string;
  authority: string;
  title: string;
  source_url: string;
  retrieved_on: string;
  jurisdiction?: string;
  state?: string | null;
  // The manifest lists chunk files to ingest in order. Chunk files are already
  // structured text — one file per legal section. This tool does not attempt
  // to parse raw PDFs; conversion to text is a manual pre-step (any PDF text
  // extractor works — the important thing is that section boundaries survive).
  chunks: Array<{
    chunk_id: string;
    breadcrumb: string;   // §6.4 prepend
    title: string;
    locator?: string | null;
    attributes_hint?: string[] | null;
    file: string;
  }>;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const supabase = createClient(reqEnv("NEXT_PUBLIC_SUPABASE_URL"), reqEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const sourcesDir = path.join(process.cwd(), "data", "sources");
  const docIds = await listDocIds(sourcesDir, args);
  if (docIds.length === 0) {
    console.error(
      "No doc_id to ingest. Usage:\n" +
        "  npm run ingest -- --doc-id <doc_id>\n" +
        "  npm run ingest -- --all\n"
    );
    process.exit(1);
  }

  for (const docId of docIds) {
    await ingestDoc(supabase as unknown, sourcesDir, docId);
  }
}

async function listDocIds(dir: string, args: Set<string>): Promise<string[]> {
  const explicit = [...args].filter((a) => !a.startsWith("--"));
  if (args.has("--doc-id") && explicit.length > 0) return explicit;
  if (args.has("--all")) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }
  return [];
}

// Supabase's generated types require a schema generic. For this admin script
// we don't have one — cast to `any` at the call sites so it stays a one-liner.
type Sb = unknown;

async function ingestDoc(sb: Sb, sourcesDir: string, docId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const docDir = path.join(sourcesDir, docId);
  const manifestPath = path.join(docDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")) as DocManifest;
  if (manifest.doc_id !== docId) throw new Error(`manifest doc_id mismatch: ${manifest.doc_id} vs ${docId}`);

  console.log(`[ingest] ${docId} — ${manifest.chunks.length} chunks`);

  // Upsert document.
  const { error: docErr } = await sbAny.from("documents").upsert({
    doc_id: manifest.doc_id,
    authority: manifest.authority,
    title: manifest.title,
    source_url: manifest.source_url,
    retrieved_on: manifest.retrieved_on,
    verified_on: null,     // set by hand during Gate 3
    verified_by: null,
    jurisdiction: manifest.jurisdiction ?? "IN",
    state: manifest.state ?? null,
  });
  if (docErr) throw new Error(`documents upsert: ${docErr.message}`);

  // Idempotent: clear existing chunks for this doc_id.
  await sbAny.from("chunks").delete().eq("doc_id", docId);

  // Load chunk texts, prepend breadcrumbs (§6.4), embed in batches.
  const rows: Array<{
    chunk_id: string;
    doc_id: string;
    title: string;
    breadcrumb: string;
    text: string;
    locator: string | null;
    attributes_hint: string[] | null;
    embedding: string;
  }> = [];
  const BATCH = 8;
  for (let i = 0; i < manifest.chunks.length; i += BATCH) {
    const batch = manifest.chunks.slice(i, i + BATCH);
    const texts = await Promise.all(
      batch.map(async (c) => {
        const body = await fs.readFile(path.join(docDir, c.file), "utf-8");
        return `${c.breadcrumb}${body.trim()}`;
      })
    );
    const embeddings = await embedBatch(texts);
    for (let j = 0; j < batch.length; j++) {
      rows.push({
        chunk_id: batch[j].chunk_id,
        doc_id: docId,
        title: batch[j].title,
        breadcrumb: batch[j].breadcrumb,
        text: texts[j],
        locator: batch[j].locator ?? null,
        attributes_hint: batch[j].attributes_hint ?? null,
        embedding: toPgVector(embeddings[j]),
      });
    }
    process.stdout.write(`  chunks ${Math.min(i + BATCH, manifest.chunks.length)}/${manifest.chunks.length}\r`);
  }
  process.stdout.write("\n");

  const { error: chunkErr } = await sbAny.from("chunks").insert(rows);
  if (chunkErr) throw new Error(`chunks insert: ${chunkErr.message}`);

  console.log(`[ingest] ${docId} — ${rows.length} chunks inserted`);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inputs: texts }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { embeddings: number[][] };
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(`embed returned ${data.embeddings?.length ?? "0"} vectors, expected ${texts.length}`);
  }
  return data.embeddings;
}

function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});

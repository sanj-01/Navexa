// Central env lookup with a single fail-fast helper. Route handlers should
// not read process.env directly.

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

export const CORPUS_VERSION = optionalEnv("CORPUS_VERSION", "unversioned");
export const ABSTAIN_THRESHOLD = Number(optionalEnv("ABSTAIN_THRESHOLD", "0.35"));
export const DEMO_OFFLINE = optionalEnv("DEMO_OFFLINE", "0") === "1";
// When set, Ask falls back to a plain Groq call (no citations) if the retrieval
// sidecar is unreachable. Violates ANVIL-SPEC.md §7 abstention discipline —
// enable only for local development / demos with the caveat that answers are
// unverified and clearly labelled as such in the UI.
export const ASK_UNGROUNDED_FALLBACK = optionalEnv("ASK_UNGROUNDED_FALLBACK", "0") === "1";

// Groq model. Default to openai/gpt-oss-20b which is on the current Groq
// catalogue and supports JSON mode. The spec named llama-3.3-70b-versatile
// but many accounts don't yet have access to it. Override in .env.local
// with GROQ_MODEL=... if you want a different one — hit
// https://api.groq.com/openai/v1/models to see what your key can use.
export const GROQ_MODEL = optionalEnv("GROQ_MODEL", "groq/compound-mini");

export function envelope() {
  return {
    generated_at: new Date().toISOString(),
    corpus_version: CORPUS_VERSION,
  };
}

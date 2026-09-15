// Classifier — ANVIL-SPEC.md §5.2. Single Groq call, temp 0, JSON-only.
// The attribute enumeration is injected from src/lib/attributes.ts so the
// list can never drift from code (§2.2).

import { ATTRIBUTE_ENUM, ATTRIBUTE_SET, HANDOFF_SECTORS, type Attribute } from "./attributes";
import { groqJson } from "./groq";
import { GROQ_MODEL } from "./env";

export interface RawClassifierOutput {
  attributes: string[];
  sector: string;
  business_label: string;
  unresolved: Array<{ attribute: string; question: string; options: string[] }>;
  confidence: number;
}

export interface CleanClassifierOutput {
  attributes: Attribute[];
  sector: string;
  business_label: string;
  unresolved: Array<{ attribute: Attribute; question: string; options: string[] }>;
  confidence: number;
  dropped: string[];
}

const ALLOWED_SECTORS = [...HANDOFF_SECTORS, "general"] as const;
const SECTOR_SET = new Set<string>(ALLOWED_SECTORS);

// Forbidden legal jargon in generated questions (§5.3). Compiled once.
export const FORBIDDEN_QUESTION_WORDS = [
  "effluent",
  "statutory",
  "compliance",
  "aggregate turnover",
  "establishment",
];

export function buildSystemPrompt(): string {
  return [
    "You classify Indian business descriptions into regulatory attributes.",
    "Respond with JSON only. No preamble, no markdown fences.",
    "",
    `Emit attributes ONLY from this list: [${ATTRIBUTE_ENUM.map((a) => `"${a}"`).join(", ")}]`,
    `Emit sector ONLY from: [${ALLOWED_SECTORS.map((s) => `"${s}"`).join(", ")}]`,
    "",
    "For any attribute you cannot determine from the description, do not guess.",
    'Place it in "unresolved" with a plain-language question a first-time',
    "entrepreneur can answer without knowing any legal terms.",
    "",
    "Question writing rules:",
    "- Plain language, no legal jargon. Never use these words: " +
      FORBIDDEN_QUESTION_WORDS.join(", ") +
      ".",
    "- One fact per question. No compound questions.",
    '- Always include "Not sure yet" as an option.',
    "- Never ask something already derivable from other attributes.",
    "",
    "OUTPUT SHAPE",
    `{
  "attributes": ["handles_food", "manufactures"],
  "sector": "general",
  "business_label": "Home-based pickle manufacturing",
  "unresolved": [
    { "attribute": "interstate_supply",
      "question": "Will you sell outside Tamil Nadu?",
      "options": ["Yes", "No", "Not sure yet"] }
  ],
  "confidence": 0.82
}`,
  ].join("\n");
}

export function cleanClassifierOutput(raw: RawClassifierOutput): CleanClassifierOutput {
  const attrs: Attribute[] = [];
  const dropped: string[] = [];
  for (const a of raw.attributes ?? []) {
    if (ATTRIBUTE_SET.has(a)) attrs.push(a as Attribute);
    else dropped.push(a);
  }

  const sector = SECTOR_SET.has(raw.sector) ? raw.sector : "general";

  const unresolved: CleanClassifierOutput["unresolved"] = [];
  for (const q of raw.unresolved ?? []) {
    if (!ATTRIBUTE_SET.has(q.attribute)) {
      dropped.push(`unresolved:${q.attribute}`);
      continue;
    }
    unresolved.push({ attribute: q.attribute as Attribute, question: q.question, options: q.options });
  }

  return {
    attributes: attrs,
    sector,
    business_label: (raw.business_label ?? "").trim(),
    unresolved,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    dropped,
  };
}

export async function classifyDescription(description: string, signal?: AbortSignal): Promise<CleanClassifierOutput> {
  const raw = await groqJson<RawClassifierOutput>(
    buildSystemPrompt(),
    description,
    { model: GROQ_MODEL, temperature: 0, max_tokens: 800 },
    signal
  );
  const clean = cleanClassifierOutput(raw);
  if (clean.dropped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[classify] dropped values from LLM output:", clean.dropped);
  }
  return clean;
}

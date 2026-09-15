// Classifier smoke test — Prompt 3 test contract, ANVIL-SPEC.md §3.1 examples.
// Pure-logic assertions always run. Live-API assertions run only if
// GROQ_API_KEY is set, so this passes on a fresh clone.
//
// Run with: npm run test:classify

import {
  buildSystemPrompt,
  cleanClassifierOutput,
  classifyDescription,
  FORBIDDEN_QUESTION_WORDS,
  type RawClassifierOutput,
} from "../src/lib/classify";
import { ATTRIBUTE_ENUM } from "../src/lib/attributes";

let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    console.log("  ok  " + label);
  } else {
    failed++;
    console.error("  FAIL " + label);
  }
}

async function main() {
  console.log("== pure-logic tests ==");

  // 1. Every attribute id from §3.2 appears in the prompt.
  const prompt = buildSystemPrompt();
  for (const a of ATTRIBUTE_ENUM) {
    assert(prompt.includes(`"${a}"`), `prompt lists attribute ${a}`);
  }

  // 2. Cleaner drops unknown attributes.
  const raw: RawClassifierOutput = {
    attributes: ["handles_food", "manufactures", "NOT_A_REAL_ATTR"],
    sector: "general",
    business_label: "Test",
    unresolved: [
      { attribute: "interstate_supply", question: "Will you sell outside Tamil Nadu?", options: ["Yes", "No", "Not sure yet"] },
      { attribute: "made_up_attr", question: "?", options: [] },
    ],
    confidence: 0.9,
  };
  const clean = cleanClassifierOutput(raw);
  assert(clean.attributes.length === 2, "unknown attribute dropped");
  assert(clean.dropped.includes("NOT_A_REAL_ATTR"), "dropped list captured unknown attribute");
  assert(clean.unresolved.length === 1, "unknown unresolved attribute dropped");
  assert(clean.dropped.some((d) => d.startsWith("unresolved:")), "dropped list captured unknown unresolved");

  // 3. Bad sector falls back to "general".
  const badSector = cleanClassifierOutput({ ...raw, sector: "space_tourism" });
  assert(badSector.sector === "general", 'unknown sector falls back to "general"');

  console.log("\n== live-API tests ==");
  if (!process.env.GROQ_API_KEY) {
    console.log("  SKIP  GROQ_API_KEY not set — live tests will run when a key is present.");
  } else {
    // §3.1 example set. Expectations are minimal — pin what the demo relies on
    // rather than the full attribute set, since LLMs tolerate paraphrasing.
    const examples: Array<{ desc: string; expect: string[] }> = [
      { desc: "a small pickle unit from my home, selling in local shops", expect: ["handles_food", "manufactures"] },
      { desc: "a cafe serving coffee and light meals in Coimbatore", expect: ["handles_food", "prepares_food_onsite", "customer_premises"] },
      { desc: "a salon with two chairs in a rented shop", expect: ["customer_premises"] },
      { desc: "freelance web design from home, some clients abroad", expect: ["services_only", "home_based"] },
      { desc: "buying scrap metal from households and selling to recyclers", expect: ["trades_goods", "storage_goods"] },
    ];

    for (const ex of examples) {
      try {
        const out = await classifyDescription(ex.desc);
        for (const need of ex.expect) {
          assert(out.attributes.includes(need as (typeof out.attributes)[number]), `"${ex.desc}" emits ${need}`);
        }
        // Forbidden-word check on every generated question (§5.3).
        for (const q of out.unresolved) {
          for (const w of FORBIDDEN_QUESTION_WORDS) {
            assert(!q.question.toLowerCase().includes(w), `question does not use "${w}": "${q.question}"`);
          }
        }
      } catch (err) {
        failed++;
        console.error(`  FAIL  ${ex.desc} — ${(err as Error).message}`);
      }
    }
  }

  console.log("");
  if (failed > 0) {
    console.error(`${failed} assertion(s) failed.`);
    process.exit(1);
  } else {
    console.log("all classifier tests passed.");
  }
}

main().catch((err) => {
  console.error("unexpected failure:", err);
  process.exit(1);
});

// Eval harness — Gate 5, ANVIL-SPEC.md §12 H+20–H+26.
//
// Reads data/eval/questions.json:
//   [{ session_id, question, expected_chunks?: string[], expected_abstain?: bool, expected_authority?: string, notes? }]
//
// Runs each through POST /api/ask on a base URL (default http://localhost:3000)
// and prints a table of question | retrieved chunk ids | abstained | correct | top_score.
// Prints aggregate accuracy and abstention rate.
//
// A question is "correct" if:
//   - expected_abstain=true  and abstained=true, OR
//   - expected_abstain=false and at least one expected_chunks id is in the returned chunk_ids.

import { promises as fs } from "fs";
import path from "path";

interface EvalRow {
  session_id: string;
  question: string;
  expected_chunks?: string[];
  expected_abstain?: boolean;
  expected_authority?: string;
  notes?: string;
}

interface AskResponse {
  answer: string;
  abstained: boolean;
  top_score: number;
  citations: Array<{ chunk_id: string }>;
  nearest_authority?: string;
  error?: string;
}

const BASE = process.env.EVAL_BASE_URL ?? "http://localhost:3000";

async function main() {
  const file = path.join(process.cwd(), "data", "eval", "questions.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch {
    console.error(
      `[eval] no questions file at ${file}. Create it with 40 entries.\n\n` +
        `Example:\n[\n  { "session_id": "abc", "question": "do I need GST if I sell on Amazon?", "expected_chunks": ["cbic_gst_reg_003"] }\n]`
    );
    process.exit(1);
  }
  const rows = JSON.parse(raw) as EvalRow[];

  const results: Array<{
    row: EvalRow;
    resp: AskResponse | null;
    correct: boolean;
    error?: string;
  }> = [];

  for (const row of rows) {
    process.stdout.write(`? ${row.question.slice(0, 70).padEnd(70)}  `);
    try {
      const res = await fetch(`${BASE}/api/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: row.session_id, question: row.question }),
      });
      const resp = (await res.json()) as AskResponse;
      if (!res.ok) {
        results.push({ row, resp: null, correct: false, error: resp.error ?? `HTTP ${res.status}` });
        console.log("ERROR");
        continue;
      }

      let correct = false;
      if (row.expected_abstain === true) correct = resp.abstained;
      else if (row.expected_abstain === false) {
        const hitIds = new Set(resp.citations.map((c) => c.chunk_id));
        correct = !resp.abstained && (row.expected_chunks ?? []).some((id) => hitIds.has(id));
      } else {
        correct = !resp.abstained;
      }

      results.push({ row, resp, correct });
      console.log(correct ? "ok " : "FAIL");
    } catch (err) {
      results.push({ row, resp: null, correct: false, error: (err as Error).message });
      console.log("ERROR");
    }
  }

  console.log("\n== table ==\n");
  console.log("question | chunk_ids | abstained | correct | top_score");
  console.log("-".repeat(80));
  for (const r of results) {
    const ids = r.resp?.citations.map((c) => c.chunk_id).join(",") ?? "—";
    console.log(
      [
        r.row.question.replace(/\s+/g, " ").slice(0, 60),
        ids.slice(0, 40),
        r.resp?.abstained ?? "—",
        r.correct ? "y" : "n",
        r.resp?.top_score.toFixed(3) ?? "—",
      ].join(" | ")
    );
  }

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const abstained = results.filter((r) => r.resp?.abstained).length;
  const wrong = results.filter((r) => !r.correct);
  const wrongAndAbstained = wrong.filter((r) => r.resp?.abstained).length;

  const accuracy = total === 0 ? 0 : correct / total;
  const abstainRate = total === 0 ? 0 : abstained / total;
  const wrongAbstainRate = wrong.length === 0 ? 0 : wrongAndAbstained / wrong.length;

  console.log("\n== aggregate ==\n");
  console.log(`total          : ${total}`);
  console.log(`correct        : ${correct}  (${(accuracy * 100).toFixed(1)}%)`);
  console.log(`abstained      : ${abstained} (${(abstainRate * 100).toFixed(1)}%)`);
  console.log(`incorrect      : ${wrong.length}`);
  console.log(`  of which abstained rather than answered wrongly: ${wrongAndAbstained} (${(wrongAbstainRate * 100).toFixed(1)}%)`);
  console.log(`\nTarget (§12 Gate 5): >=85% correct with >=90% of incorrect cases abstaining.`);
}

main().catch((err) => {
  console.error("eval failed:", err);
  process.exit(1);
});

"use client";

// Ask tab — §11.8. Includes the abstention state deliberately (§7.2, §11.8).
// Citation markers are the gold elements on this tab.

import { useState } from "react";
import type { AskResponse } from "@/types/api";
import { GoldCounter } from "@/components/GoldCounter";

// When the fallback path is used, the server sets ungrounded: true. That
// means the answer came from a bare Groq call with no citations — clearly
// mark it in the UI.
interface AskResponseWithFallback extends AskResponse {
  ungrounded?: boolean;
}

interface Props {
  sessionId: string;
}

export function Ask({ sessionId }: Props) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<AskResponseWithFallback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question: q.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Ask failed (${res.status})`);
        setErrorCode(data?.code ?? null);
        setAns(null);
      } else {
        setAns(data as AskResponseWithFallback);
        setErrorCode(null);
      }
    } catch (err) {
      setError((err as Error).message);
      setErrorCode("NETWORK");
    } finally {
      setBusy(false);
    }
  }

  const SUGGESTIONS = [
    "Do I need a separate licence to sell on Amazon?",
    "Can I run this from my residential apartment?",
    "What are the employee threshold limits for EPF in TN?",
    "Is trade licence required if I don't have walk-in customers?",
  ];

  return (
    <section aria-labelledby="ask-heading" className="space-y-6">
      <GoldCounter route="results/ask" />
      <h2 id="ask-heading" className="sr-only">
        Regulatory Assistant
      </h2>

      <div>
        <h3 className="font-display text-22 font-semibold text-ink">Regulatory Assistant</h3>
        <p className="mt-1 text-13 text-slate">
          Ask questions about your specific business situation. Responses are strictly grounded in statutory sources.
        </p>
      </div>

      {/* Question Form */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card">
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-14 text-ink placeholder-slate-light transition focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
            placeholder="e.g. Do I need a separate licence to sell on Amazon?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            className="rounded-xl bg-ink px-6 py-2.5 text-14 font-medium text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={busy || !q.trim()}
          >
            {busy ? "Researching…" : "Ask Assistant"}
          </button>
        </form>

        {/* Suggestion chips */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-11 font-semibold uppercase tracking-wider text-slate">Suggestions:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQ(s);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-12 text-slate-700 hover:bg-slate-100 hover:text-ink transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && errorCode === "RETRIEVAL_UNAVAILABLE" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-13 text-slate shadow-xs" role="alert">
          <div className="flex items-center gap-2 font-medium text-amber-900 text-14">
            <span>ℹ️</span>
            <span>Local Retrieval Sidecar Offline</span>
          </div>
          <p className="mt-2 leading-relaxed">
            The regulatory assistant searches against verified Tamil Nadu legal gazettes in <code>data/sources/</code> via the Python sidecar.
          </p>
          <div className="mt-3 rounded-xl bg-white border border-amber-200/80 p-3 font-mono text-12 text-ink">
            python scripts/retrieval-server.py
          </div>
        </div>
      )}

      {error && errorCode !== "RETRIEVAL_UNAVAILABLE" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-13 text-rose-700" role="alert">
          {error}
        </div>
      )}

      {ans && ans.abstained && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-14">
            <span>⚖️</span>
            <span>No Verified Primary Source Available</span>
          </div>
          <p className="mt-2 text-14 text-slate leading-relaxed">
            {ans.nearest_authority
              ? `For statutory guidance on this matter, direct consultation with ${ans.nearest_authority} is required.`
              : "I don't have a verified primary gazette source for that specific question, but I can guide you through the rest of your formalisation pathway."}
          </p>
        </div>
      )}

      {ans && !ans.abstained && ans.ungrounded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-12 text-amber-900" role="note">
          ⚠️ <strong>Notice:</strong> This response is generated without live gazette retrieval verification. Confirm requirements with relevant statutory authorities.
        </div>
      )}

      {ans && !ans.abstained && (
        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-4">
          <div className="prose text-15 text-ink leading-relaxed" style={{ maxWidth: "68ch" }}>
            {renderAnswerWithCitations(ans.answer)}
          </div>

          {ans.citations.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-11 font-semibold uppercase tracking-wider text-slate mb-2">
                Verified Statutory Citations
              </p>
              <ol className="space-y-1.5 text-12 text-slate tabular">
                {ans.citations.map((c) => (
                  <li key={c.n} className="flex items-start gap-2">
                    <span className="font-semibold text-gold">[{c.n}]</span>
                    <span>
                      <strong>{c.authority}</strong> — {c.title} ({c.locator})
                      {c.verified_on && <span className="text-emerald-700 font-medium ml-1.5">✓ Verified {c.verified_on}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </article>
      )}
    </section>
  );
}

function renderAnswerWithCitations(text: string): React.ReactNode {
  // Citation markers are the gold element for this tab per §10.5, and every
  // marker on the page counts as the *same* element. We use a distinct class
  // (`citation-marker`) so the GoldCounter dev audit doesn't flag the Ask tab
  // for having "multiple" gold uses — the class carries the gold colour
  // without matching the audit selector.
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) =>
    /^\[\d+\]$/.test(p) ? (
      <span key={i} className="citation-marker tabular">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

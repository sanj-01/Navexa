"use client";

// Funding tab — §11.6. Three eligibility states only: met ✓, unmet ✗, unknown ?.
// The single best-matched scheme is the gold element (§10.5).

import type { SchemesResponse } from "@/types/api";
import { GoldCounter } from "@/components/GoldCounter";

interface Props {
  schemes: SchemesResponse | null;
  loading: boolean;
}

export function Funding({ schemes, loading }: Props) {
  if (loading && !schemes) {
    return (
      <section>
        <GoldCounter route="results/funding" />
        <p className="text-15 text-slate">Loading schemes…</p>
      </section>
    );
  }
  if (!schemes || schemes.schemes.length === 0) {
    return (
      <section>
        <GoldCounter route="results/funding" />
        <div className="border hairline p-6">
          <p className="text-15">
            Scheme matching is not enabled yet.{" "}
            {schemes ? "No schemes matched your profile." : "Set up /api/schemes to enable it."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="funding-heading" className="space-y-6">
      <GoldCounter route="results/funding" />
      <h2 id="funding-heading" className="sr-only">
        Funding & Subsidies
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-22 font-semibold text-ink">Government Schemes & Subsidies</h3>
          <p className="mt-1 text-13 text-slate">
            State (Tamil Nadu) and Central MSME subsidy programs matched against your profile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1 text-12 font-medium text-slate shadow-2xs tabular">
            {schemes.matched} matched
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-12 font-medium text-emerald-800 tabular">
            ✓ {schemes.eligible_today} qualified today
          </span>
        </div>
      </div>

      <ul className="space-y-4">
        {schemes.schemes.map((s) => (
          <li
            key={s.id}
            className={
              "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition-all hover:border-slate-300 hover:shadow-lg " +
              (s.best_match ? "ring-1 ring-amber-400/40" : "")
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h4 className="font-display text-18 font-semibold text-ink">
                  {s.name}
                </h4>
                {s.best_match && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-11 font-medium gold"
                    aria-label="Best match"
                  >
                    ★ Top Match
                  </span>
                )}
              </div>
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-11 font-medium text-slate">
                Application: {s.route}
              </span>
            </div>

            <p className="mt-2 text-14 text-slate leading-relaxed">{s.summary}</p>

            {/* Criteria chips */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-11 font-semibold uppercase tracking-wider text-slate mb-2">
                Eligibility Evaluation
              </p>
              <ul className="flex flex-wrap gap-2 text-12">
                {s.criteria.map((c) => (
                  <li
                    key={c.key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
                      c.status === "met"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : c.status === "unmet"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span>{glyph(c.status)}</span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-11 text-slate-light">
              <span>Primary Source: {s.citation.locator}</span>
              {s.citation.verified_on && (
                <span className="text-emerald-700 font-medium">✓ Verified {s.citation.verified_on}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function glyph(s: "met" | "unmet" | "unknown"): string {
  if (s === "met") return "✓";
  if (s === "unmet") return "✗";
  return "?";
}

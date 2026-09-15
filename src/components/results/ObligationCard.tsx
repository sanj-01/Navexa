"use client";

// One row in the pathway list. §11.4 wireframe.
// Left border encodes phase (§10.3). One card per pathway is marked "next" —
// only that card gets the gold accent, per §10.5.

import type { Obligation } from "@/types/api";
import { daysRange, inr } from "@/lib/format";

interface Props {
  index: number;
  obligation: Obligation;
  isNext: boolean;
  revealDelayMs: number;
}

export function ObligationCard({ index, obligation, isNext, revealDelayMs }: Props) {
  const o = obligation;
  const phaseClass =
    o.phase === "pre-launch" ? "phase-pre-launch" : o.phase === "at-launch" ? "phase-at-launch" : "phase-ongoing";

  const feeLabel =
    o.fee_inr === 0
      ? "Free"
      : o.fee_inr === null || o.fee_inr === undefined
        ? "Confirm with authority"
        : inr(o.fee_inr);

  const timeline = daysRange(o.timeline_days);

  return (
    <article
      className={
        "reveal rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card transition-all hover:border-slate-300 hover:shadow-lg border-l-4 " +
        phaseClass +
        (isNext ? " ring-1 ring-amber-400/30" : "")
      }
      style={{ animationDelay: `${revealDelayMs}ms` }}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-12 font-semibold text-slate-700 tabular">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-17 sm:text-18 font-semibold text-ink leading-snug">
              {o.name}
            </h3>
            {isNext && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-11 font-medium gold"
                aria-label="Next action"
              >
                ★ Next Action
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-11 font-medium text-slate capitalize">
              {o.phase.replace("-", " ")}
            </span>
          </div>

          {o.reason && <p className="mt-2 text-14 text-slate leading-relaxed">{o.reason}</p>}

          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-12">
            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 font-medium text-ink tabular">
              💵 {feeLabel}
            </span>
            {timeline && (
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 font-medium text-slate tabular">
                ⏱️ {timeline}
              </span>
            )}
            {o.portal_url && (
              <a
                href={o.portal_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-ink hover:bg-slate-50 transition"
              >
                <span>🌐 {o.portal ?? "Official Portal"}</span>
                <span className="text-slate">↗</span>
              </a>
            )}
          </div>

          {o.depends_on.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-12 text-slate">
              <span className="font-medium text-slate">Prerequisites:</span>
              {o.depends_on.map((dep) => (
                <span
                  key={dep}
                  className="rounded-md border border-slate-200 bg-slate-100/60 px-2 py-0.5 text-11 font-medium text-slate-700"
                >
                  {dep}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-11 text-slate-light">
            <span>Official Gazette / Act: {o.citation.locator}</span>
            {o.citation.verified_on ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <span>✓</span>
                <span>Verified {o.citation.verified_on}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <span>⚠</span>
                <span>Verify with authority</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

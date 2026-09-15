"use client";

// Calendar tab — §11.7. Derived deadlines from obligation renewals.
// The nearest upcoming deadline is the gold element (§10.5).

import { useMemo } from "react";
import type { Obligation } from "@/types/api";
import { GoldCounter } from "@/components/GoldCounter";

interface Props {
  obligations: Obligation[];
}

interface Deadline {
  id: string;
  date: Date;
  label: string;
  note?: string;
  overdue: boolean;
}

export function Calendar({ obligations }: Props) {
  const now = new Date();
  const deadlines = useMemo(() => buildDeadlines(obligations, now), [obligations, now]);

  if (deadlines.length === 0) {
    return (
      <section>
        <GoldCounter route="results/calendar" />
        <p className="text-15 text-slate">
          No renewal deadlines derived from your pathway. This tab will populate as obligations
          with renewal cycles are added.
        </p>
      </section>
    );
  }

  const nearestId = deadlines[0].id;

  return (
    <section aria-labelledby="calendar-heading" className="space-y-6">
      <GoldCounter route="results/calendar" />
      <h2 id="calendar-heading" className="sr-only">
        Compliance Calendar
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-22 font-semibold text-ink">Statutory Compliance Calendar</h3>
          <p className="mt-1 text-13 text-slate">
            Mandatory annual filings, returns, and renewal milestones for the next 12 months.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1 text-12 font-medium text-slate shadow-2xs tabular">
          📅 {deadlines.length} scheduled renewals
        </span>
      </div>

      <ul className="space-y-3">
        {deadlines.map((d) => {
          const isNearest = d.id === nearestId;
          return (
            <li
              key={d.id + d.date.toISOString()}
              className={
                "rounded-2xl border bg-white p-4 sm:p-5 shadow-card transition-all hover:border-slate-300 hover:shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 " +
                (d.overdue
                  ? "border-rose-300 bg-rose-50/40"
                  : isNearest
                    ? "border-amber-300 ring-1 ring-amber-400/40"
                    : "border-slate-200/80")
              }
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={
                    "rounded-xl px-3 py-1.5 text-center text-13 font-semibold tabular border " +
                    (d.overdue
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : isNearest
                        ? "border-amber-200 bg-amber-50 gold"
                        : "border-slate-200 bg-slate-50 text-slate-700")
                  }
                >
                  {formatDate(d.date)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-16 font-semibold text-ink">{d.label}</p>
                    {isNearest && (
                      <span className="rounded-full bg-amber-100/70 border border-amber-200 px-2 py-0.5 text-11 font-medium text-amber-900">
                        Nearest upcoming
                      </span>
                    )}
                  </div>
                  {d.note && <p className="mt-1 text-12 text-slate">{d.note}</p>}
                </div>
              </div>

              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-11 font-medium text-slate">
                Statutory Milestone
              </span>
            </li>
          );
        })}
      </ul>

      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-12 text-slate leading-relaxed">
        <strong>Note on Renewal Schedules: </strong>
        Dates are dynamically computed from your business formalisation timeline and entity classification. Verify with respective portal dashboards.
      </div>
    </section>
  );
}

function buildDeadlines(obligations: Obligation[], now: Date): Deadline[] {
  const out: Deadline[] = [];
  for (const o of obligations) {
    if (!o.renewal) continue;
    const d = addMonths(now, o.renewal.cycle_months);
    out.push({
      id: o.id,
      date: d,
      label: `${o.name} — renewal`,
      note: `Cycle ${o.renewal.cycle_months} months, grace ${o.renewal.grace_days} days`,
      overdue: false,
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

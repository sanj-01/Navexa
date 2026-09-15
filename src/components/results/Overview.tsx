"use client";

// Overview — the dashboard landing after intake. A compact summary strip on
// top with the profile, then a 2x2 grid of stat tiles. Deliberately tight —
// judgement (§10) still applies: hairlines, no shadows, one gold accent.

import type { FeasibilityResponse, Obligation, ResolveResponse, SchemesResponse } from "@/types/api";
import { GoldCounter } from "@/components/GoldCounter";
import { inr, inrShort } from "@/lib/format";

interface Props {
  resolve: ResolveResponse;
  feasibility: FeasibilityResponse | null;
  schemes: SchemesResponse | null;
  budgetInr: number | undefined;
  onOpen: (section: "feasibility" | "pathway" | "funding" | "calendar" | "ask") => void;
}

export function Overview({ resolve, feasibility, schemes, budgetInr, onOpen }: Props) {
  const obligations = resolve.obligations;
  const listedFees = obligations.reduce((n, o) => n + (typeof o.fee_inr === "number" ? o.fee_inr : 0), 0);
  const next = pickNext(obligations);
  const nearestDeadline = deriveNearestDeadline(obligations);

  const runway =
    feasibility && feasibility.available && budgetInr !== undefined && feasibility.opex_monthly_inr > 0
      ? (budgetInr - feasibility.capex_total_inr) / feasibility.opex_monthly_inr
      : null;

  const eligibleSchemes = schemes?.eligible_today ?? 0;

  return (
    <section aria-labelledby="overview-heading" className="space-y-8">
      <GoldCounter route="results/overview" />
      <h2 id="overview-heading" className="sr-only">
        Overview
      </h2>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Obligations"
          value={String(obligations.length)}
          sub={`${resolve.phases["pre-launch"].length} pre · ${resolve.phases["at-launch"].length} launch · ${resolve.phases.ongoing.length} ongoing`}
          onClick={() => onOpen("pathway")}
        />
        <StatTile
          label="Listed fees"
          value={listedFees > 0 ? `₹${inrShort(listedFees)}` : "—"}
          sub={listedFees > 0 ? "Sum of statutory fees" : "Confirm with authorities"}
          onClick={() => onOpen("pathway")}
        />
        <StatTile
          label="Runway"
          value={runway !== null ? `${runway.toFixed(1)} mo` : "—"}
          sub={runway === null ? "Set setup budget" : verdictLabel(feasibility?.verdict)}
          onClick={() => onOpen("feasibility")}
        />
        <StatTile
          label="Nearest deadline"
          value={nearestDeadline ? formatDate(nearestDeadline.date) : "—"}
          sub={nearestDeadline ? nearestDeadline.label : "No renewals derived"}
          onClick={() => onOpen("calendar")}
          highlight="gold"
        />
      </div>

      {/* Next action */}
      {next && (
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-white p-6 shadow-xs transition-all">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100/60 px-2.5 py-0.5 text-11 font-medium text-amber-900">
              Immediate Action
            </span>
            <span className="text-12 text-slate font-medium">Phase: {next.phase}</span>
          </div>

          <p className="mt-3 font-display text-22 sm:text-24 font-semibold text-ink leading-tight">
            {next.name}
          </p>
          {next.reason && <p className="mt-2 text-14 text-slate leading-relaxed">{next.reason}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-12 font-medium text-slate shadow-2xs">
              🏛️ {next.authority}
            </span>
            {next.timeline_days && (
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-12 font-medium text-slate shadow-2xs tabular">
                ⏱️ {next.timeline_days[0]}–{next.timeline_days[1]} days
              </span>
            )}
            {next.portal_url && (
              <a
                href={next.portal_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-12 font-medium text-ink shadow-2xs hover:bg-slate-50 transition"
              >
                <span>{next.portal ?? "Official Portal"}</span>
                <span className="text-slate">↗</span>
              </a>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-amber-100/80">
            <button
              onClick={() => onOpen("pathway")}
              className="inline-flex items-center gap-1 text-13 font-medium text-amber-900 hover:text-amber-950 transition"
            >
              <span>Explore complete chronological pathway</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Section quick-links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionLink
          label="Funding & Subsidies"
          onClick={() => onOpen("funding")}
          summary={
            eligibleSchemes > 0
              ? `${eligibleSchemes} state & central scheme${eligibleSchemes > 1 ? "s" : ""} you qualify for today`
              : "Explore government capital subsidy schemes"
          }
        />
        <SectionLink
          label="Regulatory Assistant (Ask)"
          onClick={() => onOpen("ask")}
          summary="Ask free-form legal questions grounded in verified Tamil Nadu gazettes"
        />
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  sub,
  onClick,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  onClick?: () => void;
  highlight?: "gold";
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-card active:scale-[0.99]"
    >
      <p className="text-11 font-semibold uppercase tracking-wider text-slate group-hover:text-ink transition">
        {label}
      </p>
      <p
        className={
          "mt-2 font-display text-30 leading-none tabular font-semibold " +
          (highlight === "gold" ? "gold" : "text-ink")
        }
      >
        {value}
      </p>
      <p className="mt-2 text-12 text-slate truncate" title={sub}>
        {sub}
      </p>
    </button>
  );
}

function SectionLink({ label, summary, onClick }: { label: string; summary: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-card group active:scale-[0.99]"
    >
      <div>
        <p className="font-display text-17 font-semibold text-ink group-hover:text-gold transition">
          {label}
        </p>
        <p className="mt-1 text-13 text-slate">{summary}</p>
      </div>
      <span className="text-slate-light group-hover:text-ink group-hover:translate-x-0.5 transition-all text-16 font-medium">
        →
      </span>
    </button>
  );
}

function pickNext(obligations: Obligation[]): Obligation | undefined {
  return obligations.find((o) => o.phase === "at-launch") ?? obligations.find((o) => o.phase === "pre-launch");
}

function deriveNearestDeadline(obligations: Obligation[]): { date: Date; label: string } | null {
  const now = new Date();
  let best: { date: Date; label: string } | null = null;
  for (const o of obligations) {
    if (!o.renewal) continue;
    const d = new Date(now);
    d.setMonth(d.getMonth() + o.renewal.cycle_months);
    if (!best || d < best.date) best = { date: d, label: `${o.name} renewal` };
  }
  return best;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function verdictLabel(v: FeasibilityResponse["verdict"] | undefined): string {
  if (!v) return "";
  if (v === "covers_with_runway") return "Covers with runway";
  if (v === "tight") return "Tight — see feasibility";
  if (v === "insufficient") return "Insufficient — see feasibility";
  return "Cost model not available";
}

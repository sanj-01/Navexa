"use client";

// Feasibility tab — §11.5. This is a calculator, never a model call.
// The verdict figure is the single gold element on this screen.

import { useMemo, useState } from "react";
import type { FeasibilityResponse } from "@/types/api";
import { GoldCounter } from "@/components/GoldCounter";
import { inr, inrShort } from "@/lib/format";

interface Props {
  feasibility: FeasibilityResponse | null;
  loading: boolean;
  budgetInr: number | undefined;
  licenceFeeSubtotalInr: number;
  onRefresh?: () => void;
}

export function Feasibility({ feasibility, loading, budgetInr, licenceFeeSubtotalInr }: Props) {
  if (loading && !feasibility) {
    return (
      <section>
        <GoldCounter route="results/feasibility" />
        <p className="text-15 text-slate">Loading feasibility model…</p>
      </section>
    );
  }

  if (!feasibility || !feasibility.available) {
    // §11.5 unavailable state, verbatim wording per the wireframe.
    return (
      <section>
        <GoldCounter route="results/feasibility" />
        <div className="border hairline p-6">
          <p className="text-15">Cost model not available for this sector.</p>
          <p className="mt-2 text-15 text-slate">
            Licence, funding and compliance guidance below is still complete.
          </p>
        </div>
      </section>
    );
  }

  return (
    <InnerCalculator
      feasibility={feasibility}
      budgetInr={budgetInr}
      licenceFeeSubtotalInr={licenceFeeSubtotalInr}
    />
  );
}

function InnerCalculator({
  feasibility,
  budgetInr,
  licenceFeeSubtotalInr,
}: {
  feasibility: FeasibilityResponse;
  budgetInr: number | undefined;
  licenceFeeSubtotalInr: number;
}) {
  const [capex, setCapex] = useState(() => withLicenceOverride(feasibility.capex, licenceFeeSubtotalInr));
  const [opex, setOpex] = useState(feasibility.opex);

  const capexTotal = useMemo(() => capex.reduce((s, l) => s + l.value_inr, 0), [capex]);
  const opexMonthly = useMemo(() => opex.reduce((s, l) => s + l.value_inr, 0), [opex]);

  const runwayMonths = budgetInr && opexMonthly > 0 ? (budgetInr - capexTotal) / opexMonthly : 0;
  const verdict = classify(runwayMonths, budgetInr, capexTotal);

  return (
    <section aria-labelledby="feasibility-heading" className="space-y-8">
      <GoldCounter route="results/feasibility" />
      <h2 id="feasibility-heading" className="sr-only">
        Feasibility
      </h2>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-22 font-semibold text-ink">Capital & Runway Simulator</h3>
          <p className="mt-1 text-13 text-slate">
            Benchmark estimates for Tamil Nadu setups. Edit any value to recalculate runway live.
          </p>
        </div>
      </div>

      <VerdictBlock verdict={verdict} budget={budgetInr} capex={capexTotal} opex={opexMonthly} runway={runwayMonths} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Table title="One-time Setup Capital (Capex)" lines={capex} onChange={setCapex} totalLabel="Total Setup Capital" totalValue={capexTotal} />
        <Table title="Monthly Operating Cost (Opex)" lines={opex} onChange={setOpex} totalLabel="Total Monthly Burn" totalValue={opexMonthly} />
      </div>

      {feasibility.assumptions.length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xs">
          <p className="text-12 font-medium uppercase tracking-wider text-slate">Key Financial Assumptions</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-13 text-slate">
            {feasibility.assumptions.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

type Line = { key: string; label: string; value_inr: number; benchmark_range?: [number, number]; note?: string };

function withLicenceOverride(lines: Line[], licenceFee: number): Line[] {
  const idx = lines.findIndex((l) => l.key === "licences");
  if (idx === -1) return lines;
  const copy = [...lines];
  copy[idx] = { ...copy[idx], value_inr: licenceFee };
  return copy;
}

function Table({
  title,
  lines,
  onChange,
  totalLabel,
  totalValue,
}: {
  title: string;
  lines: Line[];
  onChange: (l: Line[]) => void;
  totalLabel: string;
  totalValue: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card flex flex-col justify-between">
      <div>
        <h4 className="font-display text-17 font-semibold text-ink mb-4 pb-3 border-b border-slate-100">
          {title}
        </h4>
        <ul className="divide-y divide-slate-100">
          {lines.map((line, i) => (
            <li key={line.key} className="flex items-center justify-between gap-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-14 font-medium text-ink">{line.label}</p>
                {line.benchmark_range && (
                  <p className="text-12 text-slate tabular">
                    Benchmark: ₹{inrShort(line.benchmark_range[0])}–₹{inrShort(line.benchmark_range[1])}
                  </p>
                )}
                {line.note && <p className="text-12 text-slate-light truncate">{line.note}</p>}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-12 text-slate">
                  ₹
                </span>
                <input
                  inputMode="numeric"
                  className="w-32 rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-6 pr-3 text-right text-14 font-medium text-ink tabular transition focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/10"
                  value={line.value_inr}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/[, ]/g, ""), 10);
                    const next = [...lines];
                    next[i] = { ...line, value_inr: Number.isFinite(n) ? n : 0 };
                    onChange(next);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-center justify-between text-14 font-semibold text-ink tabular">
        <span>{totalLabel}</span>
        <span className="text-16">{inr(totalValue)}</span>
      </div>
    </div>
  );
}

type Verdict = "covers_with_runway" | "tight" | "insufficient";

function classify(runwayMonths: number, budget: number | undefined, capex: number): Verdict {
  if (budget === undefined || budget < capex) return "insufficient";
  if (runwayMonths >= 3) return "covers_with_runway";
  if (runwayMonths >= 0.5) return "tight";
  return "insufficient";
}

function VerdictBlock({
  verdict,
  budget,
  capex,
  opex,
  runway,
}: {
  verdict: Verdict;
  budget: number | undefined;
  capex: number;
  opex: number;
  runway: number;
}) {
  if (budget === undefined) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-slate text-14 shadow-card">
        Provide your setup budget in your business profile to compute working capital and runway.
      </div>
    );
  }
  const working = Math.max(0, budget - capex);
  const monthsWord = runway >= 1 ? "months" : "month";

  const headline =
    verdict === "insufficient"
      ? "Capital shortfall — setup exceeds budget."
      : verdict === "tight"
        ? "Budget covers setup, but runway is tight."
        : "Healthy capital buffer with sustainable runway.";

  const badgeColor =
    verdict === "insufficient"
      ? "bg-rose-50 text-rose-800 border-rose-200"
      : verdict === "tight"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-emerald-50 text-emerald-800 border-emerald-200";

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-white p-6 sm:p-7 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-11 font-medium ${badgeColor}`}>
          {verdict === "insufficient" ? "High Risk" : verdict === "tight" ? "Moderate Runway" : "Feasible Runway"}
        </span>
        <span className="text-12 font-medium text-slate tabular">
          Declared Budget: {inr(budget)}
        </span>
      </div>

      <p className="mt-3 font-display text-24 sm:text-28 leading-snug gold font-semibold tabular">
        {inr(budget)} — {headline}
      </p>

      <div className="mt-4 flex flex-wrap gap-4 pt-3 border-t border-amber-100/80 text-13 text-slate tabular">
        <span>Working capital after setup: <strong className="text-ink font-semibold">{inr(working)}</strong></span>
        <span>·</span>
        <span>Runway: <strong className="text-ink font-semibold">{runway.toFixed(1)} {monthsWord}</strong> at {inr(opex)}/mo</span>
      </div>
    </div>
  );
}

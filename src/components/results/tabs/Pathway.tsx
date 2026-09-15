"use client";

// The pathway tab — §11.4. This is "the screen that wins or loses" per §12.
// One card is marked ★ next; that is the single gold element on this tab.

import type { Obligation, Phase } from "@/types/api";
import { ObligationCard } from "../ObligationCard";
import { NotRequiredCard } from "../NotRequiredCard";
import { GoldCounter } from "@/components/GoldCounter";
import { inrShort } from "@/lib/format";

interface Props {
  obligations: Obligation[];
  attributes: string[];
  cycleWarning?: boolean;
}

const PHASE_ORDER: Phase[] = ["pre-launch", "at-launch", "ongoing"];
const PHASE_LABEL: Record<Phase, string> = {
  "pre-launch": "Before you start",
  "at-launch": "At launch",
  ongoing: "Ongoing",
};

export function Pathway({ obligations, attributes, cycleWarning }: Props) {
  const grouped: Record<Phase, Obligation[]> = { "pre-launch": [], "at-launch": [], ongoing: [] };
  for (const o of obligations) grouped[o.phase].push(o);

  // Estimate: total fee for entries where fee_inr is a real number.
  const knownFee = obligations.reduce((sum, o) => sum + (typeof o.fee_inr === "number" ? o.fee_inr : 0), 0);
  const knownDays = obligations.reduce(
    (acc, o) => {
      if (!o.timeline_days) return acc;
      return [acc[0] + o.timeline_days[0], acc[1] + o.timeline_days[1]] as [number, number];
    },
    [0, 0] as [number, number]
  );

  // "Next" is the first non-satisfied obligation — for the demo, the first
  // at-launch or the first pre-launch that isn't the entity registration itself.
  const nextId = pickNext(obligations);

  const gstRequired = obligations.some((o) => o.id === "GST");
  const showGstNotYet =
    !gstRequired && !attributes.includes("interstate_supply") && !attributes.includes("sells_online");

  return (
    <section aria-labelledby="pathway-heading">
      <GoldCounter route="results/pathway" />
      <h2 id="pathway-heading" className="sr-only">
        Licence pathway
      </h2>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-12 font-medium text-slate shadow-2xs tabular">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          {obligations.length} total obligations
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-12 font-medium text-slate shadow-2xs tabular">
          ⏱️ Est. {knownDays[0]}–{knownDays[1]} days
        </span>
        {knownFee > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-12 font-medium text-slate shadow-2xs tabular">
            💵 Est. ₹{inrShort(knownFee)} in statutory fees
          </span>
        )}
      </div>

      {cycleWarning && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-13 text-rose-700">
          Dependency cycle detected. Rendering in category order — please report this obligation set.
        </div>
      )}

      {PHASE_ORDER.map((phase) => {
        const items = grouped[phase];
        if (items.length === 0 && !(phase === "ongoing" && showGstNotYet)) return null;
        return (
          <div key={phase} className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <h3 className="font-display text-17 font-semibold text-ink">
                {PHASE_LABEL[phase]}
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-11 font-medium text-slate tabular">
                {items.length} {items.length === 1 ? "step" : "steps"}
              </span>
            </div>
            <div className="space-y-3.5">
              {items.map((o, i) => (
                <ObligationCard
                  key={o.id}
                  index={globalOffset(grouped, phase) + i + 1}
                  obligation={o}
                  isNext={o.id === nextId}
                  revealDelayMs={i * 40}
                />
              ))}
              {phase === "ongoing" && showGstNotYet && (
                <NotRequiredCard
                  name="GST"
                  reason="Your turnover is below the threshold and you sell only within Tamil Nadu."
                  wouldChange="You cross the GST threshold, start selling outside Tamil Nadu, or list on any e-commerce marketplace."
                  citation="CBIC — CGST Act 2017, Sections 22 and 24"
                />
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function pickNext(obligations: Obligation[]): string | undefined {
  // Simplest rule: the first at-launch obligation, or if none, the first
  // pre-launch that isn't the very first entry (the entrepreneur is presumed
  // to know they need to register the business).
  const atLaunch = obligations.find((o) => o.phase === "at-launch");
  if (atLaunch) return atLaunch.id;
  const pre = obligations.filter((o) => o.phase === "pre-launch");
  return pre[1]?.id ?? pre[0]?.id;
}

function globalOffset(grouped: Record<Phase, Obligation[]>, current: Phase): number {
  let offset = 0;
  for (const p of PHASE_ORDER) {
    if (p === current) return offset;
    offset += grouped[p].length;
  }
  return offset;
}

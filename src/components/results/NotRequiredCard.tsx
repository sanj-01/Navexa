"use client";

// The "not required yet — and here is what would change that" card. §11.4.
// This is the deliberate demo win: the rule engine reasoning about a negative.

interface Props {
  name: string;
  reason: string;
  wouldChange: string;
  citation: string;
}

export function NotRequiredCard({ name, reason, wouldChange, citation }: Props) {
  return (
    <article
      className="reveal rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 shadow-xs border-l-4 border-l-emerald-600"
      style={{ animationDelay: "0ms" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-17 sm:text-18 font-semibold text-ink leading-snug">
          {name}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-11 font-medium text-emerald-800">
          <span>✓</span>
          <span>Exempt / Not Required Yet</span>
        </span>
      </div>

      <p className="mt-2 text-14 text-slate leading-relaxed">{reason}</p>

      <div className="mt-3.5 rounded-xl border border-slate-200/60 bg-white p-3 text-12 text-slate">
        <span className="font-semibold text-ink">Threshold Trigger: </span>
        <span>This becomes mandatory if: {wouldChange}</span>
      </div>

      <p className="mt-3 text-11 text-slate-light">
        Statutory Reference: {citation}
      </p>
    </article>
  );
}

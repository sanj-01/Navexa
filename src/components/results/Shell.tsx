"use client";

// Dashboard shell — sidebar + main panel.
//
// Two modes:
//   - `resolve` null: main panel hosts intake (step 1 → step 2 → step 3).
//     Nav items other than Overview are visible but greyed out.
//   - `resolve` set: main panel hosts Overview + section tabs. Full nav.
//
// The shell owns the fetch calls for feasibility and schemes so they cache
// across section switches.

import { useEffect, useMemo, useState } from "react";
import type { ClassifyResponse, FeasibilityResponse, Obligation, ResolveResponse, SchemesResponse } from "@/types/api";
import { Overview } from "./Overview";
import { Pathway } from "./tabs/Pathway";
import { Feasibility } from "./tabs/Feasibility";
import { Funding } from "./tabs/Funding";
import { Calendar } from "./tabs/Calendar";
import { Ask } from "./tabs/Ask";
import { Nearby } from "./tabs/Nearby";
import { Step1Description } from "../intake/Step1Description";
import { Step2Questions } from "../intake/Step2Questions";
import { Step3Profile, type ProfileValues } from "../intake/Step3Profile";
import { inr } from "@/lib/format";

type Section = "overview" | "feasibility" | "pathway" | "funding" | "calendar" | "nearby" | "ask";

const NAV: { key: Section; label: string; badge?: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "feasibility", label: "Feasibility" },
  { key: "pathway", label: "Pathway" },
  { key: "funding", label: "Funding" },
  { key: "calendar", label: "Calendar" },
  { key: "nearby", label: "Nearby & Competitors", badge: "Preview" },
  { key: "ask", label: "Ask" },
];

interface Props {
  intake: {
    stage: "step1" | "step2" | "step3" | "resolving";
    classify: ClassifyResponse | null;
    profile: ProfileValues | null;
    error: string | null;
    busy: boolean;
    onStep1: (description: string) => void;
    onStep2Done: (answers: Record<string, string>) => void;
    onStep3Done: (values: ProfileValues) => void;
    onBackToStep1: () => void;
    onBackToStep2: () => void;
  } | null;
  resolve: ResolveResponse | null;
  businessLabel: string;
  city: string;
  entityType: string;
  turnoverInr: number | undefined;
  employees: number | undefined;
  budgetInr: number | undefined;
  attributes: string[];
  onEdit: () => void;
  onSignOut: () => void;
  userEmail?: string | null;
}

export function ResultsShell({
  intake,
  resolve,
  businessLabel,
  city,
  entityType,
  turnoverInr,
  employees,
  budgetInr,
  attributes,
  onEdit,
  onSignOut,
  userEmail,
}: Props) {
  const [section, setSection] = useState<Section>("overview");
  const [feasibility, setFeasibility] = useState<FeasibilityResponse | null>(null);
  const [feasibilityLoading, setFeasibilityLoading] = useState(false);
  const [schemes, setSchemes] = useState<SchemesResponse | null>(null);
  const [schemesLoading, setSchemesLoading] = useState(false);

  const hasResolve = Boolean(resolve && !resolve.handoff);
  const licenceFeeSubtotal = useMemo(
    () => (resolve?.obligations ?? []).reduce((n, o) => n + (typeof o.fee_inr === "number" ? o.fee_inr : 0), 0),
    [resolve]
  );

  useEffect(() => {
    if (!resolve || resolve.handoff) return;
    (async () => {
      setFeasibilityLoading(true);
      try {
        const res = await fetch("/api/feasibility", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: resolve.session_id }),
        });
        if (res.ok) setFeasibility((await res.json()) as FeasibilityResponse);
      } finally {
        setFeasibilityLoading(false);
      }
    })();
  }, [resolve?.session_id, resolve?.handoff]);

  useEffect(() => {
    if (!resolve || resolve.handoff) return;
    (async () => {
      setSchemesLoading(true);
      try {
        const res = await fetch("/api/schemes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: resolve.session_id }),
        });
        if (res.ok) setSchemes((await res.json()) as SchemesResponse);
      } finally {
        setSchemesLoading(false);
      }
    })();
  }, [resolve?.session_id, resolve?.handoff]);

  // Handoff screen replaces the whole shell.
  if (resolve?.handoff) {
    return (
      <HandoffScreen
        authority={resolve.handoff.authority}
        sector={resolve.handoff.sector}
        startingPoint={resolve.handoff.starting_point}
        onEdit={onEdit}
      />
    );
  }

  return (
    <div className="min-h-screen sm:grid sm:grid-cols-[250px_1fr] bg-paper">
      {/* Sidebar */}
      <aside className="border-b hairline bg-white/70 backdrop-blur-md sm:flex sm:min-h-screen sm:flex-col sm:border-b-0 sm:border-r">
        <div className="px-6 pt-7 pb-5">
          <div className="flex items-center gap-2">
            <span className="font-display text-22 font-semibold tracking-tight text-ink">NAVEXA</span>
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          </div>
          <p className="mt-1 text-12 font-medium text-slate">Tamil Nadu Platform</p>
        </div>

        <nav aria-label="Sections" className="px-3 sm:flex-1">
          <ul className="flex flex-wrap gap-1 sm:flex-col sm:gap-1">
            {NAV.map((n) => {
              const active = hasResolve && n.key === section;
              const enabled = hasResolve || n.key === "overview";
              const tooltip = enabled
                ? undefined
                : "Finish describing your business to unlock this section.";
              return (
                <li key={n.key} className="sm:w-full">
                  <button
                    onClick={() => enabled && setSection(n.key)}
                    title={tooltip}
                    aria-disabled={!enabled}
                    className={
                      "flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-14 font-medium transition-all cursor-pointer " +
                      (active
                        ? "bg-slate-900 text-white shadow-xs"
                        : enabled
                          ? "text-slate hover:bg-slate-100 hover:text-ink"
                          : "text-slate/50 hover:bg-slate-50 hover:text-slate")
                    }
                  >
                    <span className="truncate">{n.label}</span>
                    <span className="flex items-center gap-1.5">
                      {n.badge && !active && (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-11 font-medium text-amber-900">
                          {n.badge}
                        </span>
                      )}
                      {!enabled && (
                        <span aria-hidden="true" className="text-slate-400 text-12">🔒</span>
                      )}
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden sm:block sm:px-5 sm:pb-7 sm:pt-4 border-t border-slate-100">
          {hasResolve && (
            <button
              onClick={onEdit}
              className="mt-3 block w-full text-center rounded-lg py-1.5 text-12 font-medium text-slate hover:text-ink hover:bg-slate-100 transition"
            >
              ← Edit business profile
            </button>
          )}
          {userEmail && (
            <div className="mt-4 rounded-xl border border-slate-200/60 bg-slate-50/70 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="truncate text-12 font-medium text-ink" title={userEmail}>
                  {userEmail}
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="mt-2 text-12 font-medium text-slate hover:text-rose-600 transition"
              >
                Sign out
              </button>
            </div>
          )}
          <p className="mt-4 text-center text-11 text-slate-light">
            {resolve && <>Corpus {resolve.corpus_version} · </>}
            Not legal advice
          </p>
        </div>
      </aside>

      {/* Main panel */}
      <main className="min-w-0 px-5 py-6 sm:px-10 sm:py-8">
        {hasResolve && resolve && (
          <header className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-12 font-medium uppercase tracking-wider text-slate">
                  Active Business Setup
                </span>
                <h1 className="mt-1 font-display text-24 sm:text-28 font-semibold text-ink leading-tight">
                  {businessLabel}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-12 font-medium text-slate">
                  📍 {city}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-12 font-medium text-slate">
                  ⚖️ {entityType}
                </span>
                {turnoverInr !== undefined && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-12 font-medium text-slate tabular">
                    ₹ ~{inr(turnoverInr)} turnover
                  </span>
                )}
                {employees !== undefined && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-12 font-medium text-slate tabular">
                    👥 {employees} staff
                  </span>
                )}
                {budgetInr !== undefined && (
                  <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/60 px-3 py-1 text-12 font-medium text-amber-900 tabular">
                    💰 {inr(budgetInr)} budget
                  </span>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Intake — shown until resolve completes */}
        {!hasResolve && intake && (
          <IntakePanel {...intake} />
        )}

        {/* Sections */}
        {hasResolve && resolve && section === "overview" && (
          <Overview
            resolve={resolve}
            feasibility={feasibility}
            schemes={schemes}
            budgetInr={budgetInr}
            onOpen={setSection}
          />
        )}
        {hasResolve && resolve && section === "pathway" && (
          <Pathway obligations={resolve.obligations} attributes={attributes} cycleWarning={resolve.cycle_warning} />
        )}
        {hasResolve && section === "feasibility" && (
          <Feasibility
            feasibility={feasibility}
            loading={feasibilityLoading}
            budgetInr={budgetInr}
            licenceFeeSubtotalInr={licenceFeeSubtotal}
          />
        )}
        {hasResolve && section === "funding" && <Funding schemes={schemes} loading={schemesLoading} />}
        {hasResolve && resolve && section === "calendar" && <Calendar obligations={resolve.obligations} />}
        {hasResolve && section === "nearby" && (
          <Nearby businessLabel={businessLabel} city={city} attributes={attributes} />
        )}
        {hasResolve && resolve && section === "ask" && <Ask sessionId={resolve.session_id} />}
      </main>
    </div>
  );
}

function IntakePanel(props: NonNullable<Props["intake"]>) {
  if (props.stage === "step1")
    return <Step1Description onSubmit={props.onStep1} busy={props.busy} error={props.error} />;
  if (props.stage === "step2" && props.classify)
    return <Step2Questions classify={props.classify} onDone={props.onStep2Done} onBack={props.onBackToStep1} />;
  if (props.stage === "step3")
    return (
      <Step3Profile
        onDone={props.onStep3Done}
        onBack={props.onBackToStep2}
        error={props.error}
        classifierAttributes={(props.classify?.attributes ?? []) as import("@/lib/attributes").Attribute[]}
      />
    );
  if (props.stage === "resolving")
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-14 text-slate shadow-card">
          <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
          <span>Computing regulatory pathway & legal dependencies…</span>
        </div>
      </div>
    );
  return null;
}

function HandoffScreen({
  authority,
  sector,
  startingPoint,
  onEdit,
}: {
  authority: string;
  sector: string;
  startingPoint: string;
  onEdit: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-12 font-medium text-amber-900">
          Specialist Regulator Required
        </span>
        <h1 className="mt-4 font-display text-26 font-semibold text-ink leading-tight">
          This sector requires specialized statutory oversight.
        </h1>
        <p className="mt-3 text-15 text-slate leading-relaxed">
          {sector.replace(/_/g, " ")} has a licensing regime deep enough that direct consultation with statutory authorities is recommended before committing capital.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
          <p className="text-14 font-medium text-ink">Primary Authority: {authority}</p>
          <p className="mt-2 text-13 text-slate">{startingPoint}</p>
        </div>
        <button
          onClick={onEdit}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-14 font-medium text-white shadow-xs transition hover:bg-slate-800"
        >
          ← Try a different business description
        </button>
      </div>
    </div>
  );
}

export type { Obligation };

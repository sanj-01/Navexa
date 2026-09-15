"use client";

// Intake step 3 — numeric profile capture. §5.1 step 4.
// No gold element on this screen — it is the setup for the results shell.
// (An intake screen without a gold accent is fine; §10.5 forbids more than
// one, not zero.)

import { useMemo, useState } from "react";
import type { Attribute } from "@/lib/attributes";
import { deriveAttributes } from "@/lib/deriveAttributes";

export interface ProfileValues {
  city: string;
  entity_type: string;
  turnover_inr: number | undefined;
  employees: number | undefined;
  budget_inr: number | undefined;
}

interface Props {
  onDone: (v: ProfileValues) => void;
  onBack: () => void;
  error?: string | null;
  // Attributes emitted by the classifier — used to compute sanity warnings
  // as the user types (e.g. "home_based + ₹50L turnover" flags a mismatch).
  classifierAttributes?: Attribute[];
}

export function Step3Profile({ onDone, onBack, error, classifierAttributes = [] }: Props) {
  const [city, setCity] = useState("Coimbatore");
  const [entity, setEntity] = useState("Proprietorship");
  const [turnover, setTurnover] = useState<string>("");
  const [employees, setEmployees] = useState<string>("");
  const [budget, setBudget] = useState<string>("");

  function parse(v: string): number | undefined {
    const n = parseInt(v.replace(/[, ]/g, ""), 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  const parsedTurnover = parse(turnover);
  const parsedEmployees = parse(employees);

  // Live sanity check based on the derived attribute bridge.
  const sanity = useMemo(
    () =>
      deriveAttributes(classifierAttributes, {
        turnover_inr: parsedTurnover,
        employees: parsedEmployees,
      }),
    [classifierAttributes, parsedTurnover, parsedEmployees]
  );

  // What the numbers will imply for the rule engine — surfaced so the user
  // can see the connection between their number and the resulting obligations.
  const derivedFlags: string[] = [];
  if (sanity.added.includes("turnover_above_threshold")) {
    derivedFlags.push("GST registration will be required (turnover ≥ ₹40L).");
  }
  if (sanity.added.includes("turnover_below_threshold")) {
    derivedFlags.push("GST not required at this turnover, but state-specific rules may differ.");
  }
  if (sanity.added.includes("employees_small")) derivedFlags.push("ESI registration will apply (10+ employees).");
  if (sanity.added.includes("employees_medium")) derivedFlags.push("EPF + ESI will apply (20+ employees).");
  if (sanity.added.includes("employees_large")) derivedFlags.push("EPF + ESI apply; contract-labour and factory rules may also engage.");

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-10">
      {/* Step Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-12 font-medium text-slate shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        Step 3 of 3 · Business Scale & Location
      </div>

      <div className="mt-4">
        <h2 className="font-display text-26 sm:text-30 font-semibold text-ink leading-tight">
          A few numbers for precision.
        </h2>
        <p className="mt-2 text-15 text-slate">
          Rough estimates are fine. These help determine GST thresholds, labour laws, and capital feasibility.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-13 text-rose-700" role="alert">
          {error}
        </div>
      )}

      {sanity.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-13 text-amber-900" role="alert">
          <p className="font-medium mb-1">Heads up — this doesn't quite line up:</p>
          <ul className="space-y-1">
            {sanity.warnings.map((w) => (
              <li key={w} className="flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {derivedFlags.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200/70 bg-white p-3.5 text-13 text-slate">
          <p className="text-11 font-semibold uppercase tracking-wider text-slate mb-1.5">
            What these numbers imply
          </p>
          <ul className="space-y-1">
            {derivedFlags.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Card */}
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="City (Tamil Nadu)">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Coimbatore, Chennai, Madurai"
              className={inputClass()}
            />
          </Field>
          <Field label="Legal structure">
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className={inputClass()}
            >
              <option>Proprietorship</option>
              <option>Partnership</option>
              <option>LLP</option>
              <option>Private Limited</option>
              <option>Not sure yet</option>
            </select>
          </Field>
          <Field label="Estimated annual turnover (₹)">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-14 text-slate">
                ₹
              </span>
              <input
                inputMode="numeric"
                value={turnover}
                onChange={(e) => setTurnover(e.target.value)}
                placeholder="e.g. 12,00,000"
                className={inputClass() + " pl-8 tabular"}
              />
            </div>
          </Field>
          <Field label="People working (including founders)">
            <input
              inputMode="numeric"
              value={employees}
              onChange={(e) => setEmployees(e.target.value)}
              placeholder="e.g. 3"
              className={inputClass() + " tabular"}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Setup capital / budget (₹)">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-14 text-slate">
                  ₹
                </span>
                <input
                  inputMode="numeric"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 5,00,000"
                  className={inputClass() + " pl-8 tabular"}
                />
              </div>
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-13 font-medium text-slate hover:bg-slate-50 hover:text-ink transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() =>
            onDone({
              city,
              entity_type: entity === "Not sure yet" ? "unknown" : entity,
              turnover_inr: parse(turnover),
              employees: parse(employees),
              budget_inr: parse(budget),
            })
          }
          className="rounded-xl bg-ink px-6 py-2.5 text-14 font-medium text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.99]"
        >
          Compute obligations pathway →
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-13 font-medium text-slate mb-1.5">{label}</span>
      <div>{children}</div>
    </label>
  );
}

function inputClass() {
  return "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-14 text-ink transition placeholder-slate-light focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10";
}

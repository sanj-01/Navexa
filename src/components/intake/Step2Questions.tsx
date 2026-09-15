"use client";

// Intake step 2 — adaptive questions. Wireframe: §11.2.
// The active question's left rule is the gold element on this screen.
// "Already known from your description" is the feature that makes the
// diagnosis legible (§11.2 caption).

import { useEffect, useState } from "react";
import type { ClassifyResponse } from "@/types/api";
import { GoldCounter } from "../GoldCounter";

interface Props {
  classify: ClassifyResponse;
  onDone: (answers: Record<string, string>) => void;
  onBack: () => void;
}

export function Step2Questions({ classify, onDone, onBack }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const questions = classify.unresolved ?? [];
  const total = questions.length;
  const q = questions[idx];

  // No questions to ask — pass straight through. Deferred via useEffect so
  // we never call setState on the parent during a child render.
  useEffect(() => {
    if (total === 0) onDone({});
    // onDone identity doesn't need to be in deps — the parent recreates it
    // every render, which would cause an infinite loop. Ownership of the
    // one-shot pass-through is here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  if (total === 0) return null;

  function record(value: string) {
    setAnswers((prev) => ({ ...prev, [q.attribute]: value }));
  }

  function advance() {
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else {
      onDone(answers);
    }
  }

  const selected = answers[q.attribute];

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-10">
      <GoldCounter route="intake/step-2" />

      {/* Progress header */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-12 font-medium text-slate shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Step 2 of 3 · Clarifying Details
        </div>
        <span className="text-12 font-medium text-slate tabular">
          Question {idx + 1} of {total}
        </span>
      </div>

      {/* Progress track */}
      <div className="mt-3 h-1 w-full rounded-full bg-slate-200/70 overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-300"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

      <div className="mt-6">
        <h2 className="font-display text-22 sm:text-26 font-semibold text-ink">
          {classify.business_label || "Your business setup"}
        </h2>
      </div>

      {/* Question Card */}
      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
        <div className="flex gap-4">
          <div className="w-1 shrink-0 self-stretch rounded-full gold-fill" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-17 font-medium text-ink leading-snug">{q.question}</p>
            <ul className="mt-5 space-y-2.5">
              {q.options.map((opt) => {
                const on = selected === opt;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => record(opt)}
                      className={
                        "flex w-full items-center gap-3.5 rounded-xl border p-4 text-left text-14 transition-all " +
                        (on
                          ? "border-gold bg-amber-50/40 text-ink ring-1 ring-amber-500/20 shadow-xs"
                          : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70")
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition " +
                          (on ? "border-gold bg-gold" : "border-slate-300 bg-white")
                        }
                      >
                        {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className={on ? "font-medium text-ink" : "text-slate-700"}>{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Already known attributes */}
      {classify.attributes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200/60 bg-white/60 p-5 backdrop-blur-xs">
          <p className="text-12 font-medium uppercase tracking-wider text-slate">
            Already confirmed from your description
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {classify.attributes.map((attr) => (
              <span
                key={attr}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/60 px-3 py-1 text-12 font-medium text-emerald-800"
              >
                <span className="text-emerald-600">✓</span>
                <span>{prettyAttr(attr)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-13 font-medium text-slate hover:bg-slate-50 hover:text-ink transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={!selected}
          className="rounded-xl bg-ink px-6 py-2.5 text-14 font-medium text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {idx + 1 < total ? "Next question →" : "Continue to profile →"}
        </button>
      </div>
    </div>
  );
}

function prettyAttr(a: string): string {
  // Turn "handles_food" into "handles food". Question wording rules (§5.3)
  // apply to labels the user sees too — no jargon.
  return a.replace(/_/g, " ");
}

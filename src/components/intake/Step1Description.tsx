"use client";

// Intake step 1 — free text or Tamil voice. Wireframe: §11.1.
// The active textarea's left rule is the single gold element on this screen.

import { useState } from "react";
import { GoldCounter } from "../GoldCounter";

interface Props {
  onSubmit: (description: string) => void;
  busy: boolean;
  error?: string | null;
}

const EXAMPLES = [
  "a small pickle unit from my home, selling in local shops",
  "a cafe serving coffee and light meals in Coimbatore",
  "a salon with two chairs in a rented shop",
  "freelance web design from home, some clients abroad",
  "buying scrap metal from households and selling to recyclers",
];

export function Step1Description({ onSubmit, busy, error }: Props) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const canSubmit = trimmed.length >= 6 && !busy;
  const showHint = text.length > 0 && trimmed.length < 6;

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-10">
      <GoldCounter route="intake/step-1" />

      {/* Step Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-12 font-medium text-slate shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        Step 1 of 3 · Business Diagnosis
      </div>

      <h1 className="mt-4 font-display text-30 sm:text-36 leading-tight text-ink font-semibold">
        What do you want to start?
      </h1>
      <p className="mt-2 text-15 text-slate leading-relaxed">
        Describe your business in plain words. We will deduce required licences, funding, and registration sequence.
      </p>

      {/* Input Card */}
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card transition-all">
        <form
          className="flex gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit(text.trim());
          }}
        >
          {/* Left rule — the gold element per §10.5 */}
          <div className="w-1 shrink-0 self-stretch rounded-full gold-fill" aria-hidden="true" />
          <textarea
            rows={3}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. A small organic pickle and spice manufacturing unit in Coimbatore, selling online and in local shops"
            className="w-full resize-none border-0 bg-transparent p-1 text-16 text-ink leading-relaxed placeholder-slate-light focus:outline-none"
            disabled={busy}
          />
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <span className="text-12 text-slate font-medium">
            {showHint
              ? "A few more characters, please."
              : trimmed.length === 0
                ? "Type a brief sentence above."
                : `${trimmed.length} characters`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-13 font-medium text-slate hover:bg-slate-100 hover:text-ink disabled:opacity-40 transition"
              disabled
              title="Sarvam Tamil ASR — set SARVAM_API_KEY to enable."
            >
              <span>🎙</span>
              <span>Tamil voice</span>
            </button>
            <button
              type="button"
              onClick={() => canSubmit && onSubmit(trimmed)}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2 text-14 font-medium text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  Analyzing…
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <span className="text-slate-light">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-13 text-rose-700" role="alert">
          {error}
        </div>
      )}

      {/* Examples as subtle interactive chips */}
      <div className="mt-10 rounded-2xl border border-slate-200/60 bg-white/60 p-5 backdrop-blur-xs">
        <p className="text-12 font-medium uppercase tracking-wider text-slate">
          Or explore a sample business
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onSubmit(ex)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-13 text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-ink transition active:scale-[0.99] text-left"
            >
              <span className="font-medium text-ink">{ex.split(",")[0]}</span>
              {ex.includes(",") && (
                <span className="text-slate-light ml-1 text-12">
                  ,{ex.split(",").slice(1).join(",")}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <footer className="mt-16 text-center text-12 text-slate-light">
        NAVEXA Tamil Nadu · Citations verified against official government gazettes
      </footer>
    </div>
  );
}

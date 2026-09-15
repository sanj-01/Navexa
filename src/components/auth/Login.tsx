"use client";

// Login / sign-up. Real Supabase Auth (email + password).
//
// Design: single card, sentence case, no dashboards or hero. Matches the
// Sovereign restraint of the rest of the app.

import { useState } from "react";
import { authConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "sign-in" | "sign-up";

export function Login({
  onSignedIn,
  onContinueAsGuest,
}: {
  onSignedIn: () => void;
  onContinueAsGuest?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configured = authConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError("Supabase auth is optional for demo mode. You can click 'Explore Demo as Guest' below to continue immediately.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const sb = supabaseBrowser();
      if (mode === "sign-up") {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          onSignedIn();
        } else {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("sign-in");
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignedIn();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3.5 py-1 text-12 font-medium text-slate shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Tamil Nadu · Business Setup
          </div>
          <h1 className="mt-4 font-display text-36 tracking-tight text-ink font-semibold">
            NAVEXA
          </h1>
          <p className="mt-2 text-14 text-slate max-w-xs mx-auto">
            The complete, ordered pathway of registrations, licences, and compliance obligations.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-card">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100/80 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("sign-in");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-13 font-medium transition-all ${
                mode === "sign-in"
                  ? "bg-white text-ink shadow-xs"
                  : "text-slate hover:text-ink"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("sign-up");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-13 font-medium transition-all ${
                mode === "sign-up"
                  ? "bg-white text-ink shadow-xs"
                  : "text-slate hover:text-ink"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-13 font-medium text-slate mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-14 text-ink placeholder-slate-light transition focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
              />
            </div>

            <div>
              <label className="block text-13 font-medium text-slate mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-14 text-ink placeholder-slate-light transition focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-13 text-rose-700" role="alert">
                {error}
              </div>
            )}

            {notice && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-13 text-amber-800">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full rounded-xl bg-ink py-2.5 px-4 text-14 font-medium text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Authenticating…" : mode === "sign-in" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Guest demo mode button */}
          {onContinueAsGuest && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-14 font-medium text-ink shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition active:scale-[0.99]"
              >
                <span>Continue as Guest (Explore Demo)</span>
                <span className="text-slate text-13">→</span>
              </button>
              <p className="mt-2 text-center text-12 text-slate">
                No sign-up required. Instant access to full pathway.
              </p>
            </div>
          )}

          {/* Optional Supabase info accordion */}
          {!configured && (
            <details className="mt-6 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 text-12 text-slate">
              <summary className="cursor-pointer font-medium text-slate-700 select-none">
                Configure permanent accounts (Optional)
              </summary>
              <div className="mt-2 space-y-1.5 pl-1 text-slate leading-relaxed">
                <p>To persist user accounts, add your keys to <code>.env.local</code>:</p>
                <div className="rounded-lg bg-white border border-slate-200 p-2 font-mono text-11 text-ink overflow-x-auto">
                  NEXT_PUBLIC_SUPABASE_URL=...<br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
                </div>
              </div>
            </details>
          )}
        </div>

        <p className="mt-8 text-center text-12 text-slate-light">
          NAVEXA Tamil Nadu · Regulatory Intelligence System · Not legal advice
        </p>
      </div>
    </main>
  );
}

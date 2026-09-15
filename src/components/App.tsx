"use client";

// Root client shell.
//
// Flow: auth gate → dashboard shell.
// The shell hosts intake (when there's no resolved profile) or the results
// dashboard (once resolve completes). Both share the sidebar and header.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ResultsShell } from "./results/Shell";
import { Login } from "./auth/Login";
import { authConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";
import type { ClassifyResponse, ResolveResponse } from "@/types/api";
import type { Attribute } from "@/lib/attributes";
import { deriveAttributes } from "@/lib/deriveAttributes";
import type { ProfileValues } from "./intake/Step3Profile";

type Stage = "step1" | "step2" | "step3" | "resolving";

export function App() {
  // -- auth state -----------------------------------------------------------
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authReady, setAuthReady] = useState(!authConfigured());

  useEffect(() => {
    if (!authConfigured()) {
      setAuthReady(true);
      return;
    }
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // -- intake state ---------------------------------------------------------
  const [stage, setStage] = useState<Stage>("step1");
  const [description, setDescription] = useState("");
  const [classify, setClassify] = useState<ClassifyResponse | null>(null);
  const [profile, setProfile] = useState<ProfileValues | null>(null);
  const [resolve, setResolve] = useState<ResolveResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStep1(desc: string) {
    setDescription(desc);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      const data = await res.json();
      if (res.ok) {
        setClassify(data as ClassifyResponse);
        setStage(data.unresolved?.length > 0 ? "step2" : "step3");
      } else if (res.status === 501 || res.status === 502) {
        // Classifier not wired or Groq call failed. Skip step 2 and let the
        // user proceed with the universal-base obligations only.
        setError(
          "Classifier isn't reachable yet — proceeding without attribute detection. Pathway will show universal obligations only."
        );
        setClassify({
          generated_at: new Date().toISOString(),
          corpus_version: "unversioned",
          attributes: [],
          sector: "general",
          business_label: descriptionToLabel(desc),
          unresolved: [],
          confidence: 0,
        });
        setStage("step3");
      } else {
        setError(data?.error ?? `Classifier failed (${res.status})`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleStep2Done(answers: Record<string, string>) {
    if (!classify) return;
    const applied = new Set<Attribute>(classify.attributes);
    for (const [attr, ans] of Object.entries(answers)) {
      if (ans.toLowerCase().startsWith("y") || /^[\d]/.test(ans)) applied.add(attr as Attribute);
    }
    setClassify({ ...classify, attributes: [...applied] });
    setStage("step3");
  }

  async function handleStep3Done(p: ProfileValues) {
    if (!classify) return;
    setProfile(p);
    setBusy(true);
    setError(null);
    setStage("resolving");

    // Bridge the numeric profile back into the attribute set. Without this
    // the classifier's guess (based on the description alone) is authoritative
    // even when the user's numbers contradict it — e.g. a "home-based pickle
    // unit" declaring ₹50L turnover would never trigger GST.
    const derived = deriveAttributes(classify.attributes, {
      turnover_inr: p.turnover_inr,
      employees: p.employees,
    });
    if (derived.added.length > 0) {
      setClassify({ ...classify, attributes: derived.attributes });
    }

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            description,
            attributes: derived.attributes,
            sector: classify.sector,
            business_label: classify.business_label,
            state: "TN",
            city: p.city,
            entity_type: p.entity_type,
            turnover_inr: p.turnover_inr,
            employees: p.employees,
            budget_inr: p.budget_inr,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Resolver failed (${res.status})`);
        setStage("step3");
      } else {
        setResolve(data as ResolveResponse);
      }
    } catch (err) {
      setError((err as Error).message);
      setStage("step3");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage("step1");
    setClassify(null);
    setResolve(null);
    setProfile(null);
    setError(null);
    setDescription("");
  }

  async function signOut() {
    setIsGuest(false);
    if (authConfigured()) {
      await supabaseBrowser().auth.signOut();
    }
    reset();
  }

  // -- render ---------------------------------------------------------------
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-14 text-slate shadow-card border hairline">
          <span className="inline-block h-2 w-2 rounded-full bg-gold animate-pulse" />
          Loading workspace…
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <Login
        onSignedIn={() => { /* onAuthStateChange updates user */ }}
        onContinueAsGuest={() => setIsGuest(true)}
      />
    );
  }

  return (
    <ResultsShell
      intake={{
        stage,
        classify,
        profile,
        error,
        busy,
        onStep1: handleStep1,
        onStep2Done: handleStep2Done,
        onStep3Done: handleStep3Done,
        onBackToStep1: () => setStage("step1"),
        onBackToStep2: () => setStage(classify?.unresolved.length ? "step2" : "step1"),
      }}
      resolve={resolve}
      businessLabel={classify?.business_label || descriptionToLabel(description)}
      city={profile?.city ?? ""}
      entityType={profile?.entity_type ?? ""}
      turnoverInr={profile?.turnover_inr}
      employees={profile?.employees}
      budgetInr={profile?.budget_inr}
      attributes={classify?.attributes ?? []}
      onEdit={reset}
      onSignOut={signOut}
      userEmail={user?.email ?? (isGuest ? "Guest demo mode" : null)}
    />
  );
}

function descriptionToLabel(desc: string): string {
  const trimmed = desc.trim().replace(/\s+/g, " ");
  return trimmed.length <= 60 ? trimmed : trimmed.slice(0, 57) + "…";
}

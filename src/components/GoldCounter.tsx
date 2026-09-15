"use client";

// Dev-only audit: exactly one --gold-token element per screen. §10.5, Prompt 6.
// Warns in the console if more than one .gold / .gold-fill / .gold-border
// element is present on the current route.

import { useEffect } from "react";

export function GoldCounter({ route }: { route: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const t = setTimeout(() => {
      const count = document.querySelectorAll(".gold, .gold-fill, .gold-border").length;
      if (count > 1) {
        console.warn(
          `[Sovereign audit] route "${route}" uses --gold in ${count} places. ` +
            "Per ANVIL-SPEC.md §10.5, exactly one element per screen carries the gold accent."
        );
      }
    }, 40);
    return () => clearTimeout(t);
  });
  return null;
}

import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        "surface-subtle": "var(--surface-subtle)",
        // Preserve the default slate scale (so `text-slate-200`, `bg-slate-50/50`
        // etc. work) while still resolving bare `text-slate` to the --slate CSS var.
        slate: { ...colors.slate, DEFAULT: "var(--slate)" },
        "slate-light": "var(--slate-light)",
        rule: "var(--rule)",
        gold: "var(--gold)",
        "gold-subtle": "var(--gold-subtle)",
        flag: "var(--flag)",
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "11": ["11px", { lineHeight: "1.4" }],
        "12": ["12px", { lineHeight: "1.4" }],
        "13": ["13px", { lineHeight: "1.5" }],
        "14": ["14px", { lineHeight: "1.5" }],
        "15": ["15px", { lineHeight: "1.6" }],
        "16": ["16px", { lineHeight: "1.55" }],
        "17": ["17px", { lineHeight: "1.55" }],
        "20": ["20px", { lineHeight: "1.4" }],
        "22": ["22px", { lineHeight: "1.35" }],
        "24": ["24px", { lineHeight: "1.3" }],
        "26": ["26px", { lineHeight: "1.3" }],
        "30": ["30px", { lineHeight: "1.25" }],
        "36": ["36px", { lineHeight: "1.2" }],
        "42": ["42px", { lineHeight: "1.15" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        full: "9999px",
        none: "0",
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(15, 23, 42, 0.03)",
        xs: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)",
        sm: "0 2px 4px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 6px 16px -4px rgba(15, 23, 42, 0.03)",
        lg: "0 10px 25px -3px rgba(15, 23, 42, 0.06), 0 4px 6px -4px rgba(15, 23, 42, 0.03)",
        xl: "0 20px 30px -6px rgba(15, 23, 42, 0.07), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;

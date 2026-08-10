import type { Config } from "tailwindcss";

// Aura design tokens — light, paper-ground, WorldClaw-clean (Aug 2026 pivot).
// Ink on paper, emerald as THE accent, violet rationed to on-chain surfaces.
// Accent text shades are AA-checked against the paper ground.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* Every entry resolves through the tonal ladder in globals.css rather
         than baking hex. This is the change that makes night mode real: the
         previous attempt redefined CSS variables that no utility class ever
         referenced, so the site repainted nothing and looked identical.

         The rgb(var(--x) / <alpha-value>) form is mandatory, not stylistic —
         Tailwind substitutes <alpha-value> so opacity modifiers keep working
         (text-aura-text/70 appears throughout the pages). A bare
         "var(--aura-text)" would compile but silently drop every /NN. */
      colors: {
        aura: {
          bg: "rgb(var(--tone-base) / <alpha-value>)", // page ground
          sunken: "rgb(var(--tone-sunken) / <alpha-value>)", // wells, tracks, insets
          panel: "rgb(var(--tone-raised) / <alpha-value>)", // cards
          overlay: "rgb(var(--tone-overlay) / <alpha-value>)", // sheets, popovers
          floating: "rgb(var(--tone-floating) / <alpha-value>)", // menus, toasts
          ink: "rgb(var(--tone-ink) / <alpha-value>)", // primary text — BRAND.md section 2
          paper: "rgb(var(--tone-paper) / <alpha-value>)", // text on solid-ink surfaces
          text: "rgb(var(--tone-ink) / <alpha-value>)",
          dim: "rgb(var(--tone-dim) / <alpha-value>)", // secondary text, captions
          faint: "rgb(var(--tone-faint) / <alpha-value>)", // tertiary text, axis labels
          /* BRAND.md section 2: emerald-deep #047857 is the AA body-scale
             text shade on paper; #059669 is the ceiling for large display and
             tracked labels; #10b981 is THE accent as a MARK (bars, rules,
             fills). Night remaps all three upward — see the ladder. */
          emerald: "rgb(var(--tone-emerald) / <alpha-value>)",
          "emerald-label": "rgb(var(--tone-emerald-label) / <alpha-value>)",
          "emerald-bright": "rgb(var(--tone-emerald-bright) / <alpha-value>)",
          /* the palette teal is #0d9488; at small text sizes it is 3.2:1 on
             paper, so the darker #0f766e stays the TEXT shade and #0d9488 is
             reserved for marks. */
          teal: "rgb(var(--tone-teal) / <alpha-value>)",
          "teal-mark": "rgb(var(--tone-teal-mark) / <alpha-value>)",
          violet: "rgb(var(--tone-violet) / <alpha-value>)",
          lime: "rgb(var(--tone-lime) / <alpha-value>)",
        },
      },
      borderColor: {
        /* --aura-border verbatim — the old value rgba(26,29,27,.12) was a
           near-miss of the palette, which the globals.css header forbids */
        hairline: "rgb(var(--tone-ink) / var(--hair-alpha))",
      },
      spacing: {
        /* the modular rhythm, available as p-/m-/gap-/space-y- utilities */
        s1: "var(--space-1)",
        s2: "var(--space-2)",
        s3: "var(--space-3)",
        s4: "var(--space-4)",
        s5: "var(--space-5)",
        s6: "var(--space-6)",
        s7: "var(--space-7)",
        s8: "var(--space-8)",
        s9: "var(--space-9)",
      },
      boxShadow: {
        "aura-1": "var(--shadow-1)",
        "aura-2": "var(--shadow-2)",
        "aura-3": "var(--shadow-3)",
      },
      letterSpacing: {
        label: "0.18em",
      },
      fontFamily: {
        sans: ['"Manrope Variable"', "Manrope", "Segoe UI", "system-ui", "sans-serif"],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', "Segoe UI", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

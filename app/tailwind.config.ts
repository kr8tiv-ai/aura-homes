import type { Config } from "tailwindcss";

// Aura design tokens — light, paper-ground, WorldClaw-clean (Aug 2026 pivot).
// Ink on paper, emerald as THE accent, violet rationed to on-chain surfaces.
// Accent text shades are AA-checked against the paper ground.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: "#fafaf9", // paper ground
          panel: "#ffffff", // cards
          ink: "#171a18", // primary text — BRAND.md section 2
          paper: "#fafaf9", // text on solid-ink surfaces
          text: "#171a18",
          dim: "#5f6663", // secondary text, captions
          faint: "#9aa19d", // tertiary text, axis labels
          /* BRAND.md section 2: emerald-deep #047857 is the AA body-scale
             text shade; #059669 is the ceiling for large display and tracked
             labels; #10b981 is THE accent as a MARK (bars, rules, fills).
             The old token was #087a55, which is in none of those bands. */
          emerald: "#047857",
          "emerald-label": "#059669",
          "emerald-bright": "#10b981", // bars, rings, large numerals only
          /* the palette teal is #0d9488; at small text sizes it is 3.2:1 on
             paper, so the darker #0f766e stays the TEXT shade and #0d9488 is
             reserved for marks. */
          teal: "#0f766e",
          "teal-mark": "#0d9488",
          violet: "#7c3aed",
          lime: "#4d7c0f",
        },
      },
      borderColor: {
        /* --aura-border verbatim — the old value rgba(26,29,27,.12) was a
           near-miss of the palette, which the globals.css header forbids */
        hairline: "rgba(23, 26, 24, 0.12)",
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

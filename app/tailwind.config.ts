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
          ink: "#1a1d1b", // primary text
          paper: "#fafaf9", // text on solid-ink surfaces
          text: "#1a1d1b",
          emerald: "#087a55", // accent for text/labels (AA small-text safe)
          "emerald-bright": "#10b981", // bars, rings, large numerals only
          teal: "#0f766e",
          violet: "#7c3aed",
          lime: "#4d7c0f",
        },
      },
      borderColor: {
        hairline: "rgba(26, 29, 27, 0.12)",
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

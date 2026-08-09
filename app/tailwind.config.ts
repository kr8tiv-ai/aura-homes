import type { Config } from "tailwindcss";

// Aura design tokens: dark, premium, minimal.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: "#050807",
          panel: "#0b1210",
          text: "#e7ece9",
          emerald: "#10b981",
          teal: "#2dd4bf",
          violet: "#8b5cf6",
          lime: "#a3e635",
        },
      },
      borderColor: {
        hairline: "rgba(16,185,129,0.18)",
      },
      letterSpacing: {
        label: "0.18em",
      },
    },
  },
  plugins: [],
};

export default config;

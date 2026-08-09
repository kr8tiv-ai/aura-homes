// The scroll story's copy. Aura voice: short declaratives, sentence case,
// tracked-caps labels, ranges with a basis, no exclamation marks.

export type Beat = {
  id: string;
  label: string;
  heading: string;
  body: string;
  side: "left" | "right";
  accent: "emerald" | "teal" | "violet" | "lime";
};

export const HERO = {
  label: "Off-grid, on-chain",
  heading: "Design it. Fund it. Build it.",
  sub: "A small eco home in the trees — designed by an agent, funded in USDC on X Layer, built in Alberta.",
  cue: "Scroll",
} as const;

export const BEATS: Beat[] = [
  {
    id: "land",
    label: "01 · Land",
    heading: "Start with the land.",
    body: "Real parcels, filtered for what a build actually needs: district dwelling minimums, aquifer reliability, distance to power, and septic soils. USDC in, title out.",
    side: "right",
    accent: "lime",
  },
  {
    id: "design",
    label: "02 · Design",
    heading: "The AI drafts your home.",
    body: "A short questionnaire becomes a review-ready design package — SIP panels, checked against Part 9 and climate zone 7A, reviewed and stamped by licensed professionals before anything is built.",
    side: "left",
    accent: "emerald",
  },
  {
    id: "budget",
    label: "03 · Budget",
    heading: "A budget with nothing hidden.",
    body: "Costed line by line from Alberta suppliers, with no middlemen. Ranges, not promises — LOW, MID, and HIGH, each with its basis shown.",
    side: "right",
    accent: "teal",
  },
  {
    id: "escrow",
    label: "04 · Escrow",
    heading: "Funds move when milestones do.",
    body: "USDC held in escrow on X Layer, released on 2-of-3 approval. Alberta's statutory 10% holdback is modeled on-chain, and the build record is anchored as it happens.",
    side: "left",
    accent: "violet",
  },
  {
    id: "build",
    label: "05 · Build",
    heading: "Then you get the keys.",
    body: "Permits, professionals, and materials, orchestrated to completion. The deck, the wood stove, and the hot tub under the spruce — the parts that make it a home, not a project.",
    side: "right",
    accent: "emerald",
  },
];

export const END = {
  tagline: "From USDC on X Layer to the keys of an off-grid eco home",
  season: "BuildX AI Season 2026",
  links: [
    { href: "/land", label: "Land" },
    { href: "/design", label: "Design" },
    { href: "/budget", label: "Budget" },
    { href: "/escrow", label: "Escrow" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/overview", label: "Overview" },
  ],
  creditsUrl:
    "https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/CREDITS.md",
} as const;

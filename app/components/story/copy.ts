// The scroll story's copy. Aura voice: short declaratives, sentence case,
// tracked-caps labels, ranges with a basis, no exclamation marks.
//
// Structure follows BRAND.md section 4/7: every beat carries a numbered
// kicker (mono number + hairline + tracked label) and, where it earns one, a
// spec-ledger — tiny mono IN / OUT rows that state what goes in and what
// comes out of that stage. The ledger is the substantiating prose beside the
// display statement, which is the asymmetric pairing the brand asks for.

export type LedgerRow = { k: string; v: string };

export type Beat = {
  id: string;
  /** mono figure in the kicker — "01" */
  n: string;
  /** tracked-caps word after the hairline — "Land" */
  label: string;
  heading: string;
  body: string;
  side: "left" | "right";
  accent: "emerald" | "teal" | "violet" | "lime";
  ledger?: LedgerRow[];
};

export const HERO = {
  n: "00",
  label: "Off-grid, on-chain",
  heading: "Design it. Fund it. Build it.",
  sub: "Aura Homes is the agent that takes you from USDC on X Layer to the keys of an off-grid eco home — land, design, budget, escrow, and build, orchestrated end to end.",
  cue: "Scroll",
  ledger: [
    { k: "In", v: "USDC on X Layer" },
    { k: "Out", v: "Keys to a finished home" },
  ] as LedgerRow[],
} as const;

export const BEATS: Beat[] = [
  {
    id: "land",
    n: "01",
    label: "Land",
    heading: "Start with the land.",
    body: "Real parcels, filtered for what a build actually needs: district dwelling minimums, aquifer reliability, distance to power, and septic soils.",
    side: "right",
    accent: "lime",
    ledger: [
      { k: "In", v: "Budget, region, acreage" },
      { k: "Out", v: "Shortlist with title status" },
    ],
  },
  {
    id: "design",
    n: "02",
    label: "Design",
    heading: "The AI drafts your home.",
    body: "A short questionnaire becomes a review-ready design package — SIP panels, checked against Part 9 and climate zone 7A, reviewed and stamped by licensed professionals before anything is built.",
    side: "left",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Twelve questions" },
      { k: "Out", v: "Stamped design package" },
    ],
  },
  {
    id: "budget",
    n: "03",
    label: "Budget",
    heading: "A budget with nothing hidden.",
    body: "Costed line by line from Alberta suppliers, with no middlemen. Ranges, not promises — low, mid, and high, each with its basis shown.",
    side: "right",
    accent: "teal",
  },
  {
    id: "escrow",
    n: "04",
    label: "Escrow",
    heading: "Funds move when milestones do.",
    body: "USDC held in escrow on X Layer, released on 2-of-3 approval. Alberta's statutory holdback is modeled on-chain, and the build record is anchored as it happens.",
    side: "left",
    accent: "violet",
  },
  {
    id: "build",
    n: "05",
    label: "Build",
    heading: "Then you get the keys.",
    body: "Permits, professionals, and materials, orchestrated to completion. The deck, the wood stove, and the hot tub under the spruce — the parts that make it a home, not a project.",
    side: "right",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Approved package, funded escrow" },
      { k: "Out", v: "Occupancy permit, keys" },
    ],
  },
];

export const END = {
  n: "06",
  label: "Where next",
  tagline: "From USDC on X Layer to the keys of an off-grid eco home",
  season: "BuildX AI Season 2026",
  /* The app is the destination: one primary door, the stages as side doors. */
  cta: { href: "/dashboard", label: "Open the build dashboard" },
  links: [
    { href: "/overview", label: "Overview" },
    { href: "/land", label: "Land" },
    { href: "/design", label: "Design" },
    { href: "/budget", label: "Budget" },
    { href: "/escrow", label: "Escrow" },
  ],
  creditsUrl:
    "https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/CREDITS.md",
} as const;

/* In-scene CTA surfaced at the deck/hot-tub pause (beat 5). */
export const BUILD_CTA = { href: "/dashboard", label: "Step inside the dashboard" } as const;

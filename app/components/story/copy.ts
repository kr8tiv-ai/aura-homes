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
  cta?: { href: string; label: string };
};

export type StoryAudience = "project" | "crypto";

export const HERO = {
  n: "00",
  label: "All-in-one unique stays",
  heading: "Design the home. Find the land. Build it for real.",
  sub: "Design or choose a small eco home, match suitable land, source a team, compare real costs, and prepare the project for professional review. Aura stays useful without an account, wallet, or crypto; X Layer proof and USDC are optional rails.",
  cue: "Scroll",
  ledger: [
    { k: "In", v: "Household, site, budget" },
    { k: "Out", v: "A portable project you own" },
  ] as LedgerRow[],
} as const;

export const BEATS: Beat[] = [
  {
    id: "land",
    n: "01",
    label: "Land",
    heading: "Match the home to the land.",
    body: "Compare pilot, public, partner, and user-supplied parcel records against the project brief. Aura explains fit signals and missing evidence; a qualified local reviewer confirms access, utilities, setbacks, title, and approvals.",
    side: "right",
    accent: "lime",
    ledger: [
      { k: "In", v: "Budget, region, acreage" },
      { k: "Out", v: "A sourced fit shortlist" },
    ],
  },
  {
    id: "design",
    n: "02",
    label: "Design",
    heading: "Shape a home around your life.",
    body: "Guided mode keeps the decisions approachable; Pro mode exposes the geometry and evidence. Both produce the same design-intent document for a licensed professional to review, engineer, and complete.",
    side: "left",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Brief, rooms, site goals" },
      { k: "Out", v: "Review-ready design intent" },
    ],
  },
  {
    id: "budget",
    n: "03",
    label: "Budget",
    heading: "See the gaps before the quote.",
    body: "Start with Alberta pilot ranges, then reconcile parcel conditions, utilities, finishes, shipping, and real supplier quotes. Assumptions, exclusions, confidence, and age stay attached.",
    side: "right",
    accent: "teal",
  },
  {
    id: "escrow",
    n: "04",
    label: "Escrow",
    heading: "Prepare proof before payment.",
    body: "Aura prepares an X Layer testnet escrow action with the design and budget hashes attached. The user validates the network, reviews every assumption, and confirms every wallet action.",
    side: "left",
    accent: "violet",
  },
  {
    id: "homes",
    n: "05",
    label: "HOMES",
    heading: "One home can prove a wider model.",
    body: "HOMES is a planned X Layer property-fund pilot and a first step toward a user-owned network of unique stays: route 60 percent of recognized fees toward a first home, publish costs and net rental results, then let future owners prepare eco-home projects of their own.",
    side: "right",
    accent: "lime",
    ledger: [
      { k: "First target", v: "200,000 USDC" },
      { k: "Holding design", v: "Decentralized property trust" },
      { k: "Community share", v: "60% of property economics" },
      { k: "Payout design", v: "Top 200 stakers · X Layer USDC" },
    ],
    cta: { href: "/homes", label: "Open the HOMES ledger" },
  },
  {
    id: "build",
    n: "06",
    label: "Build",
    heading: "Carry the same project to handoff.",
    body: "Shortlists, RFQs, quotes, milestone evidence, inspections, warranties, and the home book stay connected to the design. Aura coordinates the record; owners and qualified professionals make the build decisions.",
    side: "right",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Reviewed scope and real contracts" },
      { k: "Out", v: "Evidence, commissioning, home book" },
    ],
  },
];

export const END = {
  n: "07",
  label: "Where next",
  tagline: "Your home. Your land. One project you can carry forward.",
  season: "BuildX AI Season 2026",
  /* The app is the destination: one primary door, the stages as side doors. */
  cta: { href: "/start", label: "Start a private project" },
  /* One line of rollout honesty — the same arcs as /overview and docs/ROADMAP.md. */
  rollout: {
    text: "Now: the project workspace. Next: a locality marketplace. Later: a responsibly structured RWA launchpad for owner-led eco homes and unique stays.",
    href: "/overview",
    label: "See the rollout",
  },
  links: [
    { href: "/overview", label: "Overview" },
    { href: "/land", label: "Land" },
    { href: "/design", label: "Design" },
    { href: "/budget", label: "Budget" },
    { href: "/escrow", label: "Escrow" },
    { href: "/homes", label: "HOMES" },
    { href: "/faq", label: "FAQ" },
  ],
  creditsUrl:
    "https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/CREDITS.md",
} as const;

/* In-scene CTA surfaced at the deck/hot-tub pause (beat 5). */
export const BUILD_CTA = { href: "/start", label: "Start your project" } as const;

export const CRYPTO_HERO = {
  n: "00",
  label: "HOMES + X Layer",
  heading: "Build the stay. Prove the system around it.",
  sub: "Explore Aura's on-chain path: working X Layer testnet escrow today, a planned HOMES property trust and user-owned stay network next, and a later launchpad for owner-led eco homes. Every live claim starts with an address, receipt, or verifiable project artifact.",
  cue: "Follow the proof",
  ledger: [
    { k: "Live proof", v: "X Layer testnet contracts" },
    { k: "Planned", v: "HOMES trust + owner launchpad" },
  ] as LedgerRow[],
} as const;

export const CRYPTO_BEATS: Beat[] = [
  {
    id: "escrow",
    n: "01",
    label: "Testnet proof",
    heading: "Start with what the chain can prove.",
    body: "Aura's X Layer testnet contracts cover a reservation deposit, a 14-day refund window, milestone funding, 2-of-3 releases, a 10 percent holdback, and design and budget hash verification. The current token is faucet-compatible test USDC with no monetary value.",
    side: "right",
    accent: "violet",
    ledger: [
      { k: "Network", v: "X Layer testnet · chain 1952" },
      { k: "Registry", v: "Zero homes minted" },
    ],
    cta: { href: "/escrow", label: "Inspect the testnet flow" },
  },
  {
    id: "homes",
    n: "02",
    label: "HOMES",
    heading: "A property trust that begins at zero.",
    body: "HOMES is a planned token and decentralized property-trust layer for a future user-owned network of eco-home stays. The proposed ledger routes 60 percent of eligible, actually received fees toward property and publishes allocations, acquisition evidence, operating costs, net rental profit, and any later USDC distributions.",
    side: "left",
    accent: "lime",
    ledger: [
      { k: "First target", v: "Up to 200,000 USDC" },
      { k: "Property model", v: "60% community · 40% team" },
      { k: "Today", v: "No token, fees, property or payout" },
    ],
    cta: { href: "/homes", label: "Open the zero-state ledger" },
  },
  {
    id: "trust",
    n: "03",
    label: "Stay network",
    heading: "A decentralized Airbnb has to operate in the real world.",
    body: "The destination is a user-owned unique-stay network where guests can book without learning crypto and owners can publish costs, reserves, maintenance, and net results. Aura will not call it decentralized while one team controls every property, listing, and decision.",
    side: "right",
    accent: "teal",
    ledger: [
      { k: "Guest view", v: "Simple booking and clear prices" },
      { k: "Owner view", v: "Evidence, operations and optional settlement" },
    ],
  },
  {
    id: "launchpad",
    n: "04",
    label: "Owner launchpad",
    heading: "Let owners prepare a fundable stay of their own.",
    body: "A later Aura launchpad would help an owner design the home, match land, source qualified vendors and contractors, reconcile quotes, publish an evidence room, and open a named project vault. The owner confirms every contact, contract, bridge, and payment.",
    side: "left",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Site, design, team, quotes" },
      { k: "Out", v: "One named, evidence-backed project" },
    ],
    cta: { href: "/homes#launchpad-heading", label: "See the launchpad architecture" },
  },
  {
    id: "ledgers",
    n: "05",
    label: "Three ledgers",
    heading: "Support, construction money, and liquidity stay separate.",
    body: "A HOMES lock can signal support. Actual construction money belongs in a named USDC milestone vault. HOMES market liquidity remains independent and cannot be counted or spent as money raised for a property. That separation is a product invariant, not footer copy.",
    side: "right",
    accent: "violet",
    ledger: [
      { k: "Signal", v: "Time-bound HOMES lock" },
      { k: "Build", v: "Named project USDC vault" },
      { k: "Market", v: "Independent liquidity" },
    ],
  },
  {
    id: "build",
    n: "06",
    label: "Utility",
    heading: "The chain stays underneath useful work.",
    body: "People and companies can use Aura to design or choose a home, find land, prepare contractor and vendor evidence, compare quotes, and organize a professional handoff. Cash stays welcome. X Layer USDC becomes an option only where a verified provider, destination, quote, and confirmation flow exist.",
    side: "left",
    accent: "emerald",
    ledger: [
      { k: "Now", v: "Design + evidence + testnet proof" },
      { k: "Roadmap", v: "Qualified providers + confirmed settlement" },
    ],
  },
];

export const CRYPTO_END = {
  n: "07",
  label: "Two paths, one platform",
  tagline: "Use the tools today. Follow the trust as it becomes provable.",
  season: "OKX Build X · AI Season 2026",
  cta: { href: "/homes", label: "Open the HOMES dashboard" },
  rollout: {
    text: "HOMES, the trust, staking, properties, and owner vaults are planned. The home-design and project journey remains open to everyone.",
    href: "/start",
    label: "Design a unique stay",
  },
  links: [
    { href: "/homes", label: "HOMES ledger" },
    { href: "/escrow", label: "X Layer proof" },
    { href: "/faq#x-layer", label: "OKX + X Layer FAQ" },
    { href: "/build", label: "Design a home" },
    { href: "/buy", label: "Choose a home" },
    { href: "/overview", label: "Product overview" },
  ],
  creditsUrl: "https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/CREDITS.md",
} as const;

export const CRYPTO_BUILD_CTA = { href: "/start", label: "Design or source a home" } as const;

export const STORY_COPY = {
  project: { hero: HERO, beats: BEATS, end: END, buildCta: BUILD_CTA },
  crypto: { hero: CRYPTO_HERO, beats: CRYPTO_BEATS, end: CRYPTO_END, buildCta: CRYPTO_BUILD_CTA },
} as const;

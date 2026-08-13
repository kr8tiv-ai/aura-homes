// The scroll story's copy. Aura voice: short declaratives, sentence case,
// tracked-caps labels, ranges with a basis, no exclamation marks.
//
// TWO JOURNEYS, ONE WORLD (founder decision, Aug 2026 — copy chosen verbatim
// from four offered versions; do not paraphrase the quoted lines):
// · The eco journey leads with the home. Crypto appears FIRST in beat 6, as
//   optional X Layer USDC, and HOMES appears ONLY on the end sheet.
// · The X Layer journey wears the crypto undertones openly, and every
//   capability claim carries a Today / Next / Future ledger row — nothing may
//   imply the token, trust, staking, payouts or launchpad is live.
//
// Structure follows BRAND.md section 4/7: every beat carries a numbered
// kicker (mono number + hairline + tracked label) and, where it earns one, a
// spec-ledger — tiny mono rows that substantiate the display statement.

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

export type HeroAction = { href: string; label: string };

export type Hero = {
  n: string;
  label: string;
  heading: string;
  sub: string;
  cue: string;
  ledger: readonly LedgerRow[];
  /** primary doors out of the hero — first action renders as the filled CTA */
  actions?: readonly HeroAction[];
};

export type EndNote = { text: string; href: string; label: string };

export type End = {
  n: string;
  label: string;
  tagline: string;
  season: string;
  cta: { href: string; label: string };
  rollout: EndNote;
  /** the eco journey's ONLY HOMES mention — kept to the very end by design */
  homes?: EndNote;
  links: readonly { href: string; label: string }[];
  creditsUrl: string;
};

/* ======================= the eco-home journey ======================= */

export const HERO: Hero = {
  n: "00",
  label: "Eco Homes, Tiny Homes, Unique Stays",
  heading: "Design your eco home. Find land that fits. Plan every step to build it.",
  sub: "Start with a curated plan study or shape your own. See likely costs, land constraints, and next steps before you commit.",
  cue: "Scroll",
  ledger: [
    { k: "In", v: "Household, site, budget" },
    { k: "Out", v: "A portable project you own" },
  ],
  actions: [
    /* href only — the label is the founder's; /design is a redirect page and
       the primary door should not cost an extra hop. */
    { href: "/build?mode=guided", label: "Design my home" },
    { href: "/land", label: "Find land" },
  ],
};

/* Six beats, crypto silent until beat 6. Headings are the founder's exact
   sequence; bodies substantiate them in house voice. */
export const BEATS: Beat[] = [
  {
    id: "home",
    n: "01",
    label: "Home",
    heading: "Start with a home that fits your life.",
    body: "Begin from a curated concept or shape your own. Rooms, light, storage, and footprint follow how you actually live, and every choice lands in one design-intent record a licensed professional can review, engineer, and complete.",
    side: "right",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Household, rooms, site goals" },
      { k: "Out", v: "Review-ready design intent" },
    ],
  },
  {
    id: "land",
    n: "02",
    label: "Land",
    heading: "Find land that fits the plan.",
    body: "Compare pilot, public, partner, and user-supplied parcel records against the plan. Aura explains fit signals and missing evidence; a qualified local reviewer confirms access, utilities, setbacks, title, and approvals.",
    side: "left",
    accent: "lime",
    ledger: [
      { k: "In", v: "Budget, region, acreage" },
      { k: "Out", v: "A sourced fit shortlist" },
    ],
  },
  {
    id: "budget",
    n: "03",
    label: "Cost",
    heading: "See the whole project cost.",
    body: "Start with Alberta pilot ranges, then reconcile parcel conditions, utilities, finishes, shipping, and real supplier quotes. Assumptions, exclusions, confidence, and age stay attached.",
    side: "right",
    accent: "teal",
  },
  {
    id: "team",
    n: "04",
    label: "Team",
    heading: "Build a team you can check.",
    body: "Shortlist manufacturers, contractors, and reviewers with licences, insurance, and past work beside each bid. Aura organizes the evidence and flags the gaps; nobody is presented as vetted, and you make the calls.",
    side: "left",
    accent: "emerald",
    ledger: [
      { k: "In", v: "Trades, quotes, credentials" },
      { k: "Out", v: "A shortlist you verified" },
    ],
  },
  {
    id: "record",
    n: "05",
    label: "Record",
    heading: "Keep every decision in one place.",
    body: "Briefs, drawings, quotes, approvals, and changes stay in one portable project record you own. When a question surfaces a year later, the answer and its date are already there.",
    side: "right",
    accent: "lime",
    ledger: [
      { k: "In", v: "Every decision as it happens" },
      { k: "Out", v: "One portable project record" },
    ],
  },
  {
    /* Crypto's first appearance in this journey — optional, provider-gated. */
    id: "payments",
    n: "06",
    label: "Payments",
    heading: "Choose how to pay when a real quote exists.",
    body: "Nothing is owed until a verified provider issues a real quote. When one exists, pay by card as providers add Stripe, or optionally in X Layer USDC where the provider supports it — price, recipient, network, and confirmation shown before money moves.",
    side: "left",
    accent: "violet",
    ledger: [
      { k: "Card", v: "Stripe path planned" },
      { k: "Crypto", v: "Optional X Layer USDC, where supported" },
    ],
  },
];

export const END: End = {
  n: "07",
  label: "Where next",
  tagline: "Your home. Your land. One project you can carry forward.",
  season: "BuildX AI Season 2026",
  /* The app is the destination: one primary door, the stages as side doors. */
  cta: { href: "/start", label: "Start a private project" },
  /* One line of rollout honesty — the same arcs as /roadmap and docs/ROADMAP.md. */
  rollout: {
    text: "Now: the project workspace. Next: a locality marketplace. Later: a responsibly structured RWA launchpad for owner-led eco homes and unique stays.",
    href: "/roadmap",
    label: "See the roadmap",
  },
  /* HOMES appears here and ONLY here on the eco side (founder, verbatim). */
  homes: {
    text: "Long term: a user-owned Airbnb for eco stays.",
    href: "/homes",
    label: "Learn about $HOMES on X Layer",
  },
  links: [
    { href: "/roadmap", label: "Roadmap" },
    { href: "/land", label: "Land" },
    { href: "/build", label: "Design" },
    { href: "/budget", label: "Budget" },
    { href: "/buy", label: "Payments" },
    { href: "/homes", label: "HOMES" },
    { href: "/faq", label: "FAQ" },
  ],
  creditsUrl:
    "https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/CREDITS.md",
};

/* In-scene CTA surfaced on the final plate (deck/hot-tub pause). */
export const BUILD_CTA = { href: "/start", label: "Start your project" } as const;

/* ====================== the X Layer journey ========================= */

export const CRYPTO_HERO: Hero = {
  n: "00",
  label: "Eco homes on X Layer",
  heading: "Launch an eco stay. Run the whole project on X Layer.",
  sub: "Design or choose the home, match land, organize the team, prepare payments, and keep public proof connected to the real build.",
  cue: "Explore the ecosystem",
  ledger: [
    { k: "Today", v: "Design, land, team, and testnet proof" },
    { k: "Next", v: "USDC payments with verified providers" },
    { k: "Future", v: "HOMES trust and owner launchpad" },
  ],
};

/* Six beats, founder's exact sequence. Every crypto capability row is
   labelled Today / Next / Future — that labelling is a product invariant. */
export const CRYPTO_BEATS: Beat[] = [
  {
    id: "project",
    n: "01",
    label: "Project",
    heading: "Start with a real project.",
    body: "Design or choose the home, match land that fits it, and find contractors and vendors who can work the way you want to pay, crypto included. A stay worth following on X Layer begins as an ordinary, well-documented build.",
    side: "right",
    accent: "emerald",
    ledger: [
      { k: "Today", v: "Design, land, and team tools" },
      { k: "Next", v: "Provider crypto preferences on file" },
    ],
  },
  {
    id: "proof",
    n: "02",
    label: "Proof",
    heading: "Keep proofs attached to the work.",
    body: "Quotes, inspections, payment receipts, and milestone photos stay attached to the project that produced them, so a guest, a co-owner, or a future buyer can check the record instead of taking anyone's word.",
    side: "left",
    accent: "teal",
    ledger: [
      { k: "Today", v: "Project record and documents" },
      { k: "Next", v: "Public proof anchored on X Layer" },
    ],
  },
  {
    id: "payments",
    n: "03",
    label: "Payments",
    heading: "Pay in USDC where it is supported.",
    body: "Bridge from OKX to X Layer, then pay a verified provider in USDC where it is supported — a design fee, a milestone, or the day you buy an eco home with crypto. Price, service margin, recipient, network, and confirmation appear before money moves.",
    side: "right",
    accent: "violet",
    ledger: [
      { k: "Today", v: "X Layer testnet checkout proof" },
      { k: "Next", v: "Verified providers settle real USDC" },
      { k: "Future", v: "Buy an eco home with crypto" },
    ],
  },
  {
    id: "homes",
    n: "04",
    label: "HOMES",
    heading: "Follow the planned HOMES property trust.",
    body: "HOMES is a planned token and decentralized property trust for eco stays. The proposed ledger routes 60 percent of recognized fees toward a first home and publishes acquisition evidence, operating costs, and net rental results.",
    side: "left",
    accent: "lime",
    ledger: [
      { k: "Today", v: "No token, trust, staking, or payout" },
      { k: "Next", v: "Zero-state ledger stays public" },
      { k: "Future", v: "First property held by the trust" },
    ],
    cta: { href: "/homes", label: "Open the zero-state ledger" },
  },
  {
    id: "network",
    n: "05",
    label: "Stay network",
    heading: "Grow a user-owned stay network.",
    body: "The destination is a user-owned Airbnb for eco stays: guests book without learning crypto, owners publish costs and net results, and control widens only as the network earns it in public.",
    side: "right",
    accent: "teal",
    ledger: [
      { k: "Today", v: "One team, published decisions" },
      { k: "Future", v: "Community-governed stays" },
    ],
  },
  {
    id: "launchpad",
    n: "06",
    label: "Launchpad",
    heading: "Help future owners launch projects of their own.",
    body: "A future launchpad would help an owner design the home, match land, assemble vendors and contractors, and open a named project vault others can follow. The owner confirms every contact, contract, bridge, and payment.",
    side: "left",
    accent: "emerald",
    ledger: [
      { k: "Today", v: "Architecture published" },
      { k: "Future", v: "Owner launchpad on X Layer" },
    ],
    cta: { href: "/homes#launchpad-heading", label: "See the launchpad architecture" },
  },
];

export const CRYPTO_END: End = {
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
    { href: "/faq#x-layer", label: "OKX + X Layer FAQ" },
    { href: "/build", label: "Design a home" },
    { href: "/buy", label: "Choose a home" },
    { href: "/roadmap", label: "Roadmap" },
  ],
  creditsUrl: "https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/CREDITS.md",
};

export const CRYPTO_BUILD_CTA = { href: "/start", label: "Design or source a home" } as const;

/* ============================ the gate ============================== */

/* Entrance copy — the founder's verbatim pick. BOTH doors stay visible
   together; there is no hidden or default selection. */
export const GATE = {
  titleLines: ["Design your eco home.", "Find land that fits.", "Plan every step to build it."],
  sub: "Start with a curated plan study or shape your own. See likely costs, land constraints, and next steps before you commit.",
  paths: {
    project: {
      title: "Build an eco home",
      desc: "Design a home, find land, and plan the build.",
    },
    crypto: {
      title: "Explore the X Layer ecosystem",
      desc: "Launch an eco stay, follow HOMES, and see the future launchpad.",
    },
  },
} as const;

export const STORY_COPY = {
  project: { hero: HERO, beats: BEATS, end: END, buildCta: BUILD_CTA },
  crypto: { hero: CRYPTO_HERO, beats: CRYPTO_BEATS, end: CRYPTO_END, buildCta: CRYPTO_BUILD_CTA },
} as const;

// Fixture data mirroring the aura-architect pipeline output shapes.
// The /budget and /escrow pages render these until the contract reads are wired.

/** Mirrors `ownerBuildable` in data/alberta/cost-model.json: can the owner
 *  legally do this line themselves in Alberta, and on what basis. "na" is a
 *  line where the question doesn't apply (land, soft costs, contingency). */
export type OwnerBuildable = "yes" | "no" | "na";

export interface BudgetLineFixture {
  id: string;
  category: string;
  item: string;
  lowCad: number;
  midCad: number;
  highCad: number;
  ownerBuildable: OwnerBuildable;
  /** The legal or practical basis for the flag, stated honestly. */
  diyBasis: string;
}

export const budgetFixture: {
  currency: "CAD";
  excludesLand: boolean;
  lines: BudgetLineFixture[];
  total: { lowCad: number; midCad: number; highCad: number };
} = {
  currency: "CAD",
  excludesLand: true,
  lines: [
    { id: "siteWork", category: "Site", item: "Driveway, clearing, site prep", lowCad: 4500, midCad: 8000, highCad: 12000, ownerBuildable: "yes", diyBasis: "Owner work — gravel drive and clearing" },
    { id: "foundation", category: "Foundation", item: "Screw-pile foundation (16-24 piles)", lowCad: 6000, midCad: 10000, highCad: 15000, ownerBuildable: "no", diyBasis: "Part 4 element — P.Eng-stamped plans, certified install" },
    { id: "sipShell", category: "Shell", item: "SIP shell kit + erection", lowCad: 30000, midCad: 45000, highCad: 55000, ownerBuildable: "yes", diyBasis: "Small-format panels — a 2-3 person job" },
    { id: "roofWindowsDoors", category: "Shell", item: "Metal roof, triple-pane windows, doors, siding", lowCad: 22000, midCad: 32000, highCad: 45000, ownerBuildable: "yes", diyBasis: "Owner work — zone 7A window spec applies" },
    { id: "interior", category: "Interior", item: "Interior fit-out (kitchen, bath, drywall, floor)", lowCad: 22000, midCad: 35000, highCad: 55000, ownerBuildable: "yes", diyBasis: "Owner-legal — drywall required over SIP faces" },
    { id: "mechanical", category: "Mechanical", item: "HRV, plumbing, electrical, wood stove + WETT", lowCad: 22000, midCad: 30000, highCad: 40000, ownerBuildable: "yes", diyBasis: "Homeowner permits; solar wiring excluded; WETT inspected" },
    { id: "solar", category: "Energy", item: "Off-grid solar 8-12kW + 20-40kWh battery + generator", lowCad: 35000, midCad: 48000, highCad: 70000, ownerBuildable: "no", diyBasis: "Licensed work — CEC s.64" },
    { id: "water", category: "Water", item: "Buried cistern (or well)", lowCad: 8000, midCad: 12000, highCad: 18000, ownerBuildable: "no", diyBasis: "Well drilling is licensed; cistern comes installed" },
    { id: "awgSupplement", category: "Water", item: "AWG summer water module (standard on every home)", lowCad: 3500, midCad: 5000, highCad: 8000, ownerBuildable: "yes", diyBasis: "Plumbs into the cistern loop" },
    { id: "septic", category: "Septic", item: "Private sewage (septic field or biofilter)", lowCad: 12000, midCad: 18000, highCad: 28000, ownerBuildable: "no", diyBasis: "Certified installer required by law" },
    { id: "hotTubDeck", category: "Extras", item: "Wood-fired hot tub + deck", lowCad: 8000, midCad: 14000, highCad: 22000, ownerBuildable: "yes", diyBasis: "Owner work — deck under 24 in needs no permit" },
    { id: "permitsSoft", category: "Soft costs", item: "Permits, design, engineering, insurance", lowCad: 8000, midCad: 12000, highCad: 18000, ownerBuildable: "na", diyBasis: "Fees and professional services — not work packages" },
    { id: "contingency", category: "Contingency", item: "Contingency (10-15%)", lowCad: 18100, midCad: 32280, highCad: 57900, ownerBuildable: "na", diyBasis: "Computed on the ex-land lines" },
  ],
  total: { lowCad: 199100, midCad: 301280, highCad: 443900 },
};

export type MilestoneStatus = "Released" | "Funded" | "Awaiting funding";

export interface MilestoneFixture {
  index: number;
  name: string;
  description: string;
  amountCad: number;
  holdbackCad: number;
  status: MilestoneStatus;
}

export const milestonesFixture: MilestoneFixture[] = [
  {
    index: 0,
    name: "Design, engineering & permits",
    description: "Stamped drawings, development and building permits",
    amountCad: 12000,
    holdbackCad: 1200,
    status: "Released",
  },
  {
    index: 1,
    name: "Site prep & foundation",
    description: "Access, clearing, and engineered screw pile installation",
    amountCad: 18000,
    holdbackCad: 1800,
    status: "Funded",
  },
  {
    index: 2,
    name: "SIP shell & envelope",
    description: "Panels, roof, windows, and doors to lock-up",
    amountCad: 77000,
    holdbackCad: 7700,
    status: "Awaiting funding",
  },
  {
    index: 3,
    name: "Off-grid systems",
    description: "Solar + battery, water with AWG module, septic, mechanical",
    amountCad: 113000,
    holdbackCad: 11300,
    status: "Awaiting funding",
  },
  {
    index: 4,
    name: "Interior & completion",
    description: "Fit-out, extras, deficiency list, final inspection",
    amountCad: 81280,
    holdbackCad: 8128,
    status: "Awaiting funding",
  },
];

// ---------------------------------------------------------------- slips

/**
 * Slips raised by the Aura Brain for this journey. The shape mirrors Slip in
 * agent/src/brain/slips.ts (the source of truth); the values are a snapshot of
 * the brain's output (agent/out/slips.json) for agent/samples/journey.sample.json,
 * run 2026-08-09. Replace with a live journey_status read once the brain
 * service is hosted.
 */
export type SlipSeverity = "nudge" | "warn" | "critical";

export interface SlipFixture {
  ruleId: string;
  severity: SlipSeverity;
  message: string;
  suggestedAction: string;
}

export const slipsFixture: SlipFixture[] = [
  {
    ruleId: "sip-kit-unordered",
    severity: "critical",
    message:
      "Drawings were approved 9 days ago and the SIP kit is still unordered. Panel lead time is 12-20 weeks from approved drawings, so every idle day pushes lock-up by a day.",
    suggestedAction: "Place the SIP kit order with the panel plant.",
  },
  {
    ruleId: "holdback-maturity",
    severity: "warn",
    message:
      "Milestone 1 (Design, engineering & permits) holdback of $1,200 became releasable on 2026-08-04 — the 60-day statutory holdback period has run and it is still held.",
    suggestedAction: "Release the matured holdback on milestone 1 to the builder.",
  },
  {
    ruleId: "escrow-milestone-stale",
    severity: "warn",
    message:
      "Milestone 2 (Site prep & foundation) was approved by the builder 7 days ago and is still waiting on the owner's approval before the release can execute.",
    suggestedAction: "Get the owner's approval (or a dispute) on milestone 2 so the release can execute.",
  },
  {
    ruleId: "waiting-escalation",
    severity: "warn",
    message:
      "Waiting on the supplier for 14 days: final SIP kit quote from the panel plant. No movement recorded.",
    suggestedAction: "Follow up with the supplier on: final SIP kit quote from the panel plant.",
  },
];

/** Who acts on a slip, for the dashboard's owner column. */
const slipOwner: Record<string, string> = {
  "sip-kit-unordered": "You",
  "holdback-maturity": "You",
  "escrow-milestone-stale": "You",
  "waiting-escalation": "Supplier",
  "permit-unsubmitted": "You",
  "winter-window": "Builder",
};

/** Maps a brain slip into the dashboard's next-action card shape. */
export function slipToNextAction(slip: SlipFixture): NextActionFixture {
  return {
    id: slip.ruleId,
    title: slip.suggestedAction,
    detail: slip.message,
    owner: slipOwner[slip.ruleId] ?? "You",
    due: slip.severity === "critical" ? "Overdue" : slip.severity === "warn" ? "This week" : "Note",
    slip: true,
  };
}

// ---------------------------------------------------------------- dashboard

export type PipelineStage = "LAND" | "DESIGN" | "BUDGET" | "ESCROW" | "BUILD";

export interface NextActionFixture {
  id: string;
  title: string;
  detail: string;
  owner: string;
  due: string;
  /** True when the Aura Brain's slip detection raised this item. */
  slip: boolean;
}

/** Actual spend committed to date per budget category (CAD). */
export interface CategoryActualFixture {
  category: string;
  actualCad: number;
  note: string;
}

/**
 * Owner-dashboard fixture for one build journey (Aura Pilot Build 01).
 * Mirrors the Aura Brain journey state (docs/AI-BRAIN.md): deterministic
 * state + slip detection; the numbers reconcile with budgetFixture and
 * milestonesFixture above.
 */
export const dashboardFixture = {
  projectName: "Aura Pilot Build 01",
  parcel: "37 Aspen Road, Lac Ste. Anne County (Agricultural district)",
  stages: ["LAND", "DESIGN", "BUDGET", "ESCROW", "BUILD"] as PipelineStage[],
  currentStage: "ESCROW" as PipelineStage,
  /** Committed spend to date by category; categories without a row are at $0. */
  actuals: [
    { category: "Soft costs", actualCad: 11420, note: "Permits issued, drawings stamped" },
    { category: "Site", actualCad: 8650, note: "Driveway and clearing complete" },
    { category: "Foundation", actualCad: 4200, note: "Screw-pile deposit paid" },
  ] as CategoryActualFixture[],
  // Non-slip actions only; slipped steps come from slipsFixture (the Aura
  // Brain's output) and are merged in by the dashboard page.
  nextActions: [
    {
      id: "fund-m3",
      title: "Fund milestone 03 — SIP shell & envelope",
      slip: false,
      detail: "$77,000 to escrow so the shell contract can be signed against funded milestones.",
      owner: "You",
      due: "Before kit order",
    },
    {
      id: "pile-install",
      title: "Confirm screw-pile install date",
      slip: false,
      detail: "Installer holds a tentative week; confirm so site prep and pile crew land together.",
      owner: "Installer",
      due: "This week",
    },
  ] as NextActionFixture[],
  digest: {
    subject: "Your weekly build update",
    period: "Week of Aug 3-9",
    moved: "Development and building permits issued. Site clearing finished; driveway is in.",
    blocked: "SIP kit order — flagged 9 days idle against a 12-20 week lead time.",
    moneyPosition:
      "$30,000 funded to escrow, $10,800 released to the builder, $1,200 held back under the statutory holdback.",
  },
};

/** Fixture served by POST /api/design until the aura-architect service is hosted. */
export const designFixture = {
  projectName: "Aura Pilot Build 01",
  narrativeSource: "fixture",
  narrative:
    "Aura Pilot Build 01 is an 800 sqft single-storey modern cabin in Lac Ste. Anne County, " +
    "sited on screw piles with a structural insulated panel envelope (walls R-24, roof R-40). " +
    "Power comes from a 10 kW solar array with 30 kWh of storage and generator backup; water " +
    "from a buried cistern with a tank-and-field septic system. A wood stove provides resilient " +
    "heat, with an HRV keeping the tight envelope fresh.",
  meetsMinDwellingSize: true,
  shell: { wallRValue: 24, roofRValue: 40, glazingRatio: 0.22 },
  foundation: { type: "screwPiles", estimatedPileCount: 10 },
};

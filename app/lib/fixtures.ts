// Fixture data mirroring the aura-architect pipeline output shapes.
// The /budget and /escrow pages render these until the contract reads are wired.

export interface BudgetLineFixture {
  id: string;
  category: string;
  item: string;
  lowCad: number;
  midCad: number;
  highCad: number;
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
    { id: "siteWork", category: "Site", item: "Driveway, clearing, site prep", lowCad: 4500, midCad: 8000, highCad: 12000 },
    { id: "foundation", category: "Foundation", item: "Screw-pile foundation (16-24 piles)", lowCad: 6000, midCad: 10000, highCad: 15000 },
    { id: "sipShell", category: "Shell", item: "SIP shell kit + erection", lowCad: 30000, midCad: 45000, highCad: 55000 },
    { id: "roofWindowsDoors", category: "Shell", item: "Metal roof, triple-pane windows, doors, siding", lowCad: 22000, midCad: 32000, highCad: 45000 },
    { id: "interior", category: "Interior", item: "Interior fit-out (kitchen, bath, drywall, floor)", lowCad: 22000, midCad: 35000, highCad: 55000 },
    { id: "mechanical", category: "Mechanical", item: "HRV, plumbing, electrical, wood stove + WETT", lowCad: 22000, midCad: 30000, highCad: 40000 },
    { id: "solar", category: "Energy", item: "Off-grid solar 8-12kW + 20-40kWh battery + generator", lowCad: 35000, midCad: 48000, highCad: 70000 },
    { id: "water", category: "Water", item: "Buried cistern (or well)", lowCad: 8000, midCad: 12000, highCad: 18000 },
    { id: "septic", category: "Septic", item: "Private sewage (septic field or biofilter)", lowCad: 12000, midCad: 18000, highCad: 28000 },
    { id: "hotTubDeck", category: "Extras", item: "Wood-fired hot tub + deck", lowCad: 8000, midCad: 14000, highCad: 22000 },
    { id: "permitsSoft", category: "Soft costs", item: "Permits, design, engineering, insurance", lowCad: 8000, midCad: 12000, highCad: 18000 },
    { id: "contingency", category: "Contingency", item: "Contingency (10-15%)", lowCad: 17750, midCad: 31680, highCad: 56700 },
  ],
  total: { lowCad: 195250, midCad: 295680, highCad: 434700 },
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
    description: "Solar + battery, water, septic, mechanical",
    amountCad: 108000,
    holdbackCad: 10800,
    status: "Awaiting funding",
  },
  {
    index: 4,
    name: "Interior & completion",
    description: "Fit-out, extras, deficiency list, final inspection",
    amountCad: 80680,
    holdbackCad: 8068,
    status: "Awaiting funding",
  },
];

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

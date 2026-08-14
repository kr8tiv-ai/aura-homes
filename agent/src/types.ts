// Core domain types for the Aura architect pipeline.
// All money values are CAD unless a field name says otherwise.

export type WaterSource = "cistern" | "well" | "awgSupplement";

export type SepticType =
  | "tankAndField"
  | "mound"
  | "holdingTank"
  | "packagedTreatment"
  // Eco flagship: Ecoflo-class biofilter with subsurface drip dispersal of the
  // treated effluent — the one legal greywater-reuse path in Alberta (SOP 8.5).
  | "biofilterDrip";

export type HomeStyle =
  | "modernCabin"
  | "aFrame"
  | "bungalow"
  | "storeyAndAHalf"
  | "custom";

export type AquiferReliability = "reliable" | "unreliable" | "unknown";

/** The land the home will sit on. */
export interface Parcel {
  county: string; // e.g. "Lac Ste. Anne County"
  district: string; // planning/zoning district within the county
  // District-mandated minimum dwelling size — districts, never counties, set
  // this (Lac Ste. Anne: Agricultural 592 sqft, Country Residential 1,076 sqft).
  minDwellingSizeSqft: number;
  acreage?: number;
  aquifer?: AquiferReliability; // unreliable -> wells are not dependable here
  gridDistanceKm?: number; // distance to grid power (grid-optional feasibility)
  septicSoils?: boolean; // true = soils suit a conventional septic field
  gridPowerAtLine?: boolean; // grid available at property line (informs backup sizing)
  landBudgetCad?: { low: number; high: number }; // if land not yet purchased
}

/** A parcel listing evaluated by the LAND stage filter. */
export interface ParcelListing {
  id: string;
  name: string; // e.g. "37 Aspen Road"
  county: string;
  district: string;
  priceCad: number;
  /** null = not yet verified against the district land-use bylaw. */
  minDwellingSizeSqft: number | null;
  aquifer: AquiferReliability;
  gridDistanceKm: number;
  septicSoils: boolean;
  acreage?: number;
  basis?: string; // sourcing note
}

export type ParcelVerdict = "PASS" | "REJECT";

export interface ParcelFilterResult {
  parcel: ParcelListing;
  verdict: ParcelVerdict;
  /** Human-readable reject reasons and advisory notes. */
  reasons: string[];
}

/** Raw answers from the /design questionnaire wizard. */
export interface Questionnaire {
  projectName: string;
  parcel: Parcel;
  home: {
    sizeSqft: number;
    style: HomeStyle;
    storeys: 1 | 2;
    bedrooms: number;
    bathrooms: number;
    glazingRatio: number; // fraction of wall area glazed, 0..1
  };
  energy: {
    solarKw: number; // array size, typically 8-12
    batteryKwh: number; // storage, typically 20-40
    backupGenerator: boolean;
    generatorKw?: number;
    woodStove: boolean; // primary/backup heat, requires WETT inspection
  };
  water: {
    source: WaterSource;
    cisternLitres?: number; // when source is cistern or awgSupplement
    septic: SepticType;
  };
  extras: {
    hotTub: boolean; // wood-fired
    deck: boolean;
    deckSqft?: number;
    hrv: boolean; // heat recovery ventilator (tight SIP envelopes need one)
  };
  /** Contingency as a fraction of subtotal; defaults to 0.125 (research: 10-15%). */
  contingencyRate?: number;
}

/** Structural insulated panel shell specification derived from the questionnaire. */
export interface SipShellSpec {
  wallThicknessMm: number;
  roofThicknessMm: number;
  wallRValue: number;
  roofRValue: number;
  wallAreaSqft: number;
  roofAreaSqft: number;
  glazingRatio: number;
}

/** Structured design output; `narrative` is the Claude-written (or offline) summary. */
export interface DesignBrief {
  projectName: string;
  generatedAt: string; // ISO 8601
  narrative: string;
  narrativeSource: "claude" | "offline-fallback";
  parcel: Parcel;
  meetsMinDwellingSize: boolean;
  home: Questionnaire["home"];
  shell: SipShellSpec;
  foundation: { type: "screwPiles"; estimatedPileCount: number };
  energy: Questionnaire["energy"] & { estimatedAnnualLoadKwh: number };
  water: Questionnaire["water"];
  extras: Questionnaire["extras"];
  /** Constraint-check output: flags, forced adjustments, and standing rules. */
  constraintNotes: string[];
}

/** One row of the LOW/MID/HIGH budget table. */
export interface BudgetLine {
  id: string;
  category:
    | "Land"
    | "Site"
    | "Foundation"
    | "Shell"
    | "Interior"
    | "Mechanical"
    | "Energy"
    | "Water"
    | "Septic"
    | "Heating"
    | "Extras"
    | "Soft costs"
    | "Contingency";
  item: string;
  lowCad: number;
  midCad: number;
  highCad: number;
  notes?: string;
}

export interface BudgetTotals {
  lowCad: number;
  midCad: number;
  highCad: number;
}

export interface Budget {
  currency: "CAD";
  excludesLand: boolean; // land shown as informational line, excluded from totals
  lines: BudgetLine[];
  subtotal: BudgetTotals; // before contingency
  contingency: BudgetTotals;
  total: BudgetTotals;
  contingencyRate: number;
}

/** One escrow milestone; mirrors AuraBuildEscrow's holdback mechanics. */
export interface Milestone {
  index: number;
  name: string;
  description: string;
  amountCad: number; // gross, from budget MID column
  holdbackCad: number; // retained on release (Alberta statutory holdback)
  netOnReleaseCad: number; // paid to builder at release
  budgetLineIds: string[]; // traceability back to the budget
}

export interface BuildPlan {
  projectName: string;
  milestones: Milestone[];
  totalCad: number;
  totalHoldbackCad: number;
  holdbackRateBps: number; // 1000 = 10%, matches AuraBuildEscrow default
  holdbackPeriodDays: number; // 60, matches AuraBuildEscrow default
  notes: string;
}

/** Cost ranges loaded from data/alberta/cost-model.json, or built-in defaults. */
export interface CostRange {
  low: number;
  high: number;
  mid?: number; // defaults to midpoint when absent
}

export interface AlbertaCostModel {
  /** Anchor: complete off-grid SIP home at referenceSqft, excluding land. */
  baseHome: { referenceSqft: number; low: number; mid: number; high: number };
  landLacSteAnne: CostRange;
  screwPiles: CostRange;
  sipShellKitAndErection: CostRange;
  solarBattery: CostRange; // 8-12 kW / 20-40 kWh package
  cistern: CostRange;
  well: CostRange;
  /** AWG summer water module — standard on every Aura home (founder mandate). */
  awgSupplement: CostRange;
  septic: CostRange;
  woodStoveInstalled: CostRange; // includes WETT inspection
  woodFiredHotTub: CostRange;
  deck: CostRange;
  permitsDesignEngineering: number;
  hrv: CostRange;
  contingencyRange: [number, number]; // e.g. [0.10, 0.15]
}

// ---- Repo cost-model schema (data/alberta/cost-model.json, "v1") ----

export interface RepoCostModelLineItem {
  key: string; // e.g. "sipShell", "mechanical", "hotTubDeck"
  label: string;
  low: number;
  mid: number;
  high: number;
  basis?: string;
  /** Legacy schema field — the reference configuration includes every line (AWG recommended on every home, not mandatory; founder decision 2026-08-14). */
  optional?: boolean;
  ownerBuildable?: boolean;
  ownerNote?: string;
}

/** Shape of the checked-in research file; richer than AlbertaCostModel. */
export interface RepoCostModel {
  $schema?: string;
  region?: string;
  currency?: string;
  referenceHome?: { sqft: number; type?: string };
  lineItems: RepoCostModelLineItem[];
  contingencyPct: { low: number; mid: number; high: number };
  totalsExLand?: { low: number; mid: number; high: number };
}

export type CostModelInput = AlbertaCostModel | RepoCostModel;

export function isRepoCostModel(m: CostModelInput): m is RepoCostModel {
  return Array.isArray((m as RepoCostModel).lineItems);
}

import {
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import { summarizeBuildingGraph } from "./graphGeometry";
import { summarizeHome } from "./geometry";
import {
  buildBom,
  ecoSystems,
  type Category,
  type LineItem,
} from "../design/materials";

export type SiteCondition = "unknown" | "serviced-flat" | "rural-flat" | "sloped" | "remote";
export type UtilityStrategy = "serviced" | "hybrid" | "off-grid";
export type FinishLevel = "essential" | "standard" | "elevated";
export type DeliveryMode = "owner-builder" | "hybrid" | "full-service";

export interface ProjectBudgetScenario {
  site: SiteCondition;
  utilities: UtilityStrategy;
  finish: FinishLevel;
  delivery: DeliveryMode;
  shippingDistanceKm: number;
  contingencyPct: number;
}

export interface BudgetRange {
  low: number;
  mid: number;
  high: number;
}

export interface ProjectBudgetLine extends BudgetRange {
  id: string;
  category: Category | "site" | "delivery" | "soft-costs" | "utilities";
  label: string;
  quantity: number;
  unit: string;
  basis: string;
  ownerBuildable: boolean;
  status: "modelled" | "allowance" | "quote-needed";
}

export interface ProjectBudget {
  currency: "CAD";
  designHash: `0x${string}`;
  areaSqFt: number;
  measures: {
    areaSqFt: number;
    footprintSqFt: number;
    storeys: number;
    glazedAreaSqFt: number;
  };
  scenario: ProjectBudgetScenario;
  region: string;
  municipality: string;
  lines: ProjectBudgetLine[];
  subtotal: BudgetRange;
  contingency: BudgetRange;
  total: BudgetRange;
  confidence: {
    score: number;
    label: "Low" | "Medium" | "High";
    reasons: string[];
  };
  gaps: string[];
  assumptions: string[];
  exclusions: string[];
  cap: null | {
    capCad: number;
    midpointDeltaCad: number;
    state: "within" | "at-risk" | "over";
  };
}

interface ProjectBudgetInput {
  document: BuilderDocument;
  scenario: ProjectBudgetScenario;
  region: string;
  municipality: string;
  budgetCapCad: number | null;
}

const FINISH_FACTORS: Record<FinishLevel, number> = {
  essential: 0.72,
  standard: 1,
  elevated: 1.35,
};

const DELIVERY_FACTORS: Record<DeliveryMode, number> = {
  "owner-builder": 0.84,
  hybrid: 1,
  "full-service": 1.25,
};

const SITE_RANGES: Record<SiteCondition, BudgetRange & { label: string; basis: string }> = {
  unknown: {
    label: "Site preparation allowance",
    low: 8_000,
    mid: 20_000,
    high: 50_000,
    basis: "Broad allowance until slope, access, soil, clearing, drainage and driveway are known.",
  },
  "serviced-flat": {
    label: "Flat serviced-site preparation",
    low: 3_000,
    mid: 6_500,
    high: 12_000,
    basis: "Planning allowance for a clear, accessible lot; survey and geotechnical findings can change it.",
  },
  "rural-flat": {
    label: "Flat rural-site preparation",
    low: 4_500,
    mid: 8_000,
    high: 15_000,
    basis: "Clearing, drainage and a short gravel access allowance for the Alberta pilot.",
  },
  sloped: {
    label: "Sloped-site preparation",
    low: 12_000,
    mid: 28_000,
    high: 65_000,
    basis: "Allowance for survey-led access, drainage and foundation coordination; a site quote is required.",
  },
  remote: {
    label: "Remote-site preparation",
    low: 15_000,
    mid: 35_000,
    high: 80_000,
    basis: "Allowance for difficult mobilization, access and staging; a site quote is required.",
  },
};

const roundMoney = (value: number): number => Math.round(value / 50) * 50;
const boundedNumber = (value: number, fallback: number, low: number, high: number): number =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;

export function defaultProjectBudgetScenario(): ProjectBudgetScenario {
  return {
    site: "unknown",
    utilities: "hybrid",
    finish: "standard",
    delivery: "hybrid",
    shippingDistanceKm: 0,
    contingencyPct: 12,
  };
}

function systemsFor(strategy: UtilityStrategy, areaSqFt: number) {
  if (strategy === "serviced") {
    return ecoSystems({
      awg: false,
      solar_kw: 0,
      battery_kwh: 0,
      generator: false,
      greywater: false,
      rainwater: false,
      cistern_litres: 0,
      composting_toilet: false,
    });
  }
  const scale = Math.max(0.7, Math.min(1.7, areaSqFt / 800));
  if (strategy === "hybrid") {
    return ecoSystems({
      solar_kw: Math.round(4.5 * scale * 2) / 2,
      battery_kwh: Math.round(12 * scale),
      generator: false,
      awg: false,
      cistern_litres: Math.round(5_000 * scale / 500) * 500,
    });
  }
  return ecoSystems({
    solar_kw: Math.round(8 * scale * 2) / 2,
    battery_kwh: Math.round(24 * scale),
    generator: true,
    awg: true,
    cistern_litres: Math.round(9_000 * scale / 500) * 500,
  });
}

function designMeasures(document: BuilderDocument) {
  if (document.geometry.kind === "building-graph") {
    const summary = summarizeBuildingGraph(document.geometry.graph);
    const openings = document.geometry.graph.storeys.flatMap((storey) =>
      storey.walls.flatMap((wall) => wall.openings),
    );
    return {
      areaSqFt: summary.totalFloorAreaSqFt,
      footprintSqFt: summary.groundFootprintSqFt,
      storeys: document.geometry.graph.storeys.length,
      glazedAreaSqFt: summary.glazedAreaSqFt,
      windowCount: openings.filter((opening) => opening.kind !== "door").length,
      widthFt: Math.max(1, summary.bounds.widthFt),
      depthFt: Math.max(1, summary.bounds.depthFt),
    };
  }
  const summary = summarizeHome(document.spec);
  return {
    areaSqFt: summary.totalFloorAreaSqFt,
    footprintSqFt: summary.groundFootprintSqFt,
    storeys: Math.max(...document.spec.volumes.map((volume) => volume.storeys), 1),
    glazedAreaSqFt: summary.glazedAreaSqFt,
    windowCount: document.spec.volumes.reduce(
      (sum, volume) => sum + volume.openings.filter((opening) => opening.kind !== "door").length,
      0,
    ),
    widthFt: Math.max(1, summary.bounds.widthFt),
    depthFt: Math.max(1, summary.bounds.depthFt),
  };
}

function range(low: number, mid: number, high: number): BudgetRange {
  return { low: roundMoney(low), mid: roundMoney(mid), high: roundMoney(high) };
}

function fromBom(item: LineItem, finish: FinishLevel, delivery: DeliveryMode): ProjectBudgetLine {
  const finishFactor = item.category === "interior" ? FINISH_FACTORS[finish] : 1;
  const deliveryFactor = item.owner_buildable ? DELIVERY_FACTORS[delivery] : 1;
  const multiplier = finishFactor * deliveryFactor;
  return {
    id: item.key,
    category: item.category,
    label: item.label,
    quantity: item.qty,
    unit: item.unit,
    ...range(item.cad_low * multiplier, item.cad_mid * multiplier, item.cad_high * multiplier),
    basis:
      multiplier === 1
        ? item.basis
        : `${item.basis} Adjusted for ${finish.replace("-", " ")} finish and ${delivery.replace("-", " ")} delivery.`,
    ownerBuildable: item.owner_buildable,
    status: "modelled",
  };
}

function sumRanges(lines: readonly ProjectBudgetLine[]): BudgetRange {
  return range(
    lines.reduce((sum, line) => sum + line.low, 0),
    lines.reduce((sum, line) => sum + line.mid, 0),
    lines.reduce((sum, line) => sum + line.high, 0),
  );
}

export function createProjectBudget(input: ProjectBudgetInput): ProjectBudget {
  const checked = validateBuilderDocument(input.document);
  if (!checked.ok) throw new Error(`Cannot budget an invalid builder document: ${checked.problem}`);
  const document = checked.document;
  const rawScenario = input.scenario;
  const scenario: ProjectBudgetScenario = {
    site: rawScenario.site,
    utilities: rawScenario.utilities,
    finish: rawScenario.finish,
    delivery: rawScenario.delivery,
    shippingDistanceKm: boundedNumber(rawScenario.shippingDistanceKm, 0, 0, 20_000),
    contingencyPct: boundedNumber(rawScenario.contingencyPct, 12, 5, 35),
  };
  const measures = designMeasures(document);
  const systems = systemsFor(scenario.utilities, measures.areaSqFt);
  const bom = buildBom({
    width_ft: measures.widthFt,
    depth_ft: measures.depthFt,
    gross_sq_ft: measures.areaSqFt,
    window_count: measures.windowCount,
    glazing_sq_ft: measures.glazedAreaSqFt,
    material: document.spec.material,
    systems,
    storeys: measures.storeys,
  });
  let lines = bom.items
    .filter((item) => scenario.utilities !== "serviced" || item.key !== "septic")
    .map((item) => fromBom(item, scenario.finish, scenario.delivery));

  if (scenario.utilities === "serviced") {
    lines.push({
      id: "municipal-connections",
      category: "utilities",
      label: "Municipal utility connections",
      quantity: 1,
      unit: "allowance",
      ...range(7_500, 15_000, 30_000),
      basis: "Planning allowance for water, sewer and electrical connections; municipal levies and trench length require confirmation.",
      ownerBuildable: false,
      status: "quote-needed",
    });
  }

  const site = SITE_RANGES[scenario.site];
  lines.push({
    id: "site-preparation",
    category: "site",
    label: site.label,
    quantity: 1,
    unit: "allowance",
    low: site.low,
    mid: site.mid,
    high: site.high,
    basis: site.basis,
    ownerBuildable: scenario.site === "serviced-flat" || scenario.site === "rural-flat",
    status: scenario.site === "unknown" || scenario.site === "sloped" || scenario.site === "remote" ? "quote-needed" : "allowance",
  });

  const distance = scenario.shippingDistanceKm;
  lines.push({
    id: "delivery-mobilization",
    category: "delivery",
    label: distance > 0 ? `Delivery and mobilization — ${Math.round(distance)} km` : "Delivery and mobilization allowance",
    quantity: distance > 0 ? Math.round(distance) : 1,
    unit: distance > 0 ? "km" : "allowance",
    ...(distance > 0 ? range(1_500 + distance * 2.2, 3_000 + distance * 3.8, 6_000 + distance * 6.5) : range(3_000, 8_000, 20_000)),
    basis: distance > 0
      ? "Distance-based planning allowance; route, permits, load dimensions, crane time and origin still need a carrier quote."
      : "Broad allowance until the manufacturing or staging origin and road route are known.",
    ownerBuildable: false,
    status: "quote-needed",
  });

  const softScale = Math.max(0.8, measures.areaSqFt / 800);
  lines.push({
    id: "permits-design-engineering",
    category: "soft-costs",
    label: "Permits, design coordination, engineering and build insurance",
    quantity: 1,
    unit: "allowance",
    ...range(7_500 * softScale, 12_000 * softScale, 20_000 * softScale),
    basis: "Alberta pilot allowance. Authority fees, professional scope and insurance are reconciled when the parcel and delivery method are known.",
    ownerBuildable: false,
    status: "allowance",
  });

  const subtotal = sumRanges(lines);
  const contingency = range(
    subtotal.low * scenario.contingencyPct / 100,
    subtotal.mid * scenario.contingencyPct / 100,
    subtotal.high * scenario.contingencyPct / 100,
  );
  const total = range(
    subtotal.low + contingency.low,
    subtotal.mid + contingency.mid,
    subtotal.high + contingency.high,
  );

  const gaps: string[] = [];
  const reasons: string[] = ["The shell and systems are derived from the current saved design geometry."];
  let confidenceScore = 92;
  if (scenario.site === "unknown") {
    confidenceScore -= 18;
    gaps.push("Site slope, soil, access, clearing, drainage and driveway are not confirmed.");
    reasons.push("Site conditions are still an allowance.");
  }
  if (distance === 0) {
    confidenceScore -= 10;
    gaps.push("Delivery distance and origin are unknown; obtain a route and mobilization quote.");
    reasons.push("Delivery is not tied to an origin and route.");
  }
  if (!input.municipality.trim()) {
    confidenceScore -= 6;
    gaps.push("Municipality and authority fees are not confirmed.");
  }
  const isAlberta = input.region.trim().toLowerCase() === "alberta";
  if (!isAlberta) {
    confidenceScore -= 22;
    gaps.push("Pricing is calibrated to the Alberta pilot and needs regional supplier validation.");
    reasons.push("This project is outside the Alberta pricing pilot.");
  } else {
    reasons.push("Rates use the Alberta planning model and still require current supplier quotes.");
  }
  confidenceScore = Math.max(20, Math.min(95, confidenceScore));
  const confidenceLabel: ProjectBudget["confidence"]["label"] =
    confidenceScore >= 80 ? "High" : confidenceScore >= 58 ? "Medium" : "Low";

  const capCad = input.budgetCapCad !== null && Number.isFinite(input.budgetCapCad) && input.budgetCapCad > 0
    ? roundMoney(input.budgetCapCad)
    : null;
  const cap = capCad === null ? null : {
    capCad,
    midpointDeltaCad: capCad - total.mid,
    state: (total.low > capCad ? "over" : total.high > capCad ? "at-risk" : "within") as "within" | "at-risk" | "over",
  };

  return {
    currency: "CAD",
    designHash: hashBuilderDocument(document),
    areaSqFt: Math.round(measures.areaSqFt * 10) / 10,
    measures: {
      areaSqFt: Math.round(measures.areaSqFt * 10) / 10,
      footprintSqFt: Math.round(measures.footprintSqFt * 10) / 10,
      storeys: measures.storeys,
      glazedAreaSqFt: Math.round(measures.glazedAreaSqFt * 10) / 10,
    },
    scenario,
    region: input.region.trim() || "Alberta",
    municipality: input.municipality.trim(),
    lines,
    subtotal,
    contingency,
    total,
    confidence: { score: confidenceScore, label: confidenceLabel, reasons },
    gaps,
    assumptions: [
      `The range is tied to design ${hashBuilderDocument(document).slice(0, 10)} and ${Math.round(measures.areaSqFt).toLocaleString("en-CA")} sq ft of modelled floor area.`,
      `${input.region.trim() || "Alberta"} is the pricing region; supplier and trade quotes supersede these allowances.`,
      `${scenario.finish.replace("-", " ")} finish, ${scenario.delivery.replace("-", " ")} delivery and ${scenario.contingencyPct}% contingency are selected.`,
    ],
    exclusions: [
      "Land purchase price, financing costs and property taxes are excluded.",
      "GST, municipal levies and utility-provider fees are excluded unless a line says otherwise.",
      "No structural, energy, permit or contractor quote is implied by this planning range.",
    ],
    cap,
  };
}

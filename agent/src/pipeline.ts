// Pure functions: questionnaire -> design brief -> budget -> milestone schedule.
// No I/O here; the CLI (index.ts) handles files and the Claude call.

import {
  AlbertaCostModel,
  Budget,
  BudgetLine,
  BudgetTotals,
  BuildPlan,
  CostModelInput,
  CostRange,
  DesignBrief,
  isRepoCostModel,
  Milestone,
  Questionnaire,
  RepoCostModel,
} from "./types";

/**
 * Built-in defaults matching the Alberta research baseline:
 * 800 sqft off-grid SIP home LOW $185K / MID $290K / HIGH $465K excluding land.
 */
export const DEFAULT_COST_MODEL: AlbertaCostModel = {
  baseHome: { referenceSqft: 800, low: 185_000, mid: 290_000, high: 465_000 },
  landLacSteAnne: { low: 75_000, high: 200_000 },
  screwPiles: { low: 6_000, high: 15_000 },
  sipShellKitAndErection: { low: 30_000, high: 55_000 },
  solarBattery: { low: 35_000, high: 70_000 },
  cistern: { low: 8_000, high: 15_000 },
  well: { low: 10_000, high: 18_000 },
  septic: { low: 10_000, high: 25_000 },
  woodStoveInstalled: { low: 2_500, high: 4_000 },
  woodFiredHotTub: { low: 4_000, high: 12_000 },
  deck: { low: 4_000, high: 8_000 },
  permitsDesignEngineering: 12_000,
  hrv: { low: 3_500, high: 7_500 },
  contingencyRange: [0.1, 0.15],
};

const mid = (r: CostRange): number => r.mid ?? Math.round((r.low + r.high) / 2);
const round = (n: number): number => Math.round(n);

// ---------------------------------------------------------------- design brief

/** NBC 9.36 prescriptive-path cap on fenestration-and-door-to-wall ratio. */
const FDWR_PRESCRIPTIVE_MAX = 0.22;
/** Edmonton December solar yield — the number that sizes everything. */
const DEC_YIELD_KWH_PER_KW_DAY = 1.3;

export function questionnaireToDesignBrief(
  q: Questionnaire
): Omit<DesignBrief, "narrative" | "narrativeSource"> {
  const { sizeSqft, storeys, glazingRatio } = q.home;
  const footprintSqft = sizeSqft / storeys;
  // Rough envelope geometry for a rectangular plan, 9ft walls per storey.
  const sideLength = Math.sqrt(footprintSqft);
  const wallAreaSqft = round(4 * sideLength * 9 * storeys);
  const roofAreaSqft = round(footprintSqft * 1.15); // pitch allowance

  const notes: string[] = [];
  const meetsMinDwellingSize = sizeSqft >= q.parcel.minDwellingSizeSqft;

  // Check 1: district minimum dwelling size (districts set this, never counties).
  if (!meetsMinDwellingSize) {
    notes.push(
      `District minimum: ${q.parcel.district} requires ${q.parcel.minDwellingSizeSqft} sqft; ` +
        `this design is ${sizeSqft} sqft — resize or seek a variance before purchase.`
    );
  }

  // Check 2: FDWR glazing cap.
  if (glazingRatio > FDWR_PRESCRIPTIVE_MAX) {
    notes.push(
      `FDWR ${Math.round(glazingRatio * 100)}% exceeds the ${FDWR_PRESCRIPTIVE_MAX * 100}% ` +
        `prescriptive cap (NBC 9.36) — performance path required (paid energy model).`
    );
  }

  // Check 3: aquifer — unreliable parcels cannot count on a well.
  const water = { ...q.water };
  if (q.parcel.aquifer === "unreliable" && water.source === "well") {
    water.source = "cistern";
    notes.push(
      "Parcel aquifer is unreliable — water source defaulted to cistern (a well is not dependable here)."
    );
  }

  // Check 4: winter solar floor — battery covers 2 days of winter load, and the
  // generator is never optional (Edmonton December yield ~1.3 kWh/kW/day).
  const estimatedAnnualLoadKwh = round(365 * (9 + Math.max(0, sizeSqft - 400) * 0.03));
  const dailyWinterLoadKwh = Math.ceil(estimatedAnnualLoadKwh / 365);
  const batteryFloorKwh = 2 * dailyWinterLoadKwh;
  const energy = { ...q.energy, estimatedAnnualLoadKwh };
  if (energy.batteryKwh < batteryFloorKwh) {
    notes.push(
      `Battery raised from ${energy.batteryKwh} to ${batteryFloorKwh} kWh to hold 2 days of winter ` +
        `load (${dailyWinterLoadKwh} kWh/day; Edmonton December yield ~${DEC_YIELD_KWH_PER_KW_DAY} kWh/kW/day).`
    );
    energy.batteryKwh = batteryFloorKwh;
  }
  if (!energy.backupGenerator) {
    notes.push(
      `Auto-start generator added — not optional off-grid in an Alberta winter ` +
        `(Edmonton December yield ~${DEC_YIELD_KWH_PER_KW_DAY} kWh/kW/day).`
    );
    energy.backupGenerator = true;
  }

  // Standing SIP rule, in every brief.
  notes.push(
    "SIP discipline: electrical chases are frozen at panel fabrication — final electrical layout " +
      "before the panel order; no plumbing in exterior SIP walls."
  );

  return {
    projectName: q.projectName,
    generatedAt: new Date().toISOString(),
    parcel: q.parcel,
    meetsMinDwellingSize,
    home: q.home,
    shell: {
      wallThicknessMm: 165, // 6.5" SIP, ~R-24
      roofThicknessMm: 260, // 10.25" SIP, ~R-40
      wallRValue: 24,
      roofRValue: 40,
      wallAreaSqft,
      roofAreaSqft,
      glazingRatio,
    },
    foundation: {
      type: "screwPiles",
      estimatedPileCount: Math.max(8, Math.ceil(footprintSqft / 80)),
    },
    // Coarse off-grid load estimate: ~9 kWh/day base + 3 kWh/day per 100 sqft over 400.
    energy,
    water,
    extras: q.extras,
    constraintNotes: notes,
  };
}

// ---------------------------------------------------------------- budget

export function designBriefToBudget(
  brief: Omit<DesignBrief, "narrative" | "narrativeSource">,
  model: CostModelInput = DEFAULT_COST_MODEL,
  requestedContingencyRate?: number
): Budget {
  if (isRepoCostModel(model)) {
    // Repo file path ignores requestedContingencyRate — see budgetFromRepoModel.
    return budgetFromRepoModel(brief, model);
  }
  return budgetFromDefaults(brief, model, requestedContingencyRate);
}

/**
 * Budget built from the checked-in research file (data/alberta/cost-model.json).
 *
 * Follows the file's totalsRule exactly: totals = sum of non-optional line
 * items x (1 + contingencyPct), optional lines excluded, land excluded from
 * ex-land totals. The file's contingencyPct governs — a questionnaire
 * contingency override is deliberately ignored here so agent output equals the
 * published totals to the dollar (ex-land 195,250 / 295,680 / 434,700 at
 * reference size with the full non-optional line set).
 */
function budgetFromRepoModel(
  brief: Omit<DesignBrief, "narrative" | "narrativeSource">,
  model: RepoCostModel
): Budget {
  const q = brief;
  const referenceSqft = model.referenceHome?.sqft ?? 800;
  const scale = q.home.sizeSqft / referenceSqft;
  // Size-sensitive lines scale with floor area; site services and soft costs don't.
  const scaledKeys = new Set(["sipShell", "roofWindowsDoors", "interior"]);
  const categoryByKey: Record<string, BudgetLine["category"]> = {
    land: "Land",
    siteWork: "Site",
    foundation: "Foundation",
    sipShell: "Shell",
    roofWindowsDoors: "Shell",
    interior: "Interior",
    mechanical: "Mechanical",
    solar: "Energy",
    water: "Water",
    awgSupplement: "Water",
    septic: "Septic",
    hotTubDeck: "Extras",
    permitsSoft: "Soft costs",
  };

  const lines: BudgetLine[] = [];
  for (const item of model.lineItems) {
    // Questionnaire-driven inclusion rules.
    if (item.key === "awgSupplement" && q.water.source !== "awgSupplement") continue;
    if (item.key === "hotTubDeck" && !q.extras.hotTub && !q.extras.deck) continue;

    const s = scaledKeys.has(item.key) ? scale : 1;
    lines.push({
      id: item.key,
      category: categoryByKey[item.key] ?? "Interior",
      item:
        item.key === "land"
          ? `${item.label} (informational, excluded from totals)`
          : item.label,
      lowCad: round(item.low * s),
      midCad: round(item.mid * s),
      highCad: round(item.high * s),
      notes: item.basis,
    });
  }

  const subtotal = sumLines(lines.filter((l) => l.category !== "Land"));
  // totalsRule: contingency per column at the file's own contingencyPct.
  const contingency: BudgetTotals = {
    lowCad: round(subtotal.lowCad * model.contingencyPct.low),
    midCad: round(subtotal.midCad * model.contingencyPct.mid),
    highCad: round(subtotal.highCad * model.contingencyPct.high),
  };
  lines.push({
    id: "contingency",
    category: "Contingency",
    item: `Contingency (${model.contingencyPct.low * 100}-${model.contingencyPct.high * 100}%, mid ${model.contingencyPct.mid * 100}%)`,
    lowCad: contingency.lowCad,
    midCad: contingency.midCad,
    highCad: contingency.highCad,
  });

  return {
    currency: "CAD",
    excludesLand: true,
    lines,
    subtotal,
    contingency,
    total: {
      lowCad: subtotal.lowCad + contingency.lowCad,
      midCad: subtotal.midCad + contingency.midCad,
      highCad: subtotal.highCad + contingency.highCad,
    },
    contingencyRate: model.contingencyPct.mid,
  };
}

/** Budget built from the built-in research defaults (no data file present). */
function budgetFromDefaults(
  brief: Omit<DesignBrief, "narrative" | "narrativeSource">,
  model: AlbertaCostModel,
  requestedContingencyRate?: number
): Budget {
  const q = brief;
  const scale = q.home.sizeSqft / model.baseHome.referenceSqft;
  const contingencyRate = clampContingency(
    requestedContingencyRate,
    model.contingencyRange
  );

  const lines: BudgetLine[] = [];
  const push = (
    id: string,
    category: BudgetLine["category"],
    item: string,
    r: CostRange,
    notes?: string
  ) => lines.push({ id, category, item, lowCad: round(r.low), midCad: mid({ low: round(r.low), high: round(r.high), mid: r.mid && round(r.mid) }), highCad: round(r.high), notes });

  // Informational only — excluded from totals.
  push(
    "land",
    "Land",
    `Land — ${q.parcel.county} (informational, excluded from totals)`,
    model.landLacSteAnne,
    "Acreage prices vary widely by parcel and services"
  );

  push("piles", "Foundation", "Screw pile foundation, engineered layout", model.screwPiles);
  push(
    "shell",
    "Shell",
    "SIP shell kit + erection",
    scaleRange(model.sipShellKitAndErection, scale),
    `Scaled from ${model.baseHome.referenceSqft} sqft reference`
  );
  push("solar", "Energy", `Solar ${q.energy.solarKw} kW + battery ${q.energy.batteryKwh} kWh${q.energy.backupGenerator ? " + generator" : ""}`, model.solarBattery);

  if (q.water.source === "well") {
    push("water", "Water", "Drilled well, pump, and pressure system", model.well);
  } else {
    push(
      "water",
      "Water",
      q.water.source === "awgSupplement"
        ? "Cistern + atmospheric water generator supplement"
        : "Buried cistern + delivery setup",
      model.cistern
    );
  }
  push("septic", "Septic", `Septic system (${q.water.septic})`, model.septic);

  if (q.energy.woodStove) {
    push("stove", "Heating", "Wood stove, installed + WETT inspection", model.woodStoveInstalled);
  }
  if (q.extras.hrv) {
    push("hrv", "Interior", "HRV (heat recovery ventilator)", model.hrv);
  }
  push("permits", "Soft costs", "Permits, design, and engineering", {
    low: model.permitsDesignEngineering,
    high: model.permitsDesignEngineering,
    mid: model.permitsDesignEngineering,
  });

  // Interior fit-out is the remainder that reconciles component lines with the
  // whole-home anchor (LOW 185K / MID 290K / HIGH 465K at reference size).
  const anchor: BudgetTotals = {
    lowCad: round(model.baseHome.low * scale),
    midCad: round(model.baseHome.mid * scale),
    highCad: round(model.baseHome.high * scale),
  };
  const counted = sumLines(lines.filter((l) => l.category !== "Land" && l.category !== "Extras"));
  push(
    "fitout",
    "Interior",
    "Interior fit-out: framing, mechanical rough-ins, kitchen, bath, finishes",
    {
      low: Math.max(0, anchor.lowCad - counted.lowCad),
      mid: Math.max(0, anchor.midCad - counted.midCad),
      high: Math.max(0, anchor.highCad - counted.highCad),
    },
    "Derived so component lines reconcile with the whole-home anchor"
  );

  if (q.extras.hotTub) {
    push("hottub", "Extras", "Wood-fired hot tub", model.woodFiredHotTub);
  }
  if (q.extras.deck) {
    push("deck", "Extras", `Deck${q.extras.deckSqft ? ` (~${q.extras.deckSqft} sqft)` : ""}`, model.deck);
  }

  const subtotal = sumLines(lines.filter((l) => l.category !== "Land"));
  const contingency: BudgetTotals = {
    lowCad: round(subtotal.lowCad * model.contingencyRange[0]),
    midCad: round(subtotal.midCad * contingencyRate),
    highCad: round(subtotal.highCad * model.contingencyRange[1]),
  };
  lines.push({
    id: "contingency",
    category: "Contingency",
    item: `Contingency (${model.contingencyRange[0] * 100}-${model.contingencyRange[1] * 100}%)`,
    lowCad: contingency.lowCad,
    midCad: contingency.midCad,
    highCad: contingency.highCad,
  });

  return {
    currency: "CAD",
    excludesLand: true,
    lines,
    subtotal,
    contingency,
    total: {
      lowCad: subtotal.lowCad + contingency.lowCad,
      midCad: subtotal.midCad + contingency.midCad,
      highCad: subtotal.highCad + contingency.highCad,
    },
    contingencyRate,
  };
}

// ---------------------------------------------------------------- milestones

const HOLDBACK_RATE_BPS = 1_000; // 10%, matches AuraBuildEscrow default
const HOLDBACK_PERIOD_DAYS = 60;

/**
 * Groups budget lines into escrow milestones (MID column) and models the
 * Alberta statutory holdback: 10% of every release is retained and only
 * releasable 60 days after milestone release.
 */
export function budgetToMilestones(
  budget: Budget,
  projectName: string
): BuildPlan {
  const byId = new Map(budget.lines.map((l) => [l.id, l]));
  // Phase id lists cover both cost-model schemas (built-in defaults and the
  // repo data file); ids missing from the budget are simply skipped.
  const phases: Array<{ name: string; description: string; ids: string[] }> = [
    {
      name: "Design, engineering & permits",
      description: "Stamped drawings, development and building permits",
      ids: ["permits", "permitsSoft"],
    },
    {
      name: "Site prep & foundation",
      description: "Access, clearing, and engineered screw pile installation",
      ids: ["piles", "siteWork", "foundation"],
    },
    {
      name: "SIP shell & envelope",
      description: "Panel fabrication, delivery, erection, roof, windows, and doors to lock-up",
      ids: ["shell", "sipShell", "roofWindowsDoors"],
    },
    {
      name: "Off-grid systems",
      description: "Solar + battery, water, septic, mechanical, HRV, and wood stove",
      ids: ["solar", "water", "awgSupplement", "septic", "mechanical", "hrv", "stove"],
    },
    {
      name: "Interior & completion",
      description: "Fit-out, extras, deficiency list, and final inspection",
      ids: ["fitout", "interior", "hottub", "deck", "hotTubDeck", "contingency"],
    },
  ];

  const milestones: Milestone[] = [];
  for (const phase of phases) {
    const ids = phase.ids.filter((id) => byId.has(id));
    if (ids.length === 0) continue;
    const amount = ids.reduce((sum, id) => sum + (byId.get(id)?.midCad ?? 0), 0);
    if (amount <= 0) continue;
    const holdback = Math.round((amount * HOLDBACK_RATE_BPS) / 10_000);
    milestones.push({
      index: milestones.length,
      name: phase.name,
      description: phase.description,
      amountCad: amount,
      holdbackCad: holdback,
      netOnReleaseCad: amount - holdback,
      budgetLineIds: ids,
    });
  }

  const totalCad = milestones.reduce((s, m) => s + m.amountCad, 0);
  const totalHoldbackCad = milestones.reduce((s, m) => s + m.holdbackCad, 0);
  return {
    projectName,
    milestones,
    totalCad,
    totalHoldbackCad,
    holdbackRateBps: HOLDBACK_RATE_BPS,
    holdbackPeriodDays: HOLDBACK_PERIOD_DAYS,
    notes:
      "Amounts are budget MID estimates in CAD. On-chain funding is in native USDC on X Layer; " +
      "each release retains the statutory holdback per Alberta's Prompt Payment and Construction Lien Act model.",
  };
}

// ---------------------------------------------------------------- helpers

function scaleRange(r: CostRange, scale: number): CostRange {
  return { low: r.low * scale, high: r.high * scale, mid: r.mid ? r.mid * scale : undefined };
}

function sumLines(lines: BudgetLine[]): BudgetTotals {
  return lines.reduce(
    (acc, l) => ({
      lowCad: acc.lowCad + l.lowCad,
      midCad: acc.midCad + l.midCad,
      highCad: acc.highCad + l.highCad,
    }),
    { lowCad: 0, midCad: 0, highCad: 0 }
  );
}

function clampContingency(
  rate: number | undefined,
  range: [number, number]
): number {
  const r = rate ?? (range[0] + range[1]) / 2;
  return Math.min(range[1], Math.max(range[0], r));
}

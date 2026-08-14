// Regional cost basis — stage 1 (plan C2).
//
// `data/alberta/cost-model.json` is one anchored model for one region: rural
// Alberta within ~1hr of Edmonton. Its ex-land triplet ($199,100 / $301,280 /
// $443,900) is reconciled to the dollar by `agent/ npm run demo` and must not
// move. This module extends that model to other regions WITHOUT touching it,
// by applying a per-line multiplier read from baked Statistics Canada
// construction price indexes.
//
// The honesty rules that shape every decision below:
//
//   1. The anchored region multiplies by exactly 1.0, so the published triplet
//      is reproduced byte-for-byte. `regional-cost.spec.ts` pins this.
//   2. A region with no baked index returns a refusal. It never gets a silent
//      1.0 multiplier pretending to be knowledge.
//   3. The index is a TIME series, not a survey of price levels between
//      cities. A region ratio measures relative drift since the common base
//      period and equals a cost-level ratio only if the regions started at
//      parity — which Aura cannot source. So the band WIDENS in proportion to
//      the drift, and the result is labelled an estimate, not a quote.
//
// NOT wired into the budget UI this wave. Schema, data, function, tests.

import indexSetJson from "@data/cost-indexes/statcan-1810028901.json";

/* ------------------------------------------------------------------ data */

/** A single baked series: one region, one MasterFormat division. */
export interface CostIndexEntry {
  label: string;
  value: number;
  vectorId: number;
  coordinate: string;
}

export type CostIndexRegionKind = "cma" | "province" | "composite";

export interface CostIndexRegion {
  id: string;
  label: string;
  kind: CostIndexRegionKind;
  statcanMemberId: number;
  divisions: Record<string, CostIndexEntry>;
}

export interface CostIndexSet {
  retrievedAtISO: string;
  referencePeriod: string;
  source: {
    publisher: string;
    tableId: string;
    productId: number;
    title: string;
    url: string;
    licence: string;
    licenceUrl: string;
    archiveStatus: string;
    releaseTime: string;
    supersedes: string;
    supersedesNote: string;
  };
  selection: { typeOfBuilding: string; typeOfBuildingMemberId: number };
  anchorRegionId: string;
  anchorBasis: string;
  interpretation: string;
  regions: CostIndexRegion[];
}

/* The bake asserts the shape; TypeScript's structural inference over a 70 KB
   JSON literal is slow and unhelpful, so the cast happens once, here. */
export const COST_INDEX_SET = indexSetJson as unknown as CostIndexSet;

/** The region `data/alberta/cost-model.json` was researched in. */
export const ANCHOR_REGION_ID = COST_INDEX_SET.anchorRegionId;

/** Every label on a regionalized figure. Never softened, never omitted. */
export const ESTIMATE_LABEL = "an estimate, not a quote" as const;

export function costIndexRegions(): readonly CostIndexRegion[] {
  return COST_INDEX_SET.regions;
}

export function costIndexRegionIds(): readonly string[] {
  return COST_INDEX_SET.regions.map((region) => region.id);
}

export function findCostIndexRegion(regionId: string): CostIndexRegion | null {
  const wanted = regionId.trim().toLowerCase();
  return COST_INDEX_SET.regions.find((region) => region.id === wanted) ?? null;
}

/* ---------------------------------------------------- line → division map */

/**
 * Which baked division tracks each `cost-model.json` line item.
 *
 * A line whose scope genuinely spans several divisions maps to `composite` —
 * the whole-building index — rather than to whichever division happens to be
 * largest. Picking one would be a guess wearing a source's clothes.
 */
export interface LineDivisionMapping {
  division: string;
  rationale: string;
}

export const LINE_DIVISIONS: Readonly<Record<string, LineDivisionMapping>> = {
  siteWork: {
    division: "earthwork",
    rationale: "Driveway, clearing and drainage are earthwork scope.",
  },
  foundation: {
    division: "structuralSteelFraming",
    rationale:
      "The foundation is hot-dip galvanized screw piles. Under the no-concrete standard the concrete division is the wrong tracker; steel framing carries the dominant input price.",
  },
  sipShell: {
    division: "woodPlasticsComposites",
    rationale: "OSB facings and dimensional lumber dominate a SIP kit.",
  },
  roofWindowsDoors: {
    division: "composite",
    rationale:
      "Metal roof, windows, doors and siding span openings, thermal and moisture protection, and finishes. No single division represents the line, so the whole-building index carries it.",
  },
  interior: {
    division: "finishes",
    rationale: "Drywall, flooring, cabinetry and paint are finishes scope.",
  },
  mechanical: {
    division: "composite",
    rationale:
      "The line bundles plumbing, HVAC and electrical in one number. Splitting it across three divisions would need a cost split the model does not publish.",
  },
  solar: {
    division: "electrical",
    rationale: "Array, inverter, battery and auto-start generator are electrical scope.",
  },
  water: {
    division: "plumbing",
    rationale: "Cistern or well, pump and distribution are plumbing scope.",
  },
  awgSupplement: {
    division: "plumbing",
    rationale: "The AWG module is plumbed into the cistern loop.",
  },
  septic: {
    division: "utilities",
    rationale: "Private sewage treatment and dispersal are site utilities.",
  },
  hotTubDeck: {
    division: "woodPlasticsComposites",
    rationale: "Deck framing and a wood-fired tub are wood and composites scope.",
  },
  permitsSoft: {
    division: "generalRequirements",
    rationale:
      "MasterFormat Division 01 general requirements is exactly permits, professional coordination, insurance and overhead.",
  },
};

/** Lines with no mapping fall back to the whole-building index, disclosed. */
const FALLBACK_MAPPING: LineDivisionMapping = {
  division: "composite",
  rationale: "No division mapping exists for this line, so the whole-building index carries it.",
};

/* ------------------------------------------------------------- the model */

export interface RegionalBudgetLine {
  /** `data/alberta/cost-model.json` `lineItems[].key` — the line's anchored identity. */
  key: string;
  label: string;
  low: number;
  mid: number;
  high: number;
  /** Land is informational; the file's totalsRule excludes it from ex-land totals. */
  excludedFromTotals?: boolean;
}

export interface RegionalizableBudget {
  currency: "CAD";
  lines: readonly RegionalBudgetLine[];
  /** Fractions, exactly as `cost-model.json` states them (0.10 / 0.12 / 0.15). */
  contingencyPct: { low: number; mid: number; high: number };
}

export interface MoneyBand {
  low: number;
  mid: number;
  high: number;
}

export interface RegionalizedLine extends RegionalBudgetLine {
  division: string;
  divisionLabel: string;
  rationale: string;
  multiplier: number;
  /** The region's index value for this line's division. */
  regionIndex: number;
  /** The anchor region's index value for the same division. */
  anchorIndex: number;
  vectorId: number;
  coordinate: string;
}

export type RegionalConfidence = "anchored" | "indexed" | "aggregate";

export interface RegionalizedBudget {
  ok: true;
  label: typeof ESTIMATE_LABEL;
  currency: "CAD";
  region: { id: string; label: string; kind: CostIndexRegionKind };
  anchorRegion: { id: string; label: string };
  confidence: RegionalConfidence;
  /** Fraction by which each line's band half-width was widened. 0 at the anchor. */
  bandWidening: number;
  lines: RegionalizedLine[];
  subtotal: MoneyBand;
  contingency: MoneyBand;
  total: MoneyBand;
  source: {
    tableId: string;
    url: string;
    referencePeriod: string;
    retrievedAtISO: string;
    licence: string;
  };
  assumptions: string[];
}

export interface RegionalCostRefusal {
  ok: false;
  /** Plain words for a person, not an error code. */
  reason: string;
  requestedRegion: string;
  availableRegionIds: readonly string[];
}

export type RegionalizeResult = RegionalizedBudget | RegionalCostRefusal;

/**
 * How far the band opens as confidence drops.
 *
 * These are declared policy constants, not measurements, and they are written
 * here rather than buried so they can be argued with. The reasoning:
 *
 *   - `anchored`: the model was researched in this region. Nothing is assumed,
 *     so nothing widens. Zero slope AND zero floor guarantee the published
 *     triplet is reproduced exactly.
 *   - `indexed` (another CMA): the multiplier assumes the two regions were at
 *     parity in the index base period. Aura cannot source that. The drift
 *     itself bounds the error that assumption can introduce, so slope 1 treats
 *     the whole drift as uncertainty; the floor covers the case where two
 *     regions happen to have drifted alike but are still different places.
 *   - `aggregate` (a province or the national composite): the same assumption,
 *     plus an average standing in for a specific site. Both terms rise.
 */
const CONFIDENCE_WIDENING: Readonly<Record<RegionalConfidence, { floor: number; slope: number }>> = {
  anchored: { floor: 0, slope: 0 },
  indexed: { floor: 0.05, slope: 1 },
  aggregate: { floor: 0.1, slope: 1.5 },
};

function confidenceFor(region: CostIndexRegion): RegionalConfidence {
  if (region.id === ANCHOR_REGION_ID) return "anchored";
  return region.kind === "cma" ? "indexed" : "aggregate";
}

/**
 * The file's own totalsRule: totals = sum of non-excluded line items x
 * (1 + contingencyPct), per column, land excluded.
 *
 * This is a SECOND implementation of the rule that `agent/src/pipeline.ts`
 * `budgetFromRepoModel` already carries — `app/` cannot import from `agent/`
 * at runtime. That duplication is the divergence class this repo has been
 * bitten by, so it is not left to trust: `regional-cost.spec.ts` reconciles
 * this function's identity output against `cost-model.json`'s own
 * `totalsExLand` to the dollar. If the two rules ever drift apart, that gate
 * fails before a number reaches a page.
 *
 * Rounding order mirrors the agent exactly: contingency is rounded, then
 * added to the subtotal.
 */
function totalsFromLines(
  lines: readonly { low: number; mid: number; high: number; excludedFromTotals?: boolean }[],
  contingencyPct: { low: number; mid: number; high: number },
): { subtotal: MoneyBand; contingency: MoneyBand; total: MoneyBand } {
  const counted = lines.filter((line) => line.excludedFromTotals !== true);
  const subtotal: MoneyBand = {
    low: Math.round(counted.reduce((sum, line) => sum + line.low, 0)),
    mid: Math.round(counted.reduce((sum, line) => sum + line.mid, 0)),
    high: Math.round(counted.reduce((sum, line) => sum + line.high, 0)),
  };
  const contingency: MoneyBand = {
    low: Math.round(subtotal.low * contingencyPct.low),
    mid: Math.round(subtotal.mid * contingencyPct.mid),
    high: Math.round(subtotal.high * contingencyPct.high),
  };
  return {
    subtotal,
    contingency,
    total: {
      low: subtotal.low + contingency.low,
      mid: subtotal.mid + contingency.mid,
      high: subtotal.high + contingency.high,
    },
  };
}

/**
 * Applies the multiplier to a line's band, then opens the band around the
 * scaled midpoint.
 *
 * With `multiplier === 1` and `widening === 0` this is arithmetic identity on
 * integers — `mid - (mid - low) * 1 === low` exactly in IEEE 754 at these
 * magnitudes. That exactness is what makes the anchor invariant rather than
 * approximately invariant.
 */
function scaleBand(line: RegionalBudgetLine, multiplier: number, widening: number): MoneyBand {
  const mid = line.mid * multiplier;
  const low = mid - (mid - line.low * multiplier) * (1 + widening);
  const high = mid + (line.high * multiplier - mid) * (1 + widening);
  return { low: Math.round(low), mid: Math.round(mid), high: Math.round(high) };
}

/**
 * Restates an anchored Alberta budget for another region.
 *
 * Pure: same inputs, same output, no I/O, no mutation of `budget`.
 *
 * Returns a refusal — never a 1.0 multiplier — when the region has no baked
 * index, or when the anchor region is missing the division a line needs. A
 * missing figure renders as an honest blank; it does not get invented.
 */
export function regionalizeBudget(
  budget: RegionalizableBudget,
  region: string,
): RegionalizeResult {
  const available = costIndexRegionIds();
  const target = findCostIndexRegion(region);
  if (target === null) {
    return {
      ok: false,
      reason:
        `Aura has no construction price index for "${region.trim()}", so it cannot restate this budget there. ` +
        `The Alberta model is anchored to ${COST_INDEX_SET.regions.find((r) => r.id === ANCHOR_REGION_ID)?.label ?? ANCHOR_REGION_ID} ` +
        `and Statistics Canada table ${COST_INDEX_SET.source.tableId} covers ${available.length} regions.`,
      requestedRegion: region.trim(),
      availableRegionIds: available,
    };
  }
  const anchor = findCostIndexRegion(ANCHOR_REGION_ID);
  if (anchor === null) {
    return {
      ok: false,
      reason: `The anchor region "${ANCHOR_REGION_ID}" is missing from the baked index set, so no multiplier can be derived.`,
      requestedRegion: region.trim(),
      availableRegionIds: available,
    };
  }

  const confidence = confidenceFor(target);
  const policy = CONFIDENCE_WIDENING[confidence];

  /* Two passes: resolve every line's multiplier first, so the band widening
     can be a property of the whole restatement rather than per-line noise.
     The largest drift on any line sets it — the least confident line governs
     how loudly the whole budget should hedge. */
  const resolved: { line: RegionalBudgetLine; mapping: LineDivisionMapping; regionEntry: CostIndexEntry; anchorEntry: CostIndexEntry; multiplier: number }[] = [];
  for (const line of budget.lines) {
    if (line.excludedFromTotals === true) {
      /* Land is excluded from ex-land totals and a construction price index
         says nothing about land. Carrying it at a construction multiplier
         would be a claim with no source. */
      continue;
    }
    const mapping = LINE_DIVISIONS[line.key] ?? FALLBACK_MAPPING;
    const regionEntry = target.divisions[mapping.division];
    const anchorEntry = anchor.divisions[mapping.division];
    if (regionEntry === undefined || anchorEntry === undefined || anchorEntry.value === 0) {
      return {
        ok: false,
        reason:
          `Statistics Canada table ${COST_INDEX_SET.source.tableId} has no "${mapping.division}" figure for ` +
          `${regionEntry === undefined ? target.label : anchor.label} at ${COST_INDEX_SET.referencePeriod}, ` +
          `so the "${line.label}" line cannot be restated. Aura will not fill that gap with a guess.`,
        requestedRegion: region.trim(),
        availableRegionIds: available,
      };
    }
    resolved.push({
      line,
      mapping,
      regionEntry,
      anchorEntry,
      multiplier: regionEntry.value / anchorEntry.value,
    });
  }

  const maxDrift = resolved.reduce((worst, item) => Math.max(worst, Math.abs(item.multiplier - 1)), 0);
  const bandWidening = confidence === "anchored" ? 0 : policy.floor + maxDrift * policy.slope;

  const lines: RegionalizedLine[] = resolved.map((item) => ({
    ...item.line,
    ...scaleBand(item.line, item.multiplier, bandWidening),
    division: item.mapping.division,
    divisionLabel: item.regionEntry.label,
    rationale: item.mapping.rationale,
    multiplier: item.multiplier,
    regionIndex: item.regionEntry.value,
    anchorIndex: item.anchorEntry.value,
    vectorId: item.regionEntry.vectorId,
    coordinate: item.regionEntry.coordinate,
  }));

  const { subtotal, contingency, total } = totalsFromLines(lines, budget.contingencyPct);

  const assumptions: string[] = [
    `Line ranges start from data/alberta/cost-model.json, researched for ${anchor.label}.`,
    `Multipliers are ${COST_INDEX_SET.source.tableId} ${COST_INDEX_SET.selection.typeOfBuilding} division indexes ` +
      `at ${COST_INDEX_SET.referencePeriod}, ${target.label} over ${anchor.label}.`,
    COST_INDEX_SET.interpretation,
  ];
  if (confidence === "anchored") {
    assumptions.push(
      "This is the region the model was researched in, so every multiplier is 1.0 and the published Alberta range is reproduced unchanged.",
    );
  } else {
    assumptions.push(
      `The band is widened by ${Math.round(bandWidening * 1000) / 10}% because the multiplier assumes the two regions ` +
        "were at parity in the index base period, which no free public source establishes.",
    );
  }
  if (confidence === "aggregate") {
    assumptions.push(
      `${target.label} is an aggregate of several places, not one construction market; a specific site can sit well outside this range.`,
    );
  }
  assumptions.push(
    "Alberta supply paths, code references and regulatory lines in the source model are not re-verified for this region.",
  );

  return {
    ok: true,
    label: ESTIMATE_LABEL,
    currency: budget.currency,
    region: { id: target.id, label: target.label, kind: target.kind },
    anchorRegion: { id: anchor.id, label: anchor.label },
    confidence,
    bandWidening,
    lines,
    subtotal,
    contingency,
    total,
    source: {
      tableId: COST_INDEX_SET.source.tableId,
      url: COST_INDEX_SET.source.url,
      referencePeriod: COST_INDEX_SET.referencePeriod,
      retrievedAtISO: COST_INDEX_SET.retrievedAtISO,
      licence: COST_INDEX_SET.source.licence,
    },
    assumptions,
  };
}

/* --------------------------------------------------------------- adapter */

/** The shape `data/alberta/cost-model.json` presents, narrowed to what is read. */
export interface AnchoredCostModel {
  lineItems: readonly { key: string; label: string; low: number; mid: number; high: number }[];
  contingencyPct: { low: number; mid: number; high: number };
  totalsExLand: { low: number; mid: number; high: number };
}

/**
 * Builds the regionalizable budget from the anchored cost model.
 *
 * The land exclusion lives HERE, once, rather than at every call site: the
 * file's totalsRule says "land excluded from ex-land totals", and the model's
 * land line is keyed `land`. `agent/src/pipeline.ts` applies the same rule via
 * its Land category.
 */
export function budgetFromCostModel(model: AnchoredCostModel): RegionalizableBudget {
  return {
    currency: "CAD",
    lines: model.lineItems.map((item) => ({
      key: item.key,
      label: item.label,
      low: item.low,
      mid: item.mid,
      high: item.high,
      ...(item.key === "land" ? { excludedFromTotals: true } : {}),
    })),
    contingencyPct: model.contingencyPct,
  };
}

// Regional cost basis — the gate that protects the frozen money anchor.
//
// PURE spec: no page, no browser. It runs standalone and in `npm test`.
//
// The reason this file exists is assertion #1. `data/alberta/cost-model.json`
// publishes an ex-land triplet that `agent/ npm run demo` reconciles to the
// dollar. Stage 1 of the regional cost basis adds a second code path capable
// of producing that triplet, and a second implementation of the same totalsRule
// is precisely the divergence class that has bitten this repo before. So the
// identity case is pinned to the dollar, from the file, in both directions.

import { expect, test } from "playwright/test";
import costModelJson from "@data/alberta/cost-model.json";
import {
  ANCHOR_REGION_ID,
  COST_INDEX_SET,
  ESTIMATE_LABEL,
  LINE_DIVISIONS,
  budgetFromCostModel,
  costIndexRegionIds,
  regionalizeBudget,
  type AnchoredCostModel,
  type RegionalizedBudget,
} from "@/lib/builder/regionalCost";

const COST_MODEL = costModelJson as unknown as AnchoredCostModel;
const anchoredBudget = () => budgetFromCostModel(COST_MODEL);

/** Narrows an expected-success result and fails loudly instead of silently skipping. */
function ok(result: ReturnType<typeof regionalizeBudget>): RegionalizedBudget {
  expect(result.ok, `expected a regionalized budget, got: ${result.ok ? "" : result.reason}`).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

/** Band half-widths relative to the midpoint — what "widening" actually means. */
function relativeSpread(band: { low: number; mid: number; high: number }) {
  return { below: (band.mid - band.low) / band.mid, above: (band.high - band.mid) / band.mid };
}

/* ------------------------------------------------- THE ANCHOR INVARIANCE */

test("a multiplier of 1.0 reproduces cost-model.json's ex-land totals to the dollar", () => {
  const result = ok(regionalizeBudget(anchoredBudget(), ANCHOR_REGION_ID));

  // Direction 1: against the file's own published totals — never retyped.
  expect(result.total).toEqual({
    low: COST_MODEL.totalsExLand.low,
    mid: COST_MODEL.totalsExLand.mid,
    high: COST_MODEL.totalsExLand.high,
  });

  // Direction 2: against the anchored triplet named in graph v1.2 section 1.2
  // and reconciled by `agent/ npm run demo`. Written out ONCE, here, so that a
  // change to the file cannot quietly redefine what "the anchor" means.
  expect(result.total).toEqual({ low: 199_100, mid: 301_280, high: 443_900 });
});

test("the anchored region multiplies every line by exactly 1.0 and widens nothing", () => {
  const budget = anchoredBudget();
  const result = ok(regionalizeBudget(budget, ANCHOR_REGION_ID));

  expect(result.confidence).toBe("anchored");
  expect(result.bandWidening).toBe(0);

  for (const line of result.lines) {
    const source = budget.lines.find((candidate) => candidate.key === line.key);
    expect(source, `no source line for ${line.key}`).toBeDefined();
    if (!source) continue;
    expect(line.multiplier).toBe(1);
    expect({ low: line.low, mid: line.mid, high: line.high }).toEqual({
      low: source.low,
      mid: source.mid,
      high: source.high,
    });
  }

  // Land carries no construction index and is excluded from ex-land totals.
  expect(result.lines.map((line) => line.key)).not.toContain("land");
});

test("a broken multiplier would move the anchor — the invariance test can fail", () => {
  // Falsifiability check: the same arithmetic with a deliberately wrong
  // multiplier must NOT land on the published triplet. Without this, the test
  // above proves only that the numbers exist.
  const inflated = anchoredBudget();
  const drifted = {
    ...inflated,
    lines: inflated.lines.map((line) => ({ ...line, mid: line.mid * 1.01 })),
  };
  const result = ok(regionalizeBudget(drifted, ANCHOR_REGION_ID));
  expect(result.total.mid).not.toBe(301_280);
});

/* ------------------------------------------------------- honest refusals */

test("a region with no index is refused, never given a silent 1.0", () => {
  const result = regionalizeBudget(anchoredBudget(), "Yellowknife");
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Yellowknife must not resolve — it is not in the baked index set.");

  expect(result.reason).toContain("Yellowknife");
  expect(result.reason).toContain(COST_INDEX_SET.source.tableId);
  expect(result.requestedRegion).toBe("Yellowknife");
  expect(result.availableRegionIds).toEqual(costIndexRegionIds());
  // The refusal carries no totals at all. A caller cannot mistake it for a budget.
  expect(result).not.toHaveProperty("total");
  expect(result).not.toHaveProperty("bandWidening");
});

test("region lookup is trimmed and case-insensitive but never fuzzy", () => {
  expect(ok(regionalizeBudget(anchoredBudget(), "  Calgary  ")).region.id).toBe("calgary");
  expect(regionalizeBudget(anchoredBudget(), "Calgary, Alberta").ok).toBe(false);
});

/* -------------------------------------------- widening as confidence drops */

test("another CMA is restated with real multipliers and a strictly wider band", () => {
  const budget = anchoredBudget();
  const result = ok(regionalizeBudget(budget, "calgary"));

  expect(result.confidence).toBe("indexed");
  expect(result.region.kind).toBe("cma");
  expect(result.anchorRegion.id).toBe(ANCHOR_REGION_ID);
  expect(result.bandWidening).toBeGreaterThan(0);
  expect(result.lines.some((line) => line.multiplier !== 1)).toBe(true);

  // The claim under test: every line's band is wider RELATIVE TO ITS OWN
  // midpoint than the anchored line was. Removing the widening fails this.
  for (const line of result.lines) {
    const source = budget.lines.find((candidate) => candidate.key === line.key);
    if (!source) throw new Error(`no source line for ${line.key}`);
    const before = relativeSpread(source);
    const after = relativeSpread(line);
    expect(after.below).toBeGreaterThan(before.below);
    expect(after.above).toBeGreaterThan(before.above);
  }
});

test("an aggregate geography hedges harder than a single CMA", () => {
  const cma = ok(regionalizeBudget(anchoredBudget(), "calgary"));
  const province = ok(regionalizeBudget(anchoredBudget(), "alberta"));

  expect(province.confidence).toBe("aggregate");
  expect(province.region.kind).toBe("province");
  // Declared policy floors: 5% for a CMA, 10% for an aggregate. Pinned so a
  // future edit cannot quietly flatten the hedge.
  expect(cma.bandWidening).toBeGreaterThanOrEqual(0.05);
  expect(province.bandWidening).toBeGreaterThanOrEqual(0.1);
  expect(
    province.assumptions.some((line) => line.includes("aggregate of several places")),
  ).toBe(true);
});

test("widening grows with drift inside one confidence tier", () => {
  // Toronto and Victoria are both CMAs, so the tier is identical and only the
  // distance from Edmonton's index differs.
  const near = ok(regionalizeBudget(anchoredBudget(), "toronto"));
  const far = ok(regionalizeBudget(anchoredBudget(), "victoria"));
  const drift = (result: RegionalizedBudget) =>
    Math.max(...result.lines.map((line) => Math.abs(line.multiplier - 1)));

  expect(drift(far)).toBeGreaterThan(drift(near));
  expect(far.bandWidening).toBeGreaterThan(near.bandWidening);
});

/* ------------------------------------------------- labelling + provenance */

test("every restatement says what it is and where each figure came from", () => {
  for (const regionId of ["edmonton", "calgary", "alberta", "canada-fifteen-cma-composite"]) {
    const result = ok(regionalizeBudget(anchoredBudget(), regionId));
    expect(result.label).toBe(ESTIMATE_LABEL);
    expect(result.source.tableId).toBe(COST_INDEX_SET.source.tableId);
    expect(result.source.url).toContain("statcan.gc.ca");
    expect(result.source.referencePeriod).toBe(COST_INDEX_SET.referencePeriod);
    expect(Number.isNaN(Date.parse(result.source.retrievedAtISO))).toBe(false);

    for (const line of result.lines) {
      expect(line.vectorId, `${regionId}/${line.key} has no vector id`).toBeGreaterThan(0);
      expect(line.coordinate).toMatch(/^\d+(\.\d+){9}$/);
      expect(line.regionIndex).toBeGreaterThan(0);
      expect(line.anchorIndex).toBeGreaterThan(0);
      expect(line.rationale.length).toBeGreaterThan(0);
      expect(line.multiplier).toBeCloseTo(line.regionIndex / line.anchorIndex, 12);
    }
    // The interpretation limit travels with the number, not just the README.
    expect(result.assumptions.some((line) => line.includes("not a survey of absolute price levels"))).toBe(true);
  }
});

test("the baked index set carries a source for every figure it states", () => {
  expect(COST_INDEX_SET.source.tableId).toBe("18-10-0289-01");
  // The graph names 18-10-0276-01; that table is archived and this one replaces
  // it. The lineage is recorded rather than quietly swapped.
  expect(COST_INDEX_SET.source.supersedes).toBe("18-10-0276-01");
  expect(COST_INDEX_SET.source.supersedesNote).toContain("replaces table 18-10-0276");
  expect(COST_INDEX_SET.source.archiveStatus.startsWith("CURRENT")).toBe(true);
  expect(COST_INDEX_SET.source.licenceUrl).toContain("statcan.gc.ca");
  expect(COST_INDEX_SET.regions.length).toBeGreaterThan(1);

  const ids = new Set<string>();
  for (const region of COST_INDEX_SET.regions) {
    expect(ids.has(region.id), `duplicate region id ${region.id}`).toBe(false);
    ids.add(region.id);
    expect(Object.keys(region.divisions).length).toBeGreaterThan(0);
    for (const [key, entry] of Object.entries(region.divisions)) {
      const where = `${region.id}/${key}`;
      expect(typeof entry.value, where).toBe("number");
      expect(entry.value, where).toBeGreaterThan(0);
      expect(entry.vectorId, where).toBeGreaterThan(0);
      expect(entry.coordinate, where).toMatch(/^\d+(\.\d+){9}$/);
      expect(entry.label.length, where).toBeGreaterThan(0);
    }
  }
  expect(ids.has(ANCHOR_REGION_ID)).toBe(true);
});

test("every cost-model line has a named division mapping", () => {
  // A new line in cost-model.json must be given a mapping deliberately rather
  // than sliding into the composite fallback unnoticed.
  const unmapped = COST_MODEL.lineItems
    .filter((item) => item.key !== "land")
    .map((item) => item.key)
    .filter((key) => LINE_DIVISIONS[key] === undefined);
  expect(unmapped).toEqual([]);

  const bakedDivisions = new Set(Object.keys(COST_INDEX_SET.regions[0].divisions));
  for (const [key, mapping] of Object.entries(LINE_DIVISIONS)) {
    expect(bakedDivisions.has(mapping.division), `${key} maps to unbaked division ${mapping.division}`).toBe(true);
  }
});

/* ------------------------------------------------------------- purity */

test("regionalizeBudget is pure: repeatable, and it does not touch its input", () => {
  const budget = anchoredBudget();
  const before = JSON.stringify(budget);
  const first = regionalizeBudget(budget, "calgary");
  const second = regionalizeBudget(budget, "calgary");

  expect(JSON.stringify(budget)).toBe(before);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
});

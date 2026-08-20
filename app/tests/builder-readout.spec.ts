/* LF01 + LF02 — the live read-out.
 *
 * Three claims are pinned here, and each one is written so that a broken
 * version scores differently:
 *
 *   1. Editing the design moves the cost band, and the band is
 *      `createProjectBudget`'s own total — there is no second cost model in
 *      the editor.
 *   2. The readiness reading is falsifiable IN BOTH DIRECTIONS. A complete
 *      design reads review-ready (so the gate is not a constant "not ready"),
 *      and removing any one required input flips it to design-intent and names
 *      the gap. A gate that cannot fail is not a gate; a gate that cannot pass
 *      is not a reading.
 *   3. The readiness function is pure and deterministic — same inputs, deeply
 *      equal result, inputs unmutated.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import {
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  reconcileBuilderDocumentSpec,
  type BuilderDocument,
} from "@/lib/builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudget,
  type ProjectBudgetScenario,
} from "@/lib/builder/projectBudget";
import { summarizeBuildingGraph } from "@/lib/builder/graphGeometry";
import { parcelCheckApplies, readDesignReadiness, type ReadinessInput } from "@/lib/builder/readiness";
import {
  checkMeasuredFootprintAgainstParcel,
  checkSpecAgainstParcel,
  type ParcelLot,
} from "@/lib/builder/toPlan";

/** Big enough that the reference home fits with room to spare, so a failure
 *  here is a failure of the check rather than of the numbers. */
const ROOMY_LOT: ParcelLot = {
  lotWidthFt: 200,
  lotDepthFt: 250,
  frontSetbackFt: 25,
  sideSetbackFt: 15,
  rearSetbackFt: 25,
};

/** Setbacks that consume the frontage entirely — `analyseParcel` answers this
 *  with a blocking `inputs` finding rather than a silent pass. */
const IMPOSSIBLE_SETBACK_LOT: ParcelLot = {
  lotWidthFt: 40,
  lotDepthFt: 40,
  frontSetbackFt: 10,
  sideSetbackFt: 25,
  rearSetbackFt: 10,
};

/** A usable but tiny envelope: 16 × 16 ft buildable cannot hold the reference
 *  home at one storey or at two. */
const TOO_SMALL_LOT: ParcelLot = {
  lotWidthFt: 24,
  lotDepthFt: 24,
  frontSetbackFt: 4,
  sideSetbackFt: 4,
  rearSetbackFt: 4,
};

/** Every input the budget asks for, supplied. Anything less is a named gap. */
const COMPLETE_SCENARIO: ProjectBudgetScenario = {
  ...defaultProjectBudgetScenario(),
  site: "serviced-flat",
  shippingDistanceKm: 120,
};

function budgetFor(
  document: BuilderDocument,
  change: Partial<ProjectBudgetScenario> = {},
  municipality = "Foothills County",
): ProjectBudget {
  return createProjectBudget({
    document,
    scenario: { ...COMPLETE_SCENARIO, ...change },
    region: "Alberta",
    municipality,
    budgetCapCad: null,
  });
}

function widened(document: BuilderDocument, byFt: number): BuilderDocument {
  return reconcileBuilderDocumentSpec(document, {
    ...document.spec,
    volumes: document.spec.volumes.map((volume, index) =>
      index === 0 ? { ...volume, widthFt: volume.widthFt + byFt } : volume,
    ),
  });
}

function asGraph(document: BuilderDocument): BuilderDocument {
  const converted = convertBuilderDocumentToGraph(document, 0.5);
  if (!converted.ok) throw new Error(`Could not convert the fixture to graph geometry: ${converted.problem}`);
  return converted.document;
}

function withHeldDetail(document: BuilderDocument): BuilderDocument {
  return {
    ...document,
    quarantine: {
      entries: [
        {
          kind: "finish",
          reason: "Its original surface was removed by a geometry edit.",
          value: { surfaceId: "vol1-wall-n", materialId: "lime-render" },
        },
      ],
    },
  };
}

test("editing the design moves the band, and the band is createProjectBudget's own total", () => {
  const base = defaultBuilderDocument();
  const wider = widened(base, 8);

  const before = budgetFor(base);
  const after = budgetFor(wider);

  /* Determinism first, so the difference below can only be the edit. Pricing
     the same document twice must land on the same figures to the dollar. */
  expect(budgetFor(base).total).toEqual(before.total);
  expect(budgetFor(base).budgetHash).toBe(before.budgetHash);

  expect(after.designHash).not.toBe(before.designHash);
  expect(after.measures.areaSqFt).toBeGreaterThan(before.measures.areaSqFt);
  expect(after.total.low).toBeGreaterThan(before.total.low);
  expect(after.total.mid).toBeGreaterThan(before.total.mid);
  expect(after.total.high).toBeGreaterThan(before.total.high);

  /* The band the strip prints is these three keys and nothing derived from
     them — low ≤ mid ≤ high, straight off the model. */
  expect(after.total.low).toBeLessThan(after.total.mid);
  expect(after.total.mid).toBeLessThan(after.total.high);
});

test("a complete design reads review-ready, so the readiness gate can pass", () => {
  const document = defaultBuilderDocument();
  const readiness = readDesignReadiness({
    document,
    budget: budgetFor(document),
    parcelCheck: checkSpecAgainstParcel(document.spec, ROOMY_LOT),
  });

  expect(readiness.gaps).toEqual([]);
  expect(readiness.state).toBe("review-ready");
});

test("a design missing a required input cannot read review-ready", () => {
  const document = defaultBuilderDocument();
  const roomy = checkSpecAgainstParcel(document.spec, ROOMY_LOT);

  /* `names` is the missing input each case must be told about, not merely a
     gap id: the three budget cases all raise a `budget-*` gap, so matching on
     the id alone would let any one of them stand in for the other two. */
  const cases: Array<{ name: string; input: ReadinessInput; gapId: string; names: RegExp }> = [
    {
      name: "no parcel entered",
      input: { document, budget: budgetFor(document), parcelCheck: null },
      gapId: "site-parcel",
      names: /land under this home is not described/i,
    },
    {
      name: "setbacks consume the lot",
      input: {
        document,
        budget: budgetFor(document),
        parcelCheck: checkSpecAgainstParcel(document.spec, IMPOSSIBLE_SETBACK_LOT),
      },
      gapId: "parcel-inputs",
      names: /setbacks/i,
    },
    {
      name: "footprint larger than the buildable envelope",
      input: {
        document,
        budget: budgetFor(document),
        parcelCheck: checkSpecAgainstParcel(document.spec, TOO_SMALL_LOT),
      },
      gapId: "parcel-envelope",
      names: /does not fit/i,
    },
    {
      name: "site condition not assessed",
      input: { document, budget: budgetFor(document, { site: "unknown" }), parcelCheck: roomy },
      gapId: "budget-0",
      names: /slope, soil, access/i,
    },
    {
      name: "delivery distance unknown",
      input: {
        document,
        budget: budgetFor(document, { shippingDistanceKm: 0 }),
        parcelCheck: roomy,
      },
      gapId: "budget-0",
      names: /delivery distance and origin/i,
    },
    {
      name: "municipality not named",
      input: { document, budget: budgetFor(document, {}, ""), parcelCheck: roomy },
      gapId: "budget-0",
      names: /municipality/i,
    },
    {
      name: "details held for repair",
      /* The budget is the clean document's: held details do not change the
         price, they change whether the design is whole. */
      input: {
        document: withHeldDetail(document),
        budget: budgetFor(document),
        parcelCheck: roomy,
      },
      gapId: "quarantine",
      names: /held for repair/i,
    },
    {
      /* The trap this case exists to catch: after conversion, `document.spec`
         is a frozen recovery copy, so a parcel check computed from it passes
         happily while describing a home that is no longer on screen. Handing
         readiness a FITTING check must still not produce review-ready. */
      name: "planar graph geometry, with a fitting spec-derived check",
      input: {
        document: asGraph(document),
        budget: budgetFor(asGraph(document)),
        parcelCheck: roomy,
      },
      gapId: "graph-parcel-check",
      names: /legacy recovery spec/i,
    },
  ];

  const observed = cases.map((item) => {
    const readiness = readDesignReadiness(item.input);
    const named = readiness.gaps.find((gap) => gap.id === item.gapId);
    return {
      name: item.name,
      state: readiness.state,
      namesTheMissingInput: named !== undefined && item.names.test(named.need),
      /* Every gap has to name the input AND where to supply it. A gap with an
         empty address is a complaint, not an instruction. */
      everyGapIsActionable: readiness.gaps.every(
        (gap) => gap.need.trim().length > 0 && gap.where.trim().length > 0,
      ),
    };
  });

  expect(observed).toEqual(
    cases.map((item) => ({
      name: item.name,
      state: "design-intent",
      namesTheMissingInput: true,
      everyGapIsActionable: true,
    })),
  );
});

test("a graph-derived parcel check describes the design on screen", () => {
  /* EX03. A spec-derived check on a converted project is still refused — the
     case above pins that. The same project with a rectangle taken from the
     graph is the design on screen, so the graph-parcel-check gap must go. */
  const document = asGraph(defaultBuilderDocument());
  expect(document.geometry.kind).toBe("building-graph");
  if (document.geometry.kind !== "building-graph") return;
  expect(parcelCheckApplies(document)).toBe(false);
  expect(parcelCheckApplies(document, checkSpecAgainstParcel(document.spec, ROOMY_LOT))).toBe(
    false,
  );

  const summary = summarizeBuildingGraph(document.geometry.graph);
  const graphCheck = checkMeasuredFootprintAgainstParcel(
    document.spec,
    ROOMY_LOT,
    {
      widthFt: summary.bounds.widthFt,
      depthFt: summary.bounds.depthFt,
      floorAreaSqFt: summary.totalFloorAreaSqFt,
      storeys: 1,
    },
    "building-graph",
  );
  expect(graphCheck.measuredFrom).toBe("building-graph");
  expect(graphCheck.report?.fits).toBe(true);
  expect(parcelCheckApplies(document, graphCheck)).toBe(true);

  const readiness = readDesignReadiness({
    document,
    budget: budgetFor(document),
    parcelCheck: graphCheck,
  });
  expect(readiness.gaps.map((gap) => gap.id)).not.toContain("graph-parcel-check");
  expect(readiness.state).toBe("review-ready");
});

test("the readiness reading is pure and deterministic", () => {
  const document = defaultBuilderDocument();
  const input: ReadinessInput = {
    document,
    budget: budgetFor(document, { site: "unknown", shippingDistanceKm: 0 }, ""),
    parcelCheck: checkSpecAgainstParcel(document.spec, TOO_SMALL_LOT),
  };
  const untouched = JSON.stringify(input);

  const first = readDesignReadiness(input);
  const second = readDesignReadiness(input);

  expect(second).toEqual(first);
  expect(second).not.toBe(first);
  expect(JSON.stringify(input)).toBe(untouched);

  // Ids are unique, so a rendered list can key on them without collapsing rows.
  expect(new Set(first.gaps.map((gap) => gap.id)).size).toBe(first.gaps.length);
  expect(first.gaps.length).toBeGreaterThan(3);
});

/* The rejection gate the manifest calls hard: the editor's bands come from
   createProjectBudget, not from a faster copy of it. Written as a source
   search because that is the only way to catch a SECOND model being added —
   a value test would pass happily against two models that still agree. */
test("the live strip has exactly one cost source and readiness reads no clock", () => {
  const read = (relative: string): string =>
    readFileSync(path.resolve(__dirname, relative), "utf8");

  const strip = read("../components/builder/LiveReadout.tsx");
  const model = read("../lib/builder/projectBudget.ts");
  const readiness = read("../lib/builder/readiness.ts");

  /* Prove the search is live before trusting its silence: these tokens really
     do exist in the cost model, so `not.toContain` below is a real check
     rather than a spelling mistake that can never fire. */
  expect(model).toContain("buildBom");
  expect(model).toContain("FINISH_FACTORS");
  expect(model).toContain("SITE_RANGES");

  expect(strip).toContain("createProjectBudget");
  for (const parallelModel of [
    "buildBom",
    "FINISH_FACTORS",
    "DELIVERY_FACTORS",
    "SITE_RANGES",
    "@/lib/design/materials",
  ]) {
    expect(strip).not.toContain(parallelModel);
  }

  for (const impurity of ["new Date", "Date.now", "Math.random", "localStorage", "fetch("]) {
    expect(readiness).not.toContain(impurity);
  }
});

import { expect, test } from "playwright/test";

import { validateBuilderDocument } from "@/lib/builder/document";
import {
  PLAN_NUDGE_DISTANCE,
  PLAN_TEMPLATES,
  estimatePlanTemplate,
  instantiatePlanTemplate,
  paddedPlanPairs,
  planFootprintOverlapSqFt,
  planMassingDistance,
  planStructuralAxes,
  type PlanTemplate,
} from "@/lib/builder/planCatalog";
import { summarizeHome } from "@/lib/builder/geometry";
import { totalFloorAreaSqFt } from "@/lib/builder/spec";
import { modelledGlazingRatio } from "@/lib/builder/toPlan";
import { FDWR_MAX } from "@/lib/design/materials";

test("the plan library is substantial, deterministic and contains licensed open work", () => {
  // Raised from 25 when the thirty-plan Nordic glass set landed (PL01). The
  // bound is a floor, not the count — the count lives in the array.
  expect(PLAN_TEMPLATES.length).toBeGreaterThanOrEqual(55);
  expect(new Set(PLAN_TEMPLATES.map((plan) => plan.id)).size).toBe(PLAN_TEMPLATES.length);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "aura-authored").length).toBeGreaterThanOrEqual(44);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "licensed-adaptation").length).toBeGreaterThanOrEqual(3);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "public-domain-adaptation").length).toBeGreaterThanOrEqual(8);

  for (const plan of PLAN_TEMPLATES) {
    expect(plan.title.trim().length).toBeGreaterThan(0);
    expect(plan.summary.trim().length).toBeGreaterThan(0);
    expect(plan.source.url).toMatch(/^https:\/\//);
    expect(plan.source.licenseUrl).toMatch(/^https:\/\//);
    expect(plan.source.license).not.toMatch(/\bNC\b|noncommercial/i);
    expect(plan.bedrooms).toBeGreaterThanOrEqual(0);
    expect(plan.bathrooms).toBeGreaterThan(0);

    if (plan.source.kind === "licensed-adaptation") {
      expect(plan.source.attribution.trim().length).toBeGreaterThan(20);
      expect(plan.source.changes.trim().length).toBeGreaterThan(20);
      expect(plan.source.shareAlike).toBe(true);
    }

    if (plan.source.kind === "public-domain-adaptation") {
      // Public domain claimed without a stated provenance chain is exactly how
      // a catalog ships someone's copyrighted drawings — the claim must name
      // its legal basis, and attribution stays even though none is owed.
      expect(plan.source.license).toMatch(/17 USC 105|public domain|not in copyright/i);
      expect(plan.source.attribution.trim().length).toBeGreaterThan(20);
      expect(plan.source.changes.trim().length).toBeGreaterThan(20);
      expect(plan.source.shareAlike).toBe(false);
    }
  }
});

test("every plan becomes an independent, validated BuilderDocument", () => {
  for (const plan of PLAN_TEMPLATES) {
    const first = instantiatePlanTemplate(plan.id);
    const second = instantiatePlanTemplate(plan.id);

    expect(validateBuilderDocument(first).ok).toBe(true);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.spec).not.toBe(second.spec);
    expect(first.spec.name).toBe(plan.title);
    expect(totalFloorAreaSqFt(first.spec)).toBeGreaterThan(100);

    first.spec.name = "A private edit";
    expect(second.spec.name).toBe(plan.title);
  }
});

test("every plan carries a transparent Alberta materials-and-systems range", () => {
  for (const plan of PLAN_TEMPLATES) {
    const estimate = estimatePlanTemplate(plan.id);
    const document = instantiatePlanTemplate(plan.id);

    expect(estimate.currency).toBe("CAD");
    expect(estimate.jurisdiction).toBe("Alberta pilot");
    expect(estimate.areaSqFt).toBeCloseTo(totalFloorAreaSqFt(document.spec), 4);
    expect(estimate.low).toBeGreaterThan(0);
    expect(estimate.low).toBeLessThan(estimate.mid);
    expect(estimate.mid).toBeLessThan(estimate.high);
    expect(estimate.lineItems).toBeGreaterThanOrEqual(8);
    expect(estimate.assumptions.join(" ")).toMatch(/land|permit/i);
  }
});

test("steel and polycarbonate studies disclose when the range is only a proxy", () => {
  for (const id of ["fjell-cube", "lys-lantern", "lightframe-pavilion"]) {
    const estimate = estimatePlanTemplate(id) as ReturnType<typeof estimatePlanTemplate> & {
      costBasis?: { status: string; label: string; note: string };
    };

    expect(estimate.costBasis?.status).toBe("proxy");
    expect(estimate.costBasis?.label).toMatch(/proxy/i);
    expect(estimate.costBasis?.note).toMatch(/SIP|timber|steel|polycarbonate/i);
  }
});

test("a selected plan keeps its origin and cost basis through document validation", () => {
  const document = instantiatePlanTemplate("lightframe-pavilion");

  expect(document.planOrigin).toEqual({
    templateId: "lightframe-pavilion",
    templateTitle: "Lightframe Pavilion",
    costBasis: {
      status: "proxy",
      label: "Timber/SIP proxy",
      note: expect.stringMatching(/steel frame and polycarbonate packages/i),
    },
  });

  const restored = validateBuilderDocument(JSON.parse(JSON.stringify(document)));
  expect(restored.ok).toBe(true);
  if (!restored.ok) return;
  expect(restored.document.planOrigin).toEqual(document.planOrigin);
});

test("unknown plan identifiers fail instead of silently loading the reference home", () => {
  expect(() => instantiatePlanTemplate("not-a-plan")).toThrow(/Unknown Aura plan template/);
  expect(() => estimatePlanTemplate("not-a-plan")).toThrow(/Unknown Aura plan template/);
});

test("openings sit inside their walls, and the Nordic set escapes the default elevation", () => {
  for (const plan of PLAN_TEMPLATES) {
    for (const volume of plan.spec.volumes) {
      const seen = new Set<string>();
      for (const opening of volume.openings) {
        expect(seen.has(opening.id)).toBe(false);
        seen.add(opening.id);
        const run = opening.wall === "n" || opening.wall === "s" ? volume.widthFt : volume.depthFt;
        expect(opening.offsetFt).toBeGreaterThanOrEqual(0);
        expect(opening.offsetFt + opening.widthFt).toBeLessThanOrEqual(run);
        expect(opening.sillFt + opening.heightFt).toBeLessThanOrEqual(volume.wallHeightFt * volume.storeys + 0.01);
      }
    }
  }

  /* NO TWO OPENINGS MAY OCCUPY THE SAME PIECE OF WALL — IN BOTH AXES.

     Added after `bro-breezeway` shipped with a 3.6 ft glazing wall and a door
     overlapping by 0.3 ft on the same 7 ft link wall: a door set into a pane
     of glass. Every gate above was green, because they all check an opening
     against its WALL and none against its NEIGHBOUR.

     THE SECOND AXIS IS NOT OPTIONAL, and the first version of this gate got it
     wrong. Checking horizontal span alone immediately failed `massiv-clt`,
     which stacks a lower and an upper window on the same two-storey wall run —
     the same horizontal metres, ten feet apart vertically. That is a building,
     not a defect, and all six new two-storey plans do it. An opening pair is
     only in conflict when its spans overlap horizontally AND vertically. */
  for (const plan of PLAN_TEMPLATES) {
    for (const volume of plan.spec.volumes) {
      const byWall = new Map<
        string,
        { id: string; x0: number; x1: number; y0: number; y1: number }[]
      >();
      for (const opening of volume.openings) {
        const box = {
          id: opening.id,
          x0: opening.offsetFt,
          x1: opening.offsetFt + opening.widthFt,
          y0: opening.sillFt,
          y1: opening.sillFt + opening.heightFt,
        };
        byWall.set(opening.wall, [...(byWall.get(opening.wall) ?? []), box]);
      }
      byWall.forEach((boxes, wall) => {
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            /* Touching is allowed — two panes meeting on a mullion share an
               edge. Only a genuine interpenetration is a defect. */
            const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
            const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
            const conflict = overlapX > 1e-9 && overlapY > 1e-9;
            expect(
              `${plan.id}/${volume.id}/${wall} ${a.id}+${b.id}: ${conflict ? "overlap" : "clear"}`,
            ).toBe(`${plan.id}/${volume.id}/${wall} ${a.id}+${b.id}: clear`);
          }
        }
      });
    }
  }

  // The default helper mints ids `<id>-glass/-door/-east/-west`. The three
  // Nordic plans exist to be ABOUT their openings — if they ever regress to
  // the default pattern, the catalog loses the variety they were authored
  // for, and this fails.
  const defaultIds = (volumeId: string) =>
    new Set([`${volumeId}-glass`, `${volumeId}-door`, `${volumeId}-east`, `${volumeId}-west`]);
  for (const id of ["fjell-cube", "lys-lantern", "bastu-pavilion"]) {
    const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id);
    expect(plan).toBeDefined();
    const first = plan!.spec.volumes[0];
    const defaults = defaultIds(first.id);
    expect(first.openings.some((opening) => !defaults.has(opening.id))).toBe(true);
  }
});

/* ---------------------------------------------------------------------------
   THE GLAZING-DISCLOSURE GATE

   FDWR_MAX (0.22) is the NBC 9.36 PRESCRIPTIVE fenestration ceiling, not a
   legal maximum, and this builder deliberately reports `modelledGlazingRatio`
   without clamping it — Readout.tsx says in its own words that the number is
   "a comparison, not a code check". So a glass-forward plan is allowed here.

   What is not allowed is a plan that sails past the ceiling in silence. Every
   template above 0.22 must, in the `spec.notes` that survive save, share,
   export and edit: name the ceiling, state its OWN ratio to within a point of
   the geometry, name the compliance path it would take, and say what the glass
   costs in a zone 7A winter. The stated-ratio check is the part that cannot be
   satisfied by boilerplate: edit the openings and the sentence goes stale, and
   this goes red.
   ------------------------------------------------------------------------- */

/** Two records predate this gate: `fjell-cube` (29%) and `lys-lantern` (23%)
 *  were authored in the earlier Nordic square set and are over the ceiling with
 *  no disclosure. The PL01 manifest that added this gate explicitly forbade
 *  editing the existing 25 records, so they are named here rather than fixed,
 *  and named in the handoff so the orchestrator can close them. This list is
 *  a closed, documented hole — a NEW over-glazed plan is not in it and fails. */
const OVER_GLAZED_BEFORE_THIS_GATE = ["fjell-cube", "lys-lantern"] as const;

test("every plan above the prescriptive glazing ceiling discloses it in its own notes", () => {
  const over = PLAN_TEMPLATES.filter((plan) => modelledGlazingRatio(plan.spec) > FDWR_MAX);

  /* A glass-forward library with nothing over the ceiling would make this
     assertion decoration. The Nordic glass set alone puts eight plans over. */
  expect(over.length).toBeGreaterThanOrEqual(8);

  /* A stale exemption is worse than no exemption: if one of these is fixed,
     removed or redesigned under the ceiling, this fails and the list must be
     re-read rather than silently carried forward. */
  for (const id of OVER_GLAZED_BEFORE_THIS_GATE) {
    const grandfathered = PLAN_TEMPLATES.find((plan) => plan.id === id);
    expect(grandfathered, `${id} is listed as pre-existing but no longer exists`).toBeDefined();
    expect(modelledGlazingRatio(grandfathered!.spec)).toBeGreaterThan(FDWR_MAX);
  }

  const exempt = new Set<string>(OVER_GLAZED_BEFORE_THIS_GATE);
  const problems: string[] = [];
  for (const plan of over) {
    if (exempt.has(plan.id)) continue;
    const notes = plan.spec.notes;
    const actualPct = Math.round(modelledGlazingRatio(plan.spec) * 100);

    if (!/22% NBC 9\.36 prescriptive ceiling/.test(notes)) {
      problems.push(`${plan.id} (${actualPct}%): notes never name the 22% NBC 9.36 prescriptive ceiling`);
    }
    const stated = /(\d{1,3})% of the modelled wall area/.exec(notes);
    if (!stated) {
      problems.push(`${plan.id} (${actualPct}%): notes never state "N% of the modelled wall area"`);
    } else if (Math.abs(Number(stated[1]) - actualPct) > 1) {
      problems.push(`${plan.id}: notes claim ${stated[1]}% but the geometry models ${actualPct}%`);
    }
    if (!/performance path|performance model|trade-off path/i.test(notes)) {
      problems.push(`${plan.id} (${actualPct}%): notes never name a compliance path`);
    }
    if (!/heat loss|heat-loss|loses heat|overheat/i.test(notes)) {
      problems.push(`${plan.id} (${actualPct}%): notes never say what the glass costs in a cold climate`);
    }
  }
  expect(problems).toEqual([]);
});

test("no plan under the ceiling wears the over-ceiling disclosure it did not earn", () => {
  /* The mirror of the gate above. Pasting the disclosure onto a compliant plan
     would make the sentence meaningless wherever it appears. */
  const liars = PLAN_TEMPLATES.filter(
    (plan) =>
      /above the 22% NBC 9\.36 prescriptive ceiling/.test(plan.spec.notes) &&
      modelledGlazingRatio(plan.spec) <= FDWR_MAX,
  ).map((plan) => plan.id);
  expect(liars).toEqual([]);
});

test("every glazing percentage a plan states about itself tracks its own geometry", () => {
  /* Plans under the ceiling brag about being under it. That claim is a number
     too, and a number in prose rots the moment somebody drags a window. Both
     phrasings the library uses are parsed and checked against the model. */
  const patterns = [/modelled at (\d{1,3})% glazing/, /(\d{1,3})% of the modelled wall area/];
  const drifted: string[] = [];
  let claims = 0;
  for (const plan of PLAN_TEMPLATES) {
    const actualPct = Math.round(modelledGlazingRatio(plan.spec) * 100);
    for (const pattern of patterns) {
      const match = pattern.exec(plan.spec.notes);
      if (!match) continue;
      claims += 1;
      if (Math.abs(Number(match[1]) - actualPct) > 1) {
        drifted.push(`${plan.id}: notes say ${match[1]}%, geometry models ${actualPct}%`);
      }
    }
  }
  // A regex that matches nothing would pass this test on a library of lies.
  expect(claims).toBeGreaterThanOrEqual(25);
  expect(drifted).toEqual([]);
});

test("no two plans are the same building wearing a different name", () => {
  /* The failure mode a thirty-plan drop invites is a width/depth sweep with new
     titles on it. Two guards: no two plans may share a massing signature, and
     the first-volume elevations must not collapse onto a handful of patterns. */
  const massing = (plan: (typeof PLAN_TEMPLATES)[number]): string =>
    plan.spec.volumes
      .map(
        (v) =>
          `${v.widthFt}x${v.depthFt}x${v.storeys}@${v.x},${v.z},${v.rotationDeg}` +
          `/${v.roof.form}${v.roof.pitchDeg}/${v.wallHeightFt}`,
      )
      .sort()
      .join(" | ");

  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const plan of PLAN_TEMPLATES) {
    const key = massing(plan);
    const prior = seen.get(key);
    if (prior) duplicates.push(`${plan.id} is geometrically identical to ${prior}`);
    else seen.set(key, plan.id);
  }
  expect(duplicates).toEqual([]);

  const elevations = new Set(
    PLAN_TEMPLATES.map((plan) =>
      plan.spec.volumes[0].openings
        .map((o) => `${o.wall}${o.kind}${o.widthFt}x${o.heightFt}@${o.offsetFt},${o.sillFt}`)
        .sort()
        .join("|"),
    ),
  );
  expect(elevations.size).toBeGreaterThanOrEqual(50);

  /* NEITHER GUARD ABOVE IS THE RULE THIS TEST IS NAMED AFTER, and a verifier
     proved it in one line: a 56th plan that was an existing plan with `widthFt`
     14 -> 15 and everything else identical passed both. The signature check
     compares EXACT dimension strings, so one changed digit makes a new key; the
     elevation set only needs 50 distinct patterns out of 55 and has slack for
     five collisions. "Real designs, not permutations" was enforced by judgement.

     It is now enforced by measurement — see the block over `paddedPlanPairs` in
     planCatalog.ts for why the rule is CONDITIONAL rather than a distance
     threshold (a threshold that catches the clone also rejects two USDA plan
     sets). The two guards above stay: an exact clone and a collapsing elevation
     set are real defects too, and this replaces neither. */
  expect(paddedPlanPairs()).toEqual([]);
});

test("the anti-padding gate catches a plan that is another plan with one dimension nudged", () => {
  /* THE GATE'S OWN COUNTEREXAMPLE, KEPT.

     The gate above asserts an empty list, and a gate that asserts emptiness on
     a healthy library is indistinguishable from a gate that can never fire. So
     the thing it exists to reject is built here, every run, and the gate is
     required to reject it. If `paddedPlanPairs` is ever loosened into a no-op,
     this test — not a future verifier — is what says so. */
  const clone = (id: string, mutate: (plan: PlanTemplate) => void): PlanTemplate => {
    const source = PLAN_TEMPLATES.find((plan) => plan.id === id);
    expect(source, `${id} has been renamed or removed; this counterexample is stale`).toBeDefined();
    const copy = JSON.parse(JSON.stringify(source)) as PlanTemplate;
    mutate(copy);
    return copy;
  };

  /* SHAPE 1 — the verifier's own: a 14 ft wide plan re-listed at 15 ft. Its
     openings are hand-authored, so the nudge leaves the elevation untouched. */
  const nudgedAuthored = clone("glasrum-studio", (plan) => {
    plan.id = "glasrum-studio-xl";
    plan.title = "Glasrum Studio XL";
    plan.spec.volumes[0].widthFt = 15;
  });

  /* SHAPE 2 — the one an exact-string elevation check would miss. `meadow-one`
     takes the DEFAULT openings, which the volume() helper derives from width,
     so nudging 24 -> 25 silently redraws every opening on the plan. Different
     opening numbers, same building. */
  const nudgedDefault = clone("meadow-one", (plan) => {
    plan.id = "meadow-one-plus";
    plan.title = "Meadow One Plus";
    plan.spec.volumes[0].widthFt = 25;
  });

  for (const padded of [nudgedAuthored, nudgedDefault]) {
    const verdicts = paddedPlanPairs([...PLAN_TEMPLATES, padded]);
    expect(
      verdicts.map((v) => `${v.a} ~ ${v.b}`),
      `${padded.id} is an existing plan with one dimension nudged and the gate did not catch it`,
    ).toHaveLength(1);
    expect(verdicts[0].b).toBe(padded.id);
    expect(verdicts[0].structuralAxes).toEqual([]);
    expect(verdicts[0].massingDistance).toBeLessThan(PLAN_NUDGE_DISTANCE);
  }

  /* THE OTHER HALF, WHICH MATTERS JUST AS MUCH: the threshold is pinned to the
     honest library, not chosen. Across all 55 plans exactly ONE pair differs on
     no structural axis — two one-bedroom SIP gables — and the only thing
     telling them apart is 204 sq ft of floor area. That pair is what sets the
     ceiling on how strict this can get, so it is named. If a future plan drags
     these two closer than PLAN_NUDGE_DISTANCE, this goes red and the threshold
     must be re-argued rather than quietly nudged down. */
  const meadow = PLAN_TEMPLATES.find((plan) => plan.id === "meadow-one")!;
  const solstice = PLAN_TEMPLATES.find((plan) => plan.id === "solstice-cottage")!;
  expect(planStructuralAxes(meadow, solstice)).toEqual([]);
  expect(planMassingDistance(meadow, solstice)).toBeCloseTo(0.25, 4);
  expect(planMassingDistance(meadow, solstice)).toBeGreaterThan(PLAN_NUDGE_DISTANCE);

  /* WHY THE RULE IS NOT A DISTANCE THRESHOLD, asserted rather than claimed.
     These three honest pairs all sit inside the nudge radius, so only their
     structural differences acquit them — and `open-farmhouse-study ~
     smalhus-infill` is measurably CLOSER than the clone the gate just rejected.
     Any threshold tuned to catch that clone throws two federal plan sets and a
     licensed adaptation out with it. If this ever stops being true the comment
     in planCatalog.ts is wrong and the rule can be simplified. */
  for (const [a, b] of [
    ["open-farmhouse-study", "smalhus-infill"],
    ["postcard-a-frame", "lakeview-a-frame"],
    ["meadow-one", "kompakt-passiv"],
  ] as const) {
    const left = PLAN_TEMPLATES.find((plan) => plan.id === a)!;
    const right = PLAN_TEMPLATES.find((plan) => plan.id === b)!;
    expect(planMassingDistance(left, right)).toBeLessThan(PLAN_NUDGE_DISTANCE);
    expect(
      planStructuralAxes(left, right).length,
      `${a} ~ ${b} is inside the nudge radius, so only a structural difference acquits it`,
    ).toBeGreaterThan(0);
  }
  const honestFloor = planMassingDistance(
    PLAN_TEMPLATES.find((plan) => plan.id === "open-farmhouse-study")!,
    PLAN_TEMPLATES.find((plan) => plan.id === "smalhus-infill")!,
  );
  const clonedGap = planMassingDistance(
    PLAN_TEMPLATES.find((plan) => plan.id === "glasrum-studio")!,
    nudgedAuthored,
  );
  expect(
    honestFloor,
    "two honestly different plans are no longer closer than a nudged clone — a plain distance threshold may now be possible, and this rule can be simplified",
  ).toBeLessThan(clonedGap);
});

test("no plan is so large that it shrinks every thumbnail in the catalog", () => {
  /* PlanDiagram draws every card at one shared scale, CATALOG_SPAN_FT, which is
     the largest plan's bounding dimension. One oversized addition silently
     shrinks all fifty-five diagrams, so the set is held inside the span the
     library already had — `boreal-longhouse` at 44 ft. */
  const oversized: string[] = [];
  for (const plan of PLAN_TEMPLATES) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const v of plan.spec.volumes) {
      const rad = (v.rotationDeg * Math.PI) / 180;
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      const halfW = (v.widthFt * c + v.depthFt * s) / 2;
      const halfD = (v.widthFt * s + v.depthFt * c) / 2;
      minX = Math.min(minX, v.x - halfW);
      maxX = Math.max(maxX, v.x + halfW);
      minZ = Math.min(minZ, v.z - halfD);
      maxZ = Math.max(maxZ, v.z + halfD);
    }
    const span = Math.max(maxX - minX, maxZ - minZ);
    if (span > 44) oversized.push(`${plan.id} spans ${span.toFixed(1)} ft`);
  }
  expect(oversized).toEqual([]);
});

/* ---------------------------------------------------------------------------
   THE OVER-REPORT GATE

   `groundFootprintSqFt` sums volume footprints instead of unioning them, and
   geometry.ts has computed the consequence all along as `overlapAreaSqFt`,
   documented as "how much groundFootprintSqFt over-reports". Nothing outside
   the 3D readout consumed it, so three catalogue plans published a footprint —
   and a cost range priced off it — bigger than the ground they cover, to
   somebody making a budget decision.

   Redrawing them was the other option and was rejected: an L-plan whose wings
   meet at a hinge overlaps ON PURPOSE, and shrinking three records would have
   hidden the general problem instead of fixing it. The number is surfaced
   instead, and these assertions are what stop it going quiet again.
   ------------------------------------------------------------------------ */

test("a plan whose volumes overlap says how much its own footprint over-reports", () => {
  /* THE CHEAP CLIP CANNOT DRIFT FROM THE AUTHORITY. planCatalog.ts computes the
     overlap with an axis-aligned clip rather than calling summarizeHome,
     because geometry.ts imports `three` and this module is in the plan-catalogue
     client bundle. That is a real reason and also a real risk, so every plan's
     number is checked against geometry.ts's on every run. */
  const disagreements: string[] = [];
  for (const plan of PLAN_TEMPLATES) {
    const authority = summarizeHome(plan.spec).overlapAreaSqFt;
    const cheap = planFootprintOverlapSqFt(plan);
    if (Math.abs(authority - cheap) > 1e-6) {
      disagreements.push(`${plan.id}: planCatalog says ${cheap}, geometry.ts says ${authority}`);
    }
  }
  expect(disagreements).toEqual([]);

  /* The precondition that makes the cheap clip exact. A rectangle turned by a
     quarter turn is still axis-aligned; one turned by 30 degrees is not, and
     the numbers above would silently start being wrong. */
  const skewed = PLAN_TEMPLATES.flatMap((plan) =>
    plan.spec.volumes
      .filter((v) => v.rotationDeg % 90 !== 0)
      .map((v) => `${plan.id}/${v.id} is rotated ${v.rotationDeg}°`),
  );
  expect(
    skewed,
    "planCatalog.ts's overlap clip is only exact for quarter turns — upgrade it before shipping this plan",
  ).toEqual([]);

  /* THE MEASURED VALUES, PINNED. Not a "> 0" check: these three numbers are the
     size of the lie, and a plan that grew its overlap by 50% would sail through
     a presence test. Redrawing any of these is allowed — it just has to be a
     decision somebody makes on purpose, with this list re-read. */
  const overReporting = PLAN_TEMPLATES.filter((plan) => planFootprintOverlapSqFt(plan) > 0.01)
    .map((plan) => `${plan.id}: ${planFootprintOverlapSqFt(plan).toFixed(2)}`)
    .sort();
  expect(overReporting).toEqual([
    "gardstun-court: 24.00",
    "lakeside-l: 28.00",
    "wilson-court: 42.00",
  ]);

  /* Every one of them is single-storey, which is why the footprint over-report
     and the FLOOR-AREA over-report are the same number and the sentence in the
     estimate can say so. A two-storey overlapping plan would need the storey
     multiplier and would fail here first. */
  for (const id of ["gardstun-court", "lakeside-l", "wilson-court"]) {
    const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id)!;
    expect(plan.spec.volumes.every((v) => v.storeys === 1)).toBe(true);
  }
});

test("the over-report reaches the estimate a buyer reads, with the number in it", () => {
  for (const plan of PLAN_TEMPLATES) {
    const estimate = estimatePlanTemplate(plan.id);
    const overlap = planFootprintOverlapSqFt(plan);
    expect(estimate.footprintOverlapSqFt).toBeCloseTo(overlap, 6);

    const prose = estimate.assumptions.join(" ");
    if (overlap > 0.01) {
      /* The number, the corrected number, and the admission that the RANGE is
         priced off the inflated one — a footnote saying "volumes overlap" with
         no arithmetic in it is not a disclosure. */
      expect(prose, `${plan.id} over-reports by ${overlap} sq ft and never says so`).toContain(
        `${Math.round(overlap)} sq ft`,
      );
      expect(prose).toContain(`${Math.round(estimate.footprintSqFt - overlap)} sq ft`);
      expect(prose).toMatch(/over-?report|too big/i);
    } else {
      /* The mirror: a clean plan must not wear the warning. Pasting it
         everywhere would make it invisible where it is true. */
      expect(prose, `${plan.id} does not overlap but carries the over-report note`).not.toMatch(
        /volumes overlap by/i,
      );
      expect(estimate.footprintOverlapSqFt).toBe(0);
    }
  }
});

test("a proxy cost basis names what the Alberta BOM is not modelling", () => {
  const proxies = PLAN_TEMPLATES.filter((plan) => plan.costBasis?.status === "proxy");
  expect(proxies.length).toBeGreaterThanOrEqual(5);
  for (const plan of proxies) {
    expect(plan.costBasis!.label).toMatch(/proxy/i);
    // A proxy that does not say what it is a proxy FOR is just a label.
    expect(plan.costBasis!.note.trim().length).toBeGreaterThan(60);
    expect(plan.costBasis!.note).toMatch(/quote|supplier|advisor|engineering/i);
  }
});

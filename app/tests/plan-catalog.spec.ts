import { expect, test } from "playwright/test";

import { validateBuilderDocument } from "@/lib/builder/document";
import {
  PLAN_NUDGE_DISTANCE,
  PLAN_TEMPLATES,
  estimatePlanTemplate,
  instantiatePlanTemplate,
  loftFromSleeping,
  paddedPlanPairs,
  planFootprintOverlapSqFt,
  planLoft,
  planMassingDistance,
  planStructuralAxes,
  sleepingFacts,
  type PlanTemplate,
} from "@/lib/builder/planCatalog";
import { summarizeHome } from "@/lib/builder/geometry";
import { glazedAreaSqFt, totalFloorAreaSqFt, type HomeSpec } from "@/lib/builder/spec";
import { modelledGlazingRatio, planFromSpec } from "@/lib/builder/toPlan";
import { FDWR_MAX } from "@/lib/design/materials";
import { formatFeetInches } from "@/lib/units";

test("the plan library is substantial, deterministic and contains licensed open work", () => {
  // Raised from 25 when the thirty-plan Nordic glass set landed (PL01), from
  // 55 to 72 when PL03's seventeen landed, and from 72 to 87 when PL04's
  // fifteen glass plans mounted. The bound is a floor, not the count — the
  // count lives in the array. A floor left behind the library stops
  // discriminating, which is why it moves with each wave rather than being
  // treated as permanent.
  expect(PLAN_TEMPLATES.length).toBeGreaterThanOrEqual(87);
  expect(new Set(PLAN_TEMPLATES.map((plan) => plan.id)).size).toBe(PLAN_TEMPLATES.length);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "aura-authored").length).toBeGreaterThanOrEqual(61);
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
     assertion decoration. The Nordic glass set alone put eight plans over;
     PL03 added five more (vertikal-tower, atriumgard, dobbelgavl-bar,
     solvegg-house, skygge-veranda) on top of the two grandfathered records,
     so the floor moves 8 -> 15. Renegotiated rather than left at 8: a floor
     that the library has already doubled past cannot fail on a regression. */
  expect(over.length).toBeGreaterThanOrEqual(15);

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
  // 25 was PL01's floor; every one of PL03's seventeen states its own ratio
  // too, so the floor moves to 42 and the regex cannot quietly stop matching.
  expect(claims).toBeGreaterThanOrEqual(42);
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
  /* 50 was the floor at 55 plans (five collisions of slack). At 72 the library
     measures 71 distinct first-volume elevations, so the floor moves to 65 —
     still with slack, but slack that scales with the library instead of
     becoming free room to paste elevations into. */
  expect(elevations.size).toBeGreaterThanOrEqual(65);

  /* NEITHER GUARD ABOVE IS THE RULE THIS TEST IS NAMED AFTER, and a verifier
     proved it in one line: a 56th plan that was an existing plan with `widthFt`
     14 -> 15 and everything else identical passed both. The signature check
     compares EXACT dimension strings, so one changed digit makes a new key; the
     elevation set only needs 50 distinct patterns out of 55 and has slack for
     five collisions. "Real designs, not permutations" was enforced by judgement.

     It is now enforced by measurement — see the block over `paddedPlanPairs` in
     planCatalog.ts for why the rule is STRUCTURAL rather than a distance
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

  /* SHAPE 3 — the same trick aimed at PL03's wave rather than PL01's, because
     a counterexample that only ever clones a two-year-old record stops testing
     the library people are actually adding to. `dobbelgavl-bar` re-listed one
     foot wider: hand-authored elevation, so nothing about it changes. */
  const nudgedNewWave = clone("dobbelgavl-bar", (plan) => {
    plan.id = "dobbelgavl-bar-wide";
    plan.title = "Dobbelgavl Wide";
    plan.spec.volumes[0].widthFt = 19;
  });

  for (const padded of [nudgedAuthored, nudgedDefault, nudgedNewWave]) {
    const verdicts = paddedPlanPairs([...PLAN_TEMPLATES, padded]);
    expect(
      verdicts.map((v) => `${v.a} ~ ${v.b}`),
      `${padded.id} is an existing plan with one dimension nudged and the gate did not catch it`,
    ).toHaveLength(1);
    expect(verdicts[0].b).toBe(padded.id);
    expect(verdicts[0].structuralAxes).toEqual([]);
    expect(verdicts[0].massingDistance).toBeLessThan(PLAN_NUDGE_DISTANCE);
  }

  /* SHAPE 4 — THE ONE THE OLD RULE COULD NOT CATCH, AND THE REASON THE RULE
     CHANGED. The gate used to require BOTH a near-identical massing and no
     structural difference, so a clone escaped simply by being padded harder:
     get further than PLAN_NUDGE_DISTANCE from your twin and the structural
     test was never reached. `meadow-one` re-listed at 36 × 42 — half again in
     both plan dimensions, nothing else touched — is that escape, and its
     distance is asserted to be OVER the old threshold so this counterexample
     cannot pass by accident under a rule that still consulted distance. */
  const paddedHarder = clone("meadow-one", (plan) => {
    plan.id = "meadow-one-grand";
    plan.title = "Meadow One Grand";
    plan.spec.volumes[0].widthFt = 36;
    plan.spec.volumes[0].depthFt = 42;
  });
  const grandVerdicts = paddedPlanPairs([...PLAN_TEMPLATES, paddedHarder]);
  expect(
    grandVerdicts.map((v) => `${v.a} ~ ${v.b}`),
    "meadow-one-grand is meadow-one at half again in both plan dimensions with nothing else changed, and the gate did not catch it",
  ).toEqual(["meadow-one ~ meadow-one-grand"]);
  expect(grandVerdicts[0].structuralAxes).toEqual([]);
  expect(
    grandVerdicts[0].massingDistance,
    "this clone is supposed to be FAR from its twin — if it is inside the nudge radius it is testing the same thing shapes 1 to 3 already test",
  ).toBeGreaterThan(PLAN_NUDGE_DISTANCE);

  /* THE OTHER HALF, WHICH MATTERS JUST AS MUCH: the library itself has to be
     clean under the strict rule, not merely under the one that let distance
     acquit. It was not, and this is what the pins record.

     `meadow-one`, `solstice-cottage` and `jordhus-berm` were three
     one-bedroom SIP gables sharing an elevation string and a programme, all
     three acquitted by distance alone. Two of them were the SIGNATURE not
     looking: `jordhus-berm`'s only openings above its earth berm are two vents
     7.5 ft up, and the elevation axis recorded nothing but "window on the east
     wall". It records a sill BAND now, and the band is what acquits it —
     asserted here, because an acquittal nobody checks is how the last version
     of this rule went quiet. The third was the real defect and was fixed in
     the catalogue: `solstice-cottage` now carries the south-collecting
     elevation its own summary describes instead of the library default. */
  const meadow = PLAN_TEMPLATES.find((plan) => plan.id === "meadow-one")!;
  const solstice = PLAN_TEMPLATES.find((plan) => plan.id === "solstice-cottage")!;
  const jordhus = PLAN_TEMPLATES.find((plan) => plan.id === "jordhus-berm")!;
  for (const [left, right] of [
    [meadow, solstice],
    [meadow, jordhus],
    [solstice, jordhus],
  ] as const) {
    expect(
      planStructuralAxes(left, right),
      `${left.id} ~ ${right.id} used to differ on no structural axis and was acquitted by distance alone`,
    ).toContain("elevation");
  }

  /* AND THE SILL BAND IS WHAT DOES IT for the bermed plan, not something else
     that happens to differ. Drop its vents to a normal window sill and the
     elevation axis goes silent — which is the state this gate shipped in. */
  const flattened = clone("jordhus-berm", (plan) => {
    plan.id = "jordhus-berm-flat";
    for (const opening of plan.spec.volumes[0].openings) {
      if (opening.id.startsWith("vent-")) opening.sillFt = 3;
    }
  });
  expect(
    planStructuralAxes(meadow, flattened),
    "jordhus-berm is acquitted by something other than where its openings sit, so the sill band is not the thing doing the work this comment credits it with",
  ).toEqual([]);

  /* The 0.25 that used to be this rule's calibration floor, kept as a
     measurement: meadow-one and solstice-cottage are still the widest-apart
     pair the library ever had with nothing structural between them, and they
     are still far outside the nudge radius. Neither fact acquits them any
     more, which is the point. */
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

  /* PL02 — the loft is a field. Appending one character to the sleeping
     sentence used to acquit a clone on the programme axis. It must not. */
  const proseClone = clone("glasrum-studio", (plan) => {
    plan.id = "glasrum-studio-guests";
    plan.title = "Glasrum Studio Guests";
    plan.spec.volumes[0].widthFt = 15;
    plan.sleeping = `${plan.sleeping}s`;
  });
  expect(planLoft(proseClone)).toBe(planLoft(PLAN_TEMPLATES.find((plan) => plan.id === "glasrum-studio")!));
  const proseVerdicts = paddedPlanPairs([...PLAN_TEMPLATES, proseClone]);
  expect(
    proseVerdicts.map((v) => `${v.a} ~ ${v.b}`),
    "a spelling change in the sleeping sentence acquitted a nudged clone",
  ).toEqual(["glasrum-studio ~ glasrum-studio-guests"]);

  const postcard = PLAN_TEMPLATES.find((plan) => plan.id === "postcard-a-frame")!;
  const lakeview = PLAN_TEMPLATES.find((plan) => plan.id === "lakeview-a-frame")!;
  const ridge = PLAN_TEMPLATES.find((plan) => plan.id === "ridge-a-frame")!;
  const libertiny = PLAN_TEMPLATES.find((plan) => plan.id === "libertiny-study")!;
  const bunkhouse = PLAN_TEMPLATES.find((plan) => plan.id === "bunkhouse-loft")!;
  expect(planLoft(postcard)).toBe("none");
  expect(planLoft(lakeview)).toBe("unmodelled");
  expect(loftFromSleeping(lakeview.sleeping)).toBe("unmodelled");
  expect(sleepingFacts(postcard).enclosed).toBe(false);
  expect(sleepingFacts(ridge).enclosed).toBe(true);
  expect(sleepingFacts(libertiny).loftRole).toBe("primary");
  expect(sleepingFacts(bunkhouse).loftRole).toBe("dormitory");
  expect(planStructuralAxes(postcard, lakeview)).toContain("programme");
  expect(planStructuralAxes(ridge, postcard)).toContain("programme");
  expect(planStructuralAxes(libertiny, bunkhouse)).toContain("programme");
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

/* ---------------------------------------------------------------------------
   PL03's GATES — the four claims this wave makes that a reader could not check

   Everything below exists because a claim was about to be written in prose. The
   repo's own history is the argument: two recent waves shipped sentences that
   nothing checked and both were false, and this wave found two more of the same
   kind while building the measurement (`beltsville-farmhouse` published an area
   four square feet off its own geometry, and `kompakt-passiv` claimed a
   superlative that is false under both readings of it). Neither was caught by
   reading. Both are now caught by arithmetic.
   ------------------------------------------------------------------------- */

test("the area printed on every card is the area the geometry actually models", () => {
  /* Every kicker in the library opens with "N sq ft". That number is the first
     thing a buyer reads and, until PL03, nothing compared it to the model —
     `beltsville-farmhouse` said 1,292 against a 26×38 + 14×22 envelope that is
     1,296, and had said so since it was authored.

     There is no exemption list here on purpose. A published area is either the
     model's area or it is wrong, and one grandfathered record would make the
     next one easy. */
  const drifted: string[] = [];
  let checked = 0;
  for (const plan of PLAN_TEMPLATES) {
    const match = /^([\d,]+)\s*sq ft/.exec(plan.kicker);
    if (!match) {
      drifted.push(`${plan.id}: kicker does not open with an area — "${plan.kicker}"`);
      continue;
    }
    checked += 1;
    const stated = Number(match[1].replace(/,/g, ""));
    const actual = Math.round(totalFloorAreaSqFt(plan.spec));
    if (stated !== actual) drifted.push(`${plan.id}: card says ${stated} sq ft, geometry models ${actual}`);
  }
  expect(drifted).toEqual([]);
  // A regex that stopped matching would pass an empty list. Every plan is read.
  expect(checked).toBe(PLAN_TEMPLATES.length);
});

test("no plan claims more glass than its own geometry draws", () => {
  /* Notes talk in square feet of glass as well as in percentages, and a square
     footage rots exactly the way a percentage does.

     THE PROPERTY IS PINNED IN TWO STRENGTHS, DELIBERATELY. Two PL01 notes
     ("221 sq ft of glass" on vinterhage-house, "252 sq ft" on vann-edge)
     describe ONE PART of the building — the sunspace, the three south bays —
     and prose cannot tell a test which part. Forcing them to equal the whole
     house's glazing would fail two honest sentences, so the universal rule is
     the bound that must hold either way (you cannot claim more glass than the
     model draws), and the exact rule is pinned by id for the notes that mean
     the whole house. Weaker property, named, rather than a gate that rejects
     honest work — the same trade `programme`'s `sleeping` field records. */
  const WHOLE_HOUSE_CLAIMS = ["midtglass-longhouse", "skogsrom-cabin"] as const;
  const problems: string[] = [];
  let claims = 0;
  for (const plan of PLAN_TEMPLATES) {
    const match = /([\d,]+) sq ft of glass/.exec(plan.spec.notes);
    if (!match) continue;
    claims += 1;
    const stated = Number(match[1].replace(/,/g, ""));
    const actual = Math.round(glazedAreaSqFt(plan.spec));
    if (stated > actual) {
      problems.push(`${plan.id}: notes claim ${stated} sq ft of glass, the model draws ${actual}`);
    }
    if ((WHOLE_HOUSE_CLAIMS as readonly string[]).includes(plan.id) && stated !== actual) {
      problems.push(`${plan.id}: its claim is about the whole house, so ${stated} must equal ${actual}`);
    }
  }
  expect(problems).toEqual([]);
  expect(claims).toBeGreaterThanOrEqual(4);
  for (const id of WHOLE_HOUSE_CLAIMS) {
    const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id)!;
    expect(plan.spec.notes, `${id} is pinned as a whole-house glass claim but no longer makes one`).toMatch(
      /\d[\d,]* sq ft of glass/,
    );
  }
});

/** Exterior wall per square foot of FLOOR — the quantity two notes now argue
 *  about. Perimeter is counted once per volume regardless of storeys, because
 *  a two-storey wall is two storeys of the same perimeter. */
const wallPerFloorFt = (plan: PlanTemplate): number =>
  plan.spec.volumes.reduce((sum, v) => sum + 2 * (v.widthFt + v.depthFt), 0) / totalFloorAreaSqFt(plan.spec);

test("the two plans that argue about exterior wall are both telling the truth", () => {
  /* `atriumgard` says no plan over 400 sq ft carries more exterior wall per
     square foot of floor; `kompakt-passiv` says the courtyard carries a little
     over twice what it does. Both are checked here, and the first one is
     deliberately NOT the superlative it wanted to be: `libertiny-study`, a
     165 sq ft towable, beats it at 0.341, because a tiny house always wins
     this measure. Claiming the crown outright would have been the third false
     comparative this repo shipped this month — the measurement was built
     first, and the sentence was written to it. */
  const atrium = PLAN_TEMPLATES.find((plan) => plan.id === "atriumgard")!;
  const kompakt = PLAN_TEMPLATES.find((plan) => plan.id === "kompakt-passiv")!;

  const bigger = PLAN_TEMPLATES.filter(
    (plan) => totalFloorAreaSqFt(plan.spec) > 400 && wallPerFloorFt(plan) > wallPerFloorFt(atrium) + 1e-9,
  ).map((plan) => `${plan.id} (${wallPerFloorFt(plan).toFixed(3)})`);
  expect(bigger, "atriumgard's notes claim nothing over 400 sq ft carries more exterior wall").toEqual([]);
  expect(atrium.spec.notes).toMatch(/over 400 sq ft carries more exterior wall per square foot/);

  /* The only plan in the whole library that beats it, pinned by name: if it
     ever stops beating atriumgard the claim above can be strengthened to a
     plain superlative, and this is what says so. */
  const winners = PLAN_TEMPLATES.filter(
    (plan) => wallPerFloorFt(plan) > wallPerFloorFt(atrium),
  ).map((plan) => plan.id).sort();
  expect(winners).toEqual(["libertiny-study"]);
  expect(totalFloorAreaSqFt(PLAN_TEMPLATES.find((plan) => plan.id === "libertiny-study")!.spec)).toBeLessThan(400);

  const multiple = wallPerFloorFt(atrium) / wallPerFloorFt(kompakt);
  expect(multiple).toBeGreaterThan(2);
  expect(multiple).toBeLessThan(2.2);
  expect(kompakt.spec.notes).toMatch(/a little over twice as much exterior wall per square foot of floor/);
  expect(atrium.spec.notes).toMatch(/a little over twice what the near-square Kompakt Passiv carries/);

  /* And the sentence kompakt-passiv used to carry, kept as a counterexample so
     nobody restores it: it claimed the least exterior wall per square foot of
     anything in the library, and it is beaten on both readings. */
  const beatsKompaktOnFloor = PLAN_TEMPLATES.filter((plan) => wallPerFloorFt(plan) < wallPerFloorFt(kompakt));
  expect(beatsKompaktOnFloor.length).toBeGreaterThan(0);
  const perFootprint = (plan: PlanTemplate): number =>
    plan.spec.volumes.reduce((sum, v) => sum + 2 * (v.widthFt + v.depthFt), 0) /
    plan.spec.volumes.reduce((sum, v) => sum + v.widthFt * v.depthFt, 0);
  expect(PLAN_TEMPLATES.filter((plan) => perFootprint(plan) < perFootprint(kompakt)).length).toBeGreaterThan(0);
  expect(kompakt.spec.notes).not.toMatch(/least exterior wall per square foot of anything/);
});

test("a plan whose shading strategy is its eave carries the eave the engine draws", () => {
  /* THE FIELD THAT WAS A CONSTANT. All 55 plans before PL03 used a 1.5 ft
     overhang, so "budget for an overhang" was advice the library could not
     take. `skygge-veranda` takes it, and three things have to be true at once
     or the deep eave is decoration:

       1. geometry.ts must actually draw a bigger roof (not just store a bigger
          number), measured against the SAME spec at the default overhang;
       2. the drawing note a buyer reads must print the real depth, not 1.5;
       3. the shading arithmetic the note states must follow from the plan's own
          overhang and the solar geometry it cites.

     The third is hand arithmetic and the note says so: this codebase has no
     sun-path model, so the altitudes below come from latitude and axial tilt,
     which is exactly what the note claims and all it claims. */
  const deep = PLAN_TEMPLATES.filter((plan) => plan.spec.volumes.some((v) => v.roof.overhangFt !== 1.5));
  expect(deep.map((plan) => plan.id)).toEqual(["skygge-veranda"]);

  const plan = deep[0];
  const volume = plan.spec.volumes[0];
  expect(volume.roof.overhangFt).toBe(4);

  // 1. the roof geometry moves with the field.
  const shallow: HomeSpec = JSON.parse(JSON.stringify(plan.spec));
  shallow.volumes[0].roof.overhangFt = 1.5;
  const deepBounds = summarizeHome(plan.spec).boundsWithRoof;
  const shallowBounds = summarizeHome(shallow).boundsWithRoof;
  expect(deepBounds.maxX - deepBounds.minX - (shallowBounds.maxX - shallowBounds.minX)).toBeCloseTo(
    2 * (4 - 1.5),
    6,
  );

  // 2. the handoff note prints the real depth rather than the library default.
  const roofNote = planFromSpec(plan.spec).notes.find((note) => note.figures?.some((f) => f.sub?.includes("overhang")));
  expect(roofNote, "planFromSpec no longer emits a roof note with an overhang figure").toBeDefined();
  const subs = (roofNote!.figures ?? []).map((f) => f.sub ?? "").join(" | ");
  expect(subs).toContain(`${formatFeetInches(4)} overhang`);
  expect(subs).not.toContain(`${formatFeetInches(1.5)} overhang`);

  // 3. the arithmetic in the sentence follows from the plan's own overhang.
  const LATITUDE_DEG = 53.5; // Edmonton, the pilot city named throughout this app
  const OBLIQUITY_DEG = 23.44;
  const tanAt = (altitudeDeg: number) => Math.tan((altitudeDeg * Math.PI) / 180);
  const summerNoon = 90 - LATITUDE_DEG + OBLIQUITY_DEG;
  const winterNoon = 90 - LATITUDE_DEG - OBLIQUITY_DEG;
  expect(Math.round(summerNoon)).toBe(60);
  expect(Math.round(winterNoon)).toBe(13);
  const summerShade = volume.roof.overhangFt * tanAt(summerNoon);
  const winterShade = volume.roof.overhangFt * tanAt(winterNoon);

  const stated = /roughly ([\d.]+) ft of shade[\s\S]*?about ([\d.]+) ft at midwinter/.exec(plan.spec.notes);
  expect(stated, "skygge-veranda's notes no longer state both shade depths in the shape this gate reads").not.toBeNull();
  expect(Math.abs(Number(stated![1]) - summerShade)).toBeLessThan(0.1);
  expect(Math.abs(Number(stated![2]) - winterShade)).toBeLessThan(0.1);
  // The claim is only interesting if the shade covers most of the glazing.
  const glazing = volume.openings.find((o) => o.id === "glass-s")!;
  expect(summerShade).toBeGreaterThan(glazing.heightFt * 0.7);
  expect(winterShade).toBeLessThan(glazing.heightFt * 0.15);
  expect(plan.spec.notes).toMatch(/no sun-path model/);
});

test("the plan drawn to a panel grid is actually on the grid, and the grid means something", () => {
  /* `modulhus` sells one idea: every opening begins and ends on a two-foot line
     so no header crosses a CLT panel joint. That is a claim about numbers, so
     it is checked as one — and it is checked to be DISCRIMINATING as well as
     true, because a property every plan satisfies is not a design decision. */
  const onGrid = (plan: PlanTemplate): boolean =>
    plan.spec.volumes.every((v) =>
      v.openings.every((o) => Math.abs(o.offsetFt % 2) < 1e-9 && Math.abs(o.widthFt % 2) < 1e-9),
    );

  const modul = PLAN_TEMPLATES.find((plan) => plan.id === "modulhus")!;
  const offGrid = modul.spec.volumes.flatMap((v) =>
    v.openings
      .filter((o) => Math.abs(o.offsetFt % 2) > 1e-9 || Math.abs(o.widthFt % 2) > 1e-9)
      .map((o) => `${o.id} at ${o.offsetFt} × ${o.widthFt}`),
  );
  expect(offGrid, "modulhus claims every opening lands on a 2 ft line").toEqual([]);
  expect(modul.spec.notes).toMatch(/begins and ends on a two-foot line/);
  expect(modul.spec.material).toBe("clt");

  /* MEASURED, NOT GUESSED: today this is exactly ZERO — modulhus is the only
     plan in 72 whose every opening lands on the grid, which is what makes the
     discipline a decision rather than a coincidence. The bound is set at 3 so
     two future plans may land on it by accident without failing an unrelated
     wave, and if a third does, the claim has stopped meaning anything. */
  const others = PLAN_TEMPLATES.filter((plan) => plan.id !== "modulhus" && onGrid(plan));
  expect(
    others.length,
    `${others.map((p) => p.id).join(", ")} also sit entirely on the 2 ft grid — modulhus's discipline is no longer a distinguishing decision`,
  ).toBeLessThan(3);
});

test("a courtyard's roofs fall away from its court, in the data and in the drawing", () => {
  /* `facing` was never overridden anywhere in the library before PL03: every
     shed faced south because that is geometry.ts's default. atriumgard's whole
     snow argument depends on four roofs falling OUTWARD, so the direction is
     derived from each bar's position relative to the court rather than trusted
     as a literal, and then checked to have reached the drawing note. */
  const atrium = PLAN_TEMPLATES.find((plan) => plan.id === "atriumgard")!;
  const wrong: string[] = [];
  for (const v of atrium.spec.volumes) {
    // The bar's outward direction is simply where it sits relative to the court
    // centre, which for this plan is the origin.
    const outward =
      Math.abs(v.x) > Math.abs(v.z) ? (v.x > 0 ? "e" : "w") : v.z > 0 ? "s" : "n";
    if (v.roof.facing !== outward) wrong.push(`${v.id} sits ${outward} of the court but its roof faces ${v.roof.facing}`);
  }
  expect(wrong).toEqual([]);
  expect(new Set(atrium.spec.volumes.map((v) => v.roof.facing)).size).toBe(4);
  expect(atrium.spec.notes).toMatch(/fall AWAY from the court/);

  const subs = (planFromSpec(atrium.spec).notes.flatMap((note) => note.figures ?? []))
    .map((f) => f.sub ?? "")
    .join(" | ");
  for (const facing of ["N", "S", "E", "W"]) expect(subs).toContain(`facing ${facing}`);
});

test("every square-foot figure a feature bullet prints is a real dimension of that plan", () => {
  /* Five plans put an area in their feature list — "48 sq ft glazed bay",
     "264 sq ft sheltered court". Those are the same class of claim as a kicker
     and rot the same way, so they are resolved against the geometry: a volume's
     footprint, the plan's total floor area, or — for the one figure that is a
     VOID rather than a volume — the court the four bars leave between them. */
  const courtSqFt = (plan: PlanTemplate): number => {
    const rect = (v: (typeof plan.spec.volumes)[number]) => ({
      x0: v.x - v.widthFt / 2, x1: v.x + v.widthFt / 2, z0: v.z - v.depthFt / 2, z1: v.z + v.depthFt / 2,
    });
    const rects = plan.spec.volumes.map(rect);
    const west = Math.max(...rects.filter((r) => r.x1 <= 0).map((r) => r.x1));
    const east = Math.min(...rects.filter((r) => r.x0 >= 0).map((r) => r.x0));
    const north = Math.max(...rects.filter((r) => r.z1 <= 0).map((r) => r.z1));
    const south = Math.min(...rects.filter((r) => r.z0 >= 0).map((r) => r.z0));
    return (east - west) * (south - north);
  };

  const unresolved: string[] = [];
  let claims = 0;
  for (const plan of PLAN_TEMPLATES) {
    for (const feature of plan.features) {
      const match = /(\d[\d,]*) sq ft/.exec(feature);
      if (!match) continue;
      claims += 1;
      const stated = Number(match[1].replace(/,/g, ""));
      const footprints = plan.spec.volumes.map((v) => v.widthFt * v.depthFt);
      const court = plan.id === "atriumgard" ? [courtSqFt(plan)] : [];
      const allowed = [...footprints, Math.round(totalFloorAreaSqFt(plan.spec)), ...court];
      if (!allowed.some((value) => Math.abs(value - stated) < 0.5)) {
        unresolved.push(`${plan.id}: "${feature}" matches no volume footprint (${footprints.join(", ")}) or court`);
      }
    }
  }
  expect(unresolved).toEqual([]);
  // The five that exist today. A regex that stopped matching would pass empty.
  expect(claims).toBe(5);
  expect(Math.round(courtSqFt(PLAN_TEMPLATES.find((plan) => plan.id === "atriumgard")!))).toBe(264);
});

test("the library reaches four bedrooms, and says so only where it is true", () => {
  /* Diversity is a claim too. `familie-fire` calls itself the first
     four-bedroom plan in the library; before it, three was the ceiling. */
  const four = PLAN_TEMPLATES.filter((plan) => plan.bedrooms >= 4);
  expect(four.map((plan) => plan.id)).toEqual(["familie-fire"]);
  expect(Math.max(...PLAN_TEMPLATES.filter((plan) => plan.bedrooms < 4).map((plan) => plan.bedrooms))).toBe(3);
  expect(four[0].summary).toMatch(/first four-bedroom plan in the library/);
  // The pavilion the summary sells is the size the features claim.
  const pavilion = four[0].spec.volumes.find((v) => v.id === "pavilion")!;
  expect(pavilion.widthFt * pavilion.depthFt).toBe(192);
  expect(four[0].features.join(" ")).toContain("192 sq ft");
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

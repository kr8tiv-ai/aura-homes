import { expect, test } from "playwright/test";

import { builderDocumentFromLegacySpec, validateBuilderDocument } from "@/lib/builder/document";
import {
  PLAN_TEMPLATES,
  paddedPlanPairs,
  planFootprintOverlapSqFt,
  type PlanTemplate,
} from "@/lib/builder/planCatalog";
import { GLASS_PLAN_TEMPLATES } from "@/lib/builder/planCatalog.glass";
import { buildHome, wallRunFt } from "@/lib/builder/geometry";
import { glazedAreaSqFt, totalFloorAreaSqFt, type Volume, type Wall } from "@/lib/builder/spec";
import { modelledGlazingRatio, modelledWallAreaSqFt } from "@/lib/builder/toPlan";
import { FDWR_MAX, WALL_THICKNESS_MM } from "@/lib/design/materials";

/* ===========================================================================
   WHAT THIS FILE IS FOR

   tests/plan-catalog.spec.ts already holds every library-wide rule — kickers
   against geometry, opening containment, the padding gate, the 44 ft span, the
   overlap pin, the exact-equality lists. None of that is restated here.

   This file asserts what is true of THE GLASS SET SPECIFICALLY, and it leads
   with the two defect classes the library-wide gates structurally cannot see:

     1. THE SILENT TRIM. plan-catalog.spec.ts:139 checks an opening against
        `wallHeightFt * storeys` and knows nothing about roof form. A flat
        roof's 2-degree fall plus ROOF_SEAT_FT eat up to 1.5 ft off the low
        wall, and geometry.ts responds by CLIPPING the glass and pushing a
        viewport warning — never by failing. A whole set of flat-roof plans can
        therefore be green everywhere and still build trimmed glass.

     2. THE BURIED WALL AND THE CROSSED SLAB. `summarizeHome` reports
        wall-footprint overlap only. Two volumes placed closer than the sum of
        their eaves interpenetrate in silence, and an opening drawn on a wall
        another volume stands against is drawn into a face nobody can see.
        Nothing in the repo reports either.

   Both oracles are proven to discriminate below before they are trusted.
   =========================================================================== */

const SET = GLASS_PLAN_TEMPLATES;
const wallThicknessFt = (material: string): number =>
  (WALL_THICKNESS_MM as Record<string, number>)[material] / 304.8;

/** Which plan axis a wall runs along, mirroring geometry.ts's WALL_RUN_AXIS. */
const RUN_AXIS: Readonly<Record<Wall, "x" | "z">> = { n: "x", s: "x", e: "z", w: "z" };
const OPPOSITE: Readonly<Record<Wall, Wall>> = { n: "s", s: "n", e: "w", w: "e" };

const FALL = Math.tan((2 * Math.PI) / 180); // geometry.ts FLAT_ROOF_FALL_DEG
const SEAT = 0.15; // geometry.ts ROOF_SEAT_FT
const EDGE = 0.02; // geometry.ts OPENING_EDGE_CLEAR_FT

/**
 * The head height an opening on `wall` can actually reach once geometry.ts has
 * seated the wall under its own roof and clipped the hole off the outline.
 *
 * Mirrors buildRoofModel + wallTopPoints + placeOpenings. A wall that crosses
 * the fall axis gets a level top seated at the LOWER of the roof heights over
 * its own thickness; a wall that runs along the fall axis rakes, and the LOW
 * corner is what an ordinary rectangular opening has to fit under.
 */
function seatedHeadFt(v: Volume, wall: Wall, thicknessFt: number): number {
  const head = v.wallHeightFt * v.storeys;
  const facing = v.roof.facing ?? "s";
  const fallAxis: "x" | "z" = RUN_AXIS[facing] === "x" ? "z" : "x";
  const fallRun = fallAxis === "x" ? v.widthFt : v.depthFt;
  const runsAlongFall = RUN_AXIS[wall] === fallAxis;

  if (v.roof.form === "flat") {
    const oh = v.roof.overhangFt;
    if (runsAlongFall) return head - (fallRun + oh - thicknessFt) * FALL - SEAT - EDGE;
    return wall === OPPOSITE[facing]
      ? head - (oh + thicknessFt) * FALL - SEAT - EDGE // the HIGH wall
      : head - (fallRun + oh) * FALL - SEAT - EDGE; // the LOW wall
  }

  // shed: the apex sits flush with the high wall; ridgeHeightFt derives the
  // rise from widthFt while the model spreads it across the fall run.
  const ridge = head + v.widthFt * Math.tan((v.roof.pitchDeg * Math.PI) / 180);
  const slope = (ridge - head) / fallRun;
  if (runsAlongFall) return head - SEAT - EDGE;
  return wall === OPPOSITE[facing] ? ridge - thicknessFt * slope - SEAT - EDGE : head - SEAT - EDGE;
}

/** Every opening in a plan whose top sits within `clearance` of the seated head. */
function trimRisks(plan: PlanTemplate, clearance: number): string[] {
  const t = wallThicknessFt(plan.spec.material);
  const out: string[] = [];
  for (const v of plan.spec.volumes) {
    for (const o of v.openings) {
      const margin = seatedHeadFt(v, o.wall, t) - (o.sillFt + o.heightFt);
      if (margin < clearance) {
        out.push(`${plan.id}/${v.id}/${o.id}: ${margin.toFixed(3)} ft under the seated head on the ${o.wall} wall`);
      }
    }
  }
  return out;
}

/* WHAT THIS GATE IS CALLED, AND WHAT IT ACTUALLY ENFORCES.

   It used to be called "no plan in the glass set builds glass the roof will
   silently trim", which oversold it. It does not predict a trim. It enforces an
   AUTHORING CLEARANCE: every opening's head sits at least 0.25 ft below the
   height geometry.ts seats for that particular wall. At the mutated value the
   real engine does not trim either — the margin is spent, not crossed — so this
   is conservative in the right direction and the name now says which direction.
   The 0.25 ft is a drawing tolerance, not a physical threshold. */
test("every opening in the glass set is authored a quarter foot clear of its seated head", () => {
  /* THE ORACLE FIRST. A gate that cannot fail is not a gate, so the same
     measurement is run against a deliberately over-tall opening and has to
     report it. `horisont-pavilion`'s south wall is the low side of its fall,
     with 10.29 ft of seated head against an 11 ft wall — the exact case
     plan-catalog.spec.ts waves through. */
  const horisont = SET.find((plan) => plan.id === "horisont-pavilion")!;
  const overtall: PlanTemplate = JSON.parse(JSON.stringify(horisont));
  overtall.spec.volumes[0].openings.find((o) => o.id === "glass-s")!.heightFt = 10.9;
  expect(
    trimRisks(overtall, 0).length,
    "the seated-head oracle no longer reports an opening taller than the roof lets it be",
  ).toBeGreaterThan(0);
  expect(overtall.spec.volumes[0].openings[0].sillFt + 10.9).toBeLessThanOrEqual(
    overtall.spec.volumes[0].wallHeightFt * overtall.spec.volumes[0].storeys + 0.01,
  ); // and plan-catalog.spec.ts's rule would still pass it

  /* THE SET. Authored 0.25 ft clear of the seated head, per wall rather than
     per volume, because the high wall and the low wall of one flat roof differ
     by up to a foot and a half. */
  const risks = SET.flatMap((plan) => trimRisks(plan, 0.25));
  expect(risks).toEqual([]);
});

/* The gate above and the one below are a MIRROR of geometry.ts, re-derived in
   this file so it can be read. A mirror can drift. This one asks the engine
   itself, which is the only thing that actually cuts the holes, and it is here
   because four plans in this set had their geometry redrawn for orientation
   after the mirrors were written. `buildHome` never fails — it clips the glass
   and pushes a string — so the strings are the assertion. */
test("the real engine draws every plan in the glass set with no warning at all", () => {
  const warned = SET.flatMap((plan) => buildHome(plan.spec).warnings.map((w) => `${plan.id}: ${w}`));
  expect(warned).toEqual([]);

  /* The oracle. `buildHome` reports a trim rather than refusing one, so the
     same call has to produce a string when the glass is genuinely too tall. */
  const horisont: PlanTemplate = JSON.parse(JSON.stringify(SET.find((p) => p.id === "horisont-pavilion")!));
  horisont.spec.volumes[0].openings.find((o) => o.id === "glass-s")!.heightFt = 10.9;
  expect(buildHome(horisont.spec).warnings.join(" ")).toMatch(/glass-s/);
});

test("every roof in the glass set is flat or shed, and every shed draws the pitch it states", () => {
  const wrongForm = SET.flatMap((plan) =>
    plan.spec.volumes
      .filter((v) => v.roof.form !== "flat" && v.roof.form !== "shed")
      .map((v) => `${plan.id}/${v.id} is a ${v.roof.form}`),
  );
  expect(wrongForm).toEqual([]);

  /* THE SHED TRAP. spec.ts:211 computes a shed's rise from `widthFt`;
     geometry.ts:781 spreads that rise across the FALL axis. The two agree only
     when the fall runs across the width, which is to say only when `facing` is
     e or w. A shed that falls north-south draws a slope its own prose cannot
     state — and no gate anywhere reports it, because the ridge and the model
     are each internally consistent. */
  const misdrawn: string[] = [];
  for (const plan of SET) {
    for (const v of plan.spec.volumes) {
      if (v.roof.form !== "shed") continue;
      const facing = v.roof.facing ?? "s";
      const fallRun = RUN_AXIS[facing] === "x" ? v.depthFt : v.widthFt;
      const drawnDeg = (Math.atan((v.widthFt * Math.tan((v.roof.pitchDeg * Math.PI) / 180)) / fallRun) * 180) / Math.PI;
      if (Math.abs(drawnDeg - v.roof.pitchDeg) > 1e-9) {
        misdrawn.push(`${plan.id}/${v.id}: states ${v.roof.pitchDeg}° and draws ${drawnDeg.toFixed(1)}°`);
      }
    }
  }
  expect(misdrawn).toEqual([]);
  // and the set really does contain sheds, so the rule above measures something
  expect(SET.filter((plan) => plan.spec.volumes.some((v) => v.roof.form === "shed")).length).toBeGreaterThan(0);
});

/* Half a foot, and the reason it exists rather than the reason it is 0.5.
   Two plans used to sit EXACTLY on the thresholds below — `arbeidsgard-house`
   stepped 2.5 ft against a `< 2.5` flag and `lysrekke-house`'s lantern gap was
   3.5 against a threshold of exactly 3.5. Both were physically sound and both
   were one half-foot edit from being defects, with nothing in the suite saying
   so. A gate a plan sits exactly on reports nothing about the next edit. */
const GATE_MARGIN_FT = 0.5;

test("no volume in the glass set buries a neighbour's opening or crosses its roof slab", () => {
  const problems: string[] = [];
  const tight: string[] = [];
  for (const plan of SET) {
    const vs = plan.spec.volumes;
    for (let i = 0; i < vs.length; i++) {
      for (let j = i + 1; j < vs.length; j++) {
        const a = vs[i];
        const b = vs[j];
        const gapX = Math.max(a.x - a.widthFt / 2, b.x - b.widthFt / 2) - Math.min(a.x + a.widthFt / 2, b.x + b.widthFt / 2);
        const gapZ = Math.max(a.z - a.depthFt / 2, b.z - b.depthFt / 2) - Math.min(a.z + a.depthFt / 2, b.z + b.depthFt / 2);
        const gap = Math.max(gapX, gapZ);
        const headA = a.wallHeightFt * a.storeys;
        const headB = b.wallHeightFt * b.storeys;

        /* EITHER the eaves clear each other, OR the lower roof is buried deep
           enough inside the taller wall that the two slabs cannot read as
           crossing. `summarizeHome` reports neither case. */
        const eaveClear = a.roof.overhangFt + b.roof.overhangFt + 0.5;
        const step = Math.abs(headA - headB);
        if (gap < eaveClear && step < 2.5) {
          problems.push(
            `${plan.id}: ${a.id} and ${b.id} sit ${gap.toFixed(2)} ft apart with a ${step.toFixed(2)} ft height step — their ${a.roof.overhangFt} ft eaves interpenetrate`,
          );
        }
        /* AND NEITHER RULE IS ALLOWED TO BE THE ONE IT PASSES BY NOTHING. */
        if (gap < eaveClear + GATE_MARGIN_FT && step < 2.5 + GATE_MARGIN_FT) {
          tight.push(
            `${plan.id}: ${a.id} and ${b.id} clear the eave rule by ${(gap - eaveClear).toFixed(2)} ft and the step rule by ${(step - 2.5).toFixed(2)} ft — neither by the ${GATE_MARGIN_FT} ft this suite requires`,
          );
        }

        if (Math.abs(gap) > 1e-9) continue; // not abutting; nothing is buried

        // Which wall of each faces the other, and how much of it is covered.
        const alongX = Math.abs(gapZ) < 1e-9 ? false : true;
        const wallOf = (self: Volume, other: Volume): Wall =>
          alongX ? (self.x < other.x ? "e" : "w") : self.z < other.z ? "s" : "n";
        for (const [self, other] of [
          [a, b],
          [b, a],
        ] as const) {
          const wall = wallOf(self, other);
          const parapet = other.wallHeightFt * other.storeys + 0.5;
          const len = RUN_AXIS[wall] === "x" ? self.widthFt : self.depthFt;
          const c = RUN_AXIS[wall] === "x" ? self.x : self.z;
          const oc = RUN_AXIS[wall] === "x" ? other.x : other.z;
          const oLen = RUN_AXIS[wall] === "x" ? other.widthFt : other.depthFt;
          const lo = Math.max(c - len / 2, oc - oLen / 2);
          const hi = Math.min(c + len / 2, oc + oLen / 2);
          if (hi <= lo) continue;
          /* `offsetFt` runs from one end of the wall and geometry.ts owns which
             end, so a covered strip is checked under BOTH mappings — an opening
             that is only safe under one reading is not safe. */
          const strips: [number, number][] = [
            [lo - (c - len / 2), hi - (c - len / 2)],
            [len - (hi - (c - len / 2)), len - (lo - (c - len / 2))],
          ];
          for (const o of self.openings) {
            if (o.wall !== wall || o.sillFt >= parapet - 1e-9) continue;
            for (const [s, e] of strips) {
              const overlap = Math.min(o.offsetFt + o.widthFt, e) - Math.max(o.offsetFt, s);
              if (overlap > 1e-9) {
                problems.push(`${plan.id}/${self.id}/${o.id}: sits on the ${wall} wall behind ${other.id}`);
                break;
              }
              if (overlap > -GATE_MARGIN_FT) {
                tight.push(
                  `${plan.id}/${self.id}/${o.id}: clears the strip ${other.id} covers by ${(-overlap).toFixed(2)} ft, less than the ${GATE_MARGIN_FT} ft this suite requires`,
                );
              }
            }
          }
        }
      }
    }
  }
  expect(problems).toEqual([]);
  expect(tight).toEqual([]);

  /* The oracle. Sliding one of `lysrekke-house`'s lanterns until its eave meets
     its neighbour's is exactly the silent defect this rule exists for. */
  const lysrekke = SET.find((plan) => plan.id === "lysrekke-house")!;
  const boxes = lysrekke.spec.volumes.filter((v) => v.id.startsWith("box-"));
  expect(boxes.length).toBe(3);
  const centre = boxes.find((v) => v.id === "box-c")!;
  const west = boxes.find((v) => v.id === "box-w")!;
  const clear = Math.abs(centre.x - west.x) - (centre.widthFt + west.widthFt) / 2;
  expect(clear).toBeGreaterThanOrEqual(centre.roof.overhangFt + west.roof.overhangFt + 0.5 + GATE_MARGIN_FT);
  expect(centre.wallHeightFt).toBe(west.wallHeightFt); // so only the gap saves them
});

test("no two plans in the glass set are the same building, and none collides with the library", () => {
  /* The padding machinery is exported and takes an arbitrary plans array, so it
     is reused rather than restated. Both directions matter: the set against
     itself, and the set against the 72 records it is about to be concatenated
     onto. */
  expect(paddedPlanPairs(SET)).toEqual([]);
  /* PLAN_TEMPLATES already concatenates the glass set. Comparing the merged
     array to SET a second time would report every glass plan as a clone of
     itself. The library-wide pair check is the real collision gate. */
  expect(paddedPlanPairs(PLAN_TEMPLATES)).toEqual([]);

  const massing = (plan: PlanTemplate): string =>
    plan.spec.volumes
      .map(
        (v) =>
          `${v.widthFt}x${v.depthFt}x${v.storeys}@${v.x},${v.z},${v.rotationDeg}` +
          `/${v.roof.form}${v.roof.pitchDeg}/${v.wallHeightFt}`,
      )
      .sort()
      .join(" | ");
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const plan of PLAN_TEMPLATES) {
    const prior = seen.get(massing(plan));
    if (prior) clashes.push(`${plan.id} is geometrically identical to ${prior}`);
    else seen.set(massing(plan), plan.id);
  }
  expect(clashes).toEqual([]);

  const libraryIds = PLAN_TEMPLATES.map((plan) => plan.id);
  expect(SET.map((plan) => plan.id).every((id) => libraryIds.includes(id))).toBe(true);
  expect(new Set(libraryIds).size).toBe(libraryIds.length);

  /* Every plan here authors its own elevation. The `volume()` default pattern
     is what collapses the padding gate's elevation axis, and it is the reason
     this module's helper does not have one. */
  const defaulted = SET.flatMap((plan) =>
    plan.spec.volumes
      .filter((v) =>
        v.openings.every((o) =>
          [`${v.id}-glass`, `${v.id}-door`, `${v.id}-east`, `${v.id}-west`].includes(o.id),
        ),
      )
      .map((v) => `${plan.id}/${v.id}`),
  );
  expect(defaulted).toEqual([]);
});

test("the glass set raises the library's glass share, computed from both modules", () => {
  const share = (plans: readonly PlanTemplate[]): number =>
    plans.reduce((sum, plan) => sum + glazedAreaSqFt(plan.spec), 0) /
    plans.reduce((sum, plan) => sum + modelledWallAreaSqFt(plan.spec), 0);

  const core = PLAN_TEMPLATES.filter((plan) => !SET.some((glass) => glass.id === plan.id));
  const before = share(core);
  const set = share(SET);
  const after = share(PLAN_TEMPLATES);

  expect(
    set,
    `the glass set models ${(set * 100).toFixed(2)}% glazing against the library's ${(before * 100).toFixed(2)}% — it does not raise the share`,
  ).toBeGreaterThan(before);
  expect(after).toBeGreaterThan(before);

  /* And it raises the FLAT-ROOF share, which is the other half of the ask. The
     numbers come from the arrays; nothing here is written down twice. */
  const flatVolumes = (plans: readonly PlanTemplate[]) =>
    plans.flatMap((plan) => plan.spec.volumes).filter((v) => v.roof.form === "flat").length;
  const allVolumes = (plans: readonly PlanTemplate[]) => plans.flatMap((plan) => plan.spec.volumes).length;
  const flatBefore = flatVolumes(core) / allVolumes(core);
  const flatAfter = flatVolumes(PLAN_TEMPLATES) / allVolumes(PLAN_TEMPLATES);
  expect(flatAfter).toBeGreaterThan(flatBefore);

  /* THE COMPOSITION CLAIM THE MODULE HEADER MAKES. A wave of fifteen
     over-reference glass boxes would pass every gate in the repo and still be
     dishonest, so the set is required to carry real counterweights: a majority
     under the prescriptive reference, and a floor well below it. */
  const over = SET.filter((plan) => modelledGlazingRatio(plan.spec) > FDWR_MAX);
  expect(over.length).toBeGreaterThan(0);
  expect(over.length).toBeLessThan(SET.length / 2);
  expect(Math.min(...SET.map((plan) => modelledGlazingRatio(plan.spec)))).toBeLessThan(0.16);
});

test("every glass-set plan over the prescriptive reference discloses its own number", () => {
  /* plan-catalog.spec.ts runs this library-wide with a two-record exemption
     list. Here there is no exemption list at all, and the disclosed number is
     re-derived from the geometry rather than read from a table. */
  const problems: string[] = [];
  for (const plan of SET) {
    const ratio = modelledGlazingRatio(plan.spec);
    const pct = Math.round(ratio * 100);
    const notes = plan.spec.notes;
    const overCeiling = /above the 22% NBC 9\.36 prescriptive ceiling/.test(notes);

    if (ratio > FDWR_MAX) {
      if (!overCeiling) problems.push(`${plan.id} (${pct}%): never says it is above the ceiling`);
      const stated = /(\d{1,3})% of the modelled wall area/.exec(notes);
      if (!stated) problems.push(`${plan.id} (${pct}%): never states "N% of the modelled wall area"`);
      else if (Number(stated[1]) !== pct) {
        problems.push(`${plan.id}: notes claim ${stated[1]}% and the geometry models ${pct}%`);
      }
      if (!/performance path|performance model|trade-off path/i.test(notes)) {
        problems.push(`${plan.id} (${pct}%): names no compliance route`);
      }
      if (!/heat loss|heat-loss|loses heat|overheat/i.test(notes)) {
        problems.push(`${plan.id} (${pct}%): never says what the glass costs in a 7A winter`);
      }
    } else {
      if (overCeiling) problems.push(`${plan.id} (${pct}%): wears a disclosure it did not earn`);
      const stated = /modelled at (\d{1,3})% glazing/.exec(notes);
      if (!stated) problems.push(`${plan.id} (${pct}%): never states its own glazing figure`);
      else if (Number(stated[1]) !== pct) {
        problems.push(`${plan.id}: notes claim ${stated[1]}% and the geometry models ${pct}%`);
      }
      /* Landing between 22.0 and 22.5 forces a plan to state "22%" while being
         over the reference, which reads as sitting exactly on it. */
      expect(ratio, `${plan.id} rounds to 22% while being under the reference`).toBeLessThan(0.219);
    }
  }
  expect(problems).toEqual([]);

  /* The oracle: the disclosed number is checked EXACTLY, not to within a point,
     so nudging one pane by a foot has to move it. */
  const langsikt = SET.find((plan) => plan.id === "langsikt-pavilion")!;
  const nudged: PlanTemplate = JSON.parse(JSON.stringify(langsikt));
  nudged.spec.volumes[0].openings.find((o) => o.id === "glass-sw")!.widthFt = 10;
  expect(Math.round(modelledGlazingRatio(nudged.spec) * 100)).not.toBe(
    Math.round(modelledGlazingRatio(langsikt.spec) * 100),
  );
});

/* ===========================================================================
   THE COMPASS-DISCLOSURE GATE

   THE DEFECT IT EXISTS FOR. `modelledGlazingRatio` is orientation-blind: it
   divides glass by wall and cannot tell a south wall from a north one. Three
   plans in the first draft of this set therefore sat politely under, or over
   with disclosure, the prescriptive reference while spending their glazing
   budget on the faces that give nothing back at 53.5 degrees north, and none of
   them used a compass word about it. `tyngdegard-house` put 41% of its glass on
   north walls including a 118.5 sq ft glazing wall, `lysrekke-house` put two
   45 sq ft full-height panes on east and west bedroom faces, and
   `snofang-clerestory` argued 28% on clerestory gain when 63% of the clerestory
   was north. Every gate in the repo was green.

   THE THRESHOLD, AND WHY IT IS THIS NUMBER. An even four-way split puts 25% of
   a plan's glass on each face. Every plan in this wave argues that it is
   south-led, so a face carrying more than HALF an even share — 12.5% — is a
   composition decision rather than a bathroom window, and the reader is owed
   the compass word. Against the set as drawn this fires on nine faces across
   seven plans and stays quiet on the small stuff: 12.2% on `snofang`'s two ends
   and 12.3% on `terskel`'s north are under it, and both are disclosed anyway.

   WHAT IT CHECKS AND WHAT IT DOES NOT. It checks that the compass word appears
   in the plan's own features or notes, in a sentence that is also about
   openings. It does NOT check that the sentence is true, or that it is about
   THAT glass — a plan could satisfy it with an irrelevant sentence naming the
   right direction. It is a disclosure gate, not a comprehension gate.
   =========================================================================== */

const COMPASS_DISCLOSURE_SHARE = 0.125;
const COMPASS_NAME: Readonly<Record<Wall, string>> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
};

/** Glazed area (doors excluded, exactly as `glazedAreaSqFt` counts) per face. */
function glazedByWall(plan: PlanTemplate): Record<Wall, number> {
  const out: Record<Wall, number> = { n: 0, s: 0, e: 0, w: 0 };
  for (const v of plan.spec.volumes) {
    for (const o of v.openings) {
      if (o.kind === "door") continue;
      out[o.wall] += o.widthFt * o.heightFt;
    }
  }
  return out;
}

/**
 * The three places in this module where a compass word is not a wall: the site
 * latitude, the summer-sun azimuth, and a hyphenated diagonal. Left in, each
 * one would let a plan pass by writing "53.5 degrees north" and nothing else.
 */
const scrubCompass = (text: string): string =>
  text
    .replace(/[\d.]+\s*degrees\s+(north|south|east|west)/gi, "«latitude»")
    .replace(/(north|south)\s+of\s+(east|west)/gi, "«azimuth»")
    .replace(/\b(north|south)-(east|west)\b/gi, "«diagonal»");

const OPENING_WORD =
  /glass|glazing|glazed|window|pane|opening|clerestory|band|slot|screen|lantern|riser|daylight|light|sill/i;

/** Does this plan name `wall` in a sentence about its openings? */
function namesCompass(plan: PlanTemplate, wall: Wall): boolean {
  const word = new RegExp(`\\b${COMPASS_NAME[wall]}\\b`, "i");
  const units = [...plan.features, ...plan.spec.notes.split(/(?<=[.!?])\s+/)];
  return units.some((unit) => {
    const clean = scrubCompass(unit);
    return word.test(clean) && OPENING_WORD.test(clean);
  });
}

function compassSilences(plans: readonly PlanTemplate[]): string[] {
  const out: string[] = [];
  for (const plan of plans) {
    const byWall = glazedByWall(plan);
    const total = Object.values(byWall).reduce((s, a) => s + a, 0);
    for (const wall of ["n", "e", "w"] as const) {
      const share = byWall[wall] / total;
      if (share <= COMPASS_DISCLOSURE_SHARE) continue;
      if (namesCompass(plan, wall)) continue;
      out.push(
        `${plan.id}: ${byWall[wall].toFixed(1)} sq ft — ${(share * 100).toFixed(1)}% of its glass — is on ${COMPASS_NAME[wall]} walls, and neither its features nor its notes say "${COMPASS_NAME[wall]}" in a sentence about openings`,
      );
    }
  }
  return out;
}

test("every glass-set plan names the compass faces its glass is actually on", () => {
  expect(compassSilences(SET)).toEqual([]);

  /* THE ORACLE, WHICH IS THE SHIPPED DEFECT PUT BACK. `tyngdegard-house`'s low
     bar stands south of the slot, so its slot-facing wall is its north one. The
     first draft hung the plan's largest pane there and called the slot faces
     "sheltered" without ever writing the word north. Restore both halves — the
     pane and the silence — and the gate has to report it. */
  const tyngdegard: PlanTemplate = JSON.parse(
    JSON.stringify(SET.find((plan) => plan.id === "tyngdegard-house")!),
  );
  const low = tyngdegard.spec.volumes.find((v) => v.id === "low")!;
  const pane = low.openings.find((o) => o.id === "glass-s")!;
  pane.wall = "n";
  pane.heightFt = 7.9;
  low.openings.filter((o) => o.id.startsWith("win-n")).forEach((o) => (o.wall = "s"));
  tyngdegard.spec.notes = tyngdegard.spec.notes.replace(
    /Holding the ratio to 21%[\s\S]*?The 450 mm wall/,
    "Holding the ratio to 21% and putting roughly three quarters of the glass on the two sheltered faces is how a heavy wall stays defensible here. The 450 mm wall",
  );
  tyngdegard.features = ["Two bars, twelve feet apart", "Glass held to the sheltered faces", "Punched openings outward"];
  const restored = compassSilences([tyngdegard]);
  expect(restored.length, "the compass gate no longer reports tyngdegard's undisclosed north glazing wall").toBe(1);
  expect(restored[0]).toContain("north walls");

  /* And it discriminates the other way: a plan that DOES name the direction is
     not reported, so the rule is measuring disclosure and not just area. */
  const disclosed: PlanTemplate = JSON.parse(JSON.stringify(tyngdegard));
  disclosed.features = [...disclosed.features, "Largest north window in the wave"];
  expect(compassSilences([disclosed])).toEqual([]);
});

/* ===========================================================================
   THE COUNTABLE-CLAIM GATE

   TWO SHIPPED CLAIMS WERE WRONG BY COUNTING. `tyngdegard-house` said "five
   punched windows across two buildings" where the geometry had eight, and
   `ramme-pavilion` said "six proportions" where six windows sized 7×7, 4×4,
   3×9, 5×6, 2.5×8 and 4×2.5 give six sizes but only five proportions, because
   two of them are square.

   A GENERAL RULE IS NOT TRACTABLE, AND THIS FILE WILL NOT PRETEND OTHERWISE.
   The blocker is scope, not parsing. "one small window between them" in
   `soylegang-pavilion` is a claim about one wall; "three glazing walls in all"
   is a claim about a plan; "two clerestories over the hall" is a claim about
   one volume. Prose does not carry its own scope in a form a regex recovers, so
   a plan-wide count of "windows" would fail on true sentences and a scoped one
   would need the scope written down — which is what the pin table below is.

   So this gate is two things stacked, and only the first is general:
     1. A GENERAL rule for "N glazing walls". That phrase is used in this module
        only for a plan's whole complement, it is the phrase that carries the
        cost-basis argument, and it therefore has an unambiguous scope. A new
        plan writing "Four glazing walls" is checked without anybody adding it
        here.
     2. A FIXED LIST of scoped claims, each with the computation that decides
        it. This list cannot catch a claim nobody added to it. That is its
        honest limit, and the coverage assertion under it at least guarantees
        every pin still points at prose that exists.
   =========================================================================== */

const NUMBER_WORD: Readonly<Record<string, number>> = {
  both: 2,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/* A number word, then up to three ALPHABETIC modifiers, then the noun.
   TWO DELIBERATE NARROWINGS, both of which this rule needed:
     · The modifiers are alphabetic, which keeps "Two 6 ft 6 in openings" — a
       dimension, not a count of the plan's openings — from reading as a claim.
     · The separators are spaces and tabs, never a newline. `proseOf` joins the
       record's fields with newlines, and an earlier version of this regex read
       the end of one feature bullet and the start of the next as one phrase
       ("six sizes\nNo glazing walls"). A claim does not span two fields. */
const GLAZING_WALL_CLAIM = new RegExp(
  `\\b(${Object.keys(NUMBER_WORD).join("|")})\\b(?!-)((?:[ \\t]+[a-zà-ÿ][a-zà-ÿ-]*){0,3})[ \\t]+glazing[ \\t]+walls?\\b`,
  "gi",
);

const proseOf = (plan: PlanTemplate): string =>
  [
    plan.title,
    plan.kicker,
    plan.summary,
    plan.bestFor,
    plan.sleeping,
    ...plan.tags,
    ...plan.features,
    plan.costBasis?.label ?? "",
    plan.costBasis?.note ?? "",
    plan.spec.notes,
  ].join("\n");

const openingsOf = (plan: PlanTemplate) => plan.spec.volumes.flatMap((v) => v.openings);
const windowsOf = (plan: PlanTemplate) => openingsOf(plan).filter((o) => o.kind === "window");
const glazingWallsOf = (plan: PlanTemplate) => openingsOf(plan).filter((o) => o.kind === "glazing-wall");

interface PinnedClaim {
  plan: string;
  /** Matched literally against the plan's prose; the coverage rule below fails
   *  if it stops matching, so a pin cannot quietly stop pointing at anything. */
  phrase: RegExp;
  claimed: number;
  actual: (plan: PlanTemplate) => number;
  what: string;
}

const PINNED_CLAIMS: PinnedClaim[] = [
  {
    plan: "ramme-pavilion",
    phrase: /six framed windows/i,
    claimed: 6,
    actual: (p) => windowsOf(p).length,
    what: "windows in the plan",
  },
  {
    plan: "ramme-pavilion",
    phrase: /six (different )?sizes/i,
    claimed: 6,
    actual: (p) => new Set(windowsOf(p).map((o) => `${o.widthFt}x${o.heightFt}`)).size,
    what: "distinct window sizes",
  },
  {
    plan: "soylegang-pavilion",
    phrase: /[Ff]ive (narrow )?full-height (glass )?bays/,
    claimed: 5,
    actual: (p) => glazingWallsOf(p).length,
    what: "full-height bays",
  },
  {
    plan: "terskel-pavilion",
    phrase: /Two thresholds/,
    claimed: 2,
    actual: (p) => glazingWallsOf(p).length,
    what: "floor-level thresholds",
  },
  {
    plan: "snofang-clerestory",
    phrase: /High band on three walls/,
    claimed: 3,
    actual: (p) => new Set(openingsOf(p).filter((o) => o.sillFt >= 7).map((o) => o.wall)).size,
    what: "walls carrying a high band",
  },
  {
    plan: "stabel-house",
    phrase: /four openings on the two-storey mass/,
    claimed: 4,
    actual: (p) =>
      p.spec.volumes.find((v) => v.id === "mass")!.openings.filter((o) => o.wall === "n" && o.kind === "window").length,
    what: "north windows on the two-storey mass",
  },
  {
    plan: "tyngdegard-house",
    phrase: /across five punched windows/,
    claimed: 5,
    actual: (p) => windowsOf(p).filter((o) => o.wall === "n").length,
    what: "north punched windows",
  },
  {
    plan: "tyngdegard-house",
    phrase: /ten punched windows in all/,
    claimed: 10,
    actual: (p) => windowsOf(p).length,
    what: "punched windows across both bars",
  },
  {
    plan: "tredelt-pavilion",
    phrase: /57 sq ft across four openings/,
    claimed: 4,
    actual: (p) => openingsOf(p).filter((o) => o.wall === "n" && o.kind !== "door").length,
    what: "north openings",
  },
  {
    plan: "tredelt-pavilion",
    phrase: /three roofs in a line/,
    claimed: 3,
    actual: (p) => p.spec.volumes.length,
    what: "roofs in a line",
  },
  {
    plan: "trappelys-terrace",
    phrase: /Three planes, two risers/,
    claimed: 3,
    actual: (p) => p.spec.volumes.length,
    what: "roof planes",
  },
  {
    plan: "trappelys-terrace",
    phrase: /Three planes, two risers/,
    claimed: 2,
    actual: (p) => p.spec.volumes.length - 1,
    what: "risers between planes",
  },
  {
    plan: "lysrekke-house",
    phrase: /Three identical lanterns/,
    claimed: 3,
    actual: (p) => p.spec.volumes.filter((v) => v.id.startsWith("box-")).length,
    what: "lanterns",
  },
  {
    plan: "lysrekke-house",
    phrase: /Three identical lanterns/,
    claimed: 1,
    actual: (p) =>
      new Set(
        p.spec.volumes
          .filter((v) => v.id.startsWith("box-"))
          .map((v) =>
            `${v.widthFt}x${v.depthFt}x${v.wallHeightFt}/` +
            v.openings
              .map((o) => `${o.wall}${o.kind}${o.widthFt}x${o.heightFt}@${o.offsetFt},${o.sillFt}`)
              .sort()
              .join("|"),
          ),
      ).size,
    what: "distinct lantern designs — 'identical' means one",
  },
];

test("no countable claim in the glass set is refuted by the geometry", () => {
  const wrong: string[] = [];

  // 1. The general rule.
  for (const plan of SET) {
    const actual = glazingWallsOf(plan).length;
    for (const match of Array.from(proseOf(plan).matchAll(GLAZING_WALL_CLAIM))) {
      const claimed = NUMBER_WORD[match[1].toLowerCase()];
      if (claimed !== actual) {
        wrong.push(`${plan.id}: prose says "${match[0].trim()}" and the spec has ${actual}`);
      }
    }
  }

  // 2. The fixed list.
  for (const pin of PINNED_CLAIMS) {
    const plan = SET.find((p) => p.id === pin.plan)!;
    expect(proseOf(plan), `${pin.plan}: the pinned phrase ${pin.phrase} is no longer in the prose`).toMatch(pin.phrase);
    const actual = pin.actual(plan);
    if (actual !== pin.claimed) {
      wrong.push(`${pin.plan}: prose claims ${pin.claimed} ${pin.what} and the spec has ${actual}`);
    }
  }
  expect(wrong).toEqual([]);

  /* THE ORACLE, on both halves. The general rule has to notice a glazing wall
     appearing without the sentence changing, and a pin has to notice its own
     count moving. Neither is checked against a copy of itself. */
  const stabel: PlanTemplate = JSON.parse(JSON.stringify(SET.find((p) => p.id === "stabel-house")!));
  expect(stabel.costBasis!.note).toMatch(/Three glazing walls/);
  stabel.spec.volumes[1].openings.push({
    id: "glass-n-extra",
    wall: "n",
    kind: "glazing-wall",
    widthFt: 4,
    heightFt: 8,
    offsetFt: 0,
    sillFt: 0,
  });
  expect(glazingWallsOf(stabel)).toHaveLength(4);
  expect(
    Array.from(proseOf(stabel).matchAll(GLAZING_WALL_CLAIM)).some((m) => NUMBER_WORD[m[1].toLowerCase()] !== 4),
  ).toBe(true);

  const ramme: PlanTemplate = JSON.parse(JSON.stringify(SET.find((p) => p.id === "ramme-pavilion")!));
  const sizePin = PINNED_CLAIMS.find((p) => p.what === "distinct window sizes")!;
  expect(sizePin.actual(ramme)).toBe(6);
  // Make the 4×4 square match the 7×7 in proportion but not in size — the pin
  // is on SIZES, so this must still read 6; making it a duplicate size must not.
  ramme.spec.volumes[0].openings.find((o) => o.id === "frame-s2")!.widthFt = 7;
  ramme.spec.volumes[0].openings.find((o) => o.id === "frame-s2")!.heightFt = 7;
  expect(sizePin.actual(ramme)).toBe(5);
});

/* The repo's own history is the argument: three shipped superlatives were false
   and nothing was reading the prose. `proseOf` reads all of it — the card copy,
   the tags, the features, the cost basis and the notes that survive save, share
   and export. Module scope so the proper-noun test below can prove it is not
   the thing that caught the planted name. */
const BANNED: [RegExp, string][] = [
  [/code[- ]compliant|meets code|complies with the code|to code\b/i, "claims code compliance"],
  [/\bcertified\b|certification|passivhaus|passive house|net[- ]zero ready/i, "claims a certification"],
  [/maximum allowed|legal maximum|permitted maximum/i, "reads FDWR_MAX as a legal limit"],
  [
    /(we|this plan|the model) (model(s|led)?|calculat(es|ed)|simulat(es|ed)) (the )?(annual )?(energy|heat loss|solar gain|daylight)/i,
    "claims a computed energy result",
  ],
  [/kwh\/m|daylight autonomy|energy use intensity|\bEUI\b|heating load of/i, "quotes a performance result"],
  /* A DENYLIST, SAID PLAINLY. This row catches the nine names somebody thought
     of. It cannot catch a tenth, and its oracle below only proves that a
     sentence assembled from these same nine patterns matches these nine
     patterns, which is circular. It is kept as a fast, cheap net and NOT as the
     real defence — the real defence is the proper-noun rule in the test after
     this one, which fails on a name nobody listed. */
  [
    /farnsworth|glass house|villa mairea|muuratsalo|fogo island|villa savoye|case study house|shobac|tula house|linear house/i,
    "carries a real building's name (denylist hit)",
  ],
  [/reproduction of|based on the plans of|a copy of the|traced from/i, "claims to reproduce a third-party design"],
];

test("no glass-set plan claims a certification, a computed result, or somebody's building", () => {
  const offences: string[] = [];
  for (const plan of SET) {
    const prose = proseOf(plan);
    for (const [pattern, what] of BANNED) {
      if (pattern.test(prose)) offences.push(`${plan.id}: ${what}`);
    }
  }
  expect(offences).toEqual([]);

  /* The oracle. Every pattern above has to be able to fire, or this test is a
     regex that stopped matching. */
  const sample =
    "This plan is code compliant, certified passivhaus, sits at the maximum allowed glazing, " +
    "the model calculates the annual heat loss at 42 kWh/m, and it is a reproduction of Farnsworth.";
  expect(BANNED.filter(([pattern]) => pattern.test(sample)).length).toBe(BANNED.length);

  // Provenance: these are Aura originals and the schema has no slot for anything else.
  for (const plan of SET) {
    expect(plan.source.kind).toBe("aura-authored");
    expect(plan.source.license).toBe("MIT");
    expect(plan.source.shareAlike).toBe(false);
    expect(plan.source.changes).toBe("No third-party plan geometry was copied.");
  }
});

/* ===========================================================================
   THE PROPER-NOUN GATE — the one that can fail on a name nobody listed.

   `ramme-pavilion` shipped naming a real building. The gate that was supposed
   to stop that is a denylist of nine names, and a denylist is exactly the wrong
   polarity for this problem: the tenth name passes, and the tenth name is the
   one somebody will write. So the polarity is inverted here. Every capitalised
   word in a plan's prose has to be a word this module has a reason for, and the
   reasons are enumerated below rather than the offences.

   The allowlist is mostly DERIVED — the module's own plan titles — so it grows
   with the set instead of being maintained. What is left is eleven months, four
   abbreviations and the studio name.

   WHAT IT CANNOT DO, stated rather than left to be discovered:
     · A name written in lower case passes.
     · A name assembled only from allowed words passes ("the Monitor House").
     · A first word of a sentence passes, because English capitalises those.
     · A one- or two-letter token passes: this module writes -30 °C, R-40 and
       zone 7A, and no building is called C.
   It catches an unfamiliar capitalised word mid-sentence, which is the shape a
   borrowed building name has, and the oracle below proves that on a name that
   is on no list anywhere in this repo.
   =========================================================================== */

test("no glass-set plan carries a capitalised word this module has no reason for", () => {
  /* Latin-1 letter ranges rather than \p{L}: this suite compiles at the repo's
     ES5 target, where the /u flag is a syntax error. The set's titles are
     English and Norwegian, so ø and å are inside these ranges. */
  const NON_LETTER = /[^A-Za-zÀ-ÖØ-öø-ÿ]/g;
  const fromTitles = new Set(SET.flatMap((plan) => plan.title.split(/[\s-]+/)).map((w) => w.replace(NON_LETTER, "")));
  const ALSO_ALLOWED = new Set([
    "Aura", // the studio, on every notes string
    "Alberta", // the bill of materials' region
    "NBC", // the code the ratio is measured against
    "SIP",
    "CLT", // materials, named by their trade abbreviations
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]);

  const unexplained = (plans: readonly PlanTemplate[]): string[] => {
    const out: string[] = [];
    for (const plan of plans) {
      for (const sentence of proseOf(plan).split(/(?<=[.!?])\s+|\n+/)) {
        sentence
          .trim()
          .split(/\s+/)
          .forEach((raw, i) => {
            if (i === 0) return; // English capitalises sentence openers
            const word = raw
              .replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "")
              .replace(/['’]s$/, "");
            if (word.length <= 2) return; // °C, R-40, zone 7A
            if (!/^[A-ZÀ-ÖØ-Þ]/.test(word)) return;
            if (fromTitles.has(word) || ALSO_ALLOWED.has(word)) return;
            out.push(`${plan.id}: "${word}" is capitalised in the prose and is not a word this module explains`);
          });
      }
    }
    return out;
  };

  expect(unexplained(SET)).toEqual([]);

  /* THE ORACLE, and the whole point of the rewrite: a name that appears in no
     denylist in this repo, invented for this assertion. If this rule were
     circular the way the denylist is, it could not report it. */
  const planted: PlanTemplate = JSON.parse(JSON.stringify(SET[0]));
  planted.spec.notes += " The section is the Kestrel House one, after Halvorsen.";
  const caught = unexplained([planted]);
  expect(caught.some((o) => o.includes('"Kestrel"'))).toBe(true);
  expect(caught.some((o) => o.includes('"Halvorsen"'))).toBe(true);
  // and none of the nine denylisted names is what caught it
  expect(/kestrel|halvorsen/i.test(BANNED.map(([p]) => p.source).join("|"))).toBe(false);
});

test("the glass set prices its glazing honestly against a per-unit bill of materials", () => {
  /* materials.ts:681-694 prices triple glazing as window_count × $900/1350/1800
     — per UNIT — and estimatePlanTemplate counts every non-door opening as one
     unit. A thirty-four-foot glazing wall and a bathroom casement are the same
     line item, which is tolerable for a library of punched windows and is not
     tolerable for this one. Any plan carrying a glazing wall says so. */
  const wrong: string[] = [];
  for (const plan of SET) {
    const hasGlazingWall = plan.spec.volumes.some((v) => v.openings.some((o) => o.kind === "glazing-wall"));
    if (hasGlazingWall && plan.costBasis?.status !== "proxy") {
      wrong.push(`${plan.id} carries a glazing wall on a modelled cost basis`);
    }
    if (!hasGlazingWall && plan.costBasis?.status === "proxy") {
      wrong.push(`${plan.id} has no glazing wall but carries a proxy anyway`);
    }
    if (plan.costBasis?.status === "proxy") {
      expect(plan.costBasis.label).toMatch(/proxy/i);
      expect(plan.costBasis.note.trim().length).toBeGreaterThan(60);
      expect(plan.costBasis.note).toMatch(/quote|supplier|advisor|engineering/i);
    }
  }
  expect(wrong).toEqual([]);
  // The rule discriminates: one plan in the wave has no glazing wall at all.
  expect(SET.filter((plan) => plan.costBasis?.status !== "proxy").map((plan) => plan.id)).toEqual([
    "ramme-pavilion",
  ]);
});

test("every e/w opening in the glass set fits the wall geometry.ts actually builds", () => {
  /* plan-catalog.spec.ts:136 measures an e or w wall with `depthFt`;
     geometry.ts and opening-edit.spec.ts measure it with the BUILT run, two
     wall thicknesses shorter, and opening-edit.spec.ts pins the exemption list
     to exactly three existing plans. A new plan that clears `depthFt` but not
     the built run turns an unrelated file red, naming itself. Rammed earth is
     where this bites: 450 mm walls take 2.95 ft off every e/w run. */
  const problems: string[] = [];
  for (const plan of SET) {
    const t = wallThicknessFt(plan.spec.material);
    for (const v of plan.spec.volumes) {
      for (const o of v.openings) {
        const run = wallRunFt(v, o.wall, t);
        if (o.offsetFt + o.widthFt > run + 1e-9) {
          problems.push(`${plan.id}/${v.id}/${o.id}: reaches ${o.offsetFt + o.widthFt} on a built run of ${run.toFixed(3)}`);
        }
      }
    }
  }
  expect(problems).toEqual([]);

  /* The oracle: the strict run really is stricter than the one the catalog gate
     uses, on the plan where it matters most. */
  const snofang = SET.find((plan) => plan.id === "snofang-clerestory")!;
  const v = snofang.spec.volumes[0];
  expect(snofang.spec.material).toBe("rammed_earth");
  expect(wallRunFt(v, "e", wallThicknessFt("rammed_earth"))).toBeLessThan(v.depthFt - 2.9);
});

test("the merged library still satisfies the pins plan-catalog.spec.ts asserts by exact equality", () => {
  /* The glass set is already concatenated into PLAN_TEMPLATES. These exact
     equality pins are re-derived against that one array so a new record cannot
     silently join a named list. */
  const merged = PLAN_TEMPLATES;

  // plan-catalog.spec.ts:798 — `skygge-veranda` is the only deep eave.
  expect(merged.filter((p) => p.spec.volumes.some((v) => v.roof.overhangFt !== 1.5)).map((p) => p.id)).toEqual([
    "skygge-veranda",
  ]);

  // :944 — four bedrooms belongs to `familie-fire` alone, and three is the rest.
  expect(merged.filter((p) => p.bedrooms >= 4).map((p) => p.id)).toEqual(["familie-fire"]);
  expect(Math.max(...merged.filter((p) => p.bedrooms < 4).map((p) => p.bedrooms))).toBe(3);

  // :937 — exactly five feature bullets in the whole library print an area.
  expect(merged.flatMap((p) => p.features).filter((f) => /(\d[\d,]*) sq ft/.test(f)).length).toBe(5);

  // :611 — the over-reporting set is three named plans with three exact areas.
  expect(
    merged
      .filter((p) => planFootprintOverlapSqFt(p) > 0.01)
      .map((p) => `${p.id}: ${planFootprintOverlapSqFt(p).toFixed(2)}`)
      .sort(),
  ).toEqual(["gardstun-court: 24.00", "lakeside-l: 28.00", "wilson-court: 42.00"]);

  // :759 — `libertiny-study` is still the only plan beating atriumgard on wall per floor.
  const wallPerFloor = (p: PlanTemplate) =>
    p.spec.volumes.reduce((s, v) => s + 2 * (v.widthFt + v.depthFt), 0) / totalFloorAreaSqFt(p.spec);
  const atrium = merged.find((p) => p.id === "atriumgard")!;
  expect(merged.filter((p) => wallPerFloor(p) > wallPerFloor(atrium)).map((p) => p.id).sort()).toEqual([
    "libertiny-study",
  ]);

  // :869 — fewer than three plans besides `modulhus` sit entirely on the 2 ft grid.
  const onGrid = (p: PlanTemplate) =>
    p.spec.volumes.every((v) =>
      v.openings.every((o) => Math.abs(o.offsetFt % 2) < 1e-9 && Math.abs(o.widthFt % 2) < 1e-9),
    );
  expect(merged.filter((p) => p.id !== "modulhus" && onGrid(p)).map((p) => p.id)).toEqual([]);

  // :666 — the published area is the modelled area, with no exemption list.
  const drifted = merged
    .map((p) => ({ p, m: /^([\d,]+)\s*sq ft/.exec(p.kicker) }))
    .filter(({ p, m }) => !m || Number(m[1].replace(/,/g, "")) !== Math.round(totalFloorAreaSqFt(p.spec)))
    .map(({ p }) => p.id);
  expect(drifted).toEqual([]);

  // :531 — nothing shrinks every thumbnail in the catalog.
  const span = (p: PlanTemplate) => {
    const xs = p.spec.volumes.flatMap((v) => [v.x - v.widthFt / 2, v.x + v.widthFt / 2]);
    const zs = p.spec.volumes.flatMap((v) => [v.z - v.depthFt / 2, v.z + v.depthFt / 2]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  };
  expect(merged.filter((p) => span(p) > 44).map((p) => p.id)).toEqual([]);

  // :338 — the first-volume elevation set keeps growing rather than collapsing.
  const elevations = new Set(
    merged.map((p) =>
      p.spec.volumes[0].openings
        .map((o) => `${o.wall}${o.kind}${o.widthFt}x${o.heightFt}@${o.offsetFt},${o.sillFt}`)
        .sort()
        .join("|"),
    ),
  );
  expect(elevations.size).toBeGreaterThanOrEqual(65 + SET.length);

  // Every new record is a valid BuilderDocument on its own, which is what
  // instantiatePlanTemplate will build the moment an id is clicked.
  for (const plan of SET) {
    const document = builderDocumentFromLegacySpec(JSON.parse(JSON.stringify(plan.spec)));
    expect(validateBuilderDocument(document).ok, `${plan.id} does not validate`).toBe(true);
  }
});

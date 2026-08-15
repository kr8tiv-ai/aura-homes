import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import {
  FIXTURES_VERSION,
  FIXTURE_CATALOG,
  FIXTURE_KIND_IDS,
  FURNITURE_KIND_IDS,
  addFixture,
  clampDim,
  decodeFixtureSet,
  defaultDims,
  defaultOpts,
  encodeFixtureSet,
  fixtureSchedule,
  isFurnitureKind,
  kindsByMount,
  resolveFixtures,
  updateFixture,
  type ClearanceRule,
  type Dims,
  type FixtureKind,
  type FixtureKindId,
  type FixtureMount,
  type FixturePart,
  type FixtureSet,
  type Opts,
} from "@/lib/builder/fixtures";
import { defaultSpec } from "@/lib/builder/spec";

/* Why this file exists.

   `lib/builder/fixtures.ts` is a catalogue: parameters plus a build function
   per kind, and a resolver that snaps them, collides them and schedules them.
   The resolver was already tested by being used. The CATALOGUE was not tested
   at all, and a catalogue is exactly the kind of thing that rots quietly — a
   kind added to `FIXTURE_CATALOG` and forgotten in `FIXTURE_KIND_IDS` has no
   button in the palette and can never be placed, and nothing anywhere says so.

   Everything here is a property of the data rather than of one fixture, so it
   holds for the thirty-two kinds that exist today and for the next one
   somebody adds. Four properties are load-bearing:

     1. the palette and the catalogue name the same set of kinds;
     2. `extents` tells the truth about the geometry `build` produces, because
        the clearance boxes, the collision test and the schedule's size text
        are all computed from `extents` and never from the mesh;
     3. MORPH, NOT SCALE — resizing changes named dimensions and rebuilds; the
        detail sections do not move. It is the rule the whole file is built on.
        Three tests carry it, and only the last two carry any weight: a named
        table of details that must hold still, a whole-object check that can
        only see an EXACTLY uniform scale, and — the real gate — a per-part
        rule that no material thickness moves with any dimension, on any kind,
        under any option. See the block above that pair for what the first two
        cannot see and why;
     4. no clearance figure is dressed up as more authoritative than it is.

   Every predicate below is also run against a deliberately broken fixture in
   the last test, because a checker that cannot reject anything is decoration. */

const KIND_IDS = Object.keys(FIXTURE_CATALOG) as FixtureKindId[];
const kinds = KIND_IDS.map((id) => FIXTURE_CATALOG[id]);

/* ---------------------------------------------------------------- helpers */

type Triple = [number, number, number];

/** The union bounding box of a built fixture, in its own frame. */
function bboxOf(parts: FixturePart[]): { min: Triple; max: Triple; size: Triple } {
  const min: Triple = [Infinity, Infinity, Infinity];
  const max: Triple = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    const b = p.geometry.boundingBox;
    if (!b) continue;
    min[0] = Math.min(min[0], b.min.x);
    min[1] = Math.min(min[1], b.min.y);
    min[2] = Math.min(min[2], b.min.z);
    max[0] = Math.max(max[0], b.max.x);
    max[1] = Math.max(max[1], b.max.y);
    max[2] = Math.max(max[2], b.max.z);
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Every part's own bounding-box SIZE, keyed by part id. Size only: a part that
 *  moves when a fixture grows has not been scaled, and moving is fine. */
function partSizes(kind: FixtureKind, dims: Dims, opts: Opts): Record<string, Triple> {
  const out: Record<string, Triple> = {};
  for (const p of kind.build(dims, opts, { fallAxis: "x" })) {
    p.geometry.computeBoundingBox();
    const b = p.geometry.boundingBox;
    if (b) out[p.id] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
  }
  return out;
}

/** Dedupe without a Set: this suite compiles at the repo's ES5 target, where
 *  spreading one is a downlevel-iteration error. */
const unique = (values: string[]): string[] => values.filter((v, i) => values.indexOf(v) === i);

/** Every combination of a kind's options. No kind has more than one option
 *  today; the product is written out anyway so adding a second cannot leave
 *  half the clearance rules untested. */
function optionCombos(kind: FixtureKind): Opts[] {
  let combos: Opts[] = [{}];
  for (const option of kind.options) {
    const next: Opts[] = [];
    for (const base of combos) {
      for (const choice of option.choices) next.push({ ...base, [option.key]: choice.id });
    }
    combos = next;
  }
  return combos;
}

const dimsWith = (kind: FixtureKind, key: string, value: number): Record<string, number> => ({
  ...defaultDims(kind),
  [key]: value,
});

/** A kind's stated extents in the GEOMETRY's axis order — x, y, z — which is
 *  width, HEIGHT, depth. Getting that pair the wrong way round is the whole
 *  reason this helper exists rather than an inline array literal. */
const sizeOf = (kind: FixtureKind, dims: Dims, opts: Opts): Triple => {
  const e = kind.extents(dims, opts);
  return [e.widthFt, e.heightFt, e.depthFt];
};

/* Any astral character (an emoji is a surrogate pair) plus the BMP symbol and
   dingbat blocks. Written without the `u` flag, which this suite's target does
   not allow. */
const EMOJI = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F]/;

/* The predicates. Each returns a problem string, or null when the thing is
   fine — so the same function can check the real catalogue and be shown to
   REJECT a broken fixture in the last test. */

function blurbProblem(kind: Pick<FixtureKind, "id" | "label" | "tag" | "blurb">): string | null {
  if (!/^[A-Z]{2}$/.test(kind.tag)) return `tag "${kind.tag}" is not two capital letters`;
  if (EMOJI.test(kind.tag) || EMOJI.test(kind.label) || EMOJI.test(kind.blurb))
    return "this repo does not use emoji";
  if (kind.label.trim().length === 0) return "no label";
  const blurb = kind.blurb.trim();
  if (blurb.length < 35) return `blurb is ${blurb.length} characters — too short to say what it is AND why an Aura home has one`;
  if (blurb.length > 320) return `blurb is ${blurb.length} characters — that is a paragraph, not a sentence`;
  if (!blurb.endsWith(".")) return "blurb does not end in a full stop";
  return null;
}

function dimensionProblem(kind: FixtureKind, dim: FixtureKind["dimensions"][number]): string | null {
  if (!(dim.min < dim.max)) return `${dim.key}: min ${dim.min} is not below max ${dim.max}`;
  if (!(dim.step > 0)) return `${dim.key}: step ${dim.step} is not positive`;
  if (dim.default < dim.min || dim.default > dim.max) return `${dim.key}: default ${dim.default} is outside [${dim.min}, ${dim.max}]`;
  // A default the slider cannot land on is a fixture that changes shape the
  // first time somebody touches it and then never comes back.
  const snapped = clampDim(kind, dim.key, dim.default);
  if (Math.abs(snapped - dim.default) > 1e-4) return `${dim.key}: default ${dim.default} is off its own step grid (clamps to ${snapped})`;
  if (!["ft", "kW", "kWh", "count"].includes(dim.unit)) return `${dim.key}: unknown unit ${dim.unit}`;
  return null;
}

/* Clearances attributed to a named CODE. Every entry is a solid-fuel or
   electrical installation figure, and every one of them is on this list
   because somebody can point at the standard it is claimed to come from. A
   piece of furniture is not on it. */
const CODE_RULES: Readonly<Record<string, string>> = {
  "wood-stove:combustible": "CAN/CSA-B365 clearance to combustibles for a solid-fuel appliance",
  "wood-stove:floor-pad": "CAN/CSA-B365 floor-protection extension",
  "wood-stove:connector": "CAN/CSA-B365 chimney-connector clearance",
  "battery-bank:working": "CEC Rule 2-308 working space",
  "electrical-panel:working": "CEC Rule 2-308 working space",
  "range:combustible": "a wood cookstove IS a solid-fuel appliance — same CAN/CSA-B365 clearance as the stove",
  "range:floor-pad": "a wood cookstove IS a solid-fuel appliance — same CAN/CSA-B365 floor protection",
};

function ruleProblem(kindId: string, rule: ClearanceRule): string | null {
  // Typed as the literal `false`, so this can only ever fail if somebody has
  // changed the TYPE — which is the point at which a person has to go and
  // actually check a document.
  if (rule.verifiedAgainstSource !== false) return "verifiedAgainstSource is not false";
  for (const side of ["front", "back", "left", "right"] as const) {
    if (!Number.isFinite(rule[side]) || rule[side] < 0) return `${side} is ${rule[side]}`;
  }
  if (rule.heightFt !== null && !(rule.heightFt > 0)) return `heightFt is ${rule.heightFt}`;
  /* 15, not 20. The shortest note in the catalogue is the sofa's "Not a code
     figure." at 18 characters, and it is a complete and correct statement —
     the threshold exists to catch an EMPTY note or a single word, not to make
     somebody pad a sentence that is already saying the whole thing. */
  if (rule.note.trim().length < 15) return "note is too short to be a note";
  if (rule.source.trim().length < 10) return "source is too short to be a source";
  const key = `${kindId}:${rule.key}`;
  if (rule.basis === "code") {
    if (!(key in CODE_RULES)) return `claims CODE and is not on the documented list of code-attributed rules`;
    if (!/CSA|NFPA|Code/.test(rule.source)) return "claims CODE and does not name a standard";
  }
  if (rule.basis === "guideline" && !rule.source.includes("not a building code"))
    return "claims GUIDELINE and does not say in its source that a guideline is not a code";
  if (rule.basis === "indicative" && !rule.source.startsWith("none"))
    return "claims INDICATIVE and its source does not start with `none`";
  if (rule.basis === "manufacturer" && !/manual|installation sheet/i.test(rule.source))
    return "claims MANUFACTURER and does not point at a manual";
  return null;
}

/* =========================================================== the catalogue */

test("the palette and the catalogue name exactly the same kinds", () => {
  /* A kind in FIXTURE_CATALOG and not in FIXTURE_KIND_IDS has no button, can
     never be added, and looks completely fine in a diff. This is the check
     that the eighteen kinds added with this file are actually reachable. */
  expect([...FIXTURE_KIND_IDS].sort()).toEqual([...KIND_IDS].sort());
  expect(new Set(FIXTURE_KIND_IDS).size).toBe(FIXTURE_KIND_IDS.length);

  for (const id of KIND_IDS) {
    expect(FIXTURE_CATALOG[id].id, `${id} is filed in the catalogue under another id`).toBe(id);
  }

  // And the mount split loses nobody: the palette renders mount by mount.
  const mounted = (["floor", "wall", "roof"] as FixtureMount[]).flatMap((m) => kindsByMount(m).map((k) => k.id));
  expect([...mounted].sort()).toEqual([...KIND_IDS].sort());
});

test("the furniture group is a real subset and the palette's two lists cover it", () => {
  expect(new Set(FURNITURE_KIND_IDS).size).toBe(FURNITURE_KIND_IDS.length);
  for (const id of FURNITURE_KIND_IDS) {
    expect(KIND_IDS, `${id} is called furniture and is not in the catalogue`).toContain(id);
    expect(isFurnitureKind(id)).toBe(true);
  }
  // The palette splits each mount into furniture and everything else. Neither
  // list may swallow a kind, so their union has to be the whole mount.
  for (const mount of ["floor", "wall", "roof"] as FixtureMount[]) {
    const all = kindsByMount(mount).map((k) => k.id);
    const split = [
      ...all.filter((id) => isFurnitureKind(id)),
      ...all.filter((id) => !isFurnitureKind(id)),
    ];
    expect([...split].sort()).toEqual([...all].sort());
  }
  // The equipment is still equipment: the wood stove is not furniture.
  expect(isFurnitureKind("wood-stove")).toBe(false);
  expect(isFurnitureKind("hot-tub")).toBe(false);
  expect(isFurnitureKind("bed")).toBe(true);
});

test("every kind says what it is, why an Aura home has one, and wears a unique tag", () => {
  const problems = kinds.map((k) => [k.id, blurbProblem(k)] as const).filter(([, p]) => p !== null);
  expect(problems, problems.map(([id, p]) => `${id}: ${p}`).join("\n")).toEqual([]);

  const tags = kinds.map((k) => k.tag);
  const duplicated = tags.filter((t, i) => tags.indexOf(t) !== i);
  expect(duplicated, `these two-letter tags are used by more than one kind: ${duplicated.join(", ")}`).toEqual([]);
});

/** Defaults that do not sit on their own step grid, LEFT ALONE and recorded.
 *
 *  `clampDim` rounds to a multiple of the step measured from zero, so a
 *  default that is not such a multiple silently becomes a different number the
 *  first time somebody touches the slider — the fixture changes shape on first
 *  contact and never changes back. This node found one, in a kind it did not
 *  add and had no business editing: correcting it would move an existing
 *  fixture's geometry for a reason nobody asked for. It is pinned to the value
 *  it actually clamps to instead, so it cannot drift further unnoticed. */
const OFF_GRID_DEFAULTS: Readonly<Record<string, { clampsTo: number; why: string }>> = {
  "thermostat:heightFt": {
    clampsTo: 0.36,
    why: "default 0.35 ft with a 0.02 ft step. Pre-existing; an eighth of an inch on a thermostat, so reported rather than changed.",
  },
};

test("every named dimension has a range a person can actually land on", () => {
  const problems: string[] = [];
  for (const kind of kinds) {
    const keys = kind.dimensions.map((d) => d.key);
    if (new Set(keys).size !== keys.length) problems.push(`${kind.id}: duplicate dimension key`);
    for (const dim of kind.dimensions) {
      const problem = dimensionProblem(kind, dim);
      if (!problem) continue;
      const known = OFF_GRID_DEFAULTS[`${kind.id}:${dim.key}`];
      if (known && problem.includes("off its own step grid")) {
        expect(clampDim(kind, dim.key, dim.default), known.why).toBeCloseTo(known.clampsTo, 6);
        continue;
      }
      problems.push(`${kind.id}: ${problem}`);
    }
    for (const option of kind.options) {
      if (!option.choices.some((c) => c.id === option.default))
        problems.push(`${kind.id}: option ${option.key} defaults to a choice it does not offer`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

/* ================================================= extents vs the geometry */

const EXTENT_AXES = ["width", "height", "depth"] as const;

/** Where a build deliberately stands outside the extents it declares, and why.
 *  `extents` describes the BODY somebody has to fit into a room; a connector
 *  that leaves it is drawn anyway.
 *
 *  `ft` is the MEASURED overhang, not a budget. The sweep below allows it plus
 *  a hair of float slack, and `every pinned overhang is the measured one`
 *  re-measures each entry at min, default and max and pins it to four decimal
 *  places — so an overhang cannot grow at all without failing here.
 *
 *  `whenOpts` narrows an entry to the option choice that draws the connector.
 *  Two of these only exist under a non-default choice, which is exactly why
 *  the sweep now runs every combination rather than `defaultOpts` alone: a
 *  wood cookstove's flue and a composting toilet's vent were invisible to this
 *  test until it did. */
const OVERHANG_ALLOWANCE: ReadonlyArray<{
  kind: FixtureKindId;
  axis: (typeof EXTENT_AXES)[number];
  whenOpts?: Readonly<Record<string, string>>;
  ft: number;
  why: string;
}> = [
  {
    kind: "bed",
    axis: "depth",
    ft: 0.2,
    why:
      "the headboard stands 2.4 in proud of the mattress length. Pre-existing, measured here so it cannot quietly grow, and NOT corrected by this node — moving it would change where every existing bed's clearance box sits. Was pinned at 0.25 ft against a measured 0.20, which left the defect 25% of room to grow in; now pinned at the measurement.",
  },
  {
    kind: "range",
    axis: "height",
    whenOpts: { fuel: "wood" },
    ft: 3.0,
    why:
      "the wood cookstove's flue — the same 3 ft length the wood stove draws, and outside the body's stated extents for the same stated reason: the extents describe what has to fit in the room, and the chimney connector is a separate installation question. Propane and electric draw no flue and carry no allowance.",
  },
  {
    kind: "toilet",
    axis: "height",
    whenOpts: { type: "composting" },
    ft: 2.2,
    why:
      "the composting toilet's vent stack, which runs to the roof and is drawn beyond the body for the same reason as the flue. The flush toilet has no stack and carries no allowance.",
  },
];

/** How much float dust the sweep forgives on top of a measured pin. A
 *  thousandth of a foot: enough for the arithmetic, far too little to hide a
 *  connector that has actually moved. */
const OVERHANG_SLACK_FT = 0.001;

const overhangAllowance = (id: FixtureKindId, axis: (typeof EXTENT_AXES)[number], opts: Opts) =>
  OVERHANG_ALLOWANCE.find(
    (a) =>
      a.kind === id &&
      a.axis === axis &&
      (!a.whenOpts || Object.keys(a.whenOpts).every((k) => opts[k] === a.whenOpts?.[k])),
  );

test("extents agree with the geometry that actually gets built", () => {
  /* Everything downstream — the clearance boxes, the collision test, the snap,
     the schedule's size text — is computed from `extents`. A build that draws
     something bigger is a fixture that reads as fitting and does not.

     Every OPTION COMBINATION, not just the default one. An option changes what
     a fixture IS — the wood cookstove grows a flue, the composting toilet a
     vent — so a version of this test that only ever saw `defaultOpts` was
     leaving whole builds unexamined. */
  const problems: string[] = [];

  for (const id of FURNITURE_KIND_IDS) {
    const kind = FIXTURE_CATALOG[id];
    const cases: { label: string; dims: Record<string, number> }[] = [
      { label: "defaults", dims: defaultDims(kind) },
      { label: "every dimension at min", dims: Object.fromEntries(kind.dimensions.map((d) => [d.key, d.min])) },
      { label: "every dimension at max", dims: Object.fromEntries(kind.dimensions.map((d) => [d.key, d.max])) },
    ];
    for (const opts of optionCombos(kind)) {
      const where = `${id} ${JSON.stringify(opts)}`;
      for (const c of cases) {
        const ext = sizeOf(kind, c.dims, opts);
        const box = bboxOf(kind.build(c.dims, opts, { fallAxis: "x" }));
        for (let i = 0; i < 3; i++) {
          const over = box.size[i] - ext[i];
          const pinned = overhangAllowance(id, EXTENT_AXES[i], opts);
          const allowed = pinned ? pinned.ft + OVERHANG_SLACK_FT : 0.02;
          if (over > allowed)
            problems.push(`${where} (${c.label}): built ${EXTENT_AXES[i]} ${box.size[i].toFixed(3)} exceeds stated ${ext[i].toFixed(3)} by ${over.toFixed(3)} ft`);
          if (-over > 0.07)
            problems.push(`${where} (${c.label}): built ${EXTENT_AXES[i]} ${box.size[i].toFixed(3)} is ${(-over).toFixed(3)} ft SHORT of the stated ${ext[i].toFixed(3)} — the fixture reserves room it does not use`);
        }
        // A floor fixture stands ON the floor: its base is y = 0 in its own frame.
        if (kind.mount === "floor" && Math.abs(box.min[1]) > 0.02)
          problems.push(`${where} (${c.label}): the lowest geometry is at y = ${box.min[1].toFixed(3)}, not on the floor`);
      }
    }
  }

  expect(problems, problems.join("\n")).toEqual([]);
});

test("every pinned overhang is the measured one", () => {
  /* The allowances above are only honest if the numbers in them are real, and
     only a pin if the number cannot move. Measure each at min, default and max
     — a connector whose length is a fraction of a dimension would show up here
     as three different numbers — and pin to four decimals rather than to an
     upper bound. The bed's entry used to be an upper bound of 0.25 against a
     measurement of 0.20, so the overhang could have grown by a quarter and
     stayed green; that is the assertion this test replaces. */
  for (const pin of OVERHANG_ALLOWANCE) {
    const kind = FIXTURE_CATALOG[pin.kind];
    const opts = { ...defaultOpts(kind), ...(pin.whenOpts ?? {}) };
    const axis = EXTENT_AXES.indexOf(pin.axis);
    const cases: Record<string, number>[] = [
      defaultDims(kind),
      Object.fromEntries(kind.dimensions.map((d) => [d.key, d.min])),
      Object.fromEntries(kind.dimensions.map((d) => [d.key, d.max])),
    ];
    for (const dims of cases) {
      const over = bboxOf(kind.build(dims, opts, { fallAxis: "x" })).size[axis] - sizeOf(kind, dims, opts)[axis];
      expect(over, `${pin.kind}:${pin.axis} ${JSON.stringify(opts)} — ${pin.why}`).toBeCloseTo(pin.ft, 4);
    }
    // ...and the allowance only applies where it says it does: the same kind
    // under the OTHER option choice must sit inside its stated extents.
    if (pin.whenOpts) {
      for (const other of optionCombos(kind)) {
        if (Object.keys(pin.whenOpts).every((k) => other[k] === pin.whenOpts?.[k])) continue;
        const dims = defaultDims(kind);
        const over = bboxOf(kind.build(dims, other, { fallAxis: "x" })).size[axis] - sizeOf(kind, dims, other)[axis];
        expect(over, `${pin.kind} ${JSON.stringify(other)} draws the connector too — the allowance is mis-scoped`).toBeLessThanOrEqual(0.02);
      }
    }
  }

  // The bed's own overhang, kept as its own named assertion: it is a real
  // headboard, not a rounding error, and it is 2.4 inches.
  const bed = FIXTURE_CATALOG.bed;
  const dims = defaultDims(bed);
  const over = bboxOf(bed.build(dims, defaultOpts(bed), { fallAxis: "x" })).size[2] - bed.extents(dims, defaultOpts(bed)).depthFt;
  expect(over).toBeGreaterThan(0.1);
  expect(over * 12).toBeCloseTo(2.4, 4);
});

/* ========================================================= morph, not scale */

/** Detail sections that must NOT move when the named dimension beside them
 *  does. Each row is: morph this dimension, and this part keeps this size on
 *  this axis. They are the constants the file's header promises. */
const DETAILS: ReadonlyArray<{
  kind: FixtureKindId;
  dim: string;
  part: string;
  axis: 0 | 1 | 2;
  what: string;
}> = [
  { kind: "dining-table", dim: "lengthFt", part: "top", axis: 1, what: "the table top's thickness" },
  { kind: "dining-table", dim: "lengthFt", part: "leg-es", axis: 0, what: "the leg section" },
  { kind: "dining-chair", dim: "heightFt", part: "seat", axis: 1, what: "the seat board" },
  { kind: "counter-run", dim: "lengthFt", part: "counter", axis: 1, what: "the countertop slab" },
  { kind: "counter-run", dim: "lengthFt", part: "basin", axis: 0, what: "the sink" },
  { kind: "shelving", dim: "heightFt", part: "shelf0", axis: 1, what: "the shelf board" },
  { kind: "bunk", dim: "upperTopFt", part: "upper-mattress", axis: 1, what: "the mattress" },
  { kind: "dresser", dim: "depthFt", part: "top", axis: 1, what: "the top" },
  { kind: "wardrobe", dim: "widthFt", part: "door-r", axis: 2, what: "the door leaf" },
  /* Height rather than width: past about 140 splits the build draws an honest
     block instead of cylinders, and at the maximum width it is over that. The
     block path is covered by the extents test, which runs every dimension at
     its maximum. */
  { kind: "firewood-store", dim: "heightFt", part: "log-0-0", axis: 0, what: "one split of firewood" },
  { kind: "refrigerator", dim: "heightFt", part: "plinth", axis: 1, what: "the plinth" },
  { kind: "kitchen-island", dim: "widthFt", part: "counter", axis: 1, what: "the island's countertop" },
];

test("morphing a named dimension rebuilds the object and leaves the detail sections alone", () => {
  const problems: string[] = [];
  for (const row of DETAILS) {
    const kind = FIXTURE_CATALOG[row.kind];
    const spec = kind.dimensions.find((d) => d.key === row.dim);
    if (!spec) {
      problems.push(`${row.kind} has no dimension ${row.dim}`);
      continue;
    }
    const opts = defaultOpts(kind);
    const at = (v: number): Triple | undefined => partSizes(kind, dimsWith(kind, row.dim, v), opts)[row.part];
    const small = at(spec.min);
    const mid = at(spec.default);
    const large = at(spec.max);
    if (!small || !mid || !large) {
      problems.push(`${row.kind}: part "${row.part}" is not built at every size — the detail cannot be checked`);
      continue;
    }
    for (const [label, got] of [["min", small], ["max", large]] as const) {
      if (Math.abs(got[row.axis] - mid[row.axis]) > 1e-6)
        problems.push(
          `${row.kind}: ${row.what} changed with ${row.dim} (${mid[row.axis].toFixed(4)} at default, ${got[row.axis].toFixed(4)} at ${label}). That is scaling, and this file does not scale.`,
        );
    }
    // ...and the morph has to have DONE something, or the assertion above is
    // satisfied by a fixture that ignores its own slider.
    const before = sizeOf(kind, dimsWith(kind, row.dim, spec.min), opts);
    const after = sizeOf(kind, dimsWith(kind, row.dim, spec.max), opts);
    if (before.every((v, i) => Math.abs(v - after[i]) < 1e-6))
      problems.push(`${row.kind}: ${row.dim} changes nothing about the fixture's extents`);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

/** Does anything about this build survive the morph unchanged? Uniform scaling
 *  multiplies every axis of every part by the same factor, so under a uniform
 *  scale the answer is no.
 *
 *  READ THE BAILOUT. This returns false the moment ANY ONE part keeps ANY ONE
 *  axis, so it can only recognise a scale that is total. Every fixture in the
 *  catalogue keeps something — a tap, a toe kick, a hinge — so this function
 *  reports "not scaling" for all of them for reasons that have nothing to do
 *  with the fixture under test. It is kept because an exactly uniform scale is
 *  a real defect and this names it precisely; it is NOT the gate for MORPH,
 *  NOT SCALE. `thicknessProblems` is. */
function scalesUniformly(kind: FixtureKind, dimKey: string): boolean {
  const opts = defaultOpts(kind);
  const spec = kind.dimensions.find((d) => d.key === dimKey);
  if (!spec) return false;
  const small = partSizes(kind, dimsWith(kind, dimKey, spec.min), opts);
  const large = partSizes(kind, dimsWith(kind, dimKey, spec.max), opts);
  for (const id of Object.keys(small)) {
    const a = small[id];
    const b = large[id];
    if (!b) continue;
    if (a.some((v: number, i: number) => Math.abs(v - b[i]) < 1e-6)) return false;
  }
  return true;
}

test("no kind in the catalogue is an exactly uniform scale of itself", () => {
  /* Renamed from "no kind in the catalogue resizes by scaling", which claimed
     the whole rule. This assertion is unchanged and still worth running — an
     exactly uniform scale IS a defect and this is the cheapest way to name it
     — but it cannot see a partial one, so the title now says what it checks.
     The rule it used to claim is enforced two tests below. */
  const problems: string[] = [];
  for (const kind of kinds) {
    const opts = defaultOpts(kind);
    for (const dim of kind.dimensions) {
      const before = sizeOf(kind, dimsWith(kind, dim.key, dim.min), opts);
      const after = sizeOf(kind, dimsWith(kind, dim.key, dim.max), opts);
      // Only dimensions that actually change the object's size are interesting;
      // a water depth changes a fact, not a footprint.
      if (before.every((v, i) => Math.abs(v - after[i]) < 1e-6)) continue;
      if (scalesUniformly(kind, dim.key))
        problems.push(`${kind.id}: every part changed on every axis when ${dim.key} moved — nothing was held constant`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

/* ------------------------------------------------------------------------
   MORPH, NOT SCALE — stated per PART, which is the only place it is true.

   The test above (`scalesUniformly`) asks a whole-object question: did EVERY
   part change on ALL THREE axes? It answers "no" the moment any single part
   keeps any single axis, which every fixture in this catalogue does — so it
   passes for reasons that have nothing to do with the fixture under test. It
   is kept because an exactly-uniform scale IS a breach and it names that one
   precisely, but it is necessary and nowhere near sufficient, and the two
   tests below are the ones now carrying the rule.

   The invariant is NOT "nothing scales". A table top should get longer with
   the table; a counter run should get longer with the kitchen. It is:

     (A) a dimension may only move the axes the fixture's OWN `extents` says
         that dimension moves — grow a vanity's width and nothing may get
         taller or deeper; and
     (B) the parts that represent MATERIAL THICKNESS — a slab, a leaf, a
         board, a plinth — do not change at all. A six-foot vanity is a
         longer cabinet with the same 1½-inch top on it.

   (A) is derived from the kind rather than from a table written here, so a
   kind added tomorrow is governed the moment it exists. Test 5 already proves
   `extents` describes the real geometry, so it is safe to reason from.
   ------------------------------------------------------------------------ */

/** Where along a dimension's range the morph is sampled. Every value is
 *  compared against the DEFAULT build, so a part only has to exist at the
 *  default and at one sample to be checked — a fixture that changes its part
 *  COUNT partway through its range (shelving, the firewood stack) still gets
 *  every part it does keep examined. */
const MORPH_SAMPLE_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8, 1];

const AXIS_NAME = ["width", "height", "depth"] as const;

/** A part axis reads as MATERIAL THICKNESS when, at the fixture's own default
 *  size, it is both small in absolute terms and small next to the object it
 *  belongs to. Both conditions, because a thermostat is 5 inches thick and
 *  that is its DEPTH, not a slab, and a solar array's rail is 17 feet long
 *  and 15% of nothing.
 *
 *  Measured against the catalogue as it stands: the thinnest part-axis that
 *  legitimately changes today is the fridge's freezer handle at 0.16 of the
 *  fixture's height, and the smallest that changes at all is the thermostat's
 *  screen at 0.25 ft — which is 0.71 of the thermostat. Nothing in the
 *  catalogue is inside BOTH bounds and changes. The vanity's countertop slab,
 *  the case this gate exists for, is 0.12 ft and 0.0375 of the vanity. */
const THICKNESS_MAX_FT = 0.4;
const THICKNESS_MAX_FRACTION_OF_EXTENT = 0.15;

/** Geometry positions are stored in a Float32Array, so a part translated 45 ft
 *  down a solar array carries representation error in its own bounding box.
 *  A ten-thousandth of a foot is a thousandth of an inch — chosen to sit in
 *  the empty band between that noise and the smallest thing a build in this
 *  file changes on purpose. That band is not asserted by this comment; it is
 *  measured in `the morph epsilon sits in a gap nothing real falls into`. */
const MORPH_EPS = 1e-4;

/** Every non-zero way a part's bounding box responds to a dimension, across
 *  the whole catalogue. Used to prove the epsilon above separates float dust
 *  from design, rather than being asserted to. */
function allPartResponses(): number[] {
  const out: number[] = [];
  for (const kind of kinds) {
    for (const opts of optionCombos(kind)) {
      for (const dim of kind.dimensions) {
        const { base, others } = morphSamples(kind, dim, opts);
        for (const pid of Object.keys(base.sizes)) {
          for (let i = 0; i < 3; i++) {
            for (const s of others) {
              const got = s.sizes[pid]?.[i];
              if (got === undefined) continue;
              const moved = Math.abs(got - base.sizes[pid][i]);
              if (moved > 0) out.push(moved);
            }
          }
        }
      }
    }
  }
  return out;
}

interface MorphSample {
  value: number;
  ext: Triple;
  sizes: Record<string, Triple>;
}

function morphSamples(kind: FixtureKind, dim: FixtureKind["dimensions"][number], opts: Opts): {
  base: MorphSample;
  others: MorphSample[];
} {
  const at = (value: number): MorphSample => {
    const dims = dimsWith(kind, dim.key, value);
    return { value, ext: sizeOf(kind, dims, opts), sizes: partSizes(kind, dims, opts) };
  };
  const base = at(dim.default);
  const others = MORPH_SAMPLE_FRACTIONS.map((f) => at(dim.min + (dim.max - dim.min) * f));
  return { base, others };
}

/** Rule B. Every part axis that reads as material thickness at the default
 *  size, checked for constancy across the whole range of every dimension. */
function thicknessProblems(kind: FixtureKind, opts: Opts): string[] {
  const out: string[] = [];
  for (const dim of kind.dimensions) {
    const { base, others } = morphSamples(kind, dim, opts);
    for (const pid of Object.keys(base.sizes)) {
      for (let i = 0; i < 3; i++) {
        const atDefault = base.sizes[pid][i];
        const isThickness =
          atDefault <= THICKNESS_MAX_FT && atDefault <= THICKNESS_MAX_FRACTION_OF_EXTENT * base.ext[i];
        if (!isThickness) continue;
        for (const s of others) {
          const got = s.sizes[pid]?.[i];
          if (got === undefined || Math.abs(got - atDefault) <= MORPH_EPS) continue;
          out.push(
            `${kind.id} ${JSON.stringify(opts)}: part "${pid}" is ${atDefault.toFixed(4)} ft thick on ${AXIS_NAME[i]} at the default and ${got.toFixed(4)} ft at ${dim.key} = ${s.value.toFixed(3)}. Material thickness does not vary with a dimension — a bigger fixture is a bigger fixture, not a chunkier one.`,
          );
          break;
        }
      }
    }
  }
  return out;
}

/** The one place in the catalogue where a part legitimately changes size on an
 *  axis its dimension does not move, with the reason and a measured cap. The
 *  cap is 0.6463 ft in fact (asserted below), so this is 0.6% of headroom —
 *  a fourth drawer front cannot quietly turn into a scaling factor. */
const UNGOVERNED_ALLOWANCE: ReadonlyArray<{
  kind: FixtureKindId;
  dim: string;
  part: RegExp;
  axis: "width" | "height" | "depth";
  maxFt: number;
  why: string;
}> = [
  {
    kind: "dresser",
    dim: "drawers",
    part: /^drawer[0-9]+$/,
    axis: "height",
    maxFt: 0.65,
    why:
      "the drawer COUNT divides a carcass that does not move — eight drawers in the same box are shorter than four — so the stated height cannot change and the fronts must. The fronts are the division, not a thickness; the dresser's top, plinth and drawer-front DEPTH are all held constant by the thickness rule, and the kind's own fact note says exactly this.",
  },
];

/** Rule A. A dimension may only move the axes its own `extents` moves. */
function ungovernedAxisProblems(kind: FixtureKind, opts: Opts): string[] {
  const out: string[] = [];
  for (const dim of kind.dimensions) {
    const { base, others } = morphSamples(kind, dim, opts);
    for (const pid of Object.keys(base.sizes)) {
      for (let i = 0; i < 3; i++) {
        let worst = 0;
        let witness = "";
        for (const s of others) {
          const got = s.sizes[pid]?.[i];
          if (got === undefined) continue;
          const moved = Math.abs(got - base.sizes[pid][i]);
          // Governed: the fixture's own stated extents move on this axis too.
          if (Math.abs(s.ext[i] - base.ext[i]) > MORPH_EPS) continue;
          if (moved <= MORPH_EPS) continue;
          if (moved > worst) {
            worst = moved;
            witness = `${base.sizes[pid][i].toFixed(4)} ft at the default, ${got.toFixed(4)} ft at ${dim.key} = ${s.value.toFixed(3)}`;
          }
        }
        if (worst <= MORPH_EPS) continue;
        const allowed = UNGOVERNED_ALLOWANCE.find(
          (a) => a.kind === kind.id && a.dim === dim.key && a.axis === AXIS_NAME[i] && a.part.test(pid),
        );
        if (allowed && worst <= allowed.maxFt) continue;
        out.push(
          `${kind.id} ${JSON.stringify(opts)}: part "${pid}" changed ${worst.toFixed(4)} ft on ${AXIS_NAME[i]} when ${dim.key} moved, and ${dim.key} does not move this fixture's stated ${AXIS_NAME[i]} at all (${witness}).`,
        );
      }
    }
  }
  return out;
}

test("a fixture's material thicknesses do not move when it is resized", () => {
  /* THE gate for MORPH, NOT SCALE. A vanity whose countertop slab thickens
     with its width passes every other test in this file — it is a real
     violation of the rule the whole module is built on, and it is what this
     test exists to refuse. Run over every kind, every option combo, every
     dimension and every part: nothing is spot-checked. */
  const problems: string[] = [];
  for (const kind of kinds) for (const opts of optionCombos(kind)) problems.push(...thicknessProblems(kind, opts));
  expect(problems, problems.join("\n")).toEqual([]);

  // The gate is only worth its runtime if it FOUND thicknesses to hold. A
  // catalogue with no thickness members would pass it vacuously.
  let held = 0;
  for (const kind of kinds) {
    const opts = defaultOpts(kind);
    const ext = sizeOf(kind, defaultDims(kind), opts);
    const sizes = partSizes(kind, defaultDims(kind), opts);
    for (const pid of Object.keys(sizes))
      for (let i = 0; i < 3; i++)
        if (sizes[pid][i] <= THICKNESS_MAX_FT && sizes[pid][i] <= THICKNESS_MAX_FRACTION_OF_EXTENT * ext[i]) held++;
  }
  expect(
    held,
    `only ${held} part-axes in the catalogue read as material thickness. It was 264 when this gate was written, across all 32 kinds at their default size — if it has collapsed, the classifier has stopped recognising slabs and the assertion above is passing on an empty set.`,
  ).toBeGreaterThanOrEqual(250);
});

test("the morph epsilon sits in a gap nothing real falls into", () => {
  /* Both gates above call a part "unchanged" when it moved less than
     MORPH_EPS. That is a judgement call unless the catalogue is measured, so:
     collect every non-zero response in it and show the noise and the design
     are separated by orders of magnitude, with the epsilon between them. If a
     build ever starts responding by a thousandth of an inch this goes red and
     somebody has to look at it, which is the correct outcome. */
  const responses = allPartResponses().sort((a, b) => a - b);
  expect(responses.length, "nothing in the catalogue responds to anything").toBeGreaterThan(300);

  const noise = responses.filter((r) => r < MORPH_EPS);
  const design = responses.filter((r) => r >= MORPH_EPS);
  expect(design.length, "every response is being dismissed as noise").toBeGreaterThan(300);

  // The float32 side: dust, and nowhere near the epsilon.
  if (noise.length > 0)
    expect(
      noise[noise.length - 1],
      `the largest response BELOW the epsilon is ${noise[noise.length - 1]} ft — it is closing on the epsilon and the two populations are no longer separable`,
    ).toBeLessThan(MORPH_EPS / 10);

  // The design side: the smallest thing any build changes on purpose.
  expect(
    design[0],
    `the smallest deliberate response in the catalogue is ${design[0].toFixed(5)} ft, which is under ten times the epsilon`,
  ).toBeGreaterThan(MORPH_EPS * 10);
});

test("a dimension only moves the axes the fixture's own extents say it moves", () => {
  /* The companion to the thickness rule, and the one that does not need to
     guess what a thickness is: grow a vanity's width and its stated height
     does not change, so NOTHING inside it may get taller. Derived from each
     kind's `extents`, which test 5 has already proved describes the real
     geometry. */
  const problems: string[] = [];
  for (const kind of kinds) for (const opts of optionCombos(kind)) problems.push(...ungovernedAxisProblems(kind, opts));
  expect(problems, problems.join("\n")).toEqual([]);

  /* The single allowance is only honest if the number in it is real. The
     dresser's shallowest drawer front is at eight drawers and its deepest at
     two; measure the gap from the four-drawer default rather than believing
     the comment beside it. */
  const dresser = FIXTURE_CATALOG.dresser;
  const front = (n: number): number => partSizes(dresser, dimsWith(dresser, "drawers", n), {}).drawer0[1];
  expect(front(4)).toBeCloseTo(0.61125, 5);
  expect(front(2) - front(4)).toBeCloseTo(0.64625, 5);
  expect(front(4) - front(8)).toBeCloseTo(0.323125, 5);
  expect(UNGOVERNED_ALLOWANCE[0].maxFt).toBeGreaterThan(0.64625);
  expect(UNGOVERNED_ALLOWANCE[0].maxFt, "the allowance has drifted away from the number it was measured at").toBeLessThan(0.66);
  expect(UNGOVERNED_ALLOWANCE).toHaveLength(1);
});

/* ============================================================= clearances */

test("no clearance figure claims more authority than it has", () => {
  const problems: string[] = [];
  for (const kind of kinds) {
    for (const opts of optionCombos(kind)) {
      const rules = kind.clearances({ ...defaultDims(kind) }, opts);
      const keys = rules.map((r) => r.key);
      if (new Set(keys).size !== keys.length)
        problems.push(`${kind.id} ${JSON.stringify(opts)}: two clearance rules share a key`);
      for (const rule of rules) {
        const problem = ruleProblem(kind.id, rule);
        if (problem) problems.push(`${kind.id}:${rule.key} ${JSON.stringify(opts)} — ${problem}`);
      }
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("nothing furniture-related is called CODE except the one appliance that is", () => {
  /* The rejection gate this node was given, as an assertion: a chair pull-out
     is not a code figure, and a wood cookstove's clearance is. */
  const claimed: string[] = [];
  for (const id of FURNITURE_KIND_IDS) {
    const kind = FIXTURE_CATALOG[id];
    for (const opts of optionCombos(kind)) {
      for (const rule of kind.clearances(defaultDims(kind), opts)) {
        if (rule.basis === "code") claimed.push(`${id}:${rule.key}`);
      }
    }
  }
  expect(unique(claimed).sort()).toEqual(["range:combustible", "range:floor-pad"]);

  // And that pair only exists on the wood option — the propane range makes no
  // code claim at all.
  const range = FIXTURE_CATALOG.range;
  const propane = range.clearances(defaultDims(range), { fuel: "propane" });
  expect(propane.every((r) => r.basis !== "code")).toBe(true);
  const wood = range.clearances(defaultDims(range), { fuel: "wood" });
  expect(wood.filter((r) => r.basis === "code").map((r) => r.key).sort()).toEqual(["combustible", "floor-pad"]);
  for (const r of wood.filter((rule) => rule.basis === "code")) {
    expect(r.source).toContain("CAN/CSA-B365");
    expect(r.verifiedAgainstSource).toBe(false);
  }
});

test("an option that changes what a fixture IS changes its clearances", () => {
  /* The wood stove's listing does it; three of the new kinds do it too, and a
     fixture whose option changes nothing is a fixture with a decorative
     control on it. */
  const cases: { id: FixtureKindId; key: string; a: string; b: string }[] = [
    { id: "range", key: "fuel", a: "propane", b: "wood" },
    { id: "wardrobe", key: "doors", a: "hinged", b: "sliding" },
    { id: "toilet", key: "type", a: "flush", b: "composting" },
    { id: "dining-table", key: "duty", a: "dining", b: "dining-and-work" },
  ];
  for (const c of cases) {
    const kind = FIXTURE_CATALOG[c.id];
    const dims = defaultDims(kind);
    const a = JSON.stringify(kind.clearances(dims, { [c.key]: c.a }));
    const b = JSON.stringify(kind.clearances(dims, { [c.key]: c.b }));
    expect(a, `${c.id}'s ${c.key} option does not change its clearances`).not.toBe(b);
  }
  // The composting toilet's facts talk about temperature and no water; the
  // flush one's talk about litres. Same fixture, different building.
  const toilet = FIXTURE_CATALOG.toilet;
  const composting = toilet.facts(defaultDims(toilet), { type: "composting" });
  expect(composting.some((f) => /freez/i.test(f.note ?? ""))).toBe(true);
  const flush = toilet.facts(defaultDims(toilet), { type: "flush" });
  expect(flush.some((f) => f.unit === "L" && f.value > 0)).toBe(true);
});

test("every surface a fixture is built from has a material in the palette", () => {
  /* SURFACES lives in components/builder/FixturePalette.tsx, keyed by
     FixtureSurface. A build that emits a surface with no entry renders
     untyped, so the file is read as text rather than imported — importing a
     client component into a pure spec would drag React and three's renderer in
     for one object literal. */
  const source = readFileSync(path.join(__dirname, "..", "components", "builder", "FixturePalette.tsx"), "utf8");
  const block = source.slice(source.indexOf("const SURFACES"), source.indexOf("function FixtureMesh"));
  const styled: string[] = [];
  const entry = /^\s{2}"?([a-z-]+)"?:\s*\{/gm;
  for (let m = entry.exec(block); m !== null; m = entry.exec(block)) styled.push(m[1]);

  // Prove the parse found the real table before trusting what it says.
  expect(styled.length).toBeGreaterThanOrEqual(10);
  expect(styled).toContain("stove");
  expect(styled).toContain("clearance-alert");
  expect(styled).not.toContain("no-such-surface");

  const used: string[] = [];
  for (const kind of kinds) {
    for (const opts of optionCombos(kind)) {
      for (const p of kind.build(defaultDims(kind), opts, { fallAxis: "x" })) used.push(p.surface);
    }
  }
  expect(used, "the bathroom fixtures should be built of the new surface").toContain("porcelain");
  const missing = unique(used).filter((s) => styled.indexOf(s) < 0);
  expect(missing, `these surfaces are built and have no entry in SURFACES: ${missing.join(", ")}`).toEqual([]);
});

/* ======================================================= the wire format */

/** A set of three PRE-EXISTING kinds, encoded before this node added anything.
 *  Adding kinds is additive: an old project must still produce byte-identical
 *  bytes, or every saved link in the world has quietly changed meaning. */
const LEGACY_SET: FixtureSet = {
  version: FIXTURES_VERSION,
  items: [
    {
      id: "wood-stove-1",
      kind: "wood-stove",
      label: "",
      dims: { widthFt: 2, depthFt: 1.7, heightFt: 2.2 },
      options: { listing: "listed", shield: "none" },
      placement: { mount: "floor", host: { kind: "volume", volumeId: "main" }, x: 0, z: 0, rotationDeg: 0 },
    },
    {
      id: "sofa-1",
      kind: "sofa",
      label: "By the window",
      dims: { widthFt: 7, depthFt: 3.2, heightFt: 2.7 },
      options: {},
      placement: { mount: "floor", host: { kind: "volume", volumeId: "main" }, x: 2.5, z: -3, rotationDeg: 180 },
    },
    {
      id: "solar-array-1",
      kind: "solar-array",
      label: "",
      dims: { kw: 6, rowsDeep: 3 },
      options: {},
      placement: { mount: "roof", volumeId: "main", planeIndex: 0, a: 0, s: 0 },
    },
  ],
};

const LEGACY_TOKEN =
  "F1reyJ2ZXJzaW9uIjoxLCJpdGVtcyI6W3siaWQiOiJ3b29kLXN0b3ZlLTEiLCJraW5kIjoid29vZC1zdG92ZSIsImxhYmVsIjoiIiwiZGltcyI6eyJ3aWR0aEZ0IjoyLCJkZXB0aEZ0IjoxLjcsImhlaWdodEZ0IjoyLjJ9LCJvcHRpb25zIjp7Imxpc3RpbmciOiJsaXN0ZWQiLCJzaGllbGQiOiJub25lIn0sInBsYWNlbWVudCI6eyJtb3VudCI6ImZsb29yIiwiaG9zdCI6eyJraW5kIjoidm9sdW1lIiwidm9sdW1lSWQiOiJtYWluIn0sIngiOjAsInoiOjAsInJvdGF0aW9uRGVnIjowfX0seyJpZCI6InNvZmEtMSIsImtpbmQiOiJzb2ZhIiwibGFiZWwiOiJCeSB0aGUgd2luZG93IiwiZGltcyI6eyJ3aWR0aEZ0Ijo3LCJkZXB0aEZ0IjozLjIsImhlaWdodEZ0IjoyLjd9LCJvcHRpb25zIjp7fSwicGxhY2VtZW50Ijp7Im1vdW50IjoiZmxvb3IiLCJob3N0Ijp7ImtpbmQiOiJ2b2x1bWUiLCJ2b2x1bWVJZCI6Im1haW4ifSwieCI6Mi41LCJ6IjotMywicm90YXRpb25EZWciOjE4MH19LHsiaWQiOiJzb2xhci1hcnJheS0xIiwia2luZCI6InNvbGFyLWFycmF5IiwibGFiZWwiOiIiLCJkaW1zIjp7Imt3Ijo2LCJyb3dzRGVlcCI6M30sIm9wdGlvbnMiOnt9LCJwbGFjZW1lbnQiOnsibW91bnQiOiJyb29mIiwidm9sdW1lSWQiOiJtYWluIiwicGxhbmVJbmRleCI6MCwiYSI6MCwicyI6MH19XX0";

test("adding kinds did not touch the wire format", () => {
  expect(FIXTURES_VERSION).toBe(1);
  expect(encodeFixtureSet(LEGACY_SET)).toBe(LEGACY_TOKEN);

  const back = decodeFixtureSet(LEGACY_TOKEN);
  expect(back).not.toBeNull();
  expect(back?.version).toBe(FIXTURES_VERSION);
  expect(back?.items.map((i) => i.kind)).toEqual(["wood-stove", "sofa", "solar-array"]);
  expect(back?.items[1].label).toBe("By the window");
  expect(back?.items[0].dims).toEqual({ widthFt: 2, depthFt: 1.7, heightFt: 2.2 });
  expect(back?.items[0].options).toEqual({ listing: "listed", shield: "none" });

  // Re-encoding what came back returns the same bytes: the round trip is
  // lossless, which is the property a saved project depends on.
  expect(back ? encodeFixtureSet(back) : "").toBe(LEGACY_TOKEN);
});

test("the pre-existing kinds' defaults did not move", () => {
  /* A furniture pass is exactly when somebody "tidies" an old default and
     changes what every existing saved fixture re-snaps to. */
  // Written as the source writes it — `80 * IN`, not `80 / 12`. Those are two
  // different floats, and the difference is real enough to fail this line.
  expect(defaultDims(FIXTURE_CATALOG.bed)).toEqual({ widthFt: 5, lengthFt: 80 * (1 / 12), heightFt: 2 });
  expect(defaultDims(FIXTURE_CATALOG.sofa)).toEqual({ widthFt: 7, depthFt: 3.2, heightFt: 2.7 });
  expect(defaultDims(FIXTURE_CATALOG["kitchen-island"])).toEqual({ widthFt: 6, depthFt: 3, heightFt: 3 });
  expect(defaultDims(FIXTURE_CATALOG["wood-stove"])).toEqual({ widthFt: 2, depthFt: 1.7, heightFt: 2.2 });
});

/* ====================================================== in the real resolver */

test("furniture goes through the same snap, collision and schedule as the plant", () => {
  const spec = defaultSpec();
  let set: FixtureSet = { version: FIXTURES_VERSION, items: [] };

  for (const id of ["dining-table", "dining-chair", "wardrobe", "toilet", "coat-rail"] as FixtureKindId[]) {
    const out = addFixture(spec, set, id);
    expect(out.problem, `${id} could not be added to the default home`).toBeNull();
    expect(out.id).not.toBeNull();
    set = out.set;
  }

  const res = resolveFixtures(spec, set);
  expect(res.items).toHaveLength(5);
  for (const item of res.items) {
    expect(item.fits, `${item.label} does not fit the default home`).toBe(true);
    expect(item.location.length).toBeGreaterThan(10);
  }

  const rows = fixtureSchedule(res);
  expect(rows.map((r) => r.tag)).toEqual(["F-1", "F-2", "F-3", "F-4", "W-1"]);
  for (const row of rows) {
    expect(row.sizeText).toMatch(/W × .* D × .* H/);
    for (const c of row.clearances) {
      expect(c.verifiedAgainstSource, `${row.kind}:${c.key} rides into the schedule claiming to be verified`).toBe(false);
      expect(c.source.length).toBeGreaterThan(9);
    }
  }
});

test("a woodpile inside the stove's clearance is a blocked issue, not a decision", () => {
  /* The point of putting furniture into this system rather than beside it: the
     firewood store is combustible, the stove's clearance is real, and the two
     meet in the resolver with no new code. */
  const spec = defaultSpec();
  const stove = addFixture(spec, { version: FIXTURES_VERSION, items: [] }, "wood-stove");
  expect(stove.id).not.toBeNull();
  let set = updateFixture(spec, stove.set, stove.id as string, {
    options: { listing: "unlisted", shield: "none" },
    placement: { mount: "floor", host: { kind: "volume", volumeId: "main" }, x: 0, z: 0, rotationDeg: 0 },
  });

  const wood = addFixture(spec, set, "firewood-store");
  expect(wood.id).not.toBeNull();
  set = updateFixture(spec, wood.set, wood.id as string, {
    placement: { mount: "floor", host: { kind: "volume", volumeId: "main" }, x: 0, z: 3, rotationDeg: 0 },
  });

  const res = resolveFixtures(spec, set);
  // Neither body is clamped or overlapping: this is a CLEARANCE conflict.
  for (const item of res.items) expect(item.clamped).toBe(false);
  const blocked = res.issues.filter((i) => i.severity === "blocked");
  expect(blocked.some((i) => i.ruleKey === "combustible" && /Firewood store/i.test(i.message))).toBe(true);

  // Move it across the room and the conflict goes away — otherwise the check
  // above would pass on a resolver that flags everything.
  const clear = updateFixture(spec, set, wood.id as string, {
    placement: { mount: "floor", host: { kind: "volume", volumeId: "main" }, x: 0, z: 8, rotationDeg: 0 },
  });
  const after = resolveFixtures(spec, clear);
  expect(after.issues.filter((i) => i.severity === "blocked" && i.ruleKey === "combustible")).toEqual([]);
});

/* ============================================== can these checks say no? */

test("the checks in this file reject a fixture that breaks the rules they name", () => {
  /* Every predicate above is only worth its runtime if it can fail. Each is
     shown here refusing the exact defect it exists to catch. */

  expect(blurbProblem({ id: "x" as FixtureKindId, label: "Thing", tag: "XX", blurb: "A thing." })).toContain("too short");
  expect(blurbProblem({ id: "x" as FixtureKindId, label: "Thing", tag: "XXX", blurb: FIXTURE_CATALOG.bed.blurb })).toContain("two capital letters");
  expect(blurbProblem({ id: "x" as FixtureKindId, label: "Thing", tag: "XX", blurb: `${FIXTURE_CATALOG.bed.blurb} 🛏` })).toContain("emoji");
  expect(blurbProblem(FIXTURE_CATALOG.bed)).toBeNull();

  const offGrid: FixtureKind = {
    ...FIXTURE_CATALOG.sofa,
    dimensions: [{ key: "widthFt", label: "Width", unit: "ft", min: 4, max: 12, step: 0.5, default: 7.2 }],
  };
  expect(dimensionProblem(offGrid, offGrid.dimensions[0])).toContain("off its own step grid");
  expect(dimensionProblem(FIXTURE_CATALOG.sofa, FIXTURE_CATALOG.sofa.dimensions[0])).toBeNull();

  const invented: ClearanceRule = {
    key: "made-up",
    label: "Sofa clearance",
    zone: "circulation",
    front: 3,
    back: 0,
    left: 0,
    right: 0,
    heightFt: null,
    from: "base",
    basis: "code",
    source: "the National Building Code of Canada, somewhere",
    verifiedAgainstSource: false,
    note: "a number somebody wanted to sound official",
  };
  expect(ruleProblem("sofa", invented)).toContain("documented list");
  expect(ruleProblem("sofa", { ...invented, basis: "indicative", source: "a working allowance" })).toContain("`none`");
  expect(ruleProblem("sofa", { ...invented, basis: "guideline", source: "NKBA Kitchen Planning Guidelines" })).toContain("not a code");
  expect(ruleProblem("sofa", { ...invented, basis: "manufacturer", source: "some manufacturer or other" })).toContain("manual");
  expect(ruleProblem("sofa", { ...invented, basis: "indicative", source: "none — a working allowance", front: -1 })).toContain("front is -1");
  expect(ruleProblem("wood-stove", FIXTURE_CATALOG["wood-stove"].clearances(defaultDims(FIXTURE_CATALOG["wood-stove"]), defaultOpts(FIXTURE_CATALOG["wood-stove"]))[0])).toBeNull();

  /* And the morph detector: a fixture that scales rather than morphs must be
     caught. This one multiplies every part by its width, which is precisely
     what `MORPH, NOT SCALE` forbids. */
  const scaled: FixtureKind = {
    ...FIXTURE_CATALOG["dining-table"],
    build: (d) => {
      const f = (d.lengthFt ?? 6) / 6;
      return FIXTURE_CATALOG["dining-table"]
        .build({ lengthFt: 6, widthFt: 3, heightFt: 2.5 }, {}, { fallAxis: "x" })
        .map((p) => ({ ...p, geometry: p.geometry.clone().scale(f, f, f) }));
    },
  };
  expect(scalesUniformly(scaled, "lengthFt")).toBe(true);
  expect(scalesUniformly(FIXTURE_CATALOG["dining-table"], "lengthFt")).toBe(false);
});

test("the morph rule refuses the breach a uniform-scale check cannot see", () => {
  /* THE counterexample, kept in the suite rather than in somebody's memory.

     A vanity whose countertop slab thickens in proportion to its width is a
     real violation of MORPH, NOT SCALE — a 6 ft vanity would be drawn with a
     2.9-inch slab and a 1.6 ft one with a 0.8-inch slab, and the schedule, the
     clearance box and the collision test would all agree with it. Nothing
     about it is exotic; it is what happens the first time somebody writes
     `w / 3` into a build to make a big vanity "look right".

     `scalesUniformly` cannot see it. It asks whether EVERY part changed on ALL
     THREE axes, and this vanity's basin, tap and toe are untouched, so it
     reports "not scaling" and passes. That is asserted below, because the
     reason this test exists is worth being able to point at. */
  const proportionalSlab: FixtureKind = {
    ...FIXTURE_CATALOG.vanity,
    build: (d, o, ctx) =>
      FIXTURE_CATALOG.vanity.build(d, o, ctx).map((p) => {
        if (p.id !== "counter") return p;
        const w = d.widthFt ?? 3;
        return { ...p, geometry: p.geometry.clone().scale(1, w / 3, 1) };
      }),
  };

  // The old whole-object check: silent.
  expect(
    scalesUniformly(proportionalSlab, "widthFt"),
    "if this ever reports true, the counterexample has stopped being the subtle one",
  ).toBe(false);

  // The per-part checks: both say no, and both name the part and the number.
  const thickness = thicknessProblems(proportionalSlab, {});
  expect(thickness.join("\n")).toContain('part "counter"');
  expect(thickness.join("\n")).toContain("Material thickness does not vary with a dimension");
  const ungoverned = ungovernedAxisProblems(proportionalSlab, {});
  expect(ungoverned.join("\n")).toContain('part "counter"');
  expect(ungoverned.join("\n")).toContain("does not move this fixture's stated height at all");

  // And the real vanity is clean under both, so the checks are refusing the
  // defect rather than refusing vanities.
  expect(thicknessProblems(FIXTURE_CATALOG.vanity, {})).toEqual([]);
  expect(ungovernedAxisProblems(FIXTURE_CATALOG.vanity, {})).toEqual([]);

  /* The same breach on an axis the dimension DOES govern — a slab that
     thickens with the vanity's own height. Rule A is blind to this one by
     construction, because the height is allowed to move; the thickness rule is
     the one that catches it, which is why both are here. */
  const slabTracksHeight: FixtureKind = {
    ...FIXTURE_CATALOG.vanity,
    build: (d, o, ctx) =>
      FIXTURE_CATALOG.vanity.build(d, o, ctx).map((p) => {
        if (p.id !== "counter") return p;
        const h = d.heightFt ?? 2.75;
        return { ...p, geometry: p.geometry.clone().scale(1, h / 2.75, 1) };
      }),
  };
  expect(ungovernedAxisProblems(slabTracksHeight, {})).toEqual([]);
  expect(thicknessProblems(slabTracksHeight, {}).join("\n")).toContain('part "counter"');
});

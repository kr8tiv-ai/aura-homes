import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "playwright/test";

import { OpeningPlanHandles, OPENING_GRAB_PX } from "@/components/builder/Plan2D";
import {
  OPENING_DRAG_SNAP_FT,
  OPENING_HANDLES_IN_PLAN,
  OPENING_HANDLE_STANDOFF_FT,
  applyOpeningEdit,
  checkOpening,
  openingBox,
  openingBoxFromEdgeDrag,
  openingBoxFromHeightDrag,
  openingFieldLabel,
  openingGestureLabel,
  openingHandles,
  openingRunFt,
  snapOpeningDrag,
  wallFrameWorld,
  wallHeadFt,
  type OpeningBox,
} from "@/components/builder/openingEdit";
import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import { wallThicknessFt } from "@/lib/builder/geometry";
import { PLAN_TEMPLATES } from "@/lib/builder/planCatalog";
import type { HomeSpec, Opening, Volume, Wall } from "@/lib/builder/spec";
import { pointOnWallLocal, toWorld } from "@/lib/builder/walls";

/* ═══════════════════════════════════════════════════════════════════════
   OPEN01 — CHANGING A WINDOW, MEASURED.

   The founder's sentence: "in the editor I can't easily change window size, or
   door placement for some reason, it should all be exceptionally easy and
   possible both from 3d and the floor plan, every feature you should be able
   to change super super easily."

   That is three defects, and this file measures the repair of each:

     1. DISCOVERABILITY. The 2D plan could already slide an opening and resize
        it from either end. The grips were 6 CSS px, drawn only once the
        pointer was already inside the grab radius, and the surface never
        changed cursor. Nothing here trusts a comment about that: the real
        component is rendered against the real stylesheet in a real browser at
        both themes and the pixels are read back.
     2. THE 3D GAP. There was no opening interaction in the model view at all.
        The handle model is pure, so it is measured directly — five grips, on
        the opening, moving with it.
     3. DIVERGENCE. Three surfaces, three ways of writing the same edit. Now
        one, and the proof is a HASH: a drag and the equivalent typed value
        produce byte-identical documents.

   WHY EACH ASSERTION CAN GO RED is written beside it, and the first test
   proves every detector in the file still discriminates. Two recent waves in
   this repo shipped claims written in comments that nothing checked and both
   were false; the rule that came out of it is that a claimed relationship is
   resolved by a real engine on real values or it is not claimed.
   ═══════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const read = (...segments: string[]) => readFileSync(path.join(appRoot, ...segments), "utf8");

const css = read("app/globals.css");
const plan2dSource = read("components/builder/Plan2D.tsx");
const specPanelSource = read("components/builder/SpecPanel.tsx");
const handlesSource = read("components/builder/OpeningHandles.tsx");
const builderAppSource = read("components/builder/BuilderApp.tsx");

/* ---------------------------------------------------------------------
   THE JSX HARNESS. Playwright's babel transform rewrites JSX in project
   files into its component-test envelope — `{ __pw_type: "jsx", type,
   props, key }` — rather than into React elements, so the tree is converted
   back. Lifted verbatim from builder-craft.spec.ts, which lifted it from
   margin-stack.spec.ts.
--------------------------------------------------------------------- */
interface PwJsx {
  __pw_type: "jsx";
  type: unknown;
  props?: Record<string, unknown>;
  key?: unknown;
}

const isPwJsx = (value: unknown): value is PwJsx =>
  typeof value === "object" && value !== null && (value as PwJsx).__pw_type === "jsx";

const isPwFragment = (value: unknown): boolean =>
  typeof value === "object" && value !== null && "__pw_jsx_fragment" in (value as object);

const wrappedComponents = new Map<unknown, unknown>();

function asReact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(asReact);
  if (!isPwJsx(node)) return node;
  const { children, ...rest } = node.props ?? {};
  const props: Record<string, unknown> = { ...rest };
  if (node.key !== undefined && node.key !== null) props.key = node.key;
  const resolved = isPwFragment(node.type) ? Fragment : node.type;
  const type = typeof resolved === "function" ? wrapComponent(resolved) : resolved;
  if (children === undefined) return createElement(type as never, props);
  const kids = (Array.isArray(children) ? children : [children]).map(asReact);
  return createElement(type as never, props, ...(kids as never[]));
}

function wrapComponent(component: unknown): unknown {
  const cached = wrappedComponents.get(component);
  if (cached !== undefined) return cached;
  const wrapper = (props: Record<string, unknown>) =>
    asReact((component as (p: Record<string, unknown>) => unknown)(props));
  Object.defineProperty(wrapper, "name", {
    value: (component as { name?: string }).name ?? "Anonymous",
  });
  wrappedComponents.set(component, wrapper);
  return wrapper;
}

const jsx = (type: unknown, props: Record<string, unknown>): PwJsx => ({
  __pw_type: "jsx",
  type,
  props,
});

/* ------------------------------------------------------------- fixtures */

const DOCUMENT = defaultBuilderDocument();
const SPEC = DOCUMENT.spec;
const MAIN = SPEC.volumes[0];

const volumeOf = (spec: HomeSpec, id: string): Volume => {
  const v = spec.volumes.find((x) => x.id === id);
  if (!v) throw new Error(`no volume ${id}`);
  return v;
};

const openingOf = (spec: HomeSpec, volumeId: string, openingId: string): Opening => {
  const o = volumeOf(spec, volumeId).openings.find((x) => x.id === openingId);
  if (!o) throw new Error(`no opening ${openingId}`);
  return o;
};

const hashOf = (spec: HomeSpec): string => hashBuilderDocument({ ...DOCUMENT, spec });

/** `openingEdit.ts`'s `qFt` rounds every world coordinate to a thousandth of a
 *  foot — a hundredth of an inch, below anything this system draws. A distance
 *  read back along an arbitrary bearing therefore carries up to √2 thousandths
 *  of that lattice, and this is that bound, not slack. */
const QUANTISATION_FT = 0.0015;

/* ═══════════════════════════════════════════════════════════════════════
   THE INDEPENDENT ORACLE

   Deliberately NOT `checkOpening` from the module under test — this is the
   arithmetic `plan-catalog.spec.ts` applies to all 55 library plans, written
   out again here so a bug shared by the mutator and its own checker cannot
   pass both. The two-axis rule is the important half and it is quoted from
   that file's own comment: an opening pair is only in conflict when its spans
   overlap horizontally AND vertically, because six two-storey plans stack
   windows on the same horizontal metres ten feet apart and that is a building.
   ═══════════════════════════════════════════════════════════════════════ */

interface Offence {
  where: string;
  what: string;
}

function catalogueRuleOffences(spec: HomeSpec): Offence[] {
  const out: Offence[] = [];
  for (const volume of spec.volumes) {
    const head = volume.wallHeightFt * volume.storeys;
    for (const o of volume.openings) {
      const run = openingRunFt(spec, volume, o.wall);
      if (o.offsetFt < -1e-9) out.push({ where: `${volume.id}/${o.id}`, what: "offset is negative" });
      if (o.offsetFt + o.widthFt > run + 1e-9) {
        out.push({ where: `${volume.id}/${o.id}`, what: "runs off the end of its wall" });
      }
      if (o.sillFt < -1e-9) out.push({ where: `${volume.id}/${o.id}`, what: "sill is below the floor" });
      if (o.sillFt + o.heightFt > head + 1e-9) {
        out.push({ where: `${volume.id}/${o.id}`, what: "runs out through the top of its wall" });
      }
    }
    const byWall = new Map<Wall, Opening[]>();
    for (const o of volume.openings) byWall.set(o.wall, [...(byWall.get(o.wall) ?? []), o]);
    byWall.forEach((list, wall) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const dx =
            Math.min(a.offsetFt + a.widthFt, b.offsetFt + b.widthFt) -
            Math.max(a.offsetFt, b.offsetFt);
          const dy =
            Math.min(a.sillFt + a.heightFt, b.sillFt + b.heightFt) - Math.max(a.sillFt, b.sillFt);
          if (dx > 1e-9 && dy > 1e-9) {
            out.push({ where: `${volume.id}/${wall} ${a.id}+${b.id}`, what: "overlaps" });
          }
        }
      }
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   1. THE DETECTORS CAN ACTUALLY FAIL
   ═══════════════════════════════════════════════════════════════════════ */

test("every detector in this file discriminates", () => {
  /* The oracle. A clean document must report nothing, and each of the three
     forbidden states must be reported — otherwise every "no offences" below is
     a scan that measures nothing. */
  expect(catalogueRuleOffences(SPEC)).toEqual([]);

  const offWall: HomeSpec = {
    ...SPEC,
    volumes: [{ ...MAIN, openings: [{ ...openingOf(SPEC, "main", "o3"), offsetFt: 900 }] }],
  };
  expect(catalogueRuleOffences(offWall).map((x) => x.what)).toContain(
    "runs off the end of its wall",
  );

  const throughTheTop: HomeSpec = {
    ...SPEC,
    volumes: [{ ...MAIN, openings: [{ ...openingOf(SPEC, "main", "o3"), sillFt: 8, heightFt: 8 }] }],
  };
  expect(catalogueRuleOffences(throughTheTop).map((x) => x.what)).toContain(
    "runs out through the top of its wall",
  );

  const overlapping: HomeSpec = {
    ...SPEC,
    volumes: [
      {
        ...MAIN,
        openings: [
          { id: "a", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 2, sillFt: 3 },
          { id: "b", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 5, sillFt: 3 },
        ],
      },
    ],
  };
  expect(catalogueRuleOffences(overlapping).map((x) => x.what)).toContain("overlaps");

  /* The two-axis half. The SAME horizontal span, stacked vertically, is a
     two-storey building and must NOT be reported — a one-axis oracle would
     call this an overlap and would quietly make the mutator's real behaviour
     untestable. */
  const stacked: HomeSpec = {
    ...SPEC,
    volumes: [
      {
        ...MAIN,
        storeys: 2,
        openings: [
          { id: "a", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 2, sillFt: 3 },
          { id: "b", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 2, sillFt: 12 },
        ],
      },
    ],
  };
  expect(catalogueRuleOffences(stacked)).toEqual([]);

  /* The hash. Two different documents must hash differently, or every
     "identical hash" assertion below passes on a constant. */
  expect(hashOf(SPEC)).not.toBe(hashOf(offWall));
  expect(hashOf(SPEC)).toBe(hashOf(SPEC));

  /* The source scanners. Each must find something that is there and miss
     something that is not. */
  expect(plan2dSource).toContain("applyOpeningEdit");
  expect(plan2dSource).not.toContain("applyOpeningEditThatDoesNotExist");
  expect(specPanelSource.length).toBeGreaterThan(20_000);
  expect(handlesSource.length).toBeGreaterThan(10_000);
  expect(builderAppSource.length).toBeGreaterThan(50_000);
});

/* ═══════════════════════════════════════════════════════════════════════
   2. ONE MUTATION PATH — the hardest requirement, proved by a hash
   ═══════════════════════════════════════════════════════════════════════ */

test("a 3D drag and the equivalent typed value produce an identical document and an identical hash", () => {
  const o = openingOf(SPEC, "main", "o3");

  /* THE 3D PATH, arithmetic for arithmetic. `OpeningHandles` computes a slide
     as `{ offsetFt: snapOpeningDrag(o.offsetFt + (cursor − grab)) }` — this is
     that expression with the pointer delta filled in, which is why it is a
     genuine second path and not a rename of the first. */
  const pointerDeltaFt = 2.31;
  const dragged = applyOpeningEdit(SPEC, "main", "o3", {
    offsetFt: snapOpeningDrag(o.offsetFt + pointerDeltaFt),
  });

  /* THE TYPED PATH. `OpeningNumbers` and `SpecPanel` both call the mutator
     with one key of the box; the value is what a person would read off the
     drag and type back in. */
  const typed = applyOpeningEdit(SPEC, "main", "o3", { offsetFt: 10.25 });

  /* The drag really did land on the typed number rather than the test having
     chosen a number that could not miss. */
  expect(snapOpeningDrag(o.offsetFt + pointerDeltaFt)).toBe(10.25);
  expect(dragged.changed).toBe(true);
  expect(dragged.box).toEqual(typed.box);
  expect(dragged.spec).toEqual(typed.spec);
  expect(hashOf(dragged.spec)).toBe(hashOf(typed.spec));

  /* And the edit actually happened: without this, "identical" would be
     satisfied by two calls that both did nothing. */
  expect(hashOf(dragged.spec)).not.toBe(hashOf(SPEC));
  expect(openingOf(dragged.spec, "main", "o3").offsetFt).toBe(10.25);
});

test("a 2D end-drag and a 3D end-drag of the same edge to the same point are one edit", () => {
  const o = openingOf(SPEC, "main", "o3");
  /* Both surfaces build the box with `openingBoxFromEdgeDrag`, which is the
     point: the pinned-edge decision is stated once. Plan2D snaps through
     `snapScalar` and the 3D layer through `snapOpeningDrag`; land them on the
     same foot and the documents must be byte-identical. */
  const target = 14;
  const inPlan = applyOpeningEdit(SPEC, "main", "o3", openingBoxFromEdgeDrag(o, 1, target));
  const inModel = applyOpeningEdit(
    SPEC,
    "main",
    "o3",
    openingBoxFromEdgeDrag(o, 1, snapOpeningDrag(target)),
  );
  expect(inPlan.changed).toBe(true);
  expect(inPlan.spec).toEqual(inModel.spec);
  expect(hashOf(inPlan.spec)).toBe(hashOf(inModel.spec));

  /* The far edge is PINNED, which is what makes the gesture read as "wider on
     this side" instead of "recentred". */
  expect(inPlan.box.offsetFt).toBe(o.offsetFt);
  expect(inPlan.box.widthFt).toBe(target - o.offsetFt);
});

test("no surface writes an opening's size or position any other way", () => {
  /* The behavioural tests above prove the FUNCTION is consistent. This proves
     the three surfaces actually call it — otherwise a fourth private clamp
     could reappear and every hash assertion above would still be green.

     `moveOpening` and `resizeOpening` (walls.ts) clamp an opening to its wall
     and know nothing about the opening beside it. `patchOpening` (edits.ts) is
     a spread with no clamp at all. Those three names are what this test hunts
     for in the places that draw and type an opening's dimensions. */
  /* WORD-BOUNDARY, NOT SUBSTRING, and the first version of this test got it
     wrong in exactly the way Plan2D's own header warns about: `includes(
     "moveOpening(")` fires on `removeOpening(`, which is a different function
     that this file still legitimately calls. A substring test on an identifier
     is a bug waiting for the first name that contains another one. */
  const forbiddenInPlan = [/\bmoveOpening\(/, /\bresizeOpening\(/];
  for (const pattern of forbiddenInPlan) {
    expect(
      pattern.test(plan2dSource),
      `Plan2D.tsx calls ${pattern.source} — every opening gesture must go through applyOpeningEdit`,
    ).toBe(false);
  }
  /* Both halves of that boundary, so the scanner is neither blind nor
     trigger-happy. */
  expect(/\bmoveOpening\(/.test("removeOpening(spec, v, o)")).toBe(false);
  expect(/\bmoveOpening\(/.test("moveOpening(spec, v, o, 3)")).toBe(true);

  /* SpecPanel keeps `patchOpening` for `wall` and `kind`, which are changes of
     IDENTITY rather than of size, and the wall change is followed by the
     mutator re-legalising the box on its new run. What it must not do is write
     one of the four DIMENSIONS with it. */
  for (const field of ["widthFt", "heightFt", "offsetFt", "sillFt"]) {
    expect(
      new RegExp(`patchOpening\\([^)]*\\{[^}]*\\b${field}\\b`).test(specPanelSource),
      `SpecPanel.tsx writes ${field} through patchOpening instead of applyOpeningEdit`,
    ).toBe(false);
  }
  expect(specPanelSource).toContain("applyOpeningEdit(");
  expect(handlesSource).toContain("applyOpeningEdit(");
  expect(plan2dSource).toContain("applyOpeningEdit(");

  /* The regex really can fire, so a `false` above is a finding rather than a
     scanner that stopped matching. */
  expect(
    new RegExp("patchOpening\\([^)]*\\{[^}]*\\bwidthFt\\b").test(
      "patchOpening(spec, v, o, { widthFt })",
    ),
  ).toBe(true);
});

/* ═══════════════════════════════════════════════════════════════════════
   3. AN OPENING MAY NOT LEAVE ITS WALL, AND MAY NOT OVERLAP ANOTHER
   ═══════════════════════════════════════════════════════════════════════ */

/** Asks that would each produce a forbidden state if nothing refused them. */
const HOSTILE_ASKS: ReadonlyArray<Partial<OpeningBox>> = [
  { offsetFt: -40 },
  { offsetFt: 400 },
  { widthFt: 220 },
  { widthFt: 0.01 },
  { sillFt: -12 },
  { sillFt: 90 },
  { heightFt: 300 },
  { offsetFt: 500, widthFt: 500 },
  { sillFt: 40, heightFt: 40 },
];

const offenceKeys = (spec: HomeSpec): string[] =>
  catalogueRuleOffences(spec)
    .map((x) => `${x.where}: ${x.what}`)
    .sort();

test("no ask, however hostile, can push an opening into a state the catalogue forbids", () => {
  /* Every plan in the library, every opening in it, every hostile ask — and
     the result is judged by the INDEPENDENT oracle above rather than by the
     module's own checker.

     THE CLAIM IS "NO NEW OFFENCE", NOT "NO OFFENCE", and the difference is a
     real finding rather than a softening.

     `plan-catalog.spec.ts` measures an east or west wall's run as
     `volume.depthFt`. The wall that actually gets BUILT is `wallRunFt`, which
     is `depthFt − 2 × wallThicknessFt`, because the e and w walls butt INTO the
     n and s ones — geometry.ts says so at the definition and adds "the UI
     should clamp `Opening.offsetFt` against this, not against `depthFt`". Four
     openings in three library plans sit in the gap between the two figures and
     overhang the wall they are built on:

       vinterhage-house  sunspace/glass-e     ends 9.000 on an 8.917 ft wall
       vinterhage-house  sunspace/glass-w     ends 9.000 on an 8.917 ft wall
       karnapp-bay       bay/glass-bay-e      ends 5.500 on a  4.917 ft wall
       familie-fire      main/win-e-upper2    ends 29.000 on a 28.917 ft wall

     `geometry.ts` trims each and reports it, so nothing is drawn wrong — but
     the catalogue's gate calls legal what the geometry calls trimmed, and that
     is the finding. `applyOpeningEdit` refuses to make an existing fault worse
     and equally refuses to pretend it fixed one, so the honest assertion here
     is a DELTA. It still goes red the instant an edit introduces anything. */
  let asks = 0;
  let refusedAtLeastOnce = 0;
  const plansWithPreexistingFaults: string[] = [];
  for (const plan of PLAN_TEMPLATES) {
    const before = offenceKeys(plan.spec);
    if (before.length > 0) plansWithPreexistingFaults.push(plan.id);
    for (const volume of plan.spec.volumes) {
      for (const o of volume.openings) {
        for (const want of HOSTILE_ASKS) {
          asks += 1;
          const result = applyOpeningEdit(plan.spec, volume.id, o.id, want);
          if (result.refusals.length > 0) refusedAtLeastOnce += 1;
          const introduced = offenceKeys(result.spec).filter((key) => !before.includes(key));
          expect(
            introduced,
            `${plan.id} ${volume.id}/${o.id} accepted ${JSON.stringify(want)}`,
          ).toEqual([]);
        }
      }
    }
  }

  /* The sweep really ran over the whole library, and the mutator really did
     have to refuse things — a run in which nothing was ever refused would mean
     the hostile asks stopped being hostile. */
  expect(asks).toBeGreaterThan(1000);
  expect(refusedAtLeastOnce).toBeGreaterThan(asks / 2);

  /* And the "no NEW offence" form is not quietly covering a library that is
     mostly faulty: the three plans are named, so a future plan that overhangs
     its own wall cannot hide behind the delta — this goes red naming it. */
  expect(
    plansWithPreexistingFaults.sort(),
    "a catalogue plan's openings changed relative to the BUILT wall run — read the note above before re-pinning; the fix is plan-catalog.spec.ts measuring e/w walls with wallRunFt rather than depthFt, which is PL03's file, not this node's",
  ).toEqual(["familie-fire", "karnapp-bay", "vinterhage-house"]);
});

test("a slide stops against the opening beside it instead of cutting into it", () => {
  /* The reference home's south wall: a 3 ft door at 3–6 ft and a 16 ft glazing
     wall at 9–25 ft, both starting at the floor. Dragging the door east past
     the glass is the exact gesture that authored `bro-breezeway`'s door-in-a-
     pane-of-glass, and it now stops with the jambs touching. */
  const door = openingOf(SPEC, "main", "o2");
  const glass = openingOf(SPEC, "main", "o1");
  expect(door.offsetFt + door.widthFt).toBeLessThanOrEqual(glass.offsetFt);

  const result = applyOpeningEdit(SPEC, "main", "o2", { offsetFt: 20 });
  expect(result.box.offsetFt).toBe(glass.offsetFt - door.widthFt);
  expect(result.box.widthFt).toBe(door.widthFt);
  expect(result.refusals.join(" ")).toContain("Stopped against the opening beside it");
  expect(catalogueRuleOffences(result.spec)).toEqual([]);
  expect(checkOpening(result.spec, "main", "o2").clashes).toEqual([]);

  /* Widening it eastward gives up WIDTH and keeps its left jamb, because the
     caller named the size — a move and a resize are different gestures and the
     mutator is told which one it is. */
  const widened = applyOpeningEdit(SPEC, "main", "o2", openingBoxFromEdgeDrag(door, 1, 20));
  expect(widened.box.offsetFt).toBe(door.offsetFt);
  expect(widened.box.offsetFt + widened.box.widthFt).toBe(glass.offsetFt);
  expect(catalogueRuleOffences(widened.spec)).toEqual([]);
});

test("stacked openings on a two-storey wall are neighbours vertically and not horizontally", () => {
  /* THE SECOND AXIS IS NOT OPTIONAL. `plan-catalog.spec.ts` records that the
     first version of its own gate got this wrong and immediately failed
     `massiv-clt`, which stacks a lower and an upper window on the same wall
     run. A mutator that treated any horizontal overlap as a conflict would
     make that building unbuildable here. */
  const spec: HomeSpec = {
    ...SPEC,
    volumes: [
      {
        ...MAIN,
        storeys: 2,
        openings: [
          { id: "lo", wall: "n", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 4, sillFt: 3 },
          { id: "hi", wall: "n", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 4, sillFt: 12.5 },
        ],
      },
    ],
  };
  expect(catalogueRuleOffences(spec)).toEqual([]);

  /* Sliding the LOWER one horizontally is unobstructed: the upper window is
     ten feet above it and is not in its way. */
  const slid = applyOpeningEdit(spec, "main", "lo", { offsetFt: 12 });
  expect(slid.box.offsetFt).toBe(12);
  expect(slid.refusals).toEqual([]);

  /* Raising it INTO the upper one is obstructed, and stops at its sill. */
  const raised = applyOpeningEdit(spec, "main", "lo", { sillFt: 11 });
  expect(raised.box.sillFt + raised.box.heightFt).toBeLessThanOrEqual(12.5 + 1e-9);
  expect(raised.refusals.join(" ")).toContain("Stopped against the opening above or below it");
  expect(catalogueRuleOffences(raised.spec)).toEqual([]);
});

test("an opening's head stops at the eave, and the refusal says which wall it is", () => {
  const head = wallHeadFt(MAIN);
  const result = applyOpeningEdit(SPEC, "main", "o4", { heightFt: 40 });
  expect(result.box.sillFt + result.box.heightFt).toBeLessThanOrEqual(head + 1e-9);
  expect(result.refusals.join(" ")).toContain(head.toFixed(2));
  expect(catalogueRuleOffences(result.spec)).toEqual([]);
});

test("a legal edit is refused nothing, so a refusal means something", () => {
  /* The other half of every refusal assertion above. Without it, a mutator
     that refused EVERYTHING would score full marks. */
  const clean = applyOpeningEdit(SPEC, "main", "o3", { offsetFt: 9 });
  expect(clean.changed).toBe(true);
  expect(clean.refusals).toEqual([]);
  expect(clean.box.offsetFt).toBe(9);
});

test("every refusal is a sentence a person can read", () => {
  const seen: string[] = [];
  for (const want of HOSTILE_ASKS) {
    for (const id of ["o1", "o2", "o3", "o4"]) {
      for (const line of applyOpeningEdit(SPEC, "main", id, want).refusals) {
        if (!seen.includes(line)) seen.push(line);
      }
    }
  }
  expect(seen.length).toBeGreaterThan(2);
  for (const line of seen) {
    expect(line.length, `refusal is too short to explain anything: ${line}`).toBeGreaterThan(24);
    expect(line.endsWith("."), `refusal is not a sentence: ${line}`).toBe(true);
    expect(line, "a refusal leaked an internal value").not.toMatch(
      /undefined|NaN|\[object|null\b/,
    );
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   4. ONE GESTURE IS ONE UNDO STEP
   ═══════════════════════════════════════════════════════════════════════ */

/* The rule is BuilderApp's, and this node may not open that file — so the rule
   is pinned by its exact source line and then driven. If somebody changes how
   history coalesces, this goes red naming the line, instead of the labels below
   quietly meaning nothing. */
const COALESCE_RULE = "const coalesce = label === state.label && state.past.length > 0;";

test("a drag is one history entry and a typed value after it is a second", () => {
  expect(
    builderAppSource.includes(COALESCE_RULE),
    "BuilderApp's history rule has changed — re-read commit() and update this spec's model of it, do not delete the test",
  ).toBe(true);
  expect(builderAppSource.includes(COALESCE_RULE.replace("===", "!=="))).toBe(false);

  /* The reducer's rule, applied to a real sequence of edits. */
  const entries: string[] = [];
  let lastLabel: string | null = null;
  const commit = (label: string) => {
    if (!(label === lastLabel && entries.length > 0)) entries.push(label);
    lastLabel = label;
  };

  const dragLabel = openingGestureLabel("3d", "o3", 1);
  commit(dragLabel); // pointerdown → first frame
  commit(dragLabel); // …and sixty more
  commit(dragLabel);
  expect(entries.length).toBe(1);

  commit(openingFieldLabel("o3", "offsetFt")); // then somebody types a number
  expect(entries.length).toBe(2);

  const secondDrag = openingGestureLabel("3d", "o3", 2);
  commit(secondDrag);
  expect(entries.length).toBe(3);

  /* And the three label shapes really are distinct — the property the rule
     above depends on. */
  expect(dragLabel).not.toBe(secondDrag);
  expect(dragLabel).not.toBe(openingFieldLabel("o3", "offsetFt"));
  expect(openingFieldLabel("o3", "offsetFt")).not.toBe(openingFieldLabel("o3", "widthFt"));
  expect(openingGestureLabel("3d", "o3", 1)).not.toBe(openingGestureLabel("plan", "o3", 1));
});

/* ═══════════════════════════════════════════════════════════════════════
   5. THE 3D HANDLES EXIST, AND THEY ARE ON THE OPENING
   ═══════════════════════════════════════════════════════════════════════ */

test("a selected opening carries five grips, on its own wall, standing proud of it", () => {
  const handles = openingHandles(SPEC, "main", "o3");
  expect(handles.map((h) => h.kind)).toEqual(["slide", "edge-0", "edge-1", "sill", "head"]);

  /* Nothing is drawn for a selection that is not there. */
  expect(openingHandles(SPEC, "main", "nope")).toEqual([]);
  expect(openingHandles(SPEC, "nope", "o3")).toEqual([]);

  const o = openingOf(SPEC, "main", "o3");
  const th = wallThicknessFt(SPEC.material);
  const frame = wallFrameWorld(MAIN, o.wall, th);
  const zero = toWorld(MAIN, pointOnWallLocal(MAIN, o.wall, th, 0));

  for (const h of handles) {
    /* EVERY grip stands proud of the wall face, measured by projecting onto
       the wall's own outward normal.

       THE FIRST VERSION OF THIS CHECK WAS DECORATION and a mutation caught it:
       it compared the measured distance to `OPENING_HANDLE_STANDOFF_FT`, which
       is the constant the measured distance was computed FROM, so setting the
       standoff to zero — burying every grip inside the cladding, where it
       z-fights and cannot be seen — passed. The bounds below are independent of
       that constant: at least an inch, because two coplanar surfaces z-fight at
       ordinary camera distances and an invisible grip is this node's entire
       failure mode; at most a foot, because further out it stops reading as
       attached to the wall it belongs to. The equality is kept as well, so a
       drift in the constant is still named. */
    const outward =
      (h.position[0] - zero.x) * frame.out.x + (h.position[2] - zero.z) * frame.out.z;
    expect(outward, `${h.kind} is not clear of the wall face`).toBeGreaterThan(1 / 12);
    expect(outward, `${h.kind} floats off the wall`).toBeLessThan(1);
    expect(Math.abs(outward - OPENING_HANDLE_STANDOFF_FT)).toBeLessThan(QUANTISATION_FT);

    /* And each sits ON the wall's run rather than beside it.
       THE TOLERANCE IS THE QUANTISATION, not slack: `openingHandles` rounds
       each world coordinate to `qFt`'s thousandth of a foot, so a distance
       measured along an arbitrary bearing can differ from the exact value by
       up to √2 thousandths. Anything looser than that would stop measuring
       and anything tighter would fail on arithmetic rather than on a defect. */
    const along = (h.position[0] - zero.x) * frame.run.x + (h.position[2] - zero.z) * frame.run.z;
    expect(along).toBeGreaterThanOrEqual(o.offsetFt - QUANTISATION_FT);
    expect(along).toBeLessThanOrEqual(o.offsetFt + o.widthFt + QUANTISATION_FT);

    /* Big enough to hit, and it says what it does. */
    expect(h.sizeFt).toBeGreaterThanOrEqual(0.75);
    expect(h.label.length).toBeGreaterThan(12);
    expect(["grab", "ew-resize", "ns-resize"]).toContain(h.cursor);
  }

  /* The five are five PLACES, not one place five times. */
  const places = new Set(handles.map((h) => h.position.join(",")));
  expect(places.size).toBe(5);

  /* The two edges are the opening's own jambs, and the sill and head are its
     own sill and head — a grip that did not track the thing it grips is the
     whole failure mode of a handle layer. */
  const byKind = new Map(handles.map((h) => [h.kind, h]));
  const at = (kind: string): number => {
    const h = byKind.get(kind as never);
    if (!h) throw new Error(kind);
    return (h.position[0] - zero.x) * frame.run.x + (h.position[2] - zero.z) * frame.run.z;
  };
  expect(Math.abs(at("edge-0") - o.offsetFt)).toBeLessThan(QUANTISATION_FT);
  expect(Math.abs(at("edge-1") - (o.offsetFt + o.widthFt))).toBeLessThan(QUANTISATION_FT);
  /* Height is not projected through a bearing, so it is exact. */
  expect(byKind.get("sill")?.position[1]).toBe(o.sillFt);
  expect(byKind.get("head")?.position[1]).toBe(o.sillFt + o.heightFt);
});

test("the grips move with the opening, on every wall and at any bearing", () => {
  /* `wallFrameWorld` claims `(-run.z, run.x)` is the outward normal for all
     four walls at any rotation. That is exactly the sort of claim this repo has
     shipped wrong in a comment, so it is checked against the geometry: the
     outward normal must point AWAY from the volume's centre. */
  for (const rotationDeg of [0, 35, 137, 250]) {
    for (const wall of ["n", "s", "e", "w"] as const) {
      const volume: Volume = { ...MAIN, rotationDeg };
      const spec: HomeSpec = { ...SPEC, volumes: [volume] };
      const th = wallThicknessFt(spec.material);
      const frame = wallFrameWorld(volume, wall, th);
      const mid = toWorld(volume, pointOnWallLocal(volume, wall, th, 1));
      const toCentre = { x: volume.x - mid.x, z: volume.z - mid.z };
      expect(
        frame.out.x * toCentre.x + frame.out.z * toCentre.z,
        `the ${wall} wall's normal points inward at ${rotationDeg}°`,
      ).toBeLessThan(0);
      expect(Math.hypot(frame.out.x, frame.out.z)).toBeCloseTo(1, 9);
      expect(frame.run.x * frame.out.x + frame.run.z * frame.out.z).toBeCloseTo(0, 9);
    }
  }

  /* And a slid opening takes its grips with it, by the distance it moved. */
  const before = openingHandles(SPEC, "main", "o3");
  const moved = applyOpeningEdit(SPEC, "main", "o3", { offsetFt: 12 });
  const after = openingHandles(moved.spec, "main", "o3");
  const delta = 12 - openingOf(SPEC, "main", "o3").offsetFt;
  for (let i = 0; i < before.length; i++) {
    const travelled = Math.hypot(
      after[i].position[0] - before[i].position[0],
      after[i].position[2] - before[i].position[2],
    );
    expect(
      Math.abs(travelled - Math.abs(delta)),
      `${before[i].kind} did not follow its opening`,
    ).toBeLessThan(QUANTISATION_FT);
  }
});

test("the sill and head grips are the 3D view's own gestures and change the box", () => {
  /* A floor plan has no height in it, so these two cannot exist there — which
     is why "possible both from 3D and the floor plan" needs both views rather
     than one of them twice. */
  expect(OPENING_HANDLES_IN_PLAN).toEqual(["slide", "edge-0", "edge-1"]);

  const o = openingOf(SPEC, "main", "o3");
  const raised = applyOpeningEdit(
    SPEC,
    "main",
    "o3",
    openingBoxFromHeightDrag(o, "head", snapOpeningDrag(o.sillFt + 5.4)),
  );
  expect(raised.box.sillFt).toBe(o.sillFt);
  expect(raised.box.heightFt).toBe(5.5);
  expect(catalogueRuleOffences(raised.spec)).toEqual([]);

  const lowered = applyOpeningEdit(SPEC, "main", "o3", openingBoxFromHeightDrag(o, "sill", 1.5));
  expect(lowered.box.sillFt).toBe(1.5);
  expect(lowered.box.sillFt + lowered.box.heightFt).toBe(o.sillFt + o.heightFt);
});

/* ═══════════════════════════════════════════════════════════════════════
   6. DISCOVERABILITY, MEASURED IN A BROWSER

   The founder could not find a feature that already worked. These are the
   pixels that were wrong, read back from a real engine with the real
   stylesheet attached, in both themes.
   ═══════════════════════════════════════════════════════════════════════ */

const MARKS = OPENING_HANDLES_IN_PLAN.map((kind, i) => ({
  kind,
  at: { x: 120 + i * 90, y: 140 },
}));

const HANDLE_PAGE = `<main><svg id="plan" width="420" height="280" viewBox="0 0 420 280">${renderToStaticMarkup(
  asReact(jsx(OpeningPlanHandles, { marks: MARKS, grabPx: OPENING_GRAB_PX })) as never,
)}<circle id="control" cx="20" cy="20" r="6" /></svg></main>`;

async function mountPlan(page: import("playwright/test").Page, theme: "light" | "dark") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 900, height: 700 });
  await page.setContent(HANDLE_PAGE);
  await page.addStyleTag({ content: css });
  await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
}

interface HandleProbe {
  kind: string;
  cursor: string;
  ringWidth: number;
  ringHeight: number;
  ringFill: string;
  ringStroke: string;
  markWidth: number;
  markFill: string;
}

const probeHandles = (page: import("playwright/test").Page): Promise<HandleProbe[]> =>
  page.$$eval(".opening-plan-handle", (nodes: Element[]) =>
    nodes.map((node) => {
      const ring = node.querySelector(".opening-plan-handle__ring") as SVGGraphicsElement;
      const mark = node.querySelector(".opening-plan-handle__mark") as SVGGraphicsElement;
      const ringBox = ring.getBoundingClientRect();
      const markBox = mark.getBoundingClientRect();
      const ringStyle = getComputedStyle(ring);
      return {
        kind: node.getAttribute("data-opening-handle") ?? "",
        cursor: getComputedStyle(node).cursor,
        ringWidth: ringBox.width,
        ringHeight: ringBox.height,
        ringFill: ringStyle.fill,
        ringStroke: ringStyle.stroke,
        markWidth: markBox.width,
        markFill: getComputedStyle(mark).fill,
      };
    }),
  );

/** `rgb(a, b, c)` / `rgba(a, b, c, α)` → α, or 1 for an opaque form. `none` is
 *  the value that means "nothing is painted" and is reported as 0. */
function alphaOf(value: string): number {
  const v = value.trim();
  if (v === "none" || v === "transparent") return 0;
  const rgba = /^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)$/.exec(v);
  if (rgba) return Number(rgba[1]);
  return /^rgb\(/.test(v) ? 1 : 0;
}

for (const theme of ["light", "dark"] as const) {
  test(`in ${theme} the plan grips are drawn, are exactly as big as the grab radius, and change the cursor`, async ({
    page,
  }) => {
    await mountPlan(page, theme);
    const probes = await probeHandles(page);

    /* The scan found the real elements. The literal 3 is deliberate beside the
       constant: both sides of the `toEqual` derive from
       `OPENING_HANDLES_IN_PLAN`, so on its own that comparison would survive
       the component rendering nothing if the constant emptied too. */
    expect(probes.length).toBe(3);
    expect(probes.map((p) => p.kind)).toEqual([...OPENING_HANDLES_IN_PLAN]);

    /* THE ALPHA READER DISCRIMINATES, proved on the page itself: the control
       circle carries no class and paints nothing this stylesheet gave it. */
    const control = await page.$eval("#control", (el: Element) => ({
      cursor: getComputedStyle(el).cursor,
      fill: getComputedStyle(el).fill,
    }));
    expect(alphaOf("none")).toBe(0);
    expect(alphaOf("rgba(1, 2, 3, 0)")).toBe(0);
    expect(alphaOf("rgb(1, 2, 3)")).toBe(1);

    for (const p of probes) {
      /* 1. WHAT YOU SEE IS WHAT YOU CAN GRAB. The ring is drawn at the pointer
            tolerance `hitTest` is actually given, so the drawn affordance
            neither hides the target nor promises a grab that misses. Change
            either number alone and this goes red. */
      expect(p.ringWidth, `${p.kind} ring width`).toBeCloseTo(OPENING_GRAB_PX * 2, 1);
      expect(p.ringHeight, `${p.kind} ring height`).toBeCloseTo(OPENING_GRAB_PX * 2, 1);

      /* 2. AND THAT TARGET CLEARS WCAG 2.2 SC 2.5.8 (AA), whose minimum is a
            24 × 24 CSS px pointer target. The old grip was 6 px square. */
      expect(p.ringWidth, `${p.kind} is below the 24 px minimum target size`).toBeGreaterThanOrEqual(24);
      expect(p.ringHeight).toBeGreaterThanOrEqual(24);

      /* 3. IT IS ACTUALLY PAINTED. A ring with `fill: none` and no stroke is
            present in the DOM, passes every size assertion above, and is
            invisible — which is the exact defect this node exists to end. */
      expect(alphaOf(p.ringFill), `${p.kind} ring fill is invisible`).toBeGreaterThan(0.05);
      expect(alphaOf(p.ringStroke), `${p.kind} ring stroke is invisible`).toBeGreaterThan(0.5);
      expect(alphaOf(p.markFill), `${p.kind} mark fill is invisible`).toBeGreaterThan(0.5);
      expect(p.markWidth, `${p.kind} mark has no size`).toBeGreaterThan(4);

      /* 4. THE CURSOR SAYS WHAT WILL HAPPEN, and says something different from
            the surface it sits on. */
      expect(p.cursor).toBe(p.kind === "slide" ? "grab" : "ew-resize");
      expect(p.cursor).not.toBe(control.cursor);
    }

    /* The control really is unstyled by this sheet, so "different from the
       control" is a real comparison. */
    expect(control.cursor).toBe("auto");
    expect(alphaOf(control.fill)).toBe(1);
  });
}

test("a pointer on the ring edge, not just the painted mark, is over the grip", async ({
  page,
}) => {
  /* WAVE13 leftover: the previous gate measured the ring's box. A 24 px circle
     can sit in the tree, pass every size assertion, and still miss a pointer
     on its own edge if the hit target is the inner mark. This asks a real
     pointer, through elementFromPoint, at three places. */
  await mountPlan(page, "light");

  const ring = page.locator('[data-opening-handle="slide"] .opening-plan-handle__ring');
  const box = await ring.boundingBox();
  expect(box, "the slide ring was not laid out").not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const radius = box!.width / 2;

  const probe = (x: number, y: number) =>
    page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { handle: null, cursor: null };
        const handle = el.closest(".opening-plan-handle");
        return {
          handle: handle?.getAttribute("data-opening-handle") ?? null,
          cursor: getComputedStyle(handle ?? el).cursor,
        };
      },
      { x, y },
    );

  const center = await probe(cx, cy);
  expect(center.handle, "the ring centre is not over the slide grip").toBe("slide");
  expect(center.cursor).toBe("grab");

  const onEdge = await probe(cx + radius - 1, cy);
  expect(onEdge.handle, "the ring edge is not over the slide grip").toBe("slide");
  expect(onEdge.cursor).toBe("grab");

  const outside = await probe(cx + radius + 4, cy);
  expect(outside.handle, "a point past the ring still reads as the grip").not.toBe("slide");
});

test("the grip ink is remapped for night rather than reused", async ({ page }) => {
  /* The stylesheet's own stated rule is that accents are perceptually REMAPPED
     for the dark theme rather than reused, because a shade that is legible on
     paper is not on charcoal. A grip added without its dark value would pass
     every assertion above and still be the wrong emerald at 2 a.m. */
  const inkIn = async (theme: "light" | "dark") => {
    await mountPlan(page, theme);
    return page.$eval(
      ".opening-plan-handle__ring",
      (el: Element) => getComputedStyle(el).stroke,
    );
  };
  const light = await inkIn("light");
  const dark = await inkIn("dark");
  expect(alphaOf(light)).toBeGreaterThan(0);
  expect(alphaOf(dark)).toBeGreaterThan(0);
  expect(dark).not.toBe(light);
});

test("the opening block of the stylesheet reaches every colour through the ladder", () => {
  /* The site rule: not one literal colour outside the token block. A hex here
     would be the one rule this whole stylesheet keeps, broken in the newest
     rules in it. */
  const rules = css.match(/[^{}@]*\.opening-[^{}]*\{[^{}]*\}/g) ?? [];
  expect(rules.length, "no .opening-* rules were found — the scanner has drifted").toBeGreaterThan(6);

  const literals = rules.flatMap(
    (rule) => rule.match(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\(\s*[\d.]/g) ?? [],
  );
  expect(literals, "a literal colour in the .opening-* rules").toEqual([]);

  /* The scanner can see a literal when there is one. */
  expect(
    (".opening-x { color: #ff0000; }".match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length,
  ).toBe(1);
});

/* ═══════════════════════════════════════════════════════════════════════
   7. THE NEW-OPENING CLICK CANNOT AUTHOR A FORBIDDEN STATE EITHER
   ═══════════════════════════════════════════════════════════════════════ */

test("checkOpening is the gate the add-a-window click is held to", () => {
  /* `addOpening` in edits.ts falls back to the far end of the wall when no gap
     fits, and `applyOpeningEdit` promises only never to make an overlap worse —
     it cannot undo one it was handed. So Plan2D checks after adding and takes
     the opening away again. This pins that the checker it uses agrees with the
     catalogue's own arithmetic on both a clean and a dirty document. */
  expect(checkOpening(SPEC, "main", "o1")).toEqual({ onWall: true, clashes: [] });

  const dirty: HomeSpec = {
    ...SPEC,
    volumes: [
      {
        ...MAIN,
        openings: [
          { id: "a", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 2, sillFt: 3 },
          { id: "b", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 5, sillFt: 3 },
          { id: "c", wall: "s", kind: "window", widthFt: 6, heightFt: 4, offsetFt: 90, sillFt: 3 },
        ],
      },
    ],
  };
  expect(checkOpening(dirty, "main", "a").clashes).toEqual(["b"]);
  expect(checkOpening(dirty, "main", "c").onWall).toBe(false);
  expect(catalogueRuleOffences(dirty).length).toBeGreaterThan(1);

  /* And Plan2D really does hold the click to it. */
  expect(plan2dSource).toContain("checkOpening(");
});

test("the drag lattice and the panel's steps are the same lattice", () => {
  /* This is what makes "drag it there" and "type that number" comparable at
     all. If they diverge, every hash equality in this file becomes a
     coincidence that holds only for the numbers it happens to try. */
  expect(OPENING_DRAG_SNAP_FT).toBe(0.25);
  expect(snapOpeningDrag(10.3)).toBe(10.25);
  expect(snapOpeningDrag(10.13)).toBe(10.25);
  expect(snapOpeningDrag(-0.1)).toBe(-0);
  expect(handlesSource).toContain("OPENING_DRAG_SNAP_FT");

  /* A value already on the lattice is left exactly alone, so a typed number
     and a drag that reached it are the same number rather than two. */
  for (const v of [0, 0.25, 3.5, 10.25, 16]) expect(snapOpeningDrag(v)).toBe(v);
  expect(openingBox(openingOf(SPEC, "main", "o3"))).toEqual({
    offsetFt: 8,
    widthFt: 4,
    sillFt: 3,
    heightFt: 4,
  });
});

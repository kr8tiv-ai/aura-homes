/* ===========================================================================
   OPENING EDIT — the ONE function every window and door move goes through.

   THE FOUNDER'S COMPLAINT, verbatim: "in the editor I can't easily change
   window size, or door placement for some reason, it should all be
   exceptionally easy and possible both from 3d and the floor plan, every
   feature you should be able to change super super easily."

   That sentence is three different problems wearing one coat:

     1. In the 2D plan it ALREADY WORKED. Plan2D has had `{ kind: 'opening' }`
        and `{ kind: 'opening-end' }` drags since it shipped. He could not find
        them, so the defect there is DISCOVERABILITY, not capability.
     2. In 3D nothing existed at all. That half is a real gap and
        `OpeningHandles.tsx` is the answer to it.
     3. The numbers were scattered across panels, each one writing the spec its
        own way.

   THIS FILE EXISTS FOR THE THIRD PROBLEM, and it is the one that decides
   whether the other two are safe to build. Before it, an opening could be
   changed two ways and was about to gain a third:

        Plan2D drag        -> walls.ts  moveOpening / resizeOpening
        SpecPanel sliders  -> edits.ts  patchOpening
        (3D)               -> nothing

   `moveOpening` clamps the offset to the wall and knows nothing about height.
   `patchOpening` clamps NOTHING — it is a spread. Neither has ever known what a
   NEIGHBOURING opening is doing, which is how `bro-breezeway` shipped a door
   set into a pane of glass and a catalogue gate had to be written for it.

   So: every surface — the 3D handle, the 2D drag, the numeric field — states
   the SAME thing, a target BOX on the wall, and hands it to
   `applyOpeningEdit`. A drag and the equivalent typed value produce an
   identical HomeSpec and therefore an identical `hashBuilderDocument`, and
   `tests/opening-edit.spec.ts` asserts exactly that rather than asserting that
   this comment is true.

   WHAT IT REFUSES, and why refusing is the point:

     · AN OPENING MAY NOT LEAVE ITS WALL. `plan-catalog.spec.ts` asserts
       `offsetFt + widthFt <= run` and `sillFt + heightFt <= wall head` for
       every one of the catalogue's plans. An editor that can drag a window
       into a state the catalogue forbids is an editor that can author a plan
       the library it came from would reject.
     · AND IT MAY NOT OVERLAP ANOTHER OPENING. Same gate, added after the
       breezeway. Two openings conflict only when their spans overlap
       HORIZONTALLY AND VERTICALLY — stacked windows on a two-storey wall share
       horizontal metres ten feet apart and are a building, not a defect. That
       two-axis rule is copied from the gate deliberately, because a refusal
       that disagreed with the gate would be worse than no refusal at all.

   NEIGHBOURS ACT AS WALLS rather than as a bounce. A drag that runs into
   another opening STOPS against it and says so; it does not snap back to where
   it started, and it does not jump to the far side. `refusals` carries one
   plain sentence per thing that did not land, and every surface prints it.

   A MOVE IS NOT A RESIZE, and treating them the same was the first version's
   bug. Widening a window from its right-hand edge into a neighbour must pin the
   LEFT edge and give up width; sliding the same window into the same neighbour
   must keep its width and stop short. So the fit below asks whether the caller
   named `widthFt` (or `heightFt`): if it did, both edges are clamped
   independently into the free band; if it did not, the size is kept and the
   position is clamped. One rule, stated once, obeyed by all three surfaces.

   THE REFUSAL IS "NO WORSE", NOT "PERFECT". A document written before these
   rules existed — or imported from a hand-edited file — can already hold an
   overlap. Refusing every edit on such an opening would make the one thing that
   could fix it impossible, so the final gate refuses an edit that makes the
   overlap LARGER or pushes further off the wall, and permits one that reduces
   it. For any legal starting state, which is every catalogue plan and every
   document this editor has written, "no worse" and "no overlap at all" are the
   same sentence. `tests/opening-edit.spec.ts` pins both halves.

   HONEST LIMIT, recorded rather than hidden: this file legalises the BOX
   (offset, width, sill, height). `wall` and `kind` are changes of identity
   rather than of size, so they stay with `patchOpening` — but a wall change
   moves the box onto a run of a different length, so `SpecPanel` follows it
   with an `applyOpeningEdit` of the same box to re-legalise it there.

   PURE. No React, no three.js, no DOM. That is what lets the spec import it and
   measure it directly, and what lets both the SVG plan and the WebGL handles
   call the same code without either dragging the other's runtime into its
   bundle.
   =========================================================================== */

import { wallRunFt, wallThicknessFt } from "@/lib/builder/geometry";
import type { HomeSpec, Opening, Volume, Wall } from "@/lib/builder/spec";
import { pointOnWallLocal, toWorld, type Vec2 } from "@/lib/builder/walls";
import { LIMITS, clamp } from "./edits";

/* ---------------------------------------------------------------- the box */

/**
 * Where an opening sits on its wall, as four feet-measurements.
 *
 * `offsetFt` and `widthFt` run along the wall from its left end seen from
 * OUTSIDE — `spec.ts`'s definition, and the one `pointOnWallLocal` uses.
 * `sillFt` and `heightFt` run up from the finished floor. Together they are the
 * rectangle both catalogue gates test, which is why this is the shape every
 * surface speaks in.
 */
export interface OpeningBox {
  offsetFt: number;
  widthFt: number;
  sillFt: number;
  heightFt: number;
}

export const openingBox = (o: Opening): OpeningBox => ({
  offsetFt: o.offsetFt,
  widthFt: o.widthFt,
  sillFt: o.sillFt,
  heightFt: o.heightFt,
});

/** The top of the wall an opening is set into, above the finished floor. Two
 *  storeys is one wall as far as an opening is concerned — `spec.ts` multiplies
 *  the same way and `plan-catalog.spec.ts` tests against exactly this product. */
export const wallHeadFt = (v: Volume): number => v.wallHeightFt * v.storeys;

/** The built length of the wall an opening sits on. Forwarded from
 *  `geometry.ts` so there is one definition of a wall's length in the system —
 *  the e and w walls butt INTO the n and s walls and are two thicknesses
 *  shorter than `depthFt`, and clamping against `depthFt` would let an opening
 *  hang off the end of a wall that is not there. */
export const openingRunFt = (spec: HomeSpec, v: Volume, wall: Wall): number =>
  wallRunFt(v, wall, wallThicknessFt(spec.material));

/** A thousandth of a foot — a hundredth of an inch, below anything this system
 *  draws, and the same quantum `walls.ts`'s `q` and the share codec settle on.
 *  Two surfaces that quantise identically are two surfaces that HASH
 *  identically, which is the whole reason this is not left to the caller. */
export const qFt = (v: number): number => Math.round(v * 1e3) / 1e3;

/** How much overlap counts as overlap. Copied from `plan-catalog.spec.ts`:
 *  touching is allowed, because two panes meeting on a mullion share an edge
 *  and that is a window wall, not a defect. */
const TOUCH_EPS = 1e-9;

/** Three inches — the lattice a DRAG lands on.
 *
 *  It lives here rather than in the 3D layer because it is the reason a drag
 *  and a typed value can be compared at all: both surfaces round to the same
 *  quarter foot, so "drag it to 10'-3"" and "type 10.25" produce one document
 *  and one hash instead of two values a thousandth of a foot apart. The panel's
 *  fields step by the same amount. */
export const OPENING_DRAG_SNAP_FT = 0.25;

export const snapOpeningDrag = (v: number): number =>
  qFt(Math.round(v / OPENING_DRAG_SNAP_FT) * OPENING_DRAG_SNAP_FT);

/* ------------------------------------------------------- gesture → a box */

/**
 * One EDGE of an opening dragged to `tFt` along the wall, with the other edge
 * pinned.
 *
 * Pinning the far edge is what makes the gesture read as "make this window
 * wider on THIS side" instead of "recentre it", so the dimension that changes
 * is the one under the cursor. `walls.ts`'s `resizeOpening` decided that and it
 * is kept — but it is stated HERE so the 2D grip and the 3D handle cannot drift
 * apart, which they would the moment one of them grew its own copy.
 */
export function openingBoxFromEdgeDrag(
  o: Opening,
  end: 0 | 1,
  tFt: number,
): Pick<OpeningBox, "offsetFt" | "widthFt"> {
  const pinned = end === 0 ? o.offsetFt + o.widthFt : o.offsetFt;
  const lo = Math.min(pinned, tFt);
  const hi = Math.max(pinned, tFt);
  return { offsetFt: qFt(lo), widthFt: qFt(hi - lo) };
}

/**
 * The SILL or the HEAD dragged to `yFt` above the finished floor, with the
 * other one pinned. The 3D-only half of the gesture set: a floor plan has no
 * height in it, so this is a thing the model view can do that the plan cannot —
 * and it goes through the same mutator anyway.
 */
export function openingBoxFromHeightDrag(
  o: Opening,
  edge: "sill" | "head",
  yFt: number,
): Pick<OpeningBox, "sillFt" | "heightFt"> {
  const pinned = edge === "sill" ? o.sillFt + o.heightFt : o.sillFt;
  const lo = Math.min(pinned, yFt);
  const hi = Math.max(pinned, yFt);
  return { sillFt: qFt(lo), heightFt: qFt(hi - lo) };
}

/* --------------------------------------------------------------- the edit */

export interface OpeningEditResult {
  /** the new spec — the SAME object when nothing changed, so a caller can use
   *  identity to decide whether an undo step is worth pushing */
  spec: HomeSpec;
  /** what actually landed. Equal to the ask when `refusals` is empty. */
  box: OpeningBox;
  changed: boolean;
  /** one plain sentence per part of the ask that did NOT land. Empty means the
   *  drag or the typed value went through exactly as given. */
  refusals: string[];
}

interface Span {
  lo: number;
  hi: number;
}

const overlap = (a: Span, b: Span): number => Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
const conflictArea = (a: Span, b: Span, c: Span, d: Span): number =>
  Math.max(0, overlap(a, b)) * Math.max(0, overlap(c, d));

const spanOf = (lo: number, size: number): Span => ({ lo, hi: lo + size });
const hSpan = (o: Opening): Span => spanOf(o.offsetFt, o.widthFt);
const vSpan = (o: Opening): Span => spanOf(o.sillFt, o.heightFt);

/** The free run between two limits, and where each limit came from — so a
 *  refusal can say "the end of the wall" or "the opening beside it" rather than
 *  a single vague sentence covering both. */
interface Band {
  lo: number;
  hi: number;
  loIsNeighbour: boolean;
  hiIsNeighbour: boolean;
}

/**
 * Fit a span into a band.
 *
 * `resizing` is the whole distinction between a move and a resize: when the
 * caller named the size, both edges are clamped independently and the size is
 * whatever survives; when it did not, the size is kept and the position moves.
 */
function fitSpan(
  span: Span,
  size: number,
  band: Band,
  resizing: boolean,
  minSize: number,
): { lo: number; size: number; hitWall: boolean; hitNeighbour: boolean } {
  let lo: number;
  let out: number;
  if (resizing) {
    const a = clamp(span.lo, band.lo, band.hi);
    const b = clamp(span.hi, band.lo, band.hi);
    lo = qFt(a);
    out = qFt(Math.max(minSize, b - a));
  } else {
    lo = qFt(clamp(span.lo, band.lo, Math.max(band.lo, band.hi - size)));
    out = size;
  }
  const movedLow = span.lo < band.lo - TOUCH_EPS || lo !== qFt(span.lo);
  const movedHigh = span.hi > band.hi + TOUCH_EPS;
  return {
    lo,
    size: out,
    hitWall: (movedLow && !band.loIsNeighbour) || (movedHigh && !band.hiIsNeighbour),
    hitNeighbour: (movedLow && band.loIsNeighbour) || (movedHigh && band.hiIsNeighbour),
  };
}

/**
 * Move, resize, raise or lower one opening — from anywhere.
 *
 * `want` is a partial box: give the fields the gesture or the field is about
 * and the rest are carried over. Nothing here reads the previous frame of a
 * drag, so a slow drag and a fast one over the same path land identically.
 */
export function applyOpeningEdit(
  spec: HomeSpec,
  volumeId: string,
  openingId: string,
  want: Partial<OpeningBox>,
): OpeningEditResult {
  const v = spec.volumes.find((x) => x.id === volumeId);
  const o = v?.openings.find((x) => x.id === openingId);
  if (!v || !o) {
    return {
      spec,
      box: { offsetFt: 0, widthFt: 0, sillFt: 0, heightFt: 0 },
      changed: false,
      refusals: [`There is no opening ${openingId} on ${volumeId} to change.`],
    };
  }

  const was = openingBox(o);
  const run = openingRunFt(spec, v, o.wall);
  const head = wallHeadFt(v);
  const others = v.openings.filter((x) => x.id !== o.id && x.wall === o.wall);
  const refusals: string[] = [];

  /* 1. THE ASK, quantised and inside the editor's own dimensional limits. Both
        clamps come from `edits.ts`, so a number typed into a field and a number
        produced by a drag meet the same ceiling. */
  const resizingH = want.widthFt !== undefined;
  const resizingV = want.heightFt !== undefined;
  const askWidth = qFt(
    clamp(want.widthFt ?? was.widthFt, LIMITS.openingWidthFt.min, LIMITS.openingWidthFt.max),
  );
  const askHeight = qFt(
    clamp(want.heightFt ?? was.heightFt, LIMITS.openingHeightFt.min, LIMITS.openingHeightFt.max),
  );
  const askOffset = qFt(want.offsetFt ?? was.offsetFt);
  const askSill = qFt(Math.max(0, want.sillFt ?? was.sillFt));

  /* 2. ALONG THE WALL. The band is the wall itself, narrowed by any neighbour
        this box shares HEIGHT with — a window directly above another one is not
        in its way. The vertical span used to decide that is the ASK's, because
        that is the caller's stated intention; the vertical pass below then uses
        the horizontal answer, so the two never chase each other. */
  const askV = spanOf(askSill, askHeight);
  const hBand: Band = { lo: 0, hi: run, loIsNeighbour: false, hiIsNeighbour: false };
  for (const x of others) {
    if (overlap(askV, vSpan(x)) <= TOUCH_EPS) continue;
    const b = hSpan(x);
    if (b.hi <= was.offsetFt + TOUCH_EPS && b.hi > hBand.lo) {
      hBand.lo = b.hi;
      hBand.loIsNeighbour = true;
    } else if (b.lo >= was.offsetFt + was.widthFt - TOUCH_EPS && b.lo < hBand.hi) {
      hBand.hi = b.lo;
      hBand.hiIsNeighbour = true;
    }
  }
  const fitH = fitSpan(
    spanOf(askOffset, askWidth),
    askWidth,
    hBand,
    resizingH,
    LIMITS.openingWidthFt.min,
  );
  const offsetFt = fitH.lo;
  const widthFt = fitH.size;
  if (fitH.hitWall) {
    refusals.push(
      `Held on the wall — it is ${run.toFixed(2)} ft long and an opening may not hang off the end.`,
    );
  }
  if (fitH.hitNeighbour) {
    refusals.push("Stopped against the opening beside it — two may not share the same wall.");
  }

  /* 3. UP THE WALL. Same shape, and the reason it exists at all is that
        `plan-catalog.spec.ts` asserts `sillFt + heightFt <= wallHeightFt ×
        storeys` for every catalogue plan.

        A REAL NARROWING, said out loud: SpecPanel's height slider used to
        promise that a taller-than-the-wall opening was allowed and would be
        trimmed by the geometry on a gable end. It is not allowed here, because
        a design authored that way could not be contributed back to the library
        it came from — and that hint is corrected in the same change rather than
        left standing over a control that no longer behaves that way. */
  const finalH = spanOf(offsetFt, widthFt);
  const vBand: Band = { lo: 0, hi: head, loIsNeighbour: false, hiIsNeighbour: false };
  for (const x of others) {
    if (overlap(finalH, hSpan(x)) <= TOUCH_EPS) continue;
    const b = vSpan(x);
    if (b.hi <= was.sillFt + TOUCH_EPS && b.hi > vBand.lo) {
      vBand.lo = b.hi;
      vBand.loIsNeighbour = true;
    } else if (b.lo >= was.sillFt + was.heightFt - TOUCH_EPS && b.lo < vBand.hi) {
      vBand.hi = b.lo;
      vBand.hiIsNeighbour = true;
    }
  }
  const fitV = fitSpan(
    spanOf(askSill, askHeight),
    askHeight,
    vBand,
    resizingV,
    LIMITS.openingHeightFt.min,
  );
  const sillFt = fitV.lo;
  const heightFt = fitV.size;
  if (fitV.hitWall) {
    refusals.push(
      `Held under the eave — this wall is ${head.toFixed(2)} ft to the head and an opening may not run out through the top of it.`,
    );
  }
  if (fitV.hitNeighbour) {
    refusals.push("Stopped against the opening above or below it — two may not share the same wall.");
  }

  /* 4. THE SAFETY NET, and the reason it is "no worse" rather than "perfect" is
        in this file's header. Every clamp above can be defeated by an ask that
        is illegal in two directions at once — a minimum-width opening squeezed
        into a gap narrower than the minimum, for instance — so the box that
        came out is tested against the SAME two rules the catalogue gate applies
        and is not written at all if it is worse than what it replaced. This is
        what makes "the editor cannot introduce a state plan-catalog.spec.ts
        forbids" a property rather than a hope. */
  const outsideBy = (h: Span, vv: Span): number =>
    Math.max(0, -h.lo) + Math.max(0, h.hi - run) + Math.max(0, -vv.lo) + Math.max(0, vv.hi - head);
  const worstConflict = (h: Span, vv: Span): number =>
    others.reduce((most, x) => Math.max(most, conflictArea(h, hSpan(x), vv, vSpan(x))), 0);

  const outH = spanOf(offsetFt, widthFt);
  const outV = spanOf(sillFt, heightFt);
  const wasH = spanOf(was.offsetFt, was.widthFt);
  const wasV = spanOf(was.sillFt, was.heightFt);

  const nowOutside = outsideBy(outH, outV);
  const nowConflict = worstConflict(outH, outV);
  if (
    nowOutside > outsideBy(wasH, wasV) + TOUCH_EPS ||
    nowConflict > worstConflict(wasH, wasV) + TOUCH_EPS
  ) {
    return {
      spec,
      box: was,
      changed: false,
      refusals: [
        ...refusals,
        nowConflict > 0
          ? "There is no room for that here — it would have to be cut into the opening next to it, so nothing was changed."
          : "There is no room for that on this wall, so nothing was changed.",
      ],
    };
  }

  const box: OpeningBox = { offsetFt, widthFt, sillFt, heightFt };
  const changed =
    box.offsetFt !== was.offsetFt ||
    box.widthFt !== was.widthFt ||
    box.sillFt !== was.sillFt ||
    box.heightFt !== was.heightFt;

  if (!changed) return { spec, box: was, changed: false, refusals };

  return {
    spec: {
      ...spec,
      volumes: spec.volumes.map((x) =>
        x.id !== volumeId
          ? x
          : {
              ...x,
              openings: x.openings.map((y) => (y.id === openingId ? { ...y, ...box } : y)),
            },
      ),
    },
    box,
    changed: true,
    refusals,
  };
}

/* --------------------------------------------------------- the two rules */

export interface OpeningLegality {
  /** `offsetFt + widthFt <= run` AND `sillFt + heightFt <= wall head` */
  onWall: boolean;
  /** ids of the openings on the same wall this one interpenetrates, in both
   *  axes at once. Empty is the only acceptable value in a shipped plan. */
  clashes: string[];
}

/**
 * The two rules `plan-catalog.spec.ts` applies to every plan in the library,
 * applied to one opening in a live document.
 *
 * It exists because `applyOpeningEdit` guarantees only that it never makes
 * things WORSE, which is the right guarantee for an editor and the wrong one
 * for a caller that has just CREATED an opening — `addOpening` places a new one
 * at the first free gap and falls back to the far end of the wall when nothing
 * fits, so a click can land a window inside a glazing wall before this file
 * ever sees it. `Plan2D` asks this after adding one and takes it away again
 * rather than letting the click author a state the catalogue forbids.
 */
export function checkOpening(
  spec: HomeSpec,
  volumeId: string,
  openingId: string,
): OpeningLegality {
  const v = spec.volumes.find((x) => x.id === volumeId);
  const o = v?.openings.find((x) => x.id === openingId);
  if (!v || !o) return { onWall: false, clashes: [] };
  const run = openingRunFt(spec, v, o.wall);
  const head = wallHeadFt(v);
  const h = hSpan(o);
  const vv = vSpan(o);
  return {
    onWall:
      h.lo >= -TOUCH_EPS &&
      h.hi <= run + TOUCH_EPS &&
      vv.lo >= -TOUCH_EPS &&
      vv.hi <= head + TOUCH_EPS,
    clashes: v.openings
      .filter(
        (x) =>
          x.id !== o.id &&
          x.wall === o.wall &&
          overlap(h, hSpan(x)) > TOUCH_EPS &&
          overlap(vv, vSpan(x)) > TOUCH_EPS,
      )
      .map((x) => x.id),
  };
}

/* ===========================================================================
   THE HANDLES — one model, two renderers.

   `OpeningHandles.tsx` draws these as meshes in the 3D view; `Plan2D.tsx` draws
   the three that exist in plan as SVG. Both read THIS list, so a handle that
   exists in one view exists in the other and neither can quietly grow one the
   other does not know about.

   THE DISCOVERABILITY POINT LIVES HERE. The founder could not find a feature
   that already worked, which means a handle that appears only once the cursor
   is on top of it is not an affordance. So the list is produced for a SELECTED
   opening whether or not anything is hovering it, every entry carries the words
   that go beside it and the cursor it asks for, and `tests/opening-edit.spec.ts`
   measures that the drawn result is actually visible rather than trusting this
   sentence.
   =========================================================================== */

export type OpeningHandleKind = "slide" | "edge-0" | "edge-1" | "sill" | "head";

/** The two that only exist in three dimensions. A floor plan has no height in
 *  it, so the sill and the head cannot be drawn there — which is exactly why
 *  "possible both from 3D and the floor plan" needs both views rather than one
 *  of them twice. */
export const OPENING_HANDLES_3D_ONLY: readonly OpeningHandleKind[] = ["sill", "head"];

export const OPENING_HANDLES_IN_PLAN: readonly OpeningHandleKind[] = ["slide", "edge-0", "edge-1"];

export interface OpeningHandle {
  kind: OpeningHandleKind;
  /** world feet: x and z are the plan, y is above the finished floor — the same
   *  frame the R3F export root uses, so a handle is placed by arithmetic rather
   *  than by a second transform that could disagree with the first */
  position: readonly [number, number, number];
  /** how big to draw it, feet. A real dimension, so it sits ON the wall it
   *  belongs to at any camera distance. */
  sizeFt: number;
  /** what it does, in the words that go beside it */
  label: string;
  /** the CSS cursor this handle asks for. `sill`/`head` are genuinely vertical
   *  on screen because up is up; the two edge handles run along a wall that is
   *  usually — not always — horizontal on screen, so `ew-resize` is a reading of
   *  the intent rather than a claim about the projection. */
  cursor: "grab" | "ew-resize" | "ns-resize";
}

/** The wall's run and outward normal in WORLD plan feet, both unit length.
 *  Derived from two points ON the wall rather than from a rotation matrix, so
 *  it cannot disagree with where the opening is drawn. */
export function wallFrameWorld(
  v: Volume,
  wall: Wall,
  structThicknessFt: number,
): { run: Vec2; out: Vec2 } {
  const a = toWorld(v, pointOnWallLocal(v, wall, structThicknessFt, 0));
  const b = toWorld(v, pointOnWallLocal(v, wall, structThicknessFt, 1));
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const run: Vec2 = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  /* `(-run.z, run.x)` is the outward normal for all four walls — checked
     against `geometry.ts`'s WALL_AXES table, and the volume transform is a
     proper rotation, so the relationship survives any bearing. The spec proves
     it for all four walls at three bearings rather than taking this on trust. */
  return { run, out: { x: -run.z, z: run.x } };
}

/** How far proud of the wall face a handle floats, feet. Enough that it is not
 *  z-fighting the cladding, small enough that it still reads as attached. */
export const OPENING_HANDLE_STANDOFF_FT = 0.28;

/** The five handles of one opening, in world feet. Empty when the opening is
 *  not there — a caller may hold a stale selection and must not crash. */
export function openingHandles(
  spec: HomeSpec,
  volumeId: string,
  openingId: string,
): OpeningHandle[] {
  const v = spec.volumes.find((x) => x.id === volumeId);
  const o = v?.openings.find((x) => x.id === openingId);
  if (!v || !o) return [];

  const th = wallThicknessFt(spec.material);
  const { out } = wallFrameWorld(v, o.wall, th);
  const midY = o.sillFt + o.heightFt / 2;

  const at = (tFt: number, y: number): readonly [number, number, number] => {
    const p = toWorld(v, pointOnWallLocal(v, o.wall, th, tFt));
    return [
      qFt(p.x + out.x * OPENING_HANDLE_STANDOFF_FT),
      qFt(y),
      qFt(p.z + out.z * OPENING_HANDLE_STANDOFF_FT),
    ];
  };

  /* Sized against the opening rather than fixed, so a 16 ft glazing wall does
     not get the same speck a 3 ft door does — but FLOORED, because a handle you
     cannot hit is the exact failure this node exists to end. */
  const sizeFt = Math.max(0.75, Math.min(1.6, Math.min(o.widthFt, o.heightFt) / 4));

  return [
    {
      kind: "slide",
      position: at(o.offsetFt + o.widthFt / 2, midY),
      sizeFt,
      label: "Drag to slide it along the wall",
      cursor: "grab",
    },
    {
      kind: "edge-0",
      position: at(o.offsetFt, midY),
      sizeFt,
      label: "Drag to change the width from this side",
      cursor: "ew-resize",
    },
    {
      kind: "edge-1",
      position: at(o.offsetFt + o.widthFt, midY),
      sizeFt,
      label: "Drag to change the width from this side",
      cursor: "ew-resize",
    },
    {
      kind: "sill",
      position: at(o.offsetFt + o.widthFt / 2, o.sillFt),
      sizeFt,
      label: "Drag to raise or lower the sill",
      cursor: "ns-resize",
    },
    {
      kind: "head",
      position: at(o.offsetFt + o.widthFt / 2, o.sillFt + o.heightFt),
      sizeFt,
      label: "Drag to change the height at the head",
      cursor: "ns-resize",
    },
  ];
}

/* ---------------------------------------------------------- what it reads */

/**
 * The size and position of an opening in one line of feet and inches.
 *
 * Printed WHILE a handle is being dragged, so the dimension is readable during
 * the gesture rather than after it — the third thing the founder's sentence
 * asks for and the one a 3D editor most often skips.
 *
 * `format` is passed in rather than imported so this file stays free of the
 * drawing kit; both callers hand it `fmtFt`, which is the same function that
 * letters the drawing sheets, so the number under the cursor and the number on
 * the sheet can never disagree about what 4.5 feet reads as.
 */
export function openingReadout(
  box: OpeningBox,
  runFt: number,
  format: (v: number) => string,
): string {
  const after = Math.max(0, runFt - box.offsetFt - box.widthFt);
  return (
    `${format(box.widthFt)} wide × ${format(box.heightFt)} tall` +
    `  ·  ${format(box.offsetFt)} | ${format(box.widthFt)} | ${format(after)}` +
    `  ·  sill ${format(box.sillFt)}`
  );
}

/* ------------------------------------------------------------- undo steps */

/* ONE GESTURE IS ONE UNDO STEP, and the history reducer coalesces by LABEL — so
   every gesture gets its own counter value and a typed edit gets a different
   label SHAPE entirely. A drag followed by a typed change is therefore two
   entries, which `tests/opening-edit.spec.ts` asserts against the real reducer
   rather than by reading these two lines. Sixty pointermove frames inside one
   drag are one entry, which is why a drag previews locally and commits once on
   release. */

export const openingGestureLabel = (surface: string, openingId: string, gesture: number): string =>
  `opening:${surface}:${openingId}:${gesture}`;

export const openingFieldLabel = (openingId: string, field: keyof OpeningBox): string =>
  `opening:field:${openingId}:${field}`;

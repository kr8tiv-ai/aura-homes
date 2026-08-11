"use client";

/* ===========================================================================
   PLAN 2D — the floor-plan editor.

   The founder's blueprint asks for "a 2D interface allowing users to move,
   draw, or delete walls and corners via mouse-driven interactions". Until now
   a person composed rectangular VOLUMES with sliders: they could not push a
   single wall, and they could not say where an interior partition goes — the
   room packer decided that for them. This is that surface. All the geometry
   is in `lib/builder/walls.ts`; this file is the pixels and the pointer.

   SVG, NOT CANVAS. Four reasons, in the order they mattered:

   1. THE COLOUR RULE. This site has a real night mode, driven from CSS
      variables through the `aura-*` Tailwind tokens, and there is not a
      literal hex anywhere in the UI. SVG elements take `className`, so
      `fill-aura-ink/70` and `stroke-aura-emerald` resolve through the same
      tonal ladder as everything else and the plan repaints at 2 a.m. for
      free. A canvas would force `fillStyle = "#..."` or a `getComputedStyle`
      round-trip on every frame — a literal colour in the render path, which
      is the one thing the rule forbids.
   2. THE REST OF THE SYSTEM IS ALREADY SVG. `drawings/sheets.ts` emits SVG;
      this editor is the same drawing at an earlier moment, and it should be
      made of the same stuff so a line here and a line on the sheet are the
      same kind of object.
   3. IT IS FREE TO INSPECT. A wrong wall is a DOM node you can select and
      read. On a canvas it is a rounding error you argue with.
   4. THE COST IS NOTHING AT THIS SIZE. A home is a handful of masses, a few
      dozen openings and partitions — a few hundred nodes. Canvas wins at
      thousands, and this is not thousands.

      Hit-testing does NOT go through the DOM. It is done in world feet by
      `walls.ts`, so the grab radius is a real distance, identical at every
      zoom, and a wall is grabbable along its whole length rather than only
      where a handle happens to be drawn.

   THE DRAG COMMITS ONCE, ON RELEASE.
   The obvious build emits a new spec on every pointermove. That would push
   sixty specs a second through `BuilderApp`, rebuild and re-upload the whole
   three.js model each time, and — because the reducer coalesces by label —
   leave a dead undo step behind whenever a drag was cancelled. So a drag
   renders a local PREVIEW and calls `onEdit` exactly once, on pointerup.
   Escape during a drag emits nothing at all, which is what "nothing here is a
   dead end" has to mean: the escape hatch must not cost an undo.

   PIXELS ARE PIXELS AND FEET ARE FEET. The transform is held in `walls.ts`'s
   `View` rather than in an SVG `viewBox` in feet. That keeps one pixel of grab
   tolerance exactly one pixel at any zoom, keeps stroke widths from scaling
   with the model, and means the numbers that draw the plan are the numbers
   that hit-test it.
   =========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtFt } from "@/lib/builder/drawings/kit";
import { MM_PER_FT, deckCornersPlan, wallRunFt } from "@/lib/builder/geometry";
import type { HomeSpec, Volume, Wall } from "@/lib/builder/spec";
import {
  CORNER_WALLS,
  DEFAULT_SNAP,
  GRID_STEPS,
  MIN_DOOR_FT,
  WALLS_CW,
  contentBounds,
  cornerLocal,
  dirToLocal,
  dragCorner,
  dragPartitionEnd,
  faceAxisOf,
  ftPerPx,
  gridLines,
  handleKey,
  hitTest,
  interiorBoundsLocal,
  localAlignCandidates,
  makeView,
  moveOpening,
  moveVolumeTo,
  movePartitionTo,
  offsetWall,
  openingAlignCandidates,
  openingChain,
  partitionAcrossChain,
  partitionLengthFt,
  partitionQuadLocal,
  partitionFromDrag,
  pointOnPartitionLocal,
  pointOnWallLocal,
  pruneOrphanPartitions,
  resizeOpening,
  setPartitionDoor,
  removePartition,
  addPartition,
  snapMove,
  snapPoint,
  snapScalar,
  structThicknessOf,
  tAlongWall,
  toLocal,
  toPx,
  toWorld,
  toWorldPt,
  viewWorldBounds,
  volumeAt,
  volumeCornersWorld,
  wallFaceLocal,
  wallRunOf,
  worldAlignCandidates,
  type PlanHandle,
  type Partition,
  type Px,
  type SnapSettings,
  type Vec2,
  type View,
  type WorldBounds,
} from "@/lib/builder/walls";
import { KIND_LABELS, WALL_LABELS, addOpening, removeOpening } from "./edits";
import { Button, Segmented } from "./ui";

/* ===========================================================================
   props
   =========================================================================== */

export interface Plan2DProps {
  spec: HomeSpec;
  /** the same `(next, label)` the sliders use, so a drag is one undo step */
  onEdit: (next: HomeSpec, label: string) => void;
  /**
   * Partitions are NOT part of HomeSpec — `share.ts`'s validator rebuilds a
   * spec from known primitives and would drop them (see the walls.ts header).
   * Pass them in and they join the editor's history like everything else;
   * leave them out and this component holds them itself, which works but
   * keeps them out of undo. The wiring is six lines and is written out in
   * this agent's report.
   */
  partitions?: Partition[];
  onPartitions?: (next: Partition[], label: string) => void;

  selectedVolumeId?: string | null;
  onSelectVolume?: (id: string) => void;
  selectedOpeningId?: string | null;
  onSelectOpening?: (id: string | null) => void;
}

/* ===========================================================================
   local types
   =========================================================================== */

type Tool = "select" | "partition" | "window" | "door" | "glazing-wall";

const TOOLS: ReadonlyArray<{ id: Tool; label: string; title: string }> = [
  { id: "select", label: "Select", title: "Move corners, walls, openings and partitions" },
  { id: "partition", label: "Partition", title: "Drag inside a mass to draw an interior wall" },
  { id: "window", label: "Window", title: "Click a wall to place a window there" },
  { id: "door", label: "Door", title: "Click a wall to place a door there" },
  { id: "glazing-wall", label: "Glazing", title: "Click a wall to place a glazing wall there" },
];

/** A dashed line drawn while a snap is holding, so the alignment that just
 *  happened is visible rather than mysterious. */
interface Guide {
  a: Vec2;
  b: Vec2;
}

/** What a gesture is doing. `spec0`/`parts0` are the model as it was when the
 *  pointer went down; every frame is computed from THOSE rather than from the
 *  previous frame, so a slow drag and a fast one land in the same place and
 *  nothing accumulates rounding. */
type Drag =
  | { kind: "pan"; fromPx: Px; panFrom: Px }
  | { kind: "volume"; volumeId: string; grabWorld: Vec2; centre0: Vec2 }
  | { kind: "wall"; volumeId: string; wall: Wall }
  | { kind: "corner"; volumeId: string; index: number }
  | { kind: "opening"; volumeId: string; openingId: string; grabT: number; offset0: number }
  | { kind: "opening-end"; volumeId: string; openingId: string; end: 0 | 1 }
  | { kind: "partition"; id: string }
  | { kind: "partition-end"; id: string; end: 0 | 1 }
  | { kind: "partition-door"; id: string }
  | { kind: "draw"; volumeId: string; a: Vec2 };

interface DragState {
  drag: Drag;
  spec0: HomeSpec;
  parts0: Partition[];
  label: string;
  moved: boolean;
}

/** What the pointer is currently producing. Held locally and thrown away on
 *  release or on Escape — see the header on why a drag does not commit. */
interface Preview {
  spec: HomeSpec;
  partitions: Partition[];
  adjusted: string[];
  readout: string;
  guides: Guide[];
  /** the rubber band, for the partition tool */
  draft: { volumeId: string; a: Vec2; b: Vec2 } | null;
}

/* ===========================================================================
   drawing helpers — pure, px in, string out
   =========================================================================== */

const pathOf = (pts: readonly Px[], close = true): string =>
  pts.length === 0
    ? ""
    : `M${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("L")}${close ? "Z" : ""}`;

const localPath = (v: Volume, view: View, pts: readonly Vec2[], close = true): string =>
  pathOf(
    pts.map((p) => toPx(view, toWorld(v, p))),
    close,
  );

/** A door swing: the leaf plus the arc it sweeps. The sweep flag is decided
 *  from the cross product in SCREEN space, so a mass rotated to any bearing
 *  still draws the arc on the side the door actually opens. */
function swingPath(hinge: Px, jamb: Px, tip: Px): string {
  const r = Math.hypot(tip.x - hinge.x, tip.y - hinge.y);
  const cross = (jamb.x - hinge.x) * (tip.y - hinge.y) - (jamb.y - hinge.y) * (tip.x - hinge.x);
  const sweep = cross > 0 ? 1 : 0;
  return (
    `M${hinge.x.toFixed(2)} ${hinge.y.toFixed(2)}L${tip.x.toFixed(2)} ${tip.y.toFixed(2)}` +
    `M${jamb.x.toFixed(2)} ${jamb.y.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${tip.x.toFixed(2)} ${tip.y.toFixed(2)}`
  );
}

/** A guide line long enough to leave the frame in any direction. */
const guideAcross = (v: Volume | null, axis: "x" | "z", value: number): Guide => {
  const far = 400;
  const a: Vec2 = axis === "x" ? { x: value, z: -far } : { x: -far, z: value };
  const b: Vec2 = axis === "x" ? { x: value, z: far } : { x: far, z: value };
  return v ? { a: toWorld(v, a), b: toWorld(v, b) } : { a, b };
};

const dim = (v: number): string => fmtFt(v);

/**
 * Does a handle key refer to this partition?
 *
 * Written as a split rather than as `key.includes(id)`, which was the first
 * version and was wrong: ids are `p1`, `p2`, … `p10`, so `includes("p1")`
 * lights up `p10`, `p11` and `p12` as well. A substring test on an identifier
 * is a bug waiting for the tenth partition.
 */
function refersToPartition(key: string, id: string): boolean {
  const parts = key.split(":");
  return parts[0].startsWith("partition") && parts[1] === id;
}

/* ===========================================================================
   the component
   =========================================================================== */

export default function Plan2D({
  spec,
  onEdit,
  partitions: partitionsProp,
  onPartitions,
  selectedVolumeId,
  onSelectVolume,
  selectedOpeningId,
  onSelectOpening,
}: Plan2DProps) {
  /* -------------------------------------------------- partitions, either way */
  const [ownPartitions, setOwnPartitions] = useState<Partition[]>([]);
  const rawPartitions = partitionsProp ?? ownPartitions;

  /* A partition whose volume was deleted from the panel is dropped at read
     time rather than written back, so this component never fires an edit
     nobody asked for while the user is looking at something else. */
  const partitions = useMemo(
    () => pruneOrphanPartitions(spec, rawPartitions).partitions,
    [spec, rawPartitions],
  );

  const commitPartitions = useCallback(
    (next: Partition[], label: string) => {
      if (onPartitions) onPartitions(next, label);
      else setOwnPartitions(next);
    },
    [onPartitions],
  );

  /* ---------------------------------------------------------------- surface */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ------------------------------------------------------------------ view

     The fitted bounds are FROZEN rather than recomputed from the spec every
     render. Recomputing them would re-fit the view the instant a wall moved —
     the model would swim under the cursor mid-drag, which is the classic
     hand-rolled-plan-viewer bug. "Fit" re-takes them deliberately. */
  const [baseBounds, setBaseBounds] = useState<WorldBounds | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Px>({ x: 0, y: 0 });

  useEffect(() => {
    if (baseBounds === null && size.w > 0) setBaseBounds(contentBounds(spec));
  }, [baseBounds, size.w, spec]);

  const view: View = useMemo(
    () => makeView(baseBounds ?? contentBounds(spec), Math.max(1, size.w), Math.max(1, size.h), zoom, pan),
    [baseBounds, spec, size.w, size.h, zoom, pan],
  );

  const fit = useCallback(() => {
    setBaseBounds(contentBounds(spec));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [spec]);

  /* -------------------------------------------------------------- settings */
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<PlanHandle | null>(null);
  const [hover, setHover] = useState<PlanHandle | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  /* Mirrored into a ref as well as state. The state is what renders; the ref
     is what `endDrag` reads. Reading the state there instead would put
     `preview` in that callback's dependency list, so the pointerup handler
     would be rebuilt on every mousemove — and a handler that is rebuilt
     mid-gesture is how a commit ends up firing against a stale model. */
  const previewRef = useRef<Preview | null>(null);
  const showPreview = useCallback((p: Preview | null) => {
    previewRef.current = p;
    setPreview(p);
  }, []);

  const dragRef = useRef<DragState | null>(null);
  /* A per-gesture counter so two identical drags in a row cannot coalesce into
     one undo step. UI-only and never persisted, so nothing about the geometry
     or the export depends on it. */
  const gestureRef = useRef(0);

  /* What is on screen: the preview while a gesture is live, the real model
     otherwise. Everything below reads THESE two and never the props directly,
     which is what keeps the drawn plan and the dimensions in agreement. */
  const shownSpec = preview?.spec ?? spec;
  const shownPartitions = preview?.partitions ?? partitions;
  const th = structThicknessOf(shownSpec);
  const tolFt = ftPerPx(view) * snapSettings.tolPx;

  const activeVolumeId =
    selectedVolumeId ??
    (selection && "volumeId" in selection ? selection.volumeId : null) ??
    shownSpec.volumes[0]?.id ??
    null;

  /* ===================================================================== */
  /* pointer                                                                */
  /* ===================================================================== */

  const pxOf = useCallback((e: { clientX: number; clientY: number }): Px => {
    const r = svgRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  }, []);

  const worldOf = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 => toWorldPt(view, pxOf(e)),
    [pxOf, view],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.button !== 1) return;
      svgRef.current?.focus();
      const world = worldOf(e);
      const middle = e.button === 1;

      /* --- the opening tools: one click, one opening, placed where you clicked */
      if (!middle && (tool === "window" || tool === "door" || tool === "glazing-wall")) {
        const hit = hitTest(spec, partitions, world, tolFt);
        /* Only a WALL takes an opening. Clicking the middle of a room with the
           window tool does nothing on purpose — guessing at the nearest wall
           would put a window somewhere nobody pointed. */
        if (hit?.kind !== "wall") return;
        const v = spec.volumes.find((x) => x.id === hit.volumeId);
        if (!v) return;
        const added = addOpening(spec, v.id, hit.wall, tool);
        if (!added.id) return;
        const placed = added.spec.volumes.find((x) => x.id === v.id);
        const made = placed?.openings.find((o) => o.id === added.id);
        const t = tAlongWall(v, hit.wall, th, world);
        const next = made
          ? moveOpening(added.spec, v.id, added.id, t - made.widthFt / 2)
          : added.spec;
        gestureRef.current += 1;
        onEdit(next, `plan:add-opening:${gestureRef.current}`);
        setSelection({ kind: "opening", volumeId: v.id, openingId: added.id });
        onSelectOpening?.(added.id);
        setTool("select");
        return;
      }

      /* --- the partition tool: a rubber band inside one mass */
      if (!middle && tool === "partition") {
        const v = volumeAt(spec, world);
        if (!v) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        gestureRef.current += 1;
        dragRef.current = {
          drag: { kind: "draw", volumeId: v.id, a: toLocal(v, world) },
          spec0: spec,
          parts0: partitions,
          label: `plan:draw-partition:${gestureRef.current}`,
          moved: false,
        };
        return;
      }

      /* --- select / drag */
      const hit = middle ? null : hitTest(spec, partitions, world, tolFt);
      e.currentTarget.setPointerCapture(e.pointerId);
      gestureRef.current += 1;

      if (!hit) {
        dragRef.current = {
          drag: { kind: "pan", fromPx: pxOf(e), panFrom: pan },
          spec0: spec,
          parts0: partitions,
          label: "plan:pan",
          moved: false,
        };
        setSelection(null);
        return;
      }

      setSelection(hit);
      if ("volumeId" in hit) onSelectVolume?.(hit.volumeId);
      if (hit.kind === "opening" || hit.kind === "opening-end") onSelectOpening?.(hit.openingId);
      else if (hit.kind !== "wall") onSelectOpening?.(null);

      const label = `plan:${hit.kind}:${gestureRef.current}`;
      let drag: Drag;
      switch (hit.kind) {
        case "volume": {
          const v = spec.volumes.find((x) => x.id === hit.volumeId);
          if (!v) return;
          drag = { kind: "volume", volumeId: v.id, grabWorld: world, centre0: { x: v.x, z: v.z } };
          break;
        }
        case "wall":
          drag = { kind: "wall", volumeId: hit.volumeId, wall: hit.wall };
          break;
        case "corner":
          drag = { kind: "corner", volumeId: hit.volumeId, index: hit.index };
          break;
        case "opening": {
          const v = spec.volumes.find((x) => x.id === hit.volumeId);
          const o = v?.openings.find((x) => x.id === hit.openingId);
          if (!v || !o) return;
          drag = {
            kind: "opening",
            volumeId: v.id,
            openingId: o.id,
            grabT: tAlongWall(v, o.wall, th, world),
            offset0: o.offsetFt,
          };
          break;
        }
        case "opening-end":
          drag = {
            kind: "opening-end",
            volumeId: hit.volumeId,
            openingId: hit.openingId,
            end: hit.end,
          };
          break;
        case "partition":
          drag = { kind: "partition", id: hit.id };
          break;
        case "partition-end":
          drag = { kind: "partition-end", id: hit.id, end: hit.end };
          break;
        default:
          drag = { kind: "partition-door", id: hit.id };
          break;
      }
      dragRef.current = { drag, spec0: spec, parts0: partitions, label, moved: false };
    },
    [
      onEdit,
      onSelectOpening,
      onSelectVolume,
      pan,
      partitions,
      pxOf,
      spec,
      th,
      tolFt,
      tool,
      worldOf,
    ],
  );

  /* ------------------------------------------------------------ the solve

     One function, every gesture. It takes the model as it was at pointer-down
     and the current world point, and returns what the model would be. Nothing
     here reads the previous frame. */
  const solve = useCallback(
    (state: DragState, world: Vec2): Preview | null => {
      const { drag, spec0, parts0 } = state;
      const s = snapSettings;

      switch (drag.kind) {
        case "volume": {
          const v = spec0.volumes.find((x) => x.id === drag.volumeId);
          if (!v) return null;
          const delta = { x: world.x - drag.grabWorld.x, z: world.z - drag.grabWorld.z };
          const proposed = { x: drag.centre0.x + delta.x, z: drag.centre0.z + delta.z };
          const moved: Volume = { ...v, x: proposed.x, z: proposed.z };
          const cands = worldAlignCandidates(spec0, v.id);
          const snapped = snapMove(
            volumeCornersWorld(moved),
            proposed,
            cands.xs,
            cands.zs,
            tolFt,
            s,
          );
          const centre = { x: proposed.x + snapped.delta.x, z: proposed.z + snapped.delta.z };
          const edit = moveVolumeTo(spec0, parts0, v.id, centre);
          const guides: Guide[] = [];
          if (snapped.guideX !== null) guides.push(guideAcross(null, "x", snapped.guideX));
          if (snapped.guideZ !== null) guides.push(guideAcross(null, "z", snapped.guideZ));
          const nv = edit.spec.volumes.find((x) => x.id === v.id);
          return {
            ...edit,
            guides,
            draft: null,
            readout: nv ? `Centre  E ${dim(nv.x)}   S ${dim(nv.z)}` : "",
          };
        }

        case "wall": {
          const v = spec0.volumes.find((x) => x.id === drag.volumeId);
          if (!v) return null;
          const axis = faceAxisOf(drag.wall);
          const local = toLocal(v, world);
          const cands = localAlignCandidates(spec0, v, parts0);
          /* Alignment snaps the FACE — flush with a neighbour's corner is a
             stated intention. Failing that the resulting DIMENSION goes to the
             grid, because a wall you can read as 34'-0" is worth more than one
             that happens to sit on a site gridline. */
          const opposite = -wallFaceLocal(v, drag.wall);
          const faceSnap = snapScalar(
            axis === "x" ? local.x : local.z,
            axis === "x" ? cands.xs : cands.zs,
            tolFt,
            { ...s, gridFt: 0 },
          );
          let face = faceSnap.value;
          if (faceSnap.kind !== "align" && s.gridFt > 0) {
            const sign = Math.sign(face - opposite) || 1;
            const dimension = Math.abs(face - opposite);
            face = opposite + sign * (Math.round(dimension / s.gridFt) * s.gridFt);
          }
          const edit = offsetWall(spec0, parts0, v.id, drag.wall, face);
          const nv = edit.spec.volumes.find((x) => x.id === v.id);
          return {
            ...edit,
            guides: faceSnap.guide === null ? [] : [guideAcross(v, axis, faceSnap.guide)],
            draft: null,
            readout: nv
              ? `${WALL_LABELS[drag.wall]} wall · ${dim(nv.widthFt)} × ${dim(nv.depthFt)}`
              : "",
          };
        }

        case "corner": {
          const v = spec0.volumes.find((x) => x.id === drag.volumeId);
          if (!v) return null;
          const local = toLocal(v, world);
          const cands = localAlignCandidates(spec0, v, parts0);
          /* Align-only here, exactly as in the wall case: the grid is applied
             to the resulting DIMENSION rather than to the face, so a corner
             drag lands you on 34'-0" × 24'-0" instead of on a face position
             whose dimension happens to be 34'-3½". Letting `snapPoint` grid
             the face first and then gridding the dimension would quantise
             twice from a value already displaced once. */
          const snapped = snapPoint(local, cands.xs, cands.zs, tolFt, { ...s, gridFt: 0 });
          const [wx, wz] = CORNER_WALLS[((drag.index % 4) + 4) % 4];
          const oppX = -wallFaceLocal(v, wx);
          const oppZ = -wallFaceLocal(v, wz);
          const gridFace = (raw: number, opp: number, kind: string) => {
            if (kind === "align" || s.gridFt <= 0) return raw;
            const sign = Math.sign(raw - opp) || 1;
            return opp + sign * (Math.round(Math.abs(raw - opp) / s.gridFt) * s.gridFt);
          };
          const target = {
            x: gridFace(snapped.p.x, oppX, snapped.x.kind),
            z: gridFace(snapped.p.z, oppZ, snapped.z.kind),
          };
          const edit = dragCorner(spec0, parts0, v.id, drag.index, target);
          const guides: Guide[] = [];
          if (snapped.x.guide !== null) guides.push(guideAcross(v, "x", snapped.x.guide));
          if (snapped.z.guide !== null) guides.push(guideAcross(v, "z", snapped.z.guide));
          const nv = edit.spec.volumes.find((x) => x.id === v.id);
          return {
            ...edit,
            guides,
            draft: null,
            readout: nv ? `${dim(nv.widthFt)} × ${dim(nv.depthFt)}  ·  ${Math.round(nv.widthFt * nv.depthFt)} sq ft` : "",
          };
        }

        case "opening": {
          const v = spec0.volumes.find((x) => x.id === drag.volumeId);
          const o = v?.openings.find((x) => x.id === drag.openingId);
          if (!v || !o) return null;
          const t = tAlongWall(v, o.wall, th, world);
          const raw = drag.offset0 + (t - drag.grabT);
          const cands = openingAlignCandidates(spec0, v, o.wall, o.id, o.widthFt);
          const snapped = snapScalar(raw, cands, tolFt, s);
          const nextSpec = moveOpening(spec0, v.id, o.id, snapped.value);
          const nv = nextSpec.volumes.find((x) => x.id === v.id);
          const no = nv?.openings.find((x) => x.id === o.id);
          const chain = nv && no ? openingChain(nextSpec, nv, no) : null;
          return {
            spec: nextSpec,
            partitions: parts0,
            adjusted: [],
            guides: [],
            draft: null,
            readout: chain
              ? `${dim(chain.before)}  |  ${dim(chain.span)}  |  ${dim(chain.after)}`
              : "",
          };
        }

        case "opening-end": {
          const v = spec0.volumes.find((x) => x.id === drag.volumeId);
          const o = v?.openings.find((x) => x.id === drag.openingId);
          if (!v || !o) return null;
          const raw = tAlongWall(v, o.wall, th, world);
          const cands = openingAlignCandidates(spec0, v, o.wall, o.id, 0);
          const snapped = snapScalar(raw, cands, tolFt, s);
          const nextSpec = resizeOpening(spec0, v.id, o.id, drag.end, snapped.value);
          const nv = nextSpec.volumes.find((x) => x.id === v.id);
          const no = nv?.openings.find((x) => x.id === o.id);
          const chain = nv && no ? openingChain(nextSpec, nv, no) : null;
          return {
            spec: nextSpec,
            partitions: parts0,
            adjusted: [],
            guides: [],
            draft: null,
            readout: chain
              ? `${KIND_LABELS[o.kind]} ${dim(chain.span)} wide  ·  ${dim(chain.before)} from the end`
              : "",
          };
        }

        case "partition": {
          const p = parts0.find((x) => x.id === drag.id);
          const v = p ? spec0.volumes.find((x) => x.id === p.volumeId) : undefined;
          if (!p || !v) return null;
          const local = toLocal(v, world);
          const acrossAxis = p.axis === "x" ? "z" : "x";
          const cands = localAlignCandidates(spec0, v, parts0.filter((x) => x.id !== p.id));
          const snapped = snapScalar(
            acrossAxis === "x" ? local.x : local.z,
            acrossAxis === "x" ? cands.xs : cands.zs,
            tolFt,
            s,
          );
          const next = movePartitionTo(v, parts0, p.id, snapped.value, th);
          const np = next.find((x) => x.id === p.id);
          const chain = np ? partitionAcrossChain(v, np, th) : null;
          return {
            spec: spec0,
            partitions: next,
            adjusted: [],
            guides: snapped.guide === null ? [] : [guideAcross(v, acrossAxis, snapped.guide)],
            draft: null,
            readout: chain ? `${dim(chain.before)}  |  partition  |  ${dim(chain.after)}` : "",
          };
        }

        case "partition-end": {
          const p = parts0.find((x) => x.id === drag.id);
          const v = p ? spec0.volumes.find((x) => x.id === p.volumeId) : undefined;
          if (!p || !v) return null;
          const local = toLocal(v, world);
          const cands = localAlignCandidates(spec0, v, parts0.filter((x) => x.id !== p.id));
          const snapped = snapScalar(
            p.axis === "x" ? local.x : local.z,
            p.axis === "x" ? cands.xs : cands.zs,
            tolFt,
            s,
          );
          const next = dragPartitionEnd(v, parts0, p.id, drag.end, snapped.value, th);
          const np = next.find((x) => x.id === p.id);
          return {
            spec: spec0,
            partitions: next,
            adjusted: [],
            guides: snapped.guide === null ? [] : [guideAcross(v, p.axis, snapped.guide)],
            draft: null,
            readout: np ? `Partition ${dim(partitionLengthFt(np))} long` : "",
          };
        }

        case "partition-door": {
          const p = parts0.find((x) => x.id === drag.id);
          const v = p ? spec0.volumes.find((x) => x.id === p.volumeId) : undefined;
          if (!p || !v || !p.door) return null;
          const local = toLocal(v, world);
          const along = p.axis === "x" ? local.x : local.z;
          const snapped = snapScalar(along, [], tolFt, s);
          const next = setPartitionDoor(parts0, p.id, {
            atFt: snapped.value,
            widthFt: p.door.widthFt,
          });
          const np = next.find((x) => x.id === p.id);
          return {
            spec: spec0,
            partitions: next,
            adjusted: [],
            guides: [],
            draft: null,
            readout: np?.door
              ? `Doorway ${dim(np.door.widthFt)} · ${dim(np.door.atFt - np.fromFt)} from the end`
              : "",
          };
        }

        case "draw": {
          const v = spec0.volumes.find((x) => x.id === drag.volumeId);
          if (!v) return null;
          const local = toLocal(v, world);
          const cands = localAlignCandidates(spec0, v, parts0);
          const snapped = snapPoint(local, cands.xs, cands.zs, tolFt, s);
          const draft = partitionFromDrag(v, v.id, drag.a, snapped.p, th);
          if (!draft) {
            return {
              spec: spec0,
              partitions: parts0,
              adjusted: [],
              guides: [],
              draft: { volumeId: v.id, a: drag.a, b: snapped.p },
              readout: "Drag further — a partition starts at 2 ft",
            };
          }
          const added = addPartition(parts0, draft);
          const made = added.partitions[added.partitions.length - 1];
          return {
            spec: spec0,
            partitions: added.partitions,
            adjusted: [],
            guides: [],
            draft: null,
            readout: `New partition ${dim(partitionLengthFt(made))} long`,
          };
        }

        default:
          return null;
      }
    },
    [snapSettings, th, tolFt],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const state = dragRef.current;
      const world = worldOf(e);

      if (!state) {
        const next = tool === "select" ? hitTest(spec, partitions, world, tolFt) : null;
        /* `hitTest` returns a fresh object every call, so assigning it blindly
           would re-render the whole plan on every mouse move over the panel.
           Compare by key and keep the old object when nothing changed. */
        setHover((prev) => (handleKey(prev) === handleKey(next) ? prev : next));
        return;
      }
      state.moved = true;

      if (state.drag.kind === "pan") {
        const now = pxOf(e);
        setPan({
          x: state.drag.panFrom.x + (now.x - state.drag.fromPx.x),
          y: state.drag.panFrom.y + (now.y - state.drag.fromPx.y),
        });
        return;
      }
      showPreview(solve(state, world));
    },
    [partitions, pxOf, showPreview, solve, spec, tolFt, tool, worldOf],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const state = dragRef.current;
      dragRef.current = null;
      const p = previewRef.current;
      showPreview(null);
      if (!state || !commit || !p || !state.moved) return;

      if (p.spec !== state.spec0) onEdit(p.spec, state.label);
      if (p.partitions !== state.parts0) commitPartitions(p.partitions, state.label);
      if (state.drag.kind === "draw" && p.partitions.length > state.parts0.length) {
        const made = p.partitions[p.partitions.length - 1];
        setSelection({ kind: "partition", id: made.id });
        setTool("select");
      }
    },
    [commitPartitions, onEdit, showPreview],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (svgRef.current?.hasPointerCapture(e.pointerId)) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
      endDrag(true);
    },
    [endDrag],
  );

  /* ------------------------------------------------------------------ wheel

     Registered by hand rather than through `onWheel`, because React attaches
     wheel listeners passively and a passive listener cannot call
     preventDefault — the page would scroll out from under the plan. */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setZoom((z0) => {
        const z1 = Math.min(12, Math.max(0.2, z0 * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        const ratio = z1 / z0;
        setPan((p0) => ({
          x: (cx - r.width / 2) * (1 - ratio) + ratio * p0.x,
          y: (cy - r.height / 2) * (1 - ratio) + ratio * p0.y,
        }));
        return z1;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ===================================================================== */
  /* keyboard — every mouse gesture also has a key, and Delete is reversible */
  /* ===================================================================== */

  const nudge = useCallback(
    (dxFt: number, dzFt: number) => {
      const sel = selection;
      if (!sel) return;
      const step = `plan:nudge:${handleKey(sel)}`;

      if (sel.kind === "partition" || sel.kind === "partition-end" || sel.kind === "partition-door") {
        const p = partitions.find((x) => x.id === sel.id);
        const v = p ? spec.volumes.find((x) => x.id === p.volumeId) : undefined;
        if (!p || !v) return;
        const d = dirToLocal(v, { x: dxFt, z: dzFt });
        const across = p.axis === "x" ? d.z : d.x;
        if (across === 0) return;
        commitPartitions(movePartitionTo(v, partitions, p.id, p.atFt + across, th), step);
        return;
      }
      if (sel.kind === "opening" || sel.kind === "opening-end") {
        const v = spec.volumes.find((x) => x.id === sel.volumeId);
        const o = v?.openings.find((x) => x.id === sel.openingId);
        if (!v || !o) return;
        const d = dirToLocal(v, { x: dxFt, z: dzFt });
        const seg = pointOnWallLocal(v, o.wall, th, 1);
        const zero = pointOnWallLocal(v, o.wall, th, 0);
        const along = (seg.x - zero.x) * d.x + (seg.z - zero.z) * d.z;
        if (along === 0) return;
        onEdit(moveOpening(spec, v.id, o.id, o.offsetFt + along), step);
        return;
      }
      if (sel.kind === "wall") {
        const v = spec.volumes.find((x) => x.id === sel.volumeId);
        if (!v) return;
        const d = dirToLocal(v, { x: dxFt, z: dzFt });
        const axis = faceAxisOf(sel.wall);
        const delta = axis === "x" ? d.x : d.z;
        if (delta === 0) return;
        const edit = offsetWall(spec, partitions, v.id, sel.wall, wallFaceLocal(v, sel.wall) + delta);
        onEdit(edit.spec, step);
        if (edit.partitions !== partitions) commitPartitions(edit.partitions, step);
        return;
      }
      if (sel.kind === "corner") {
        const v = spec.volumes.find((x) => x.id === sel.volumeId);
        if (!v) return;
        const d = dirToLocal(v, { x: dxFt, z: dzFt });
        const c = cornerLocal(v, sel.index);
        const edit = dragCorner(spec, partitions, v.id, sel.index, { x: c.x + d.x, z: c.z + d.z });
        onEdit(edit.spec, step);
        if (edit.partitions !== partitions) commitPartitions(edit.partitions, step);
        return;
      }
      const v = spec.volumes.find((x) => x.id === sel.volumeId);
      if (!v) return;
      onEdit(moveVolumeTo(spec, partitions, v.id, { x: v.x + dxFt, z: v.z + dzFt }).spec, step);
    },
    [commitPartitions, onEdit, partitions, selection, spec, th],
  );

  const removeSelected = useCallback(() => {
    const sel = selection;
    if (!sel) return;
    gestureRef.current += 1;
    const label = `plan:delete:${gestureRef.current}`;
    if (sel.kind === "partition" || sel.kind === "partition-end") {
      commitPartitions(removePartition(partitions, sel.id), label);
      setSelection(null);
    } else if (sel.kind === "partition-door") {
      commitPartitions(setPartitionDoor(partitions, sel.id, null), label);
      setSelection({ kind: "partition", id: sel.id });
    } else if (sel.kind === "opening" || sel.kind === "opening-end") {
      onEdit(removeOpening(spec, sel.volumeId, sel.openingId), label);
      onSelectOpening?.(null);
      setSelection(null);
    }
    /* A VOLUME is deliberately not deletable from here. Removing the first one
       relocates the deck, and `edits.ts` returns a `deckMoved` flag so the
       panel can say so — swallowing that here would make a mass disappear with
       a side effect nobody was told about. The panel owns that action. */
  }, [commitPartitions, onEdit, onSelectOpening, partitions, selection, spec]);

  const addDoorToSelected = useCallback(() => {
    const sel = selection;
    if (!sel || (sel.kind !== "partition" && sel.kind !== "partition-end")) return;
    const p = partitions.find((x) => x.id === sel.id);
    if (!p) return;
    gestureRef.current += 1;
    const width = Math.min(2.8, Math.max(MIN_DOOR_FT, partitionLengthFt(p) - 1));
    commitPartitions(
      setPartitionDoor(partitions, p.id, {
        atFt: (p.fromFt + p.toFt) / 2,
        widthFt: width,
      }),
      `plan:door:${gestureRef.current}`,
    );
  }, [commitPartitions, partitions, selection]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (e.key === "Escape") {
        if (dragRef.current) {
          endDrag(false);
          e.preventDefault();
          return;
        }
        if (tool !== "select") {
          setTool("select");
          e.preventDefault();
          return;
        }
        setSelection(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
        return;
      }
      const stepFt = (snapSettings.gridFt > 0 ? snapSettings.gridFt : 0.25) * (e.shiftKey ? 5 : 1);
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-stepFt, 0],
        ArrowRight: [stepFt, 0],
        // north is up, and north is −z
        ArrowUp: [0, -stepFt],
        ArrowDown: [0, stepFt],
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        nudge(d[0], d[1]);
      }
    },
    [endDrag, nudge, removeSelected, snapSettings.gridFt, tool],
  );

  /* ===================================================================== */
  /* render                                                                 */
  /* ===================================================================== */

  const worldBox = useMemo(() => viewWorldBounds(view), [view]);
  const minor = snapSettings.gridFt > 0 ? snapSettings.gridFt : 1;
  const gx = useMemo(
    () => gridLines(worldBox.minX, worldBox.maxX, minor, view.scale),
    [minor, view.scale, worldBox.maxX, worldBox.minX],
  );
  const gz = useMemo(
    () => gridLines(worldBox.minZ, worldBox.maxZ, minor, view.scale),
    [minor, view.scale, worldBox.maxZ, worldBox.minZ],
  );
  const gxMajor = useMemo(
    () => gridLines(worldBox.minX, worldBox.maxX, 10, view.scale, 3),
    [view.scale, worldBox.maxX, worldBox.minX],
  );
  const gzMajor = useMemo(
    () => gridLines(worldBox.minZ, worldBox.maxZ, 10, view.scale, 3),
    [view.scale, worldBox.maxZ, worldBox.minZ],
  );

  const deck = useMemo(() => {
    const pts = deckCornersPlan(shownSpec);
    return pts ? pts.map(([x, z]) => toPx(view, { x, z })) : null;
  }, [shownSpec, view]);

  const hoverKey = handleKey(hover);
  const selKey = handleKey(selection);

  const readout =
    preview?.readout ??
    describeSelection(shownSpec, shownPartitions, selection, th) ??
    "Drag a corner to resize, a wall to push it, or draw a partition inside a mass.";

  return (
    <section className="aura-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="aura-label">Floor plan</p>
        <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/45">
          North up · 1 square = {minor >= 1 ? `${minor} ft` : `${Math.round(minor * 12)} in`}
        </p>
      </div>

      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-aura-text/60">
        The same home the 3D view is showing, from above and to scale. Drag a corner to resize the
        mass — the opposite corner stays put and the footprint stays rectangular, which is what
        keeps it solvable by the plan engine. Drag a wall to push that one face. Draw interior
        partitions where you want them instead of letting the room packer decide. Every drag is one
        undo, and Escape mid-drag costs nothing.
      </p>

      {/* --------------------------------------------------------- toolbar */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <Segmented<Tool> label="Tool" value={tool} options={TOOLS} onChange={setTool} />
        <div className="flex flex-wrap items-end gap-4">
          <Segmented<string>
            label="Grid"
            value={String(snapSettings.gridFt)}
            options={GRID_STEPS.map((g) => ({ id: String(g.ft), label: g.label }))}
            onChange={(v) => setSnapSettings((s) => ({ ...s, gridFt: Number(v) }))}
          />
          <div className="flex gap-2">
            <Button
              tone={snapSettings.align ? "loud" : "quiet"}
              onClick={() => setSnapSettings((s) => ({ ...s, align: !s.align }))}
              title="Snap to other masses' corners and to this volume's partitions"
            >
              Align {snapSettings.align ? "on" : "off"}
            </Button>
            <Button onClick={fit} title="Fit the whole home in the frame">
              Fit
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ plan */}
      <div
        ref={wrapRef}
        className="mt-5 aspect-[4/3] w-full overflow-hidden rounded-xl border aura-hairline bg-aura-sunken"
      >
        {size.w > 0 ? (
          <svg
            ref={svgRef}
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            role="application"
            tabIndex={0}
            aria-label="Floor plan editor. Arrow keys move the selection, Delete removes it, Escape cancels."
            data-cursor={tool === "select" ? "Drag" : TOOLS.find((t) => t.id === tool)?.label}
            className="block touch-none outline-none focus-visible:ring-1 focus-visible:ring-aura-emerald"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            {/* ---- grid */}
            <g className="stroke-aura-ink/10" strokeWidth={1}>
              {gx.map((x) => {
                const p = toPx(view, { x, z: 0 });
                return <line key={`gx${x}`} x1={p.x} y1={0} x2={p.x} y2={size.h} />;
              })}
              {gz.map((z) => {
                const p = toPx(view, { x: 0, z });
                return <line key={`gz${z}`} x1={0} y1={p.y} x2={size.w} y2={p.y} />;
              })}
            </g>
            <g className="stroke-aura-ink/25" strokeWidth={1}>
              {gxMajor.map((x) => {
                const p = toPx(view, { x, z: 0 });
                return <line key={`mx${x}`} x1={p.x} y1={0} x2={p.x} y2={size.h} />;
              })}
              {gzMajor.map((z) => {
                const p = toPx(view, { x: 0, z });
                return <line key={`mz${z}`} x1={0} y1={p.y} x2={size.w} y2={p.y} />;
              })}
            </g>

            {/* ---- the deck, for context only: it is edited in the panel */}
            {deck ? (
              <path
                d={pathOf(deck)}
                className="fill-aura-teal/10 stroke-aura-teal/50"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}

            {/* ---- the masses */}
            {shownSpec.volumes.map((v) => (
              <VolumePlan
                key={v.id}
                v={v}
                view={view}
                thicknessFt={th}
                partitions={shownPartitions.filter((p) => p.volumeId === v.id)}
                active={v.id === activeVolumeId}
                hoverKey={hoverKey}
                selKey={selKey}
                selectedOpeningId={selectedOpeningId ?? null}
                showHandles={tool === "select"}
              />
            ))}

            {/* ---- the rubber band */}
            {preview?.draft
              ? (() => {
                  const v = shownSpec.volumes.find((x) => x.id === preview.draft?.volumeId);
                  if (!v || !preview.draft) return null;
                  const a = toPx(view, toWorld(v, preview.draft.a));
                  const b = toPx(view, toWorld(v, preview.draft.b));
                  return (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className="stroke-aura-violet"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                    />
                  );
                })()
              : null}

            {/* ---- alignment guides */}
            {(preview?.guides ?? []).map((g, i) => {
              const a = toPx(view, g.a);
              const b = toPx(view, g.b);
              return (
                <line
                  key={`guide${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="stroke-aura-violet"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              );
            })}
          </svg>
        ) : null}
      </div>

      {/* ------------------------------------------------------- the number */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className="font-mono text-xs tabular-nums text-aura-text/80"
        >
          {readout}
        </p>
        <div className="flex flex-wrap gap-2">
          {selection?.kind === "partition" || selection?.kind === "partition-end" ? (
            <>
              <Button onClick={addDoorToSelected} title="Cut a doorway in this partition">
                Add doorway
              </Button>
              <Button tone="danger" onClick={removeSelected}>
                Delete partition
              </Button>
            </>
          ) : null}
          {selection?.kind === "opening" || selection?.kind === "opening-end" ? (
            <Button tone="danger" onClick={removeSelected}>
              Delete opening
            </Button>
          ) : null}
        </div>
      </div>

      {preview && preview.adjusted.length > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-aura-violet">
          {preview.adjusted.length} thing{preview.adjusted.length === 1 ? " was" : "s were"} moved to
          stay inside the mass: {preview.adjusted.join(", ")}. Undo puts them back.
        </p>
      ) : null}

      <p className="mt-4 border-t aura-hairline pt-4 max-w-3xl text-xs leading-relaxed text-aura-text/55">
        Partitions drawn here are 90 mm — the non-structural thickness this system uses everywhere,
        and the one the schedule prints. They are NOT yet carried into the plan engine or the sheet
        set: those read `HomeSpec`, and partitions are held beside it until the spec gains the
        field. Until then a share link carries the masses and not the interior walls, and this
        panel says so rather than letting somebody discover it from a drawing.
      </p>
    </section>
  );
}

/* ===========================================================================
   one mass, drawn
   =========================================================================== */

function VolumePlan({
  v,
  view,
  thicknessFt,
  partitions,
  active,
  hoverKey,
  selKey,
  selectedOpeningId,
  showHandles,
}: {
  v: Volume;
  view: View;
  thicknessFt: number;
  partitions: readonly Partition[];
  active: boolean;
  hoverKey: string;
  selKey: string;
  selectedOpeningId: string | null;
  showHandles: boolean;
}) {
  const hw = v.widthFt / 2;
  const hd = v.depthFt / 2;
  const inner = interiorBoundsLocal(v, thicknessFt);

  const outerPts: Vec2[] = [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];
  const innerPts: Vec2[] = [
    { x: inner.minX, z: inner.minZ },
    { x: inner.maxX, z: inner.minZ },
    { x: inner.maxX, z: inner.maxZ },
    { x: inner.minX, z: inner.maxZ },
  ];

  return (
    <g>
      {/* floor */}
      <path d={localPath(v, view, innerPts)} className="fill-aura-panel" />
      {/* wall poché — outer ring minus inner, so 190 mm of SIP reads as the
          dimension it is instead of as a hairline */}
      <path
        d={`${localPath(v, view, outerPts)} ${localPath(v, view, innerPts)}`}
        fillRule="evenodd"
        className={active ? "fill-aura-ink/70" : "fill-aura-ink/45"}
      />
      <path
        d={localPath(v, view, outerPts)}
        fill="none"
        className={active ? "stroke-aura-emerald" : "stroke-aura-ink/40"}
        strokeWidth={active ? 1.5 : 1}
      />

      {/* openings: punch the poché, then draw what fills the hole */}
      {v.openings.map((o) => {
        const face = wallFaceLocal(v, o.wall);
        const axis = faceAxisOf(o.wall);
        const sign = Math.sign(face) || 1;
        const a = pointOnWallLocal(v, o.wall, thicknessFt, o.offsetFt);
        const b = pointOnWallLocal(v, o.wall, thicknessFt, o.offsetFt + o.widthFt);
        const push = (p: Vec2, by: number): Vec2 =>
          axis === "x" ? { x: p.x + by, z: p.z } : { x: p.x, z: p.z + by };
        const quad = [a, b, push(b, -sign * thicknessFt), push(a, -sign * thicknessFt)];
        const key = `opening:${v.id}:${o.id}`;
        const lit = hoverKey === key || selKey === key || selectedOpeningId === o.id;
        const mid = [push(a, (-sign * thicknessFt) / 2), push(b, (-sign * thicknessFt) / 2)];

        return (
          <g key={o.id}>
            <path d={localPath(v, view, quad)} className="fill-aura-panel" />
            {o.kind === "door" ? (
              (() => {
                const hinge = toPx(view, toWorld(v, mid[0]));
                const jamb = toPx(view, toWorld(v, mid[1]));
                const tipLocal = push(mid[0], -sign * o.widthFt);
                const tip = toPx(view, toWorld(v, tipLocal));
                return (
                  <path
                    d={swingPath(hinge, jamb, tip)}
                    fill="none"
                    className={lit ? "stroke-aura-emerald" : "stroke-aura-emerald/60"}
                    strokeWidth={1.25}
                  />
                );
              })()
            ) : (
              <path
                d={localPath(v, view, mid, false)}
                fill="none"
                className={
                  o.kind === "glazing-wall"
                    ? lit
                      ? "stroke-aura-teal"
                      : "stroke-aura-teal/70"
                    : lit
                      ? "stroke-aura-teal-mark"
                      : "stroke-aura-teal-mark/70"
                }
                strokeWidth={o.kind === "glazing-wall" ? 3 : 2}
              />
            )}
            {showHandles && lit
              ? [a, b].map((p, i) => {
                  const px = toPx(view, toWorld(v, p));
                  return (
                    <rect
                      key={`oe${i}`}
                      x={px.x - 3}
                      y={px.y - 3}
                      width={6}
                      height={6}
                      className="fill-aura-bg stroke-aura-teal"
                      strokeWidth={1.25}
                    />
                  );
                })
              : null}
          </g>
        );
      })}

      {/* partitions */}
      {partitions.map((p) => {
        const key = `partition:${p.id}`;
        const lit = refersToPartition(hoverKey, p.id) || refersToPartition(selKey, p.id);
        const quad = partitionQuadLocal(p);
        const seg = { a: pointOnPartitionLocal(p, 0), b: pointOnPartitionLocal(p, p.toFt - p.fromFt) };
        return (
          <g key={p.id}>
            <path
              d={localPath(v, view, quad)}
              className={lit ? "fill-aura-ink/80" : "fill-aura-ink/55"}
            />
            {p.door
              ? (() => {
                  const half = p.door.widthFt / 2;
                  const g0 = pointOnPartitionLocal(p, p.door.atFt - half - p.fromFt);
                  const g1 = pointOnPartitionLocal(p, p.door.atFt + half - p.fromFt);
                  const t = p.thicknessFt / 2 + 0.01;
                  const gap: Vec2[] =
                    p.axis === "x"
                      ? [
                          { x: g0.x, z: g0.z - t },
                          { x: g1.x, z: g1.z - t },
                          { x: g1.x, z: g1.z + t },
                          { x: g0.x, z: g0.z + t },
                        ]
                      : [
                          { x: g0.x - t, z: g0.z },
                          { x: g1.x - t, z: g1.z },
                          { x: g1.x + t, z: g1.z },
                          { x: g0.x + t, z: g0.z },
                        ];
                  const hinge = toPx(view, toWorld(v, g0));
                  const jamb = toPx(view, toWorld(v, g1));
                  const tipLocal: Vec2 =
                    p.axis === "x"
                      ? { x: g0.x, z: g0.z + p.door.widthFt }
                      : { x: g0.x + p.door.widthFt, z: g0.z };
                  const tip = toPx(view, toWorld(v, tipLocal));
                  return (
                    <>
                      <path d={localPath(v, view, gap)} className="fill-aura-panel" />
                      <path
                        d={swingPath(hinge, jamb, tip)}
                        fill="none"
                        className="stroke-aura-emerald/70"
                        strokeWidth={1.1}
                      />
                    </>
                  );
                })()
              : null}
            {showHandles && lit
              ? [seg.a, seg.b].map((pt, i) => {
                  const px = toPx(view, toWorld(v, pt));
                  return (
                    <circle
                      key={`pe${i}`}
                      cx={px.x}
                      cy={px.y}
                      r={3.5}
                      className="fill-aura-bg stroke-aura-emerald"
                      strokeWidth={1.25}
                    />
                  );
                })
              : null}
          </g>
        );
      })}

      {/* handles: corners as squares, wall grips as bars */}
      {showHandles && active ? (
        <g>
          {[0, 1, 2, 3].map((i) => {
            const px = toPx(view, toWorld(v, cornerLocal(v, i)));
            const key = `corner:${v.id}:${i}`;
            const lit = hoverKey === key || selKey === key;
            return (
              <rect
                key={`c${i}`}
                x={px.x - 4.5}
                y={px.y - 4.5}
                width={9}
                height={9}
                className={
                  lit ? "fill-aura-emerald stroke-aura-emerald" : "fill-aura-bg stroke-aura-emerald"
                }
                strokeWidth={1.5}
              />
            );
          })}
          {/* A grip at the midpoint of each wall. Its LENGTH is fixed in
              pixels, not in feet: a grip sized in feet is a speck when you
              zoom out and a stripe across the room when you zoom in. The run
              direction is taken in pixel space so a mass at any bearing gets a
              bar lying along its own wall. */}
          {WALLS_CW.map((wall) => {
            const face = wallFaceLocal(v, wall);
            const axis = faceAxisOf(wall);
            const at: Vec2 = axis === "x" ? { x: face, z: 0 } : { x: 0, z: face };
            const mid = toPx(view, toWorld(v, at));
            const one = toPx(view, toWorld(v, pointOnWallLocal(v, wall, thicknessFt, 1)));
            const zero = toPx(view, toWorld(v, pointOnWallLocal(v, wall, thicknessFt, 0)));
            const len = Math.hypot(one.x - zero.x, one.y - zero.y) || 1;
            const ux = (one.x - zero.x) / len;
            const uy = (one.y - zero.y) / len;
            // never longer than a third of the wall it sits on
            const wallPx = wallRunFt(v, wall, thicknessFt) * view.scale;
            const half = Math.max(4, Math.min(14, wallPx / 6));
            const key = `wall:${v.id}:${wall}`;
            const lit = hoverKey === key || selKey === key;
            return (
              <line
                key={`w${wall}`}
                x1={mid.x - ux * half}
                y1={mid.y - uy * half}
                x2={mid.x + ux * half}
                y2={mid.y + uy * half}
                className={lit ? "stroke-aura-emerald" : "stroke-aura-emerald/60"}
                strokeWidth={lit ? 4.5 : 3}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : null}
    </g>
  );
}

/* ===========================================================================
   small pure helpers used above
   =========================================================================== */

/** What the footer says when nothing is being dragged. */
function describeSelection(
  spec: HomeSpec,
  partitions: readonly Partition[],
  sel: PlanHandle | null,
  thicknessFt: number,
): string | null {
  if (!sel) return null;
  switch (sel.kind) {
    case "volume":
    case "corner":
    case "wall": {
      const v = spec.volumes.find((x) => x.id === sel.volumeId);
      if (!v) return null;
      const head =
        sel.kind === "wall"
          ? `${v.name} · ${WALL_LABELS[sel.wall]} wall ${dim(wallRunOf(spec, v, sel.wall))}`
          : v.name;
      return `${head} · ${dim(v.widthFt)} × ${dim(v.depthFt)} · ${Math.round(v.widthFt * v.depthFt)} sq ft`;
    }
    case "opening":
    case "opening-end": {
      const v = spec.volumes.find((x) => x.id === sel.volumeId);
      const o = v?.openings.find((x) => x.id === sel.openingId);
      if (!v || !o) return null;
      const chain = openingChain(spec, v, o);
      return `${KIND_LABELS[o.kind]} on the ${WALL_LABELS[o.wall].toLowerCase()} wall · ${dim(chain.before)} | ${dim(chain.span)} | ${dim(chain.after)}`;
    }
    case "partition":
    case "partition-end":
    case "partition-door": {
      const p = partitions.find((x) => x.id === sel.id);
      const v = p ? spec.volumes.find((x) => x.id === p.volumeId) : undefined;
      if (!p || !v) return null;
      const chain = partitionAcrossChain(v, p, thicknessFt);
      const door = p.door ? ` · doorway ${dim(p.door.widthFt)}` : "";
      return `Partition ${dim(partitionLengthFt(p))} long, ${Math.round(p.thicknessFt * MM_PER_FT)} mm thick · ${dim(chain.before)} | ${dim(chain.after)}${door}`;
    }
    default:
      return null;
  }
}

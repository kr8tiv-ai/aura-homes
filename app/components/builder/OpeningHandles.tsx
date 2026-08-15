"use client";

/* ===========================================================================
   OPENING HANDLES — grab a window in the 3D view, and type the same number.

   Two exports, one file, the shape `FixturePalette.tsx` already uses here:

     <OpeningHandles>  the R3F layer. Mount it in the viewport's
                       `houseChildren` slot; it draws five grips on the
                       SELECTED opening and drags them.
     <OpeningNumbers>  the DOM panel. The same five dimensions as fields, so
                       "exceptionally easy" includes typing an exact number.

   THEY SHARE NO STATE AND NO ARITHMETIC. Both are controlled, and both hand
   their answer to `applyOpeningEdit` in `openingEdit.ts` — the ONE mutator.
   That is the whole point of this node: a drag in 3D, the same drag in the
   floor plan and the same value typed into a field produce an identical
   HomeSpec and therefore an identical `hashBuilderDocument`. Three code paths
   for one edit is the divergence class this repo has been bitten by four
   times, and `tests/opening-edit.spec.ts` asserts the equality rather than
   this paragraph asserting it.

   WHY THE LAYER GOES IN `houseChildren` AND NOT IN Viewport.tsx. That slot was
   built for exactly this and currently carries the fixture layer. The canvas is
   the export root, two other specs pin that it never remounts and is never
   conditionally mounted, and a handle layer is not worth reopening that file
   for. Everything here is a child of the group `houseRef` points at, so the
   whole group carries EXPORT_IGNORE: a .glb of an Aura home contains the
   windows and does not contain the grips you moved them with — the same trade
   `FixtureLayer` makes with its clearance boxes, and `exportSpec.ts` names
   "drag handles" in the doc comment on that flag.

   WHY THE POINTER IS A DOM LISTENER AND NOT AN R3F CAPTURE. `SurfacePicker`
   already reaches for `gl.domElement` and its own raycaster for the same
   reason: a drag has to keep tracking after the pointer leaves the canvas, and
   mutating the raycaster the renderer is about to use is shared state that
   works until it does not. Pointer-DOWN is an R3F event, because that is what
   tells us WHICH grip was grabbed; everything after it is windowed.

   WHY IT COMMITS EVERY FRAME INSTEAD OF PREVIEWING. `Plan2D` previews locally
   and commits once, because it draws its own SVG and can. This layer cannot:
   the walls it is moving are built by `BuilderApp` from the document, so the
   only way the model moves under the cursor is to edit the document. That is
   exactly what every slider in this editor already does, and the history
   reducer coalesces by LABEL — so one gesture with one label is one undo step
   however many frames it took. The honest cost, stated rather than hidden:
   Escape mid-drag puts the opening back where it started, and that return is
   the same single history step rather than no step at all. One undo clears it.

   THE COLOUR RULE. The three material colours below are three.js material
   colours, which is exactly where `Viewport.tsx` and `FixturePalette.tsx` keep
   theirs — a WebGL material is not a CSS class. `PICK_HIGHLIGHT_COLOR` is
   imported rather than retyped so a grip and a picked surface are the same
   emerald. The DOM panel below contains no literal colour at all.
   =========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { fmtFt } from "@/lib/builder/drawings/kit";
import { EXPORT_IGNORE } from "@/lib/builder/exportSpec";
import { PICK_HIGHLIGHT_COLOR } from "@/lib/builder/surfaces";
import type { HomeSpec, Opening, Volume } from "@/lib/builder/spec";
import { wallThicknessFt } from "@/lib/builder/geometry";
import { pointOnWallLocal, toWorld } from "@/lib/builder/walls";
import { KIND_LABELS, LIMITS, WALL_LABELS } from "./edits";
import {
  applyOpeningEdit,
  openingBox,
  openingBoxFromEdgeDrag,
  openingBoxFromHeightDrag,
  openingFieldLabel,
  openingGestureLabel,
  openingHandles,
  openingReadout,
  openingRunFt,
  qFt,
  snapOpeningDrag,
  wallFrameWorld,
  wallHeadFt,
  OPENING_DRAG_SNAP_FT,
  OPENING_HANDLE_STANDOFF_FT,
  type OpeningBox,
  type OpeningHandle,
  type OpeningHandleKind,
} from "./openingEdit";
import { Button, Panel } from "./ui";

/* ===========================================================================
   what the two surfaces say back
   =========================================================================== */

/** The line under the cursor while something is being changed, plus anything
 *  the mutator refused. Held by the integrator so the 3D layer and the panel
 *  can never be showing two different answers about the same opening. */
export interface OpeningStatus {
  readout: string;
  refusals: readonly string[];
  source: "3d" | "field";
}

/* The drag lattice is `OPENING_DRAG_SNAP_FT` in `openingEdit.ts`, beside the
   mutator, because it is what makes a drag and a typed value comparable rather
   than a detail of this layer. `snapOpeningDrag` is the rounding. */
const snapDrag = snapOpeningDrag;

/* ===========================================================================
   THE 3D LAYER
   =========================================================================== */

/** A grip's bar, oriented in the wall's own frame: local +x runs ALONG the
 *  wall and local +z points out of it, which is what the group rotation below
 *  arranges. Sizes are feet, so a grip is a real object on a real wall. */
const BAR_THICKNESS_FT = 0.16;

interface DragState {
  kind: OpeningHandleKind;
  /** the document as it was when the pointer went down. EVERY frame is solved
   *  from THIS, never from the previous frame, so a slow drag and a fast one
   *  over the same path land on the same numbers and nothing accumulates. */
  spec0: HomeSpec;
  opening0: Opening;
  volumeId: string;
  /** where along the wall the cursor grabbed, feet */
  grabT: number;
  label: string;
  plane: THREE.Plane;
  /** the wall's t = 0 point, shifted out to the handle standoff */
  origin: THREE.Vector3;
  run: THREE.Vector3;
  /** the box the last frame committed. `applyOpeningEdit` returns a fresh spec
   *  object whenever the result differs from `spec0`, so without this a drag
   *  that hovers on one value would push an identical document sixty times a
   *  second and rebuild the whole three.js model for each of them. It costs no
   *  correctness: history coalesces by label either way. */
  applied: OpeningBox | null;
}

export function OpeningHandles({
  spec,
  volumeId,
  openingId,
  onEdit,
  onStatus,
  enabled = true,
}: {
  spec: HomeSpec;
  /** the volume the selected opening belongs to */
  volumeId: string | null;
  /** null draws nothing at all — an unselected home has no grips on it */
  openingId: string | null;
  onEdit: (next: HomeSpec, label: string) => void;
  onStatus?: (status: OpeningStatus | null) => void;
  enabled?: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  /* OrbitControls is mounted `makeDefault`, so it publishes itself here. It has
     to be switched off for the length of a drag or every grip doubles as a
     camera orbit and the window flies away while you widen it. */
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  const volume = volumeId ? spec.volumes.find((v) => v.id === volumeId) ?? null : null;
  const opening = volume && openingId ? volume.openings.find((o) => o.id === openingId) ?? null : null;

  const handles = useMemo(
    () => (volume && opening ? openingHandles(spec, volume.id, opening.id) : []),
    [spec, volume, opening],
  );

  /* The wall's yaw, so a grip's bar lies along the wall it belongs to at any
     bearing. Three.js rotates local +x to (cos θ, −sin θ) about Y, so
     θ = atan2(−run.z, run.x) puts local +x on the run and — because the volume
     transform is a proper rotation — local +z on the outward normal. */
  const yaw = useMemo(() => {
    if (!volume || !opening) return 0;
    const { run } = wallFrameWorld(volume, opening.wall, wallThicknessFt(spec.material));
    return Math.atan2(-run.z, run.x);
  }, [spec.material, volume, opening]);

  const drag = useRef<DragState | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const [hovered, setHovered] = useState<OpeningHandleKind | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  /* Read through a ref for the same reason SurfacePicker does: `onEdit` and
     `onStatus` routinely arrive as inline arrows, and a window listener that
     detaches on every re-render would drop a gesture mid-drag. */
  const live = useRef({ onEdit, onStatus, spec });
  live.current = { onEdit, onStatus, spec };

  /* A per-gesture counter so two identical drags in a row cannot coalesce into
     one undo step. UI-only, never persisted, so nothing about the geometry or
     the export depends on it. */
  const gesture = useRef(0);

  const setCursor = useCallback(
    (value: string) => {
      gl.domElement.style.cursor = value;
    },
    [gl],
  );

  /* The selection changed under us — drop any status the last gesture left on
     screen rather than leaving a stale dimension beside a different window. */
  useEffect(() => {
    onStatus?.(null);
  }, [onStatus, openingId, volumeId]);

  /* Never leave the page holding a grabbing cursor or a disabled camera. */
  useEffect(
    () => () => {
      if (controls) controls.enabled = true;
      gl.domElement.style.cursor = "";
    },
    [controls, gl],
  );

  const solve = useCallback(
    (clientX: number, clientY: number): void => {
      const state = drag.current;
      if (!state) return;
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      /* Edge-on to the wall the intersection runs away to infinity, so the
         frame is skipped rather than producing a wild number. Nothing is
         committed and the opening simply does not move until the camera is off
         the grazing angle — which is what a person orbiting to look along a
         wall expects anyway. */
      if (Math.abs(raycaster.ray.direction.dot(state.plane.normal)) < 0.08) return;
      if (!raycaster.ray.intersectPlane(state.plane, hit)) return;

      const o = state.opening0;
      const along = hit.clone().sub(state.origin).dot(state.run);
      let want: Partial<OpeningBox>;
      switch (state.kind) {
        case "slide":
          want = { offsetFt: snapDrag(o.offsetFt + (along - state.grabT)) };
          break;
        case "edge-0":
          want = openingBoxFromEdgeDrag(o, 0, snapDrag(along));
          break;
        case "edge-1":
          want = openingBoxFromEdgeDrag(o, 1, snapDrag(along));
          break;
        case "sill":
          want = openingBoxFromHeightDrag(o, "sill", snapDrag(hit.y));
          break;
        default:
          want = openingBoxFromHeightDrag(o, "head", snapDrag(hit.y));
          break;
      }

      const result = applyOpeningEdit(state.spec0, state.volumeId, o.id, want);
      const v = state.spec0.volumes.find((x) => x.id === state.volumeId);
      live.current.onStatus?.({
        readout: v
          ? openingReadout(result.box, openingRunFt(state.spec0, v, o.wall), fmtFt)
          : "",
        refusals: result.refusals,
        source: "3d",
      });
      const settled = state.applied;
      const same =
        settled !== null &&
        settled.offsetFt === result.box.offsetFt &&
        settled.widthFt === result.box.widthFt &&
        settled.sillFt === result.box.sillFt &&
        settled.heightFt === result.box.heightFt;
      if (!same) {
        state.applied = result.box;
        live.current.onEdit(result.spec, state.label);
      }
      invalidate();
    },
    [camera, gl, hit, invalidate, ndc, raycaster],
  );

  const end = useCallback(
    (cancelled: boolean) => {
      const state = drag.current;
      drag.current = null;
      setGrabbing(false);
      if (controls) controls.enabled = true;
      setCursor("");
      if (!state) return;
      if (cancelled) {
        /* Under the SAME label, so the whole gesture including its undoing is
           one history entry rather than two. */
        live.current.onEdit(state.spec0, state.label);
        live.current.onStatus?.({
          readout: "Cancelled — the opening is back where it started.",
          refusals: [],
          source: "3d",
        });
      }
      invalidate();
    },
    [controls, invalidate, setCursor],
  );

  useEffect(() => {
    if (!drag.current && !grabbing) return;
    const onMove = (e: PointerEvent) => solve(e.clientX, e.clientY);
    const onUp = () => end(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        end(true);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [end, grabbing, solve]);

  const begin = useCallback(
    (e: ThreeEvent<PointerEvent>, handle: OpeningHandle) => {
      if (!enabled || !volume || !opening) return;
      // Without this the same press also reaches the volume behind the grip and
      // selection flickers between the window and the wall it sits in.
      e.stopPropagation();

      const th = wallThicknessFt(spec.material);
      const frame = wallFrameWorld(volume, opening.wall, th);
      const zero = toWorld(volume, pointOnWallLocal(volume, opening.wall, th, 0));
      const origin = new THREE.Vector3(
        zero.x + frame.out.x * OPENING_HANDLE_STANDOFF_FT,
        0,
        zero.z + frame.out.z * OPENING_HANDLE_STANDOFF_FT,
      );
      const run = new THREE.Vector3(frame.run.x, 0, frame.run.z);
      const normal = new THREE.Vector3(frame.out.x, 0, frame.out.z);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);

      /* Where the cursor grabbed, so a slide moves the opening BY the pointer
         delta rather than teleporting its centre under the cursor. */
      const grabbed = new THREE.Vector3(e.point.x, e.point.y, e.point.z).sub(origin).dot(run);

      gesture.current += 1;
      drag.current = {
        kind: handle.kind,
        spec0: spec,
        opening0: opening,
        volumeId: volume.id,
        grabT: grabbed,
        label: openingGestureLabel("3d", opening.id, gesture.current),
        plane,
        origin,
        run,
        applied: openingBox(opening),
      };
      if (controls) controls.enabled = false;
      setCursor(handle.kind === "slide" ? "grabbing" : handle.cursor);
      setGrabbing(true);
    },
    [controls, enabled, opening, setCursor, spec, volume],
  );

  if (!enabled || !volume || !opening || handles.length === 0) return null;

  return (
    /* EXPORT_IGNORE on the group, not on each mesh: `prepareForExport` walks
       the tree and removes the whole subtree, so one flag covers everything
       added here now and later. */
    <group name="aura-opening-handles" userData={{ [EXPORT_IGNORE]: true }}>
      {handles.map((h) => {
        const lit = hovered === h.kind || drag.current?.kind === h.kind;
        const long =
          h.kind === "sill" || h.kind === "head"
            ? Math.max(1, opening.widthFt * 0.7)
            : Math.max(1, opening.heightFt * 0.7);
        return (
          <group key={h.kind} position={[h.position[0], h.position[1], h.position[2]]} rotation={[0, yaw, 0]}>
            {/* The grip a person sees. A BAR rather than a dot for the four
                that resize, because a bar says which way it moves; the slide
                grip is a puck because it moves both ways along the wall. */}
            {h.kind === "slide" ? (
              <mesh castShadow={false} receiveShadow={false}>
                <sphereGeometry args={[h.sizeFt / 2, 16, 12]} />
                <meshStandardMaterial
                  color={PICK_HIGHLIGHT_COLOR}
                  roughness={0.35}
                  metalness={0.1}
                  emissive={PICK_HIGHLIGHT_COLOR}
                  emissiveIntensity={lit ? 0.9 : 0.45}
                  toneMapped={false}
                />
              </mesh>
            ) : (
              <mesh castShadow={false} receiveShadow={false}>
                <boxGeometry
                  args={
                    h.kind === "sill" || h.kind === "head"
                      ? [long, BAR_THICKNESS_FT, BAR_THICKNESS_FT]
                      : [BAR_THICKNESS_FT, long, BAR_THICKNESS_FT]
                  }
                />
                <meshStandardMaterial
                  color={PICK_HIGHLIGHT_COLOR}
                  roughness={0.35}
                  metalness={0.1}
                  emissive={PICK_HIGHLIGHT_COLOR}
                  emissiveIntensity={lit ? 0.9 : 0.45}
                  toneMapped={false}
                />
              </mesh>
            )}

            {/* The grip a person HITS. Deliberately larger than the one they
                see and fully transparent: a target you can only hit by landing
                on a 2-inch bar is the "it works if you know" failure this node
                exists to end. Transparent rather than `visible={false}`,
                because an invisible object is skipped by the event raycaster
                and would take the affordance away again. */}
            <mesh
              onPointerDown={(e) => begin(e, h)}
              /* R3F synthesises a click from a down/up pair, and the volume
                 behind the grip listens for clicks to select itself. Stopping
                 the down alone would leave the up to select the wall the window
                 is in the moment somebody taps a grip without moving. */
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!drag.current) {
                  setHovered(h.kind);
                  setCursor(h.cursor);
                }
              }}
              onPointerOut={() => {
                if (!drag.current) {
                  setHovered((current) => (current === h.kind ? null : current));
                  setCursor("");
                }
              }}
            >
              <sphereGeometry args={[Math.max(h.sizeFt, 1.1), 12, 10]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ===========================================================================
   THE PANEL — the same five dimensions, typed.
   =========================================================================== */

const FIELDS: ReadonlyArray<{
  key: keyof OpeningBox;
  label: string;
  step: number;
  hint: string;
}> = [
  { key: "widthFt", label: "Width", step: 0.25, hint: "Along the wall." },
  { key: "heightFt", label: "Height", step: 0.25, hint: "Sill to head." },
  {
    key: "offsetFt",
    label: "Position along the wall",
    step: OPENING_DRAG_SNAP_FT,
    hint: "From the wall's left end, looking at it from outside.",
  },
  {
    key: "sillFt",
    label: "Sill height",
    step: OPENING_DRAG_SNAP_FT,
    hint: "Above the finished floor. Zero for a door or a glazing wall.",
  },
];

/** feet as a decimal a person can type, without a trailing `.000`. */
const asField = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The numeric half.
 *
 * Every field calls `applyOpeningEdit` with ONE key of the box, which is
 * precisely what a 3D grip does — so "type 8.25" and "drag it to 8.25" are the
 * same call with the same argument, and there is no second place for a clamp to
 * live and drift.
 *
 * Controlled with a local string so a half-typed "1" does not become a 1 ft
 * window on the way to 16; the edit is committed on blur and on Enter, which is
 * the same "one gesture, one undo step" rule a drag keeps.
 */
export function OpeningNumbers({
  spec,
  volumeId,
  openingId,
  onEdit,
  status = null,
  onStatus,
}: {
  spec: HomeSpec;
  volumeId: string | null;
  openingId: string | null;
  onEdit: (next: HomeSpec, label: string) => void;
  /** what the 3D layer last said, so both halves show one answer */
  status?: OpeningStatus | null;
  onStatus?: (status: OpeningStatus | null) => void;
}) {
  const volume: Volume | null = volumeId
    ? spec.volumes.find((v) => v.id === volumeId) ?? null
    : null;
  const opening = volume && openingId ? volume.openings.find((o) => o.id === openingId) ?? null : null;

  const [draft, setDraft] = useState<Partial<Record<keyof OpeningBox, string>>>({});
  useEffect(() => setDraft({}), [openingId, volumeId]);

  if (!volume || !opening) {
    return (
      <Panel
        label="Window and door"
        hint="Click a window or a door — in the model or in the floor plan — and its size and position appear here as numbers you can type. The same five grips are on it in 3D."
      >
        <p className="text-sm leading-relaxed text-aura-text/60">
          Nothing is selected. In the 3D view, click a window; in the floor plan, click one and its
          grips appear on it.
        </p>
      </Panel>
    );
  }

  const box = openingBox(opening);
  const run = openingRunFt(spec, volume, opening.wall);
  const head = wallHeadFt(volume);

  /* ONE key at a time, because that is exactly the shape a 3D grip produces —
     `{ offsetFt }` from the slide grip, `{ offsetFt, widthFt }` from an edge.
     Written out rather than spread from a computed key so the value is typed as
     a number rather than as `string | number`. */
  const askOne = (key: keyof OpeningBox, value: number) => {
    const want: Partial<OpeningBox> = {};
    want[key] = qFt(value);
    const result = applyOpeningEdit(spec, volume.id, opening.id, want);
    onStatus?.({
      readout: openingReadout(result.box, run, fmtFt),
      refusals: result.refusals,
      source: "field",
    });
    if (result.changed) onEdit(result.spec, openingFieldLabel(opening.id, key));
  };

  const commit = (key: keyof OpeningBox, raw: string) => {
    const value = Number(raw);
    setDraft((d) => ({ ...d, [key]: undefined }));
    if (raw.trim() === "" || !Number.isFinite(value)) return;
    askOne(key, value);
  };

  const nudge = (key: keyof OpeningBox, by: number) => askOne(key, box[key] + by);

  const limitOf = (key: keyof OpeningBox): { min: number; max: number } => {
    if (key === "widthFt") return { min: LIMITS.openingWidthFt.min, max: Math.min(LIMITS.openingWidthFt.max, run) };
    if (key === "heightFt") return { min: LIMITS.openingHeightFt.min, max: Math.min(LIMITS.openingHeightFt.max, head) };
    if (key === "offsetFt") return { min: 0, max: Math.max(0, run - box.widthFt) };
    return { min: 0, max: Math.max(0, head - box.heightFt) };
  };

  const refusals = status?.refusals ?? [];

  return (
    <Panel
      label={`${KIND_LABELS[opening.kind]} — ${WALL_LABELS[opening.wall].toLowerCase()} wall`}
      hint={
        <>
          Five grips on this opening in the 3D view, three of them in the floor plan, and the same
          five numbers here. All of them go through one function, so a drag and a typed value leave
          the project byte-identical.
        </>
      }
    >
      <div className="opening-numbers">
        <p className="opening-numbers__readout" aria-live="polite">
          {status?.readout ?? openingReadout(box, run, fmtFt)}
        </p>

        <div className="opening-numbers__grid">
          {FIELDS.map((field) => {
            const limit = limitOf(field.key);
            const shown = draft[field.key] ?? asField(box[field.key]);
            return (
              <label key={field.key} className="opening-numbers__field">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="aura-label">{field.label}</span>
                  <span className="font-mono text-xs tabular-nums text-aura-text/80">
                    {fmtFt(box[field.key])}
                  </span>
                </span>
                <span className="opening-numbers__row">
                  <Button onClick={() => nudge(field.key, -field.step)} title={`Down ${field.step} ft`}>
                    −
                  </Button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min={limit.min}
                    max={limit.max}
                    value={shown}
                    aria-label={`${field.label}, feet`}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                    onBlur={(e) => commit(field.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commit(field.key, (e.target as HTMLInputElement).value);
                      }
                    }}
                    className="opening-numbers__input"
                  />
                  <Button onClick={() => nudge(field.key, field.step)} title={`Up ${field.step} ft`}>
                    +
                  </Button>
                </span>
                <span className="opening-numbers__hint">
                  {field.hint} {field.key === "widthFt" || field.key === "offsetFt"
                    ? `This wall is ${fmtFt(run)} long.`
                    : `This wall is ${fmtFt(head)} to the head.`}
                </span>
              </label>
            );
          })}
        </div>

        {refusals.length > 0 ? (
          <ul className="opening-numbers__refusals" aria-live="polite">
            {refusals.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        <p className="opening-numbers__note">
          An opening may not hang off its wall and two may not be cut into the same piece of it —
          the same two rules every plan in the library is checked against. When a drag or a number
          would break one, it stops there and says so above rather than letting the model become
          something that could not be built.
        </p>
      </div>
    </Panel>
  );
}

"use client";

/* ===========================================================================
   WALK01 — WALK THROUGH THE HOME AND PRESENT IT.

   Chaos sells this verb as Envision. We already own every part of it: a live
   R3F scene, an orbit camera, drei's controls and a summary that says exactly
   where every wall is. So this node adds NO DEPENDENCY and NO GEOMETRY. It
   adds a list of places to stand.

   THE ONE THING IT MUST NOT BE
   ---------------------------
   A camera mode is a WAY OF LOOKING, not a document edit. Nothing in this file
   imports a mutator, dispatches an action, or touches `spec`. The canvas does
   not remount, `data-load-epoch` does not move, and `hashBuilderDocument` is
   the same string before and after the whole walk — asserted, not asserted-in-
   a-comment, in `tests/walkthrough.spec.ts`.

   WHY IT IS TWO EXPORTS AND A CHANNEL
   -----------------------------------
   `BuilderApp.tsx` is off limits to every agent in this wave, so this had to
   mount on props it is GIVEN. The camera lives inside the `<Canvas>` and the
   controls live inside it too, so moving the camera means being inside it —
   which is what `houseChildren` is for (it is how `FixtureLayer` already gets
   there). But the CONTROLS a person presses are HTML, outside the canvas.

   Two React trees, one camera. Rather than ask BuilderApp to hold a piece of
   state for us — a second thing to wire and a second thing to get wrong —
   `walkChannel` is a two-line external store that the panel writes a POSE into
   and the rig reads a POSE out of. The mount is therefore two elements and no
   new state:

       houseChildren: <WalkthroughCameraRig />
       under the model: <WalkthroughPanel summary={home.summary} />

   The cost of a module-level singleton is honest and written down: it assumes
   ONE builder canvas per page, which is what the builder is. `SurfacePicker.tsx`
   already established the shape — one file, an R3F layer and a DOM panel.

   THE RIG RENDERS NOTHING. `houseChildren` mounts inside the EXPORT ROOT, so
   anything it drew would end up in the .glb. It returns `null`, and the spec
   checks the source for a JSX tag rather than trusting this sentence.

   REDUCED MOTION IS NOT A LESSER MODE
   -----------------------------------
   The rule this node exists to keep: somebody who cannot use a moving camera
   must still be able to see the home. So the reduced-motion path is not "the
   walkthrough, off" — it is the SAME set of viewpoints reached in ONE step
   each. Every control below is in the DOM under both preferences; CSS hides
   only PLAY, which is the one control whose whole purpose is motion.

   That decision is deliberate and it is what makes the guarantee measurable:
   the panel's markup is identical either way, so a browser can be asked, under
   each preference, which controls have a box — and the answer for the stepped
   path is "all of them" in both. A JS branch that rendered two different trees
   would have moved that question somewhere no test could reach it.

   THE GAZE IS CLAMPED BY A FILE THIS NODE CANNOT EDIT
   --------------------------------------------------
   `Viewport.tsx` mounts OrbitControls with `minDistance={12}` and
   `maxPolarAngle={Math.PI / 2 - 0.035}`. Those are not decoration: OrbitControls
   ENFORCES them on the next `update()`. A viewpoint that looked level, or that
   put its look point six feet ahead, would be silently dragged somewhere else
   and the label would then be a lie. Viewport is not in this node's write-set,
   so the two numbers are MIRRORED below and `tests/walkthrough.spec.ts` parses
   the real ones out of `Viewport.tsx` and asserts the mirror still matches.
   =========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Camera, Vector3 } from "three";

import { GRADE_Y_FT, type Pt2, type SiteSummary } from "@/lib/builder/geometry";
import { formatFeetInchesWords } from "@/lib/units";

/* ============================================================ the assumption */

/** Where the eye is, and the only place this number is written.
 *  Stated rather than magic: it is printed in the panel, in feet and inches,
 *  through the same constant the camera stands on. */
export const EYE_HEIGHT_FT = 5.5;

/** The datum every volume's floor sits on. `geometry.ts` places each volume's
 *  local origin at "footprint centre, finished floor", and GRADE_Y_FT is below
 *  it by the slab plus the pile exposure — the spec asserts that relationship
 *  against geometry.ts's own constants rather than trusting this comment. */
export const FINISHED_FLOOR_Y_FT = 0;

export const EYE_HEIGHT_NOTE =
  `Eye height is a stated assumption, not a measurement of you: every viewpoint stands ` +
  `${formatFeetInchesWords(EYE_HEIGHT_FT)} above the floor beneath it — above the finished floor ` +
  `inside, above grade outside.`;

/* ------------------------------------------- what OrbitControls will enforce */

/** MIRROR of `Viewport.tsx`'s `maxPolarAngle`. Asserted equal in the spec. */
export const ORBIT_MAX_POLAR_RAD = Math.PI / 2 - 0.035;
/** MIRROR of `Viewport.tsx`'s `minDistance`. Asserted equal in the spec. */
export const ORBIT_MIN_DISTANCE_FT = 12;

/** How far below level the gaze tips. Twice the margin the polar clamp leaves,
 *  so every viewpoint clears it rather than sitting on it — a look point ABOVE
 *  the eye is impossible under that clamp, and one exactly level is on the
 *  boundary, where a rounding error becomes a camera that moved itself. */
export const GAZE_BELOW_LEVEL_RAD = 2 * (Math.PI / 2 - ORBIT_MAX_POLAR_RAD);
const GAZE_DROP_PER_FT = Math.tan(GAZE_BELOW_LEVEL_RAD);

/** The look point is never nearer than this. OrbitControls pushes the camera
 *  back until it is `minDistance` from the target, so a nearer look point would
 *  move the person out of the room they are standing in. */
export const LOOK_AHEAD_MIN_FT = ORBIT_MIN_DISTANCE_FT * 1.5;

/** MIRROR of `Viewport.tsx`'s camera `fov`. Asserted equal in the spec. */
export const VIEWPORT_FOV_DEG = 38;
/** MIRROR of the builder stage's NARROWEST aspect — `aspect-[16/10]`, which is
 *  what a phone gets; `lg:aspect-[16/9]` is wider and therefore easier. Sizing
 *  the exterior stand-off against the narrow one means the wide one also fits. */
export const VIEWPORT_MIN_ASPECT = 16 / 10;
/** Air left around the home in an exterior frame. */
export const APPROACH_MARGIN_FT = 5;

/**
 * How far back an exterior viewpoint has to stand for the WHOLE home to be in
 * frame — derived, not chosen.
 *
 * This is the number a magic constant would have hidden. A 38° lens at a
 * 5 ft 6 in eye, tipped 4° down, puts the top of the frame at
 * `tan(halfFov − gaze)` per foot of distance: a 21-foot ridge therefore needs
 * about 88 feet of lawn, and no smaller number gets it, whatever it looks like
 * in one screenshot of one home. The spec checks the claim the way a claim
 * about a camera should be checked — by building a real THREE.PerspectiveCamera
 * at Viewport's own field of view and asking its frustum, for every plan in the
 * catalogue.
 */
export function approachStandOffFt(summary: SiteSummary): number {
  const roof = summary.boundsWithRoof;
  const halfV = (VIEWPORT_FOV_DEG * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * VIEWPORT_MIN_ASPECT);
  const eyeY = GRADE_Y_FT + EYE_HEIGHT_FT;
  const rise = summary.maxRidgeHeightFt + APPROACH_MARGIN_FT - eyeY;
  const reach = roof.widthFt / 2 + APPROACH_MARGIN_FT;
  return Math.max(
    LOOK_AHEAD_MIN_FT,
    rise / Math.tan(halfV - GAZE_BELOW_LEVEL_RAD),
    reach / Math.tan(halfH),
  );
}

/* ================================================================ the poses */

export interface WalkPose {
  /** where the camera stands, in site feet */
  readonly eye: readonly [number, number, number];
  /** what it is pointed at — OrbitControls' target, so orbiting from a
   *  viewpoint pivots around what you were looking at */
  readonly look: readonly [number, number, number];
}

export interface WalkViewpoint {
  readonly id: string;
  readonly label: string;
  readonly where: "outside" | "inside";
  readonly pose: WalkPose;
  /** the sentence that says where these numbers came from */
  readonly basis: string;
}

export interface WalkViewpoints {
  readonly stops: readonly WalkViewpoint[];
  /** true when two volumes share a footprint and only one viewpoint was made
   *  for them — see WALK_UPPER_STOREY_NOTE */
  readonly sharedFootprints: boolean;
}

const centroidOf = (plan: readonly Pt2[]): Pt2 => {
  let x = 0;
  let z = 0;
  for (const p of plan) {
    x += p[0];
    z += p[1];
  }
  return [x / plan.length, z / plan.length];
};

interface Edge {
  dx: number;
  dz: number;
  len: number;
}

const edgeOf = (a: Pt2, b: Pt2): Edge => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  return len > 1e-9 ? { dx: dx / len, dz: dz / len, len } : { dx: 1, dz: 0, len: 0 };
};

/** A pose from a standing point and a horizontal direction. The look point is
 *  `aheadFt` along that direction and `GAZE_DROP_PER_FT` per foot below the
 *  eye, which is what keeps the polar angle inside Viewport's clamp for every
 *  distance rather than for the one that was tried. */
export function poseLookingAlong(
  eye: readonly [number, number, number],
  dx: number,
  dz: number,
  aheadFt: number,
): WalkPose {
  const ahead = Math.max(LOOK_AHEAD_MIN_FT, aheadFt);
  return {
    eye,
    look: [eye[0] + dx * ahead, eye[1] - GAZE_DROP_PER_FT * ahead, eye[2] + dz * ahead],
  };
}

/**
 * The places to stand, derived from the summary the viewer is already drawing.
 *
 * Order is the walk: up to the home from the south, through each footprint,
 * then round to the north side. North is −Z in the site frame (geometry.ts),
 * so +Z is the sunny side you would arrive on.
 */
export function walkViewpoints(summary: SiteSummary): WalkViewpoints {
  /* The roof bounds, not the wall bounds: an eave that left the frame would be
     the one part of the home a person actually notices missing. */
  const b = summary.boundsWithRoof;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const gradeEyeY = GRADE_Y_FT + EYE_HEIGHT_FT;
  const standOff = approachStandOffFt(summary);

  const stops: WalkViewpoint[] = [];

  /* ---- the approach, from the south */
  stops.push({
    id: "approach",
    label: "The approach, from the south",
    where: "outside",
    pose: poseLookingAlong([cx, gradeEyeY, b.maxZ + standOff], 0, -1, standOff + (b.maxZ - cz)),
    basis:
      `On grade, ${formatFeetInchesWords(standOff)} south of the roof line. That distance is ` +
      `derived rather than chosen: it is what a ${VIEWPORT_FOV_DEG}° lens at ` +
      `${formatFeetInchesWords(EYE_HEIGHT_FT)} needs for a ` +
      `${formatFeetInchesWords(summary.maxRidgeHeightFt)} ridge to clear the top of the frame ` +
      `with ${formatFeetInchesWords(APPROACH_MARGIN_FT)} of air.`,
  });

  /* ---- one per footprint, on the ground floor */
  const seen = new Set<string>();
  let sharedFootprints = false;
  for (const volume of summary.volumes) {
    if (volume.plan.length < 3) continue;
    const [vx, vz] = centroidOf(volume.plan);
    const key = `${vx.toFixed(2)}|${vz.toFixed(2)}`;
    if (seen.has(key)) {
      sharedFootprints = true;
      continue;
    }
    seen.add(key);

    /* The longer of the two plan edges: you look down the length of a room,
       not across it. `volumeCornersPlan` emits the width edge first and `ccw`
       can only reverse the ring, so edge 0→1 and 1→2 are the two axes. */
    const a = edgeOf(volume.plan[0], volume.plan[1]);
    const c = edgeOf(volume.plan[1], volume.plan[2]);
    const long = a.len >= c.len ? a : c;

    /* Which way along it: toward the middle of the site, so a second wing
       reads as part of the same home rather than as scenery behind you. On a
       single volume the two are equal and the tie breaks toward +axis. */
    const toCentre = (vx - cx) * long.dx + (vz - cz) * long.dz;
    const sign = toCentre > 1e-9 ? -1 : 1;
    const ahead = long.len / 2 + 6;

    stops.push({
      id: `inside:${volume.id}`,
      label: `Inside ${volume.name}`,
      where: "inside",
      pose: poseLookingAlong(
        [vx, FINISHED_FLOOR_Y_FT + EYE_HEIGHT_FT, vz],
        long.dx * sign,
        long.dz * sign,
        ahead,
      ),
      basis:
        `The centre of ${volume.name}'s footprint, on the ground floor, looking along its ` +
        `${formatFeetInchesWords(long.len)} axis. The floor level is the summary's own datum — ` +
        `a storey above this one is not a place this camera can be told to stand.`,
    });
  }

  /* ---- and round the back, at the same derived stand-off */
  stops.push({
    id: "north",
    label: "The north side",
    where: "outside",
    pose: poseLookingAlong([cx, gradeEyeY, b.minZ - standOff], 0, 1, standOff + (cz - b.minZ)),
    basis:
      `On grade, ${formatFeetInchesWords(standOff)} north of the roof line, looking back — the ` +
      `same derived stand-off as the approach, so both elevations are framed the same way. ` +
      `North is the cold side in zone 7A, and it is the one worth looking at before the glass ` +
      `is decided.`,
  });

  return { stops, sharedFootprints };
}

export const WALK_UPPER_STOREY_NOTE =
  "Two volumes here share one footprint, so they share one viewpoint. This camera places itself " +
  "from the plan summary, which carries a floor area and a ridge height but no floor level for an " +
  "upper storey — so rather than guess a height and label it a room, it stands on the ground floor " +
  "and says so.";

/* ============================================================== the movement */

/** The camera's travel time, and it is the interface's own: `--motion-travel`
 *  in globals.css. The spec asserts the two are the same number. */
export const WALK_TRAVEL_MS = 250;
/** 250 ms at 60 fps. Asserted against WALK_TRAVEL_MS rather than eyeballed. */
export const WALK_GLIDE_FRAMES = 15;
/** How long a viewpoint is held while presenting. */
export const WALK_HOLD_MS = 4000;

/** ONE step for reduced motion, and the step lands in exactly the same place
 *  the glide would have. That is the whole guarantee: a stepped path is not a
 *  shorter walk, it is the same walk without the travel. */
export function walkFrames(reducedMotion: boolean): number {
  return reducedMotion ? 1 : WALK_GLIDE_FRAMES;
}

/** Autoplay is the one thing reduced motion really does remove: a camera that
 *  moves on its own, without being asked, every four seconds. */
export function walkAutoplayAllowed(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const lerp3 = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

/** Where the camera is on `step` of `frames`. The last step returns the
 *  destination OBJECT, not a lerp at t=1 — so a glided arrival and a stepped
 *  arrival are identical to the last bit rather than to six decimal places. */
export function walkPoseAt(from: WalkPose, to: WalkPose, frames: number, step: number): WalkPose {
  if (frames <= 1 || step >= frames) return to;
  const t = smoothstep(Math.max(0, step) / frames);
  return { eye: lerp3(from.eye, to.eye, t), look: lerp3(from.look, to.look, t) };
}

/* ================================================================ the keys */

export type WalkKeyAction = "next" | "previous" | "first" | "last";

/** The keyboard grammar, and the ONLY place it is written. The hint the panel
 *  prints is generated from this map, so a key that works and a key that is
 *  advertised cannot drift apart. */
export const WALK_KEYS: Readonly<Record<string, WalkKeyAction>> = {
  ArrowRight: "next",
  ArrowDown: "next",
  PageDown: "next",
  ArrowLeft: "previous",
  ArrowUp: "previous",
  PageUp: "previous",
  Home: "first",
  End: "last",
};

const keysFor = (action: WalkKeyAction): string[] =>
  Object.keys(WALK_KEYS).filter((key) => WALK_KEYS[key] === action);

export const WALK_KEY_NOTE =
  `From the keyboard: ${keysFor("previous").join(", ")} step back, ` +
  `${keysFor("next").join(", ")} step forward, ` +
  `${keysFor("first").join(", ")} and ${keysFor("last").join(", ")} jump to the ends. ` +
  `Every viewpoint is also a button in its own right.`;

/** Clamped, never wrapped: at the end of a walk you should be able to tell that
 *  you are at the end. Autoplay wraps on purpose and says so, below. */
export function walkIndex(current: number, action: WalkKeyAction, count: number): number {
  if (count <= 0) return 0;
  const last = count - 1;
  const at = Math.min(Math.max(current, 0), last);
  if (action === "first") return 0;
  if (action === "last") return last;
  if (action === "next") return Math.min(last, at + 1);
  return Math.max(0, at - 1);
}

export function walkAutoplayNext(current: number, count: number): number {
  return count <= 0 ? 0 : (current + 1) % count;
}

/* ============================================================== the channel */

export interface WalkRequest {
  readonly seq: number;
  readonly pose: WalkPose;
  readonly frames: number;
}

export interface WalkArrival {
  readonly seq: number;
  readonly eye: readonly [number, number, number];
  /** how many times the rig has written the camera since the page loaded — one
   *  per stepped move, `WALK_GLIDE_FRAMES` per glided one */
  readonly writes: number;
}

/** The two-line store the panel and the rig share. Deliberately not React
 *  state: the panel is HTML and the rig is inside the canvas, and the only
 *  thing they need to agree on is a pose. */
class WalkChannel {
  private listeners = new Set<() => void>();
  private current: WalkRequest | null = null;
  private landed: WalkArrival | null = null;
  private seq = 0;
  private writes = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  request = (): WalkRequest | null => this.current;
  arrival = (): WalkArrival | null => this.landed;
  /** SSR has no camera and no preference to read; both sides render "not yet". */
  none = (): null => null;

  go = (pose: WalkPose, frames: number): void => {
    this.seq += 1;
    this.current = { seq: this.seq, pose, frames };
    this.emit();
  };

  wrote = (): void => {
    this.writes += 1;
  };

  arrive = (eye: readonly [number, number, number]): void => {
    this.landed = { seq: this.current?.seq ?? 0, eye, writes: this.writes };
    this.emit();
  };

  private emit(): void {
    /* forEach rather than for..of: the repo's tsconfig targets a level where
       iterating a Set needs --downlevelIteration, and a store is not worth a
       compiler flag. */
    this.listeners.forEach((listener) => listener());
  }
}

export const walkChannel = new WalkChannel();

/* ================================================================== the rig */

/** What this file needs from drei's OrbitControls, and nothing more. */
export interface OrbitLike {
  target: Vector3;
  update: () => void;
}

export function asOrbitControls(value: unknown): OrbitLike | null {
  const candidate = value as Partial<OrbitLike> | null | undefined;
  if (!candidate || typeof candidate.update !== "function") return null;
  const target = candidate.target as Vector3 | undefined;
  return target && typeof target.set === "function" ? (candidate as OrbitLike) : null;
}

/** Put the camera at a pose. The ONE place the camera is written, so a stepped
 *  move, a glided frame and an autoplay advance are the same three lines. */
export function applyWalkPose(camera: Camera, controls: OrbitLike | null, pose: WalkPose): void {
  camera.position.set(pose.eye[0], pose.eye[1], pose.eye[2]);
  if (controls) {
    controls.target.set(pose.look[0], pose.look[1], pose.look[2]);
    controls.update();
  } else {
    camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
  }
}

/** Where the camera is right now, as a pose to glide FROM. */
export function currentWalkPose(camera: Camera, controls: OrbitLike | null): WalkPose {
  const eye: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
  if (controls) {
    return { eye, look: [controls.target.x, controls.target.y, controls.target.z] };
  }
  return { eye, look: [eye[0], eye[1], eye[2] - LOOK_AHEAD_MIN_FT] };
}

/**
 * The camera half, mounted inside the canvas through `houseChildren`.
 *
 * RENDERS NOTHING. `houseChildren` lands inside the export root, and a .glb of
 * an Aura home does not contain a tour rig.
 */
export function WalkthroughCameraRig() {
  const camera = useThree((state) => state.camera);
  const rawControls = useThree((state) => state.controls);
  const invalidate = useThree((state) => state.invalidate);
  const request = useSyncExternalStore(
    walkChannel.subscribe,
    walkChannel.request,
    walkChannel.none,
  );

  const controls = asOrbitControls(rawControls);
  const run = useRef<{ from: WalkPose; to: WalkPose; frames: number; step: number } | null>(null);
  /* Seeded from what has LANDED, not from what is pending.

     The original seeded from the pending request, so a rig that mounts late
     dropped it — and the viewport is lazily loaded, so "late" is the ordinary
     case: press Next while the 3D view is still arriving and the panel moved
     its index, said nothing, and the camera never went anywhere. A control
     that quietly does nothing is the one failure this panel is least allowed.

     Seeding from the arrival keeps the behaviour that seeding was FOR — a rig
     remounting after a completed walk still will not replay that walk at you,
     because the move it would replay is one that already landed — while a
     request nobody has honoured yet is honoured on arrival. */
  const applied = useRef<number>(walkChannel.arrival()?.seq ?? 0);

  useEffect(() => {
    if (!request || request.seq === applied.current) return;
    applied.current = request.seq;
    run.current = {
      from: currentWalkPose(camera, controls),
      to: request.pose,
      frames: Math.max(1, request.frames),
      step: 0,
    };
    /* frameloop is "demand" — nothing draws unless something asks. */
    invalidate();
  }, [request, camera, controls, invalidate]);

  useFrame(() => {
    const active = run.current;
    if (!active) return;
    active.step += 1;
    const done = active.step >= active.frames;
    applyWalkPose(camera, controls, walkPoseAt(active.from, active.to, active.frames, active.step));
    walkChannel.wrote();
    if (done) {
      run.current = null;
      walkChannel.arrive([camera.position.x, camera.position.y, camera.position.z]);
    } else {
      invalidate();
    }
  });

  return null;
}

/* ================================================================ the panel */

export const WALK_STEPPED_NOTE =
  "Your system asks for reduced motion, so the camera does not glide: each control here moves it " +
  "to that viewpoint in one step. Nothing is missing from this path — every viewpoint below is " +
  "reachable, in either direction, without a camera that moves on its own.";

export const WALK_GLIDE_NOTE =
  `The camera glides between viewpoints over ${WALK_TRAVEL_MS} ms — the travel time the rest of ` +
  `the interface uses. Ask your system for reduced motion and it steps between the same ` +
  `viewpoints instead, losing none of them.`;

export const WALK_READ_ONLY_NOTE =
  "This is a way of looking, not an edit. Walking the home changes no dimension, no opening and " +
  "no finish — the design hash is the same string when you step out as when you stepped in, and " +
  "orbit, zoom and Frame the home all keep working from wherever you are standing.";

export default function WalkthroughPanel({ summary }: { summary: SiteSummary }) {
  const { stops, sharedFootprints } = useMemo(() => walkViewpoints(summary), [summary]);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  /* Read after mount so the markup is identical on the server and in the
     harness; the DIFFERENCE between the two preferences is CSS, below. */
  const [motion, setMotion] = useState<"stepped" | "glide" | null>(null);

  const arrival = useSyncExternalStore(
    walkChannel.subscribe,
    walkChannel.arrival,
    walkChannel.none,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setMotion(query.matches ? "stepped" : "glide");
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  /* The camera is never taken on mount. A person arrives at the builder with
     the framing the document chose; this panel moves the camera only when
     somebody asks it to. */
  const goTo = useCallback(
    (next: number) => {
      const stop = stops[next];
      if (!stop) return;
      setIndex(next);
      setStarted(true);
      walkChannel.go(stop.pose, walkFrames(prefersReducedMotion()));
    },
    [stops],
  );

  const step = useCallback(
    (action: WalkKeyAction) => goTo(walkIndex(index, action, stops.length)),
    [goTo, index, stops.length],
  );

  useEffect(() => {
    if (!playing) return;
    if (!walkAutoplayAllowed(prefersReducedMotion())) {
      setPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => {
        const next = walkAutoplayNext(current, stops.length);
        const stop = stops[next];
        if (stop) walkChannel.go(stop.pose, walkFrames(prefersReducedMotion()));
        return next;
      });
      setStarted(true);
    }, WALK_HOLD_MS);
    return () => window.clearInterval(timer);
  }, [playing, stops]);

  const current = stops[Math.min(index, stops.length - 1)];
  if (!current) return null;

  return (
    <section
      className="walk"
      aria-label="Walk through the home"
      data-walkthrough
      data-walk-count={stops.length}
      data-walk-index={index}
      data-walk-viewpoint={current.id}
      data-walk-started={started ? "yes" : "no"}
      data-walk-playing={playing ? "yes" : "no"}
      data-walk-motion={motion ?? "unknown"}
      data-walk-writes={arrival ? arrival.writes : 0}
      data-walk-camera={
        arrival ? arrival.eye.map((value) => value.toFixed(2)).join(" ") : "not moved"
      }
      onKeyDown={(event) => {
        const action = WALK_KEYS[event.key];
        if (!action) return;
        event.preventDefault();
        step(action);
      }}
    >
      <div className="walk-head">
        <p className="walk-label">Walk through it</p>
        <p className="walk-lede">
          {stops.length} places to stand in this home, in the order somebody would arrive at them.
          The camera you already have, moved to each one.
        </p>
      </div>

      <div className="walk-controls" role="group" aria-label="Step between viewpoints">
        <button
          type="button"
          className="walk-step"
          data-walk-action="previous"
          data-cursor="Select"
          onClick={() => step("previous")}
        >
          Back
        </button>
        <button
          type="button"
          className="walk-step"
          data-walk-action="next"
          data-cursor="Select"
          onClick={() => step("next")}
        >
          Next
        </button>
        <button
          type="button"
          className="walk-play"
          data-walk-action="play"
          data-cursor="Select"
          aria-pressed={playing}
          onClick={() => setPlaying((on) => !on)}
        >
          {playing ? "Stop presenting" : `Present · ${WALK_HOLD_MS / 1000} s each`}
        </button>
        <p className="walk-position" aria-live="polite">
          Viewpoint {index + 1} of {stops.length} · {current.label}
        </p>
      </div>

      <ul className="walk-stops" aria-label="Every viewpoint">
        {stops.map((stop, at) => (
          <li key={stop.id}>
            <button
              type="button"
              className="walk-stop"
              data-walk-viewpoint={stop.id}
              data-walk-where={stop.where}
              data-cursor="Select"
              aria-pressed={at === index}
              onClick={() => goTo(at)}
            >
              {stop.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="walk-basis">{current.basis}</p>
      <p className="walk-eye">{EYE_HEIGHT_NOTE}</p>
      <p className="walk-note walk-note-glide">{WALK_GLIDE_NOTE}</p>
      <p className="walk-note walk-note-stepped">{WALK_STEPPED_NOTE}</p>
      <p className="walk-keys">{WALK_KEY_NOTE}</p>
      {sharedFootprints ? <p className="walk-limit">{WALK_UPPER_STOREY_NOTE}</p> : null}
      <p className="walk-readonly">{WALK_READ_ONLY_NOTE}</p>
    </section>
  );
}

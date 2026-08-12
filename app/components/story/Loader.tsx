"use client";

import { useEffect, useRef, useState } from "react";
import type { OpeningSceneStage } from "@/lib/three/sceneQuality";

/* ---------------------------------------------------------------------
   THE SCENE LOADER — central, stage-honest, and visibly alive.

   Two founder complaints shaped this file. First: "make the loading widget
   more central and apparent" — so the card sits dead centre (.aura-loader in
   globals.css) and appears in the very first commit after Enter. Second:
   "the loading widget completely disappeared and it just sort of freezes
   and staggers" — the old handoff card unmounted the moment the CORE stage
   painted, exactly when the progressive pipeline (site → forest →
   atmosphere → meadow) began compiling shaders and cloning models. The jank
   arrived right as the feedback left. So the loader now lives until the
   LAST progressive stage has painted, and it names the stage it is in.

   WHY IT IS NOT INSIDE THE THREE.JS CHUNK. This component renders DOM only
   and imports nothing from three/drei (the stage import above is
   type-only). That placement is the feature: it paints before WebGL
   construction or shader compilation can occupy the main thread, and it
   keeps the landing's initial bundle free of a 3D dependency. The real
   signals are pushed IN from where they originate:

   · fetch {loaded,total} — drei's useProgress, observed inside StoryCanvas
     (which lives in the dynamic chunk with the rest of three) and reported
     up through Story. It only sees what goes through a THREE loader — the
     six GLBs — which is exactly why it cannot be the whole story.
   · painted — the per-stage first-frame signal StoryCanvas already emits to
     advance its own progressive pipeline (SceneFrameSignal via useFrame).
     A stage is "painted" only after R3F has completed a real frame of it.

   FIVE STAGES, ALL REAL:
     Film       Enter clicked; the gate film still covers while the three.js
                chunk arrives and the canvas mounts.
     Canvas     the canvas is live and the GLBs are fetching (real fraction).
     Core       fetch done; waiting for the first committed scene frame.
     Landscape  core painted and on screen; site, forest and atmosphere
                layers are building behind it.
     Meadow     atmosphere painted; the meadow instances are growing.
   "Ready" follows the meadow's first painted frame, then the card fades.

   NO FAKE RAMP. The frame stroke advances ONLY on real signals: the fetch
   fraction while fetching, a fixed milestone when a stage paints. Between
   signals the number holds still — and the elapsed clock keeps ticking at
   10 Hz, which is the honest "not dead" indicator: if a stage stalls, the
   time visibly climbs while the stage name stays put.

   The poster/still LCP state, the reduced-motion still, and the WebGL
   failure fallback all live in Story.tsx/StillScene — this card simply
   never mounts in those worlds (`active` is false).
--------------------------------------------------------------------- */

/** Must match the opacity transition on .aura-loader in globals.css. */
const FADE_MS = 420;
/** A beat of "Ready" before the fade, so completion reads as an event. */
const READY_HOLD_MS = 350;

type LoaderStageName = "Film" | "Canvas" | "Core" | "Landscape" | "Meadow" | "Ready";

/** Frame-stroke milestones. Values are aesthetic; the EVENTS are real. */
const PAINT_FRAC: Record<OpeningSceneStage, number> = {
  core: 0.62,
  site: 0.74,
  forest: 0.84,
  atmosphere: 0.92,
  meadow: 1,
};
const FILM_FRAC = 0.06;
const FETCH_SPAN = 0.44; // fetch walks the stroke from 0.06 to 0.50

export type LoaderFetchState = { loaded: number; total: number };

export default function SceneLoader({
  active,
  canvasLive,
  fetched,
  painted,
}: {
  /** entered, motion allowed, and WebGL not known-failed */
  active: boolean;
  /** the StoryCanvas chunk has mounted (the 3D code is on the page) */
  canvasLive: boolean;
  /** THREE.DefaultLoadingManager counts, reported up from StoryCanvas */
  fetched: LoaderFetchState;
  /** last progressive stage with a committed frame, null before core */
  painted: OpeningSceneStage | null;
}) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  /* The elapsed clock — starts on first activation, ticks at 10 Hz, and
     KEEPS ticking through stalls. That persistence is the point: a frozen
     number is indistinguishable from a crash; a climbing one is a wait. */
  const startedAt = useRef<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    if (!active || gone) return;
    if (startedAt.current === null) startedAt.current = performance.now();
    const id = window.setInterval(() => setNowMs(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [active, gone]);

  /* Completion: meadow painted → brief Ready hold → fade → unmount. */
  const complete = painted === "meadow";
  useEffect(() => {
    if (!complete || fading) return;
    const t = window.setTimeout(() => setFading(true), READY_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [complete, fading]);
  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [fading]);

  if (!active || gone) return null;

  /* ---- honest state derivation, newest signal wins ---- */
  const fetching = fetched.total > 0 && fetched.loaded < fetched.total;
  const fetchDone = fetched.total > 0 && fetched.loaded >= fetched.total;

  let stage: LoaderStageName;
  if (complete) stage = "Ready";
  else if (painted === "atmosphere") stage = "Meadow";
  else if (painted !== null) stage = "Landscape"; // core | site | forest painted
  else if (fetchDone) stage = "Core";
  else if (canvasLive && fetched.total > 0) stage = "Canvas";
  else stage = "Film";

  let frac = 0;
  if (canvasLive) frac = FILM_FRAC;
  if (fetched.total > 0) {
    frac = FILM_FRAC + FETCH_SPAN * Math.min(1, fetched.loaded / fetched.total);
  }
  if (painted !== null) frac = PAINT_FRAC[painted];

  const lit = painted !== null; // the window lights when the scene is truly up
  const showPct = frac > 0;

  const elapsed = startedAt.current === null ? 0 : Math.max(0, (nowMs || performance.now()) - startedAt.current);
  const timeText = `${(elapsed / 1000).toFixed(1)}s`;

  /* The live region announces stage TRANSITIONS only — identical strings are
     not re-announced, so this stays polite without extra throttling. */
  const sr = complete ? "3D scene ready." : `Loading the 3D scene — ${stage.toLowerCase()} stage.`;

  const cls = [
    "aura-loader",
    fading ? "" : "is-on",
    complete ? "" : "is-indeterminate",
    lit ? "is-lit" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} role="status" aria-live="polite">
      <svg className="aura-loader-mark" viewBox="0 0 46 40" width="34" height="30" aria-hidden focusable="false">
        {/* the plot, and the frame the build is aiming at */}
        <line className="aura-loader-plot" x1="2.5" y1="35.4" x2="43.5" y2="35.4" />
        <path className="aura-loader-ghost" d="M6 34 L23 5 L40 34" />
        <rect className="aura-loader-win" x="19" y="24" width="8" height="8" rx="0.6" />
        {/* the frame as actually built — pathLength 1 makes the dash array a
            plain 0..1 fraction, so the offset IS the progress fraction */}
        <path
          className="aura-loader-frame"
          d="M6 34 L23 5 L40 34"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - frac}
        />
      </svg>
      <span className="aura-loader-txt" aria-hidden>
        <span className="aura-loader-label">{stage}</span>
        <span className="aura-loader-meta">
          {/* em dash whenever no real fraction exists yet */}
          <span className="aura-loader-pct">{showPct ? `${Math.round(frac * 100)}%` : "—"}</span>
          <span className="aura-loader-time">{timeText}</span>
        </span>
      </span>
      <span className="aura-loader-sr">{sr}</span>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";

/* ---------------------------------------------------------------------
   THE SCENE LOADER — "a little preloader so people know something is
   happening" (founder, Aug 2026).

   WHERE IT LIVES, AND WHY IT IS NOT A SUSPENSE FALLBACK.
   The obvious move is <Suspense fallback={<Loader />}> in StoryCanvas.
   It is wrong twice over. A fallback rendered inside <Canvas> is handed to
   the R3F reconciler, so it must be THREE objects — a <div> there is a
   runtime error, not a layout bug. drei's <Html> would work around that by
   mounting a portal, but <Html> is itself a suspending-adjacent component
   that needs the R3F context, a camera and a render loop to position
   itself: paying for a WebGL context and a frameloop in order to draw a
   30px SVG is backwards, and it would also inherit the canvas's
   aria-hidden.

   So the loading STATE is lifted out of the canvas instead, and the loader
   is an ordinary fixed-position DOM node rendered as a sibling of <Canvas>.
   Two facts make that exact rather than approximate:

   1. useProgress() is a zustand store wired to THREE.DefaultLoadingManager
      at module scope (drei core/Progress.js). It is global — no R3F context
      needed — and it is already recording before we subscribe, because
      Scene.tsx calls useGLTF.preload() at module scope. Nothing is missed.
   2. <SceneReady> below is a null-rendering R3F child placed INSIDE the
      Suspense boundary next to <Scene>. React does not commit a suspended
      boundary's children, so its effect cannot fire until <Scene> has
      actually mounted. That is the honest "the 3D is on screen" moment.

   WHY BOTH SIGNALS. useProgress only sees things that go through a THREE
   loader — here, the six GLBs (~590 KB). It does NOT see the 200x200
   terrain build, the procedural canvas textures, or shader compilation,
   and those are a real part of the wait. So progress drives the drawing
   while there are items left to fetch, and once the fetch is genuinely
   done but <SceneReady> still has not fired, the loader drops the number
   and says FINISHING with an indeterminate mark. It never claims to know a
   fraction it does not have.

   THE MARK. An A-frame — the home the journey is about. The plot line and
   a ghosted outline are there from the first frame so the shape reads
   instantly; the emerald frame draws over the ghost as real items land
   (stroke-dashoffset against pathLength="1"), and the window lights only
   when the scene is genuinely mounted. No fake ramp, no 90%-and-wait.

   NO FLASH. On a warm cache the whole thing can be over in 80 ms, and a
   loader that appears and vanishes is worse than none. It is not revealed
   until REVEAL_DELAY has passed with the scene still not ready, and once
   revealed it is held for MIN_VISIBLE before it is allowed to start
   fading. Both fades run on --ease-fluid-decel.
--------------------------------------------------------------------- */

/** Don't reveal at all unless the scene is still missing after this long. */
const REVEAL_DELAY = 250;
/** Once revealed, stay up at least this long so it fades rather than blinks. */
const MIN_VISIBLE = 700;
/** Must match the opacity transition on .aura-loader in globals.css. */
const FADE_MS = 420;

type Phase = "idle" | "in" | "out" | "done";

/**
 * Renders nothing. Lives INSIDE the Suspense boundary, so its effect is the
 * first moment React has actually committed <Scene> — i.e. the 3D exists.
 * Placing it here rather than reading `active` off useProgress matters: the
 * loading manager goes idle between waves of requests, so `active` can blink
 * false while the scene is still nowhere near mounted.
 */
export function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export default function SceneLoader({ ready }: { ready: boolean }) {
  const { progress, loaded, total } = useProgress();
  const [phase, setPhase] = useState<Phase>("idle");
  const shownAt = useRef(0);

  /* Reveal — but only if the wait is long enough to be worth explaining.
     If `ready` flips inside the delay the cleanup kills the timer and the
     guard above stops it ever being re-armed, so nothing is drawn at all. */
  useEffect(() => {
    if (ready || phase !== "idle") return;
    const t = window.setTimeout(() => {
      shownAt.current = performance.now();
      setPhase("in");
    }, REVEAL_DELAY);
    return () => window.clearTimeout(t);
  }, [ready, phase]);

  /* Dismiss. Never before MIN_VISIBLE has elapsed since the reveal — a
     loader that is up for 60ms reads as a glitch, not as feedback. */
  useEffect(() => {
    if (!ready) return;
    if (phase === "idle") {
      setPhase("done");
      return;
    }
    if (phase !== "in") return;
    const held = performance.now() - shownAt.current;
    const t = window.setTimeout(() => setPhase("out"), Math.max(0, MIN_VISIBLE - held));
    return () => window.clearTimeout(t);
  }, [ready, phase]);

  /* Drop the node once the fade has finished, so no live region and no
     backdrop-filter layer is left sitting over the story. */
  useEffect(() => {
    if (phase !== "out") return;
    const t = window.setTimeout(() => setPhase("done"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  /* ---- honest state derivation -------------------------------------
     `fetching` is the only window in which a fraction is genuinely known.
     Before the manager has seen anything, total is 0 and we know nothing.
     After the last item lands, the remaining work (terrain, procedural
     textures, shader compile) is untracked and therefore unmeasured. */
  const fetching = total > 0 && loaded < total;
  const pct = fetching ? Math.max(0, Math.min(100, progress)) : total > 0 ? 100 : 0;
  const indeterminate = !fetching && !ready;

  const label = ready ? "Ready" : total === 0 ? "Surveying" : fetching ? "Raising the frame" : "Finishing";
  /* Announce in quarters, not per item: a polite live region that fires on
     every percent is unusable. Identical strings are not re-announced, so
     quantising here is what actually throttles it. */
  const srPct = Math.floor(pct / 25) * 25;
  const sr = ready
    ? "Scene ready."
    : fetching
      ? `Loading the 3D scene, ${srPct} percent.`
      : "Loading the 3D scene.";

  const cls = [
    "aura-loader",
    phase === "in" ? "is-on" : "",
    indeterminate ? "is-indeterminate" : "",
    ready ? "is-lit" : "",
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
        {/* the frame as actually built — pathLength 1 makes the dash array
            a plain 0..1 fraction, so the offset IS the load fraction */}
        <path
          className="aura-loader-frame"
          d="M6 34 L23 5 L40 34"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - pct / 100}
        />
      </svg>
      <span className="aura-loader-txt" aria-hidden>
        <span className="aura-loader-label">{label}</span>
        {/* em dash, not a number, whenever the fraction is not real */}
        <span className="aura-loader-pct">{fetching ? `${Math.round(pct)}%` : "—"}</span>
      </span>
      {phase !== "idle" && <span className="aura-loader-sr">{sr}</span>}
    </div>
  );
}

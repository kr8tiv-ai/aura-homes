"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  degradeSceneQuality,
  selectSceneQuality,
  type SceneQuality,
} from "@/lib/three/sceneQuality";
import Scene from "./Scene";
import SceneLoader, { SceneReady } from "./Loader";

/* ---------------------------------------------------------------------
   WEBGL PROBE — run on render, not in an effect, and hand the context back.

   Two things were wrong with probing inside useEffect and dropping the
   result on the floor:

   1. TIMING. StoryCanvas is only ever mounted on the client (Story.tsx
      pulls it in with next/dynamic ssr:false), so there is no hydration
      mismatch to defend against — and probing in an effect meant render 0
      returned null and <Canvas> could not mount until the following
      commit. Everything three.js does starts one commit later than it
      needs to, on the exact path the founder says feels slow.
   2. LEAKED CONTEXT. Browsers cap live WebGL contexts (~16 in Chrome) and
      dropping the JS reference does not free one — the GPU context lives
      until it is garbage collected or explicitly lost. Every mount leaked
      a probe context, and on a machine already near the cap that is what
      makes the real canvas come back context-lost. WEBGL_lose_context
      hands it straight back.

   The effect below stays purely as the SSR safety net: if this ever runs
   where `document` does not exist the probe returns null and the effect
   re-runs it after mount, i.e. exactly the old behaviour.
--------------------------------------------------------------------- */
function probeWebGL(): boolean | null {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

function runtimeQuality(reduced: boolean): SceneQuality {
  const nav = navigator as NavigatorWithMemory;
  return selectSceneQuality({
    width: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    reducedMotion: reduced,
  });
}

/**
 * Capability hints choose the opening composition; delivered frames get the
 * final word. A full scene that cannot clear 42 fps after a short warm-up is
 * reduced once to the balanced budget. There is no oscillation and no
 * quality-up event halfway through somebody's scroll.
 */
function SceneQualityGovernor({
  quality,
  onDegrade,
}: {
  quality: SceneQuality;
  onDegrade: () => void;
}) {
  const sample = useRef({ warmup: 0, frames: 0, elapsed: 0, decided: false });

  useEffect(() => {
    sample.current = { warmup: 0, frames: 0, elapsed: 0, decided: quality.tier !== "full" };
  }, [quality.tier]);

  useFrame((_, delta) => {
    const state = sample.current;
    if (state.decided || quality.tier !== "full") return;
    // Background tabs are intentionally throttled by the browser; that says
    // nothing about the device's ability to render the scene while visible.
    if (document.visibilityState !== "visible") return;
    if (state.warmup < 8) {
      state.warmup += 1;
      return;
    }
    state.frames += 1;
    state.elapsed += Math.min(delta, 0.25);
    if (state.elapsed < 1.6) return;
    state.decided = true;
    if (state.frames / state.elapsed < 42) onDegrade();
  });
  return null;
}

/** Fixed full-viewport canvas behind the copy. Detects WebGL up front and
 *  falls back to the still illustration so the page never renders blank. */
export default function StoryCanvas({
  progressRef,
  reduced,
  night = false,
  onReady,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
  night?: boolean;
  onReady?: () => void;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(probeWebGL);
  /* Latched, never cleared: <Scene> is not expected to suspend a second
     time (every model is preloaded and Environment is procedural), and if
     it ever did, re-showing the loader mid-story would be worse than the
     brief hitch it was reporting.

     `ready` lives HERE because <SceneReady> (inside the canvas) and
     <SceneLoader> (outside it) are siblings, so this is their nearest
     common owner. Name the cost: flipping it re-renders <Canvas> once, so
     Scene's render pass runs a second time. Nothing is rebuilt — every
     geometry/material in Scene is behind a useMemo with stable deps — and
     it happens AFTER the scene is committed and on screen, so it delays
     nothing the visitor is waiting for. A module-level store would avoid
     even that, at the price of state that outlives the component and has
     to be hand-reset on remount; not worth the trap.

     The progress SUBSCRIPTION deliberately does not live here. useProgress
     fires on every loader event; reading it in StoryCanvas would re-render
     the canvas dozens of times during load. It is read inside SceneLoader,
     which is the only thing that needs it. */
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  const [quality, setQuality] = useState<SceneQuality>(() => runtimeQuality(reduced));
  const runtimeDegraded = useRef(false);
  const degrade = useCallback(() => {
    runtimeDegraded.current = true;
    setQuality((current) => degradeSceneQuality(current));
  }, []);

  useEffect(() => {
    if (webgl === null) setWebgl(probeWebGL() ?? false);
  }, [webgl]);

  useEffect(() => {
    const refreshQuality = () => {
      const next = runtimeQuality(reduced);
      setQuality(runtimeDegraded.current ? degradeSceneQuality(next) : next);
    };
    refreshQuality();
    window.addEventListener("resize", refreshQuality, { passive: true });
    return () => window.removeEventListener("resize", refreshQuality);
  }, [reduced]);

  if (webgl === null) return null;
  if (webgl === false) return null;

  return (
    <>
      <div data-scene-quality={quality.tier} className="story-scene-root">
        <Canvas
          shadows
          dpr={[1, quality.maxDpr]}
          frameloop={quality.frameloop}
        /* far was 140 — the mountain range sits well beyond that and was being
           clipped into a grey slab across the sky. 260 clears the range from
           every camera beat while keeping the near/far ratio modest enough not
           to cost depth precision (0.3/260 ≈ 870, vs 467 before) — which
           matters, because coplanar glass on the deck is only just resolved. */
        camera={{ fov: 38, near: 0.4, far: 260, position: [-4.5, 5.4, 17.5] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          /* ACES over AgX (both trialled, Aug 2026): AgX's gentler highlight
             rolloff helped the dusk sun, but it desaturated the emerald
             landscape and teal firs — and vivid, alive foliage is what sells
             this eco brand. ACES keeps the greens punchy; the dusk clip AgX
             fixed was never actually a problem here. */
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          const context = gl.getContext();
          const debug = context.getExtension("WEBGL_debug_renderer_info");
          const renderer = String(
            debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER),
          );
          if (/swiftshader|llvmpipe|software/i.test(renderer)) degrade();
        }}
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
        aria-hidden
      >
        {/* The fallback stays null ON PURPOSE. A Suspense fallback inside
            <Canvas> is reconciled by R3F, so it can only be 3D — the loader
            has to be DOM, and it is the sibling below. <SceneReady> is the
            other half: React cannot commit it while this boundary is
            suspended, so its effect firing is the exact instant <Scene> is
            really on screen. See Loader.tsx for the full argument. */}
        <Suspense fallback={null}>
          <SceneQualityGovernor quality={quality} onDegrade={degrade} />
          <Scene progressRef={progressRef} reduced={reduced} night={night} quality={quality} />
          <SceneReady onReady={markReady} />
        </Suspense>
        </Canvas>
      </div>
      {/* Outside the canvas: a plain fixed div, no R3F context, no <Html>
          portal, no second render loop. Honours prefers-reduced-motion and
          both themes in CSS (globals.css, "THE SCENE LOADER"). */}
      <SceneLoader ready={ready} />
    </>
  );
}

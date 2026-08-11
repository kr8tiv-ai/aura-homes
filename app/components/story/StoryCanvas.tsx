"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";
import StillScene from "./StillScene";
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

/** Fixed full-viewport canvas behind the copy. Detects WebGL up front and
 *  falls back to the still illustration so the page never renders blank. */
export default function StoryCanvas({
  progressRef,
  reduced,
  night = false,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
  night?: boolean;
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
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (webgl === null) setWebgl(probeWebGL() ?? false);
  }, [webgl]);

  if (webgl === null) return null;
  if (webgl === false) return <StillScene />;

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={reduced ? "demand" : "always"}
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
          <Scene progressRef={progressRef} reduced={reduced} night={night} />
          <SceneReady onReady={markReady} />
        </Suspense>
      </Canvas>
      {/* Outside the canvas: a plain fixed div, no R3F context, no <Html>
          portal, no second render loop. Honours prefers-reduced-motion and
          both themes in CSS (globals.css, "THE SCENE LOADER"). */}
      <SceneLoader ready={ready} />
    </>
  );
}

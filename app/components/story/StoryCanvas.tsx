"use client";

import { Suspense, startTransition, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import {
  nextOpeningSceneStage,
  selectOpeningSceneQuality,
  selectSceneQuality,
  type OpeningSceneStage,
  type SceneQuality,
} from "@/lib/three/sceneQuality";
import { probeWebGL } from "@/lib/three/webgl";
import Scene from "./Scene";

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
interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

function runtimeQuality(reduced: boolean): SceneQuality {
  const nav = navigator as NavigatorWithMemory;
  return selectOpeningSceneQuality({
    width: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    reducedMotion: reduced,
  });
}

/** The quality the hardware actually earns, with the opening's caps lifted.
 *  Applied only after the last opening stage has painted a real frame — the
 *  0.14 grass cap exists to protect the first paint, and holding it forever
 *  was the bug that shipped a 14%-density meadow with dwarf flowers. */
function runtimeFullQuality(reduced: boolean): SceneQuality {
  const nav = navigator as NavigatorWithMemory;
  return selectSceneQuality({
    width: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    reducedMotion: reduced,
  });
}

/** Signal each progressive phase only after R3F has completed a real frame.
 * The core signal releases the DOM loader; every later signal authorizes one
 * more idle-scheduled layer. */
function SceneFrameSignal({
  stage,
  onPainted,
}: {
  stage: OpeningSceneStage;
  onPainted: (stage: OpeningSceneStage) => void;
}) {
  const sent = useRef(false);
  const callback = useRef(onPainted);
  callback.current = onPainted;

  useFrame(() => {
    if (sent.current) return;
    sent.current = true;
    window.requestAnimationFrame(() => callback.current(stage));
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
  onUnavailable,
  onStagePainted,
  onFetch,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
  night?: boolean;
  onReady?: () => void;
  onUnavailable?: () => void;
  /** Reports each progressive stage's first committed frame up to the DOM
   *  loader, which stays visible until the meadow has painted. */
  onStagePainted?: (stage: OpeningSceneStage) => void;
  /** Reports THREE.DefaultLoadingManager counts (the six GLBs) up to the
   *  DOM loader. Observed here so drei stays inside this dynamic chunk. */
  onFetch?: (loaded: number, total: number) => void;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(probeWebGL);
  const [quality, setQuality] = useState<SceneQuality>(() => runtimeQuality(reduced));
  const [stage, setStage] = useState<OpeningSceneStage>("core");
  const [paintedStage, setPaintedStage] = useState<OpeningSceneStage | null>(null);
  /** true once the LAST opening stage has painted — the moment the opening
   *  caps have done their job and the meadow may grow to full density. */
  const [settled, setSettled] = useState(false);
  const openingReadySent = useRef(false);

  const handleStagePainted = useCallback((painted: OpeningSceneStage) => {
    setPaintedStage(painted);
    onStagePainted?.(painted);
    if (painted === "core" && !openingReadySent.current) {
      openingReadySent.current = true;
      onReady?.();
    }
    if (painted === "meadow") setSettled(true);
  }, [onReady, onStagePainted]);

  /* useProgress is a global zustand store wired to THREE.DefaultLoadingManager
     at module scope; Scene.tsx preloads the GLBs at module scope, so it is
     already counting by the time this component first renders. */
  const { loaded: fetchLoaded, total: fetchTotal } = useProgress();
  useEffect(() => {
    onFetch?.(fetchLoaded, fetchTotal);
  }, [onFetch, fetchLoaded, fetchTotal]);

  useEffect(() => {
    if (webgl === null) setWebgl(probeWebGL() ?? false);
  }, [webgl]);

  useEffect(() => {
    if (webgl === false) onUnavailable?.();
  }, [onUnavailable, webgl]);

  useEffect(() => {
    const refreshQuality = () => {
      setQuality(settled ? runtimeFullQuality(reduced) : runtimeQuality(reduced));
    };
    refreshQuality();
    window.addEventListener("resize", refreshQuality, { passive: true });
    return () => window.removeEventListener("resize", refreshQuality);
  }, [reduced, settled]);

  /* The promotion. Once the meadow stage has painted at the opening scale,
     lift the caps through the SAME idle boundary the stage machine uses —
     rebuilding ~1M grass instances is exactly the task the opening split to
     avoid, so it never lands inside a frame the visitor is watching. The
     resize listener above re-derives from the settled selector afterwards. */
  useEffect(() => {
    if (!settled) return;
    let idleHandle: number | null = null;
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const timer = window.setTimeout(() => {
      const promote = () => startTransition(() => setQuality(runtimeFullQuality(reduced)));
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(promote, { timeout: 2_000 });
      } else {
        window.requestAnimationFrame(promote);
      }
    }, 600);
    return () => {
      window.clearTimeout(timer);
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [settled, reduced]);

  /* Progress only after the current stage has produced a real frame. Each
     addition is scheduled through an idle boundary, so model cloning,
     atmosphere shaders and meadow instances cannot collapse back into the
     single 19-second task this replaces. */
  useEffect(() => {
    if (paintedStage !== stage) return;
    const next = nextOpeningSceneStage(stage);
    if (!next) return;

    const delay = stage === "core" ? 450 : stage === "site" ? 550 : stage === "forest" ? 700 : 900;
    let idleHandle: number | null = null;
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const timer = window.setTimeout(() => {
      const advance = () => startTransition(() => {
        setStage((current) => current === stage ? next : current);
      });
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(advance, { timeout: 1_200 });
      } else {
        window.requestAnimationFrame(advance);
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [paintedStage, stage]);

  if (webgl === null) return null;
  if (webgl === false) return null;

  return (
    <>
      <div
        data-scene-quality={quality.tier}
        data-scene-phase={stage}
        className="story-scene-root"
      >
        <Canvas
          shadows={quality.softShadows}
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
        }}
        style={{ position: "fixed", inset: 0, zIndex: 0 }}
        aria-hidden
      >
        {/* The fallback stays null on purpose. A Suspense fallback inside
            Canvas can only be 3D; the status card lives in Story.tsx so it
            paints before this bundle and survives main-thread scene work. */}
        <Suspense fallback={null}>
          <Scene
            progressRef={progressRef}
            reduced={reduced}
            night={night}
            quality={quality}
            stage={stage}
          />
          <SceneFrameSignal key={stage} stage={stage} onPainted={handleStagePainted} />
        </Suspense>
        </Canvas>
      </div>
    </>
  );
}

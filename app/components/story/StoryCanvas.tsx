"use client";

import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";
import StillScene from "./StillScene";

/** Fixed full-viewport canvas behind the copy. Detects WebGL up front and
 *  falls back to the still illustration so the page never renders blank. */
export default function StoryCanvas({
  progressRef,
  reduced,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      setWebgl(!!gl);
    } catch {
      setWebgl(false);
    }
  }, []);

  if (webgl === null) return null;
  if (webgl === false) return <StillScene />;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      frameloop={reduced ? "demand" : "always"}
      camera={{ fov: 38, near: 0.3, far: 140, position: [-4.5, 5.4, 17.5] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
      aria-hidden
    >
      <Suspense fallback={null}>
        <Scene progressRef={progressRef} reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}

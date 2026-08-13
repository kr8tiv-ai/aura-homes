"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import type { BuilderDocument } from "@/lib/builder/document";
import { hashBuilderDocument } from "@/lib/builder/document";
import {
  buildHome,
  cameraFrameForSummary,
  GRADE_Y_FT,
  type Part,
} from "@/lib/builder/geometry";
import { NORDIC_MATERIALS } from "@/lib/three/nordicMaterials";
import { useMemo } from "react";

const MATERIAL = {
  wall: NORDIC_MATERIALS.limeRender,
  floor: NORDIC_MATERIALS.ash,
  roof: NORDIC_MATERIALS.standingSeam,
  trim: NORDIC_MATERIALS.blackAluminium,
  glass: NORDIC_MATERIALS.glass,
  door: NORDIC_MATERIALS.cedar,
  frame: NORDIC_MATERIALS.blackAluminium,
  sill: NORDIC_MATERIALS.stone,
  pile: NORDIC_MATERIALS.blackAluminium,
  deck: NORDIC_MATERIALS.cedar,
  tub: NORDIC_MATERIALS.cedar,
  water: NORDIC_MATERIALS.water,
} as const;

function PreviewPart({ part }: { part: Part }) {
  const material = MATERIAL[part.surface];
  const translucent = part.surface === "glass" || part.surface === "water";
  return (
    <mesh geometry={part.geometry}>
      {translucent ? (
        <meshPhysicalMaterial
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
          transparent
          opacity={"opacity" in material ? material.opacity : 0.82}
          transmission={part.surface === "glass" ? 0.32 : 0}
          thickness={0.08}
          side={THREE.DoubleSide}
        />
      ) : (
        <meshStandardMaterial
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
          flatShading
        />
      )}
    </mesh>
  );
}

/** A deliberately small, demand-rendered model viewer. It owns its geometry,
 * so R3F disposes the buffers when another plan is previewed. */
export default function PlanModelPreview({
  document,
  planId,
  title,
}: {
  document: BuilderDocument;
  planId: string;
  title: string;
}) {
  const home = useMemo(() => buildHome(document.spec), [document]);
  const frame = useMemo(() => cameraFrameForSummary(home.summary), [home]);
  const bounds = home.summary.boundsWithRoof;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 24);
  const designHash = hashBuilderDocument(document);

  return (
    <div
      className="plan-model-preview"
      data-plan-model-preview={planId}
      data-preview-design-hash={designHash}
      data-preview-width={(bounds.maxX - bounds.minX).toFixed(2)}
      data-preview-depth={(bounds.maxZ - bounds.minZ).toFixed(2)}
      role="img"
      aria-label={`Interactive 3D preview of ${title}`}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.35]}
        camera={{ fov: 38, near: 0.5, far: 2000, position: frame.position }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => camera.lookAt(...frame.target)}
      >
        <color attach="background" args={["#dce8df"]} />
        <hemisphereLight color="#f5f1e7" groundColor="#66765d" intensity={1.45} />
        <directionalLight position={[span, span * 1.5, span]} intensity={2.1} color="#fff4de" />
        <group>
          {home.volumes.map((volume) => (
            <group
              key={volume.id}
              position={[volume.origin[0], volume.origin[1], volume.origin[2]]}
              rotation={[0, volume.rotationY, 0]}
            >
              {volume.parts.map((part) => <PreviewPart key={part.id} part={part} />)}
            </group>
          ))}
          {home.deck ? (
            <group
              position={[home.deck.origin[0], home.deck.origin[1], home.deck.origin[2]]}
              rotation={[0, home.deck.rotationY, 0]}
            >
              {home.deck.parts.map((part) => <PreviewPart key={part.id} part={part} />)}
            </group>
          ) : null}
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GRADE_Y_FT - 0.02, 0]}>
          <planeGeometry args={[span * 5, span * 5]} />
          <meshStandardMaterial color="#839879" roughness={1} />
        </mesh>
        <OrbitControls
          makeDefault
          target={frame.target}
          enablePan={false}
          enableDamping={false}
          minDistance={Math.max(8, frame.distance * 0.45)}
          maxDistance={frame.distance * 2.5}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </Canvas>
      <p>Drag to orbit · scroll to zoom</p>
    </div>
  );
}

"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import type { BuilderDocument } from "@/lib/builder/document";
import { hashBuilderDocument } from "@/lib/builder/document";
import {
  buildHome,
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

/**
 * One comparison camera for every catalog model. The user can still orbit and
 * zoom, but each newly selected plan starts at the same scale and projection;
 * a smaller plan therefore looks smaller instead of being auto-framed into
 * the same silhouette as a larger one.
 */
const PROOF_CAMERA = {
  position: [72, 44, 92] as const,
  target: [0, 9, 0] as const,
  fov: 38,
  aspect: 16 / 10,
};
const RENDER_CAMERA = `${PROOF_CAMERA.position.join(",")}→${PROOF_CAMERA.target.join(",")}`;
const RENDER_PROJECTION = `perspective:${PROOF_CAMERA.fov}/0.5/2000`;
const RENDER_DISTANCE = new THREE.Vector3(...PROOF_CAMERA.position).distanceTo(
  new THREE.Vector3(...PROOF_CAMERA.target),
);

function previewGeometryProof(home: ReturnType<typeof buildHome>) {
  const camera = new THREE.PerspectiveCamera(
    PROOF_CAMERA.fov,
    PROOF_CAMERA.aspect,
    0.5,
    2_000,
  );
  camera.position.set(...PROOF_CAMERA.position);
  camera.lookAt(...PROOF_CAMERA.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const world = new THREE.Box3();
  const projected = new THREE.Box2();
  let hash = 0x811c9dc5;

  const mix = (value: number) => {
    hash ^= value | 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  const visit = (
    origin: readonly [number, number, number],
    rotationY: number,
    parts: readonly Part[],
  ) => {
    const transform = new THREE.Matrix4().makeRotationY(rotationY);
    transform.setPosition(...origin);
    for (const part of parts) {
      for (let index = 0; index < part.surface.length; index += 1) {
        mix(part.surface.charCodeAt(index));
      }
      const positions = part.geometry.getAttribute("position");
      mix(positions.count);
      for (let index = 0; index < positions.count; index += 1) {
        const point = new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index),
        ).applyMatrix4(transform);
        world.expandByPoint(point);
        const view = point.clone().project(camera);
        projected.expandByPoint(new THREE.Vector2(view.x, view.y));
        mix(Math.round(point.x * 1_000));
        mix(Math.round(point.y * 1_000));
        mix(Math.round(point.z * 1_000));
      }
    }
  };

  for (const volume of home.volumes) visit(volume.origin, volume.rotationY, volume.parts);
  if (home.deck) visit(home.deck.origin, home.deck.rotationY, home.deck.parts);

  const fixed = (value: number) => value.toFixed(4);
  return {
    signature: `preview-v1:${hash.toString(16).padStart(8, "0")}`,
    camera: `${PROOF_CAMERA.position.join(",")}→${PROOF_CAMERA.target.join(",")}@${PROOF_CAMERA.fov}/${PROOF_CAMERA.aspect}`,
    projectedBounds: [
      projected.min.x,
      projected.min.y,
      projected.max.x,
      projected.max.y,
    ].map(fixed).join(","),
    worldBounds: [
      world.min.x,
      world.min.y,
      world.min.z,
      world.max.x,
      world.max.y,
      world.max.z,
    ].map(fixed).join(","),
  };
}

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
  const bounds = home.summary.boundsWithRoof;
  const designHash = hashBuilderDocument(document);
  const proof = useMemo(() => previewGeometryProof(home), [home]);

  return (
    <div
      className="plan-model-preview"
      data-plan-model-preview={planId}
      data-preview-design-hash={designHash}
      data-preview-camera-mode="fixed-comparison-v1"
      data-preview-render-camera={RENDER_CAMERA}
      data-preview-render-projection={RENDER_PROJECTION}
      data-preview-geometry-signature={proof.signature}
      data-preview-camera={proof.camera}
      data-preview-projected-bounds={proof.projectedBounds}
      data-preview-world-bounds={proof.worldBounds}
      data-preview-width={(bounds.maxX - bounds.minX).toFixed(2)}
      data-preview-depth={(bounds.maxZ - bounds.minZ).toFixed(2)}
      role="img"
      aria-label={`Interactive 3D preview of ${title}`}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.35]}
        camera={{
          fov: PROOF_CAMERA.fov,
          near: 0.5,
          far: 2_000,
          position: [...PROOF_CAMERA.position],
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => camera.lookAt(...PROOF_CAMERA.target)}
      >
        <color attach="background" args={["#dce8df"]} />
        <hemisphereLight color="#f5f1e7" groundColor="#66765d" intensity={1.45} />
        <directionalLight position={[48, 72, 48]} intensity={2.1} color="#fff4de" />
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
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#839879" roughness={1} />
        </mesh>
        <OrbitControls
          makeDefault
          target={PROOF_CAMERA.target}
          enablePan={false}
          enableDamping={false}
          minDistance={RENDER_DISTANCE * 0.4}
          maxDistance={RENDER_DISTANCE * 2.5}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </Canvas>
      <p>Drag to orbit · scroll to zoom</p>
    </div>
  );
}

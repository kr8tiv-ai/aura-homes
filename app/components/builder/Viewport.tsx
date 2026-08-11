"use client";

/* ===========================================================================
   THE VIEWPORT — the HomeSpec, on screen, while you are still changing it.

   `lib/builder/geometry.ts` decides the SHAPE and this file decides the LOOK,
   and the `surface` tag on each part is the entire contract between them. That
   split is why a roof can change form without a single colour moving, and why
   a night palette is eleven lines rather than a rewrite.

   THE VISUAL LANGUAGE is the one `components/story/Scene.tsx` established for
   the landing page: flat-shaded low-poly, standard materials, roughness doing
   the work, no textures, no post-processing. This builder has to look like it
   belongs to the same world as the home on the front page, because it is
   supposed to be the same home.

   THREE THINGS THIS FILE IS CAREFUL ABOUT
   ---------------------------------------
   1. IT OWNS NO GEOMETRY. Every BufferGeometry arrives built and is disposed
      by whoever built it (`BuilderApp`), so every mesh here carries
      `dispose={null}` — without it R3F would free buffers the builder still
      holds a reference to, and the model would vanish mid-drag.
   2. THE HOUSE GROUP IS THE EXPORT ROOT. `houseRef` wraps the volumes and the
      deck and NOTHING else: no ground, no grid, no sun, no selection glow.
      That is what makes the .glb a building rather than a screenshot of an
      editor. The editor furniture also carries `EXPORT_IGNORE` as a second
      belt, in case somebody later hands a wider subtree to the exporter.
   3. IT RENDERS ON DEMAND. `frameloop="demand"` means no frame is drawn
      unless something changed — a 3D view idling at 60fps on a laptop for the
      twenty minutes somebody spends reading the plan below it is a battery
      bill for nothing. `<Refresh>` invalidates whenever React re-renders the
      scene, and drei's OrbitControls invalidates while you drag.
   =========================================================================== */

import { useEffect, useMemo, useRef, useState, type ElementRef, type MutableRefObject } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  GRADE_Y_FT,
  type HomeGeometry,
  type Part,
  type Surface,
  type VolumeGeometry,
  type VolumeSummary,
} from "@/lib/builder/geometry";
import { EXPORT_IGNORE } from "@/lib/builder/exportSpec";
import { currentTheme, onThemeChange, type Theme } from "@/lib/theme";
import { bearingWords, hourLabel, type SunPosition } from "./sun";

/* ---------------------------------------------------------------- palette

   One palette, two lights. The night mode does NOT recolour the building —
   a cedar deck is the same cedar after dark — it changes the sky, the ground
   and what is coming out of the windows, which is what actually changes.  */

interface SurfaceStyle {
  color: string;
  roughness: number;
  metalness: number;
  /** translucent surfaces: glass and the water in the tub */
  opacity?: number;
  /** flat shading is the low-poly language; smooth is for the cylinders */
  smooth?: boolean;
  noShadow?: boolean;
}

const SURFACES: Record<Surface, SurfaceStyle> = {
  wall: { color: "#e7e1d5", roughness: 0.94, metalness: 0 },
  floor: { color: "#b08a5e", roughness: 0.78, metalness: 0 },
  roof: { color: "#2a302c", roughness: 0.55, metalness: 0.3 },
  trim: { color: "#8f9a94", roughness: 0.4, metalness: 0.6 },
  glass: { color: "#a8cfd4", roughness: 0.08, metalness: 0.15, opacity: 0.34, noShadow: true },
  door: { color: "#6a5442", roughness: 0.85, metalness: 0 },
  frame: { color: "#20261f", roughness: 0.6, metalness: 0.25 },
  sill: { color: "#8d968f", roughness: 0.7, metalness: 0.1 },
  pile: { color: "#6c7370", roughness: 0.6, metalness: 0.35, smooth: true },
  deck: { color: "#a97e57", roughness: 0.86, metalness: 0 },
  tub: { color: "#6d523c", roughness: 0.9, metalness: 0, smooth: true },
  water: { color: "#4f8d86", roughness: 0.2, metalness: 0.1, opacity: 0.88, smooth: true, noShadow: true },
};

/** The two worlds the site already has: paper daylight, and the night the
 *  landing page's NIGHT button flips to. */
const WORLD = {
  light: {
    sky: "#dcecf3",
    ground: "#7d8f6e",
    grid: "#93a689",
    gridAxis: "#5f7355",
    sun: "#fff4de",
    hemi: 0.55,
    ambient: 0.16,
    key: 2.2,
    /** what a window looks like from outside when nothing is lit inside */
    glow: 0,
  },
  dark: {
    sky: "#1b2733",
    ground: "#2c3630",
    grid: "#3c4a42",
    gridAxis: "#55665c",
    sun: "#9fb6d8",
    hemi: 0.26,
    ambient: 0.1,
    key: 0.5,
    glow: 0.9,
  },
} as const;

/* ------------------------------------------------------------------ theme */

function useTheme(): Theme {
  // Starts light and corrects after mount: `currentTheme()` reads the DOM, and
  // this component is client-only, but the first render still has to be
  // deterministic for React to be happy about it.
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(currentTheme());
    return onThemeChange(setTheme);
  }, []);
  return theme;
}

/* ------------------------------------------------------------------ parts */

function PartMesh({ part, night }: { part: Part; night: boolean }) {
  const s = SURFACES[part.surface];
  const lit = night && part.surface === "glass";
  return (
    <mesh
      geometry={part.geometry}
      /* the geometry belongs to BuilderApp — see rule 1 in the header */
      dispose={null}
      castShadow={!s.noShadow}
      receiveShadow={!s.noShadow}
    >
      <meshStandardMaterial
        color={s.color}
        roughness={s.roughness}
        metalness={s.metalness}
        flatShading={!s.smooth}
        transparent={s.opacity !== undefined}
        opacity={s.opacity ?? 1}
        emissive={lit ? "#ffc98a" : "#000000"}
        emissiveIntensity={lit ? WORLD.dark.glow : 0}
      />
    </mesh>
  );
}

function VolumeGroup({
  volume,
  night,
  onSelect,
}: {
  volume: VolumeGeometry;
  night: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <group
      position={[volume.origin[0], volume.origin[1], volume.origin[2]]}
      rotation={[0, volume.rotationY, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // Without stopPropagation the click also reaches the volume behind
        // this one and selection flickers between the two.
        e.stopPropagation();
        onSelect(volume.id);
      }}
    >
      {volume.parts.map((p) => (
        <PartMesh key={p.id} part={p} night={night} />
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- furniture */

/** The ground the home stands on, and the grid that gives the eye a scale.
 *  Both carry EXPORT_IGNORE — a .glb of an Aura home does not contain a lawn. */
function Site({ theme }: { theme: Theme }) {
  const w = WORLD[theme];
  return (
    <group userData={{ [EXPORT_IGNORE]: true }}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GRADE_Y_FT, 0]}
        receiveShadow
        userData={{ [EXPORT_IGNORE]: true }}
      >
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={w.ground} roughness={1} metalness={0} />
      </mesh>
      {/* 5-foot squares out to 200 feet: a scale you can count, not a texture */}
      <gridHelper
        args={[400, 80, w.gridAxis, w.grid]}
        position={[0, GRADE_Y_FT + 0.03, 0]}
        userData={{ [EXPORT_IGNORE]: true }}
      />
      {/* North. The site frame fixes north at −Z (geometry.ts), and every
          solar claim on this page depends on the viewer knowing which way
          that is. */}
      <mesh position={[0, GRADE_Y_FT + 0.05, -60]} userData={{ [EXPORT_IGNORE]: true }}>
        <boxGeometry args={[0.6, 0.08, 120]} />
        <meshBasicMaterial color={w.gridAxis} />
      </mesh>
    </group>
  );
}

/** The selection: a soft plate on the ground under the chosen volume, at its
 *  own rotation. Not an outline — an outline on a rotated rectangle is a
 *  hand-built LineLoop with its own disposal problem, and this reads better.
 *
 *  The plate's size comes off the summary's world plan corners rather than
 *  from the spec, so this component needs nothing but the geometry it is
 *  already given. Edge 0→1 of that ring is always the volume's WIDTH edge
 *  (`volumeCornersPlan` emits width first, and `ccw` can only reverse the
 *  ring, which maps edge 0→1 onto the opposite width edge). */
function SelectionPlate({
  volume,
  summary,
}: {
  volume: VolumeGeometry;
  summary: VolumeSummary;
}) {
  const p = summary.plan;
  if (p.length !== 4) return null;
  const widthFt = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
  const depthFt = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  return (
    <group
      position={[volume.origin[0], GRADE_Y_FT + 0.08, volume.origin[2]]}
      rotation={[0, volume.rotationY, 0]}
      userData={{ [EXPORT_IGNORE]: true }}
    >
      {/* the group yaws, the mesh lies down — composing both on one Euler is
          where a sign error would hide */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ [EXPORT_IGNORE]: true }}>
        <planeGeometry args={[widthFt + 3, depthFt + 3]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/** The sun itself, so the slider moves something visible rather than a number. */
function SunMarker({ sun, distance, theme }: { sun: SunPosition; distance: number; theme: Theme }) {
  if (!sun.aboveHorizon) return null;
  const [x, y, z] = sun.direction;
  return (
    <mesh
      position={[x * distance, y * distance, z * distance]}
      userData={{ [EXPORT_IGNORE]: true }}
    >
      <sphereGeometry args={[distance * 0.035, 16, 12]} />
      <meshBasicMaterial color={WORLD[theme].sun} />
    </mesh>
  );
}

/** Draw one frame whenever React commits a change to the scene. This is what
 *  makes `frameloop="demand"` safe: every slider, every theme flip and every
 *  rebuild passes through a render of this component's parent. */
function Refresh() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  });
  return null;
}

/* ------------------------------------------------------------- the scene */

function Scene({
  home,
  sun,
  theme,
  selectedId,
  onSelect,
  houseRef,
}: {
  home: HomeGeometry;
  sun: SunPosition;
  theme: Theme;
  selectedId: string | null;
  onSelect: (id: string) => void;
  houseRef: MutableRefObject<THREE.Group | null>;
}) {
  const w = WORLD[theme];
  const night = theme === "dark";
  const selected = home.volumes.find((v) => v.id === selectedId) ?? null;
  const selectedSummary = home.summary.volumes.find((v) => v.id === selectedId) ?? null;

  /* The shadow camera is sized from the model rather than fixed, because a
     14-foot cabin and a 70-foot cluster want very different boxes: too big and
     every shadow is a soft grey smear, too small and half the house casts
     nothing at all. */
  const b = home.summary.boundsWithRoof;
  const radius = Math.max(
    24,
    Math.abs(b.minX),
    Math.abs(b.maxX),
    Math.abs(b.minZ),
    Math.abs(b.maxZ),
    home.summary.maxRidgeHeightFt,
  );
  const shadowSpan = radius + 25;
  const sunDistance = Math.max(150, radius * 4);
  const [sx, sy, sz] = sun.direction;

  return (
    <>
      <Refresh />
      <color attach="background" args={[w.sky]} />

      <hemisphereLight color={w.sky} groundColor={w.ground} intensity={w.hemi} />
      <ambientLight intensity={w.ambient} />
      <directionalLight
        castShadow={sun.aboveHorizon}
        position={[sx * sunDistance, Math.max(sy, 0.02) * sunDistance, sz * sunDistance]}
        color={w.sun}
        /* Below the horizon the key is off, not dim: a sun that lights the
           south wall at midnight would quietly undo the whole point of the
           slider. What is left is sky and ambient, which is what dusk is. */
        intensity={sun.aboveHorizon ? w.key * Math.min(1, 0.35 + sun.altitudeDeg / 45) : 0}
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={1}
        shadow-camera-far={sunDistance * 2.4}
      />
      {/* North fill, so the shaded elevations read as surfaces rather than as
          holes. Deliberately weak — it is not a second sun. */}
      <directionalLight position={[-radius, radius * 1.4, -radius * 1.6]} color={w.sky} intensity={0.18} />

      <Site theme={theme} />
      <SunMarker sun={sun} distance={sunDistance} theme={theme} />
      {selected && selectedSummary ? (
        <SelectionPlate volume={selected} summary={selectedSummary} />
      ) : null}

      {/* THE EXPORT ROOT — volumes and deck, nothing else. */}
      <group ref={houseRef}>
        {home.volumes.map((v) => (
          <VolumeGroup key={v.id} volume={v} night={night} onSelect={onSelect} />
        ))}
        {home.deck ? (
          <group
            position={[home.deck.origin[0], home.deck.origin[1], home.deck.origin[2]]}
            rotation={[0, home.deck.rotationY, 0]}
          >
            {home.deck.parts.map((p) => (
              <PartMesh key={p.id} part={p} night={night} />
            ))}
          </group>
        ) : null}
      </group>
    </>
  );
}

/* ------------------------------------------------------------- the canvas */

export default function Viewport({
  home,
  sun,
  hour,
  selectedId,
  onSelect,
  houseRef,
}: {
  home: HomeGeometry;
  sun: SunPosition;
  hour: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  houseRef: MutableRefObject<THREE.Group | null>;
}) {
  const theme = useTheme();
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);

  /* The camera is framed once, from the FIRST model it is given, and the orbit
     TARGET is fixed with it. Re-deriving either on every edit would yank the
     view out from under somebody nudging a slider — and a `target` prop that
     changes also silently undoes a pan, which reads as the app fighting you.
     "Frame the home" is a button instead, and it restores exactly this. */
  const initial = useMemo(() => {
    const b = home.summary.boundsWithRoof;
    const span = Math.max(30, b.widthFt, b.depthFt, home.summary.maxRidgeHeightFt * 1.6);
    return {
      distance: span * 1.9,
      height: span * 0.85,
      target: [0, Math.max(6, home.summary.maxRidgeHeightFt * 0.4), 0] as [number, number, number],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frame = () => controls.current?.reset();

  return (
    <div className="relative overflow-hidden rounded-xl border aura-hairline bg-aura-sunken">
      <div className="aspect-[16/10] min-h-[20rem] w-full">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          /* nothing in this scene animates on its own — see rule 3 */
          frameloop="demand"
          camera={{
            fov: 38,
            near: 1,
            far: 3000,
            position: [initial.distance * 0.72, initial.height, initial.distance],
          }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <Scene
            home={home}
            sun={sun}
            theme={theme}
            selectedId={selectedId}
            onSelect={onSelect}
            houseRef={houseRef}
          />
          <OrbitControls
            ref={controls}
            makeDefault
            enableDamping
            dampingFactor={0.09}
            target={initial.target}
            minDistance={12}
            maxDistance={900}
            /* stop just short of level so the camera never drops below grade
               and looks up at the underside of the world */
            maxPolarAngle={Math.PI / 2 - 0.035}
          />
        </Canvas>
      </div>

      {/* ---------------------------------------------------------- overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3">
        <div className="rounded-md border aura-hairline bg-aura-panel/85 px-3 py-2 backdrop-blur">
          <p className="font-mono text-[0.6rem] uppercase tracking-label text-aura-emerald">
            {hourLabel(hour)} solar
          </p>
          <p className="mt-1 font-mono text-[0.65rem] tabular-nums text-aura-text/70">
            {sun.aboveHorizon
              ? `sun ${Math.round(sun.altitudeDeg)}° up, ${bearingWords(sun.azimuthDeg)}`
              : "sun below the horizon"}
          </p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={frame}
            data-cursor="Select"
            className="rounded-full border aura-hairline bg-aura-panel/85 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/70 backdrop-blur transition-colors hover:border-aura-teal hover:text-aura-text"
          >
            Frame the home
          </button>
        </div>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-center font-mono text-[0.6rem] uppercase tracking-label text-aura-text/45">
        Drag to orbit · scroll to zoom · click a volume to select it · north is away from you at the start
      </p>
    </div>
  );
}

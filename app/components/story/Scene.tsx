"use client";

import { useMemo, useRef, useState, useLayoutEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sparkles, Html, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { withBase } from "../../lib/basePath";

/* ------------------------------------------------------------------ */
/* One continuous camera journey (kage-inspired motion, ours in every  */
/* other way): a CatmullRom spline over real topography — start low    */
/* behind the ridge, crest it to reveal the home, descend, approach,   */
/* rise onto the deck, glide the glass walkway to the tub, settle.     */
/* Beats land exactly on even-indexed control points.                  */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const near = (prog: number, k: number, width = 0.85) => smoothstep(0, 1, clamp01(1 - Math.abs(prog - k) / width));

/* Deterministic terrain height — shared by the mesh, the props, and the rig. */
function terrainH(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const ridge =
    4.6 *
    Math.exp(-Math.pow(z - 25, 2) / (2 * 5.5 * 5.5)) *
    (1 - clamp01((Math.abs(x) - 16) / 24) * 0.75);
  const t = clamp01((r - 13) / 30);
  let roll =
    t *
    t *
    (Math.sin(x * 0.16 + 1.7) * Math.cos(z * 0.13 - 0.6) +
      0.5 * Math.sin(x * 0.31 - 2.2) * Math.sin(z * 0.27 + 1.1)) *
    1.5;
  roll *= 1 - clamp01(ridge / 1.2) * 0.85;
  return ridge + roll;
}

type Ctrl = { p: [number, number, number]; t: [number, number, number]; fov: number; ground?: number };

/* 13 control points; beats at even indices (hero=0 … end=12). `ground`
   means the y given is an eye-height offset above the terrain.
   The whole journey stays on the FRONT side of the home — the camera never
   crosses the building, so the spline can never clip the roof. */
const CTRL: Ctrl[] = [
  { p: [-2.0, 2.5, 31.5], t: [0.4, 4.7, 20.0], fov: 36, ground: 1 }, // 0 hero — low at the trailhead
  { p: [-0.8, 2.4, 27.5], t: [0.2, 4.9, 18.5], fov: 36, ground: 1 }, //   climbing
  { p: [0.6, 2.6, 23.5], t: [0.0, 1.6, 0.0], fov: 40, ground: 1 }, // 1 LAND — crest reveal
  { p: [-3.4, 2.2, 17.4], t: [0.0, 2.0, 0.8], fov: 41, ground: 1 }, //   descending past the pines
  { p: [-5.2, 2.0, 12.2], t: [0.5, 2.6, 1.8], fov: 41, ground: 1 }, // 2 DESIGN — front-left; lounge stays left-of-frame
  { p: [-1.0, 3.0, 12.6], t: [0.4, 1.9, 1.4], fov: 43, ground: 1 }, //   swinging across the lawn
  { p: [7.4, 5.6, 13.6], t: [0.0, 1.8, 1.6], fov: 44 }, // 3 BUDGET — elevated 3/4, whole property
  { p: [4.4, 2.2, 9.8], t: [0.6, 1.8, 4.4], fov: 42, ground: 1 }, //   coming down to the lawn
  { p: [0.8, 1.8, 8.3], t: [0.2, 2.0, 3.8], fov: 41, ground: 1 }, // 4 ESCROW — at the foot of the steps
  { p: [0.3, 2.35, 5.7], t: [4.6, 1.1, 5.3], fov: 42 }, //   up the steps, eyes on the walkway
  { p: [5.6, 2.0, 7.6], t: [0.6, 2.1, 2.8], fov: 42 }, // 5 BUILD — past the tub, looking back home
  { p: [7.4, 2.4, 9.4], t: [0.4, 2.2, 1.8], fov: 40 }, //   drifting out the northeast corner
  { p: [9.4, 4.3, 13.4], t: [0.2, 2.2, 1.2], fov: 37 }, // 6 END — settle, dusk
];

const REDUCED_SHOT = { p: [9.4, 4.3, 13.4], t: [0.2, 2.2, 1.2], fov: 38 } as const;

/* ------------------------------ assets ------------------------------ */

const MODELS = {
  cabin: withBase("/models/cabin.glb"),
  pines: withBase("/models/pines.glb"),
  pineTeal: withBase("/models/pine-teal.glb"),
  campfire: withBase("/models/campfire.glb"),
  rocks: withBase("/models/rocks.glb"),
  lantern: withBase("/models/lantern.glb"),
};

useGLTF.preload(MODELS.cabin);
useGLTF.preload(MODELS.pines);
useGLTF.preload(MODELS.pineTeal);
useGLTF.preload(MODELS.campfire);
useGLTF.preload(MODELS.rocks);
useGLTF.preload(MODELS.lantern);

function useNormalizedClones(
  src: THREE.Object3D,
  height: number,
  placements: { pos: [number, number, number]; rotY?: number; scale?: number }[],
  opts: { shadows?: boolean; ground?: boolean } = {}
) {
  const { shadows = true, ground = true } = opts;
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(src);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const k = height / (size.y || 1);
    return placements.map(({ pos, rotY = 0, scale = 1 }) => {
      const obj = src.clone(true);
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = shadows;
          o.receiveShadow = shadows;
        }
      });
      const g = new THREE.Group();
      obj.position.set(-center.x * k * scale, -box.min.y * k * scale, -center.z * k * scale);
      obj.scale.setScalar(k * scale);
      g.add(obj);
      const y = ground ? terrainH(pos[0], pos[2]) - 0.06 + pos[1] : pos[1];
      g.position.set(pos[0], y, pos[2]);
      g.rotation.y = rotY;
      return g;
    });
  }, [src, height, placements, shadows, ground]);
}

/* ----------------------------- materials ---------------------------- */

/** Big architectural glass — real transmission, used only on the gables. */
function useArchGlass() {
  return useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      transmission: 0.94,
      roughness: 0.06,
      ior: 1.5,
      thickness: 0.4,
      color: new THREE.Color("#e4f4ee"),
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    });
    return m;
  }, []);
}

/** Cheap glass — railings, walkway, deck panel. Transparent + reflective. */
function useCheapGlass() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        metalness: 0,
        color: new THREE.Color("#dcf5ec"),
        envMapIntensity: 1.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );
}

/* ----------------------------- terrain ------------------------------ */

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(160, 160, 152, 152);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(p.count * 3);
    const cA = new THREE.Color("#8db284");
    const cB = new THREE.Color("#a4c295");
    const cC = new THREE.Color("#b7c489");
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      p.setY(i, terrainH(x, z));
      const n1 = 0.5 + 0.5 * Math.sin(x * 0.23 + z * 0.17 + 1.2);
      const n2 = 0.5 + 0.5 * Math.sin(x * 0.61 - z * 0.43 + 4.0);
      tmp.copy(cA).lerp(cB, n1).lerp(cC, n2 * 0.25);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}

/* --------------------------- soft sprites --------------------------- */

function useSoftTexture(stops: [number, string][]) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [stops]);
}

/* Kept below bloom threshold so smoke never reads as a glowing orb. */
const SMOKE_STOPS: [number, string][] = [
  [0, "rgba(236,238,234,0.7)"],
  [0.45, "rgba(236,238,234,0.28)"],
  [1, "rgba(236,238,234,0)"],
];

function Smoke({
  origin,
  count = 7,
  rate = 0.16,
  size = 1,
  rise = 3.6,
  drift = 0.3,
  opacity = 0.5,
  frozen = false,
}: {
  origin: [number, number, number];
  count?: number;
  rate?: number;
  size?: number;
  rise?: number;
  drift?: number;
  opacity?: number;
  frozen?: boolean;
}) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const tex = useSoftTexture(SMOKE_STOPS);
  useFrame(({ clock }) => {
    if (frozen) return;
    const t = clock.elapsedTime;
    refs.current.forEach((s, i) => {
      if (!s) return;
      const life = (t * rate + i / count) % 1;
      s.position.set(
        origin[0] + Math.sin(t * 0.5 + i * 2.1) * drift * life * 2,
        origin[1] + life * rise,
        origin[2] + Math.cos(t * 0.4 + i * 1.3) * drift * life
      );
      const sc = size * (0.45 + life * 1.9);
      s.scale.set(sc, sc, 1);
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = opacity * clamp01(life / 0.12) * Math.pow(1 - life, 1.5);
    });
  });
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={origin}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={frozen ? 0 : 0.01} />
        </sprite>
      ))}
    </group>
  );
}

const MIST_STOPS: [number, string][] = [
  [0, "rgba(244,250,246,0.5)"],
  [0.6, "rgba(244,250,246,0.18)"],
  [1, "rgba(244,250,246,0)"],
];

const MIST: { pos: [number, number, number]; scale: number; speed: number }[] = [
  { pos: [-15, 1.4, -7], scale: 16, speed: 0.05 },
  { pos: [13, 1.0, -11], scale: 14, speed: 0.035 },
  { pos: [-6, 0.9, -17], scale: 18, speed: 0.045 },
  { pos: [10, 1.6, 8], scale: 12, speed: 0.03 },
  { pos: [-17, 1.2, 9], scale: 13, speed: 0.04 },
];

function Mist({ frozen = false }: { frozen?: boolean }) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const tex = useSoftTexture(MIST_STOPS);
  useFrame(({ clock }) => {
    if (frozen) return;
    const t = clock.elapsedTime;
    refs.current.forEach((s, i) => {
      if (!s) return;
      const m = MIST[i];
      s.position.x = m.pos[0] + Math.sin(t * m.speed * 2 + i * 1.8) * 2.4;
      s.position.y = m.pos[1] + Math.sin(t * m.speed + i) * 0.3;
    });
  });
  return (
    <group>
      {MIST.map((m, i) => (
        <sprite
          key={i}
          position={m.pos}
          scale={[m.scale, m.scale * 0.4, 1]}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.15} />
        </sprite>
      ))}
    </group>
  );
}

/* ------------------------- dusk-aware registry ---------------------- */
/* Materials/lights that warm up as the journey ends register here.     */

type DuskSink = (d: number) => void;

function useDuskRegistry() {
  return useMemo(() => {
    const sinks = new Set<DuskSink>();
    return {
      add: (s: DuskSink) => {
        sinks.add(s);
        return () => {
          sinks.delete(s);
        };
      },
      set: (d: number) => sinks.forEach((s) => s(d)),
    };
  }, []);
}
type Dusk = ReturnType<typeof useDuskRegistry>;

/* ------------------------------ the home ---------------------------- */

const RIDGE_H = 4.8;
const EAVE = 3.6;
const EAVE_H = 0.35;
const DEPTH = 3.0; // half depth
const ROOF_A = Math.atan2(EAVE, RIDGE_H - EAVE_H);
const SLOPE_L = Math.hypot(EAVE, RIDGE_H - EAVE_H);

function GableGlass({ z, mat }: { z: number; mat: THREE.Material }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([-EAVE, EAVE_H, 0, EAVE, EAVE_H, 0, 0, RIDGE_H, 0]);
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return <mesh geometry={geo} material={mat} position={[0, 0, z]} />;
}

function AFrameHome({ dusk, archGlass, cheapGlass }: { dusk: Dusk; archGlass: THREE.Material; cheapGlass: THREE.Material }) {
  const lamp = useRef<THREE.PointLight>(null);
  const pendant = useRef<THREE.MeshStandardMaterial>(null);
  useLayoutEffect(
    () =>
      dusk.add((d) => {
        if (lamp.current) lamp.current.intensity = 0.15 + d * 2.2;
        if (pendant.current) pendant.current.emissiveIntensity = 0.2 + d * 1.5;
      }),
    [dusk]
  );

  const mullion = "#20261f";
  const cedar = ["#a97e57", "#9b7350", "#b0855e"];

  return (
    <group>
      {/* floor slab on screw piles */}
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[7.5, 0.32, 6.4]} />
        <meshStandardMaterial color="#c6ccc4" roughness={0.9} flatShading />
      </mesh>
      {([[-3.2, -2.6], [3.2, -2.6], [-3.2, 2.6], [3.2, 2.6], [0, -2.6], [0, 2.6]] as [number, number][]).map(
        ([x, z], i) => (
          <mesh key={i} position={[x, 0.05, z]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.24, 8]} />
            <meshStandardMaterial color="#6c7370" roughness={0.7} metalness={0.3} flatShading />
          </mesh>
        )
      )}

      {/* roof panes — dark standing seam */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          castShadow
          receiveShadow
          position={[(s * EAVE) / 2, (RIDGE_H + EAVE_H) / 2, 0]}
          rotation={[0, 0, s * ROOF_A]}
        >
          <boxGeometry args={[0.16, SLOPE_L + 0.5, 6.9]} />
          <meshStandardMaterial color="#242a27" roughness={0.5} metalness={0.35} flatShading />
        </mesh>
      ))}
      {/* ridge cap */}
      <mesh castShadow position={[0, RIDGE_H + 0.06, 0]}>
        <boxGeometry args={[0.3, 0.12, 6.9]} />
        <meshStandardMaterial color="#1c211f" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* glass gables, front and back */}
      <GableGlass z={DEPTH} mat={archGlass} />
      <GableGlass z={-DEPTH} mat={archGlass} />

      {/* mullions + door, front */}
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} castShadow position={[x, (EAVE_H + RIDGE_H - (Math.abs(x) * (RIDGE_H - EAVE_H)) / EAVE) / 2, DEPTH]}>
          <boxGeometry args={[0.08, RIDGE_H - EAVE_H - (Math.abs(x) * (RIDGE_H - EAVE_H)) / EAVE, 0.1]} />
          <meshStandardMaterial color={mullion} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 2.5, DEPTH]}>
        <boxGeometry args={[4.6, 0.08, 0.1]} />
        <meshStandardMaterial color={mullion} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* door frame + handle */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} castShadow position={[x, 1.35, DEPTH + 0.02]}>
          <boxGeometry args={[0.09, 2.1, 0.12]} />
          <meshStandardMaterial color={mullion} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 2.36, DEPTH + 0.02]}>
        <boxGeometry args={[1.33, 0.09, 0.12]} />
        <meshStandardMaterial color={mullion} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0.42, 1.25, DEPTH + 0.06]}>
        <boxGeometry args={[0.05, 0.5, 0.05]} />
        <meshStandardMaterial color="#8f9a94" roughness={0.35} metalness={0.7} />
      </mesh>

      {/* interior — silhouettes of a life, lit warm at dusk */}
      <mesh position={[-1.5, 0.56, -1.2]} castShadow>
        <boxGeometry args={[1.9, 0.36, 1.5]} />
        <meshStandardMaterial color="#e8e2d4" roughness={0.95} />
      </mesh>
      <mesh position={[-2.6, 0.75, 0.9]} castShadow>
        <boxGeometry args={[0.9, 0.74, 1.9]} />
        <meshStandardMaterial color="#4c4038" roughness={0.9} />
      </mesh>
      {/* wood stove + a real chimney: double-wall flue, storm collar, rain cap,
          topping out above the ridge (not a bare rod poking the roof) */}
      <mesh position={[0.9, 0.78, -2.2]} castShadow>
        <cylinderGeometry args={[0.24, 0.26, 0.85, 10]} />
        <meshStandardMaterial color="#20211f" roughness={0.6} metalness={0.3} flatShading />
      </mesh>
      <mesh position={[0.9, 3.15, -2.2]} castShadow>
        <cylinderGeometry args={[0.085, 0.085, 3.8, 10]} />
        <meshStandardMaterial color="#2e3230" roughness={0.45} metalness={0.6} />
      </mesh>
      {/* storm collar at the roof penetration */}
      <mesh position={[0.9, 3.72, -2.2]}>
        <cylinderGeometry args={[0.1, 0.2, 0.16, 10]} />
        <meshStandardMaterial color="#232725" roughness={0.5} metalness={0.55} />
      </mesh>
      {/* rain cap */}
      <mesh position={[0.9, 5.08, -2.2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 10]} />
        <meshStandardMaterial color="#232725" roughness={0.5} metalness={0.55} />
      </mesh>
      <mesh position={[0.9, 5.16, -2.2]}>
        <coneGeometry args={[0.17, 0.12, 10]} />
        <meshStandardMaterial color="#2e3230" roughness={0.45} metalness={0.6} />
      </mesh>
      <pointLight ref={lamp} position={[0, 2.5, -0.4]} color="#ffc98a" intensity={0.2} distance={10} decay={2} />
      <mesh position={[0, 3.0, -0.4]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial ref={pendant} color="#fff3da" emissive="#ffd9a0" emissiveIntensity={0.3} />
      </mesh>

      {/* solar array on the east pane */}
      <group position={[EAVE / 2, (RIDGE_H + EAVE_H) / 2, 0]} rotation={[0, 0, ROOF_A]}>
        <mesh position={[0.16, 0.1, 0]} castShadow>
          <boxGeometry args={[0.07, 2.6, 3.6]} />
          <meshStandardMaterial color="#16233c" roughness={0.25} metalness={0.65} />
        </mesh>
      </group>
    </group>
  );
}

/* ----------------------- deck, walkway, hot tub --------------------- */

function GlassRailRun({
  from,
  to,
  h = 0.98,
  base = 0.5,
  mat,
}: {
  from: [number, number];
  to: [number, number];
  h?: number;
  base?: number;
  mat: THREE.Material;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  return (
    <group position={[cx, base, cz]} rotation={[0, ang, 0]}>
      <mesh material={mat} position={[0, h / 2, 0]}>
        <boxGeometry args={[0.05, h, len]} />
      </mesh>
      <mesh position={[0, h + 0.03, 0]} castShadow>
        <boxGeometry args={[0.07, 0.06, len + 0.05]} />
        <meshStandardMaterial color="#5d6663" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

function Deck({ cheapGlass }: { cheapGlass: THREE.Material }) {
  const cedar = ["#a97e57", "#9b7350", "#b0855e"];
  const planks = [];
  for (let i = 0; i < 6; i++) {
    const z = 3.25 + i * 0.47;
    planks.push(
      <mesh key={i} castShadow receiveShadow position={[-1.15, 0.44, z]}>
        <boxGeometry args={[4.9, 0.09, 0.43]} />
        <meshStandardMaterial color={cedar[i % 3]} roughness={0.85} flatShading />
      </mesh>
    );
  }
  return (
    <group>
      {planks}
      {/* rim joist + skirt so the deck reads built, not floating lumber */}
      <mesh castShadow receiveShadow position={[-1.15, 0.29, 4.43]}>
        <boxGeometry args={[4.72, 0.24, 2.62]} />
        <meshStandardMaterial color="#6d523c" roughness={0.9} flatShading />
      </mesh>
      {([[-3.35, 3.35], [0.95, 3.35], [-3.35, 5.6], [0.95, 5.6]] as [number, number][]).map(([x, z], i) => (
        <mesh key={`dp${i}`} castShadow position={[x, 0.14, z]}>
          <cylinderGeometry args={[0.07, 0.09, 0.3, 8]} />
          <meshStandardMaterial color="#5a4632" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* glass-floored section, east side, feeding the walkway */}
      <mesh material={cheapGlass} position={[2.4, 0.44, 4.6]}>
        <boxGeometry args={[2.1, 0.08, 2.85]} />
      </mesh>
      {/* frame under glass */}
      <mesh castShadow position={[2.4, 0.38, 4.6]}>
        <boxGeometry args={[2.2, 0.06, 2.95]} />
        <meshStandardMaterial color="#5d6663" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* glass railings: front edge with a gap for the steps, west edge */}
      <GlassRailRun from={[-3.6, 6.05]} to={[-1.1, 6.05]} mat={cheapGlass} />
      <GlassRailRun from={[1.2, 6.05]} to={[3.45, 6.05]} mat={cheapGlass} />
      <GlassRailRun from={[-3.6, 3.15]} to={[-3.6, 6.05]} mat={cheapGlass} />
      {/* steps to the meadow */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow receiveShadow position={[0.05, 0.34 - i * 0.13, 6.35 + i * 0.34]}>
          <boxGeometry args={[2.1, 0.1, 0.34]} />
          <meshStandardMaterial color={cedar[i % 3]} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Walkway({ cheapGlass }: { cheapGlass: THREE.Material }) {
  // deck east edge (3.45, 4.6) -> tub platform (5.9, 5.4)
  const from: [number, number] = [3.45, 4.65];
  const to: [number, number] = [5.9, 5.35];
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ang = Math.atan2(to[0] - from[0], to[1] - from[1]);
  return (
    <group>
      <group position={[cx, 0.42, cz]} rotation={[0, ang, 0]}>
        <mesh material={cheapGlass} position={[0, 0, 0]}>
          <boxGeometry args={[1.0, 0.07, len + 0.4]} />
        </mesh>
        <mesh castShadow position={[0, -0.06, 0]}>
          <boxGeometry args={[1.08, 0.05, len + 0.5]} />
          <meshStandardMaterial color="#5d6663" roughness={0.5} metalness={0.5} />
        </mesh>
      </group>
      {/* stone piers grounding the walkway */}
      {([[4.25, 4.88], [5.1, 5.11]] as [number, number][]).map(([x, z], i) => (
        <mesh key={`wp${i}`} castShadow position={[x, 0.18, z]}>
          <cylinderGeometry args={[0.11, 0.15, 0.4, 8]} />
          <meshStandardMaterial color="#848c85" roughness={0.95} flatShading />
        </mesh>
      ))}
      <GlassRailRun from={[from[0] - 0.35, from[1] + 0.42]} to={[to[0] - 0.35, to[1] + 0.42]} h={0.62} base={0.45} mat={cheapGlass} />
      <GlassRailRun from={[from[0] + 0.38, from[1] - 0.48]} to={[to[0] + 0.38, to[1] - 0.48]} h={0.62} base={0.45} mat={cheapGlass} />
    </group>
  );
}

function HotTub({ position, dusk }: { position: [number, number, number]; dusk: Dusk }) {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useLayoutEffect(
    () =>
      dusk.add((d) => {
        if (water.current) water.current.emissiveIntensity = 0.15 + d * 0.45;
      }),
    [dusk]
  );
  return (
    <group position={position}>
      {/* stone pad */}
      <mesh receiveShadow castShadow position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.55, 1.7, 0.22, 12]} />
        <meshStandardMaterial color="#8d968f" roughness={0.95} flatShading />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.78, 0.72, 0.84, 14, 1, true]} />
        <meshStandardMaterial color="#8a5a3a" roughness={0.9} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.76, 0.05, 8, 14]} />
        <meshStandardMaterial color="#6d4429" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 14]} />
        <meshStandardMaterial ref={water} color="#1d8f86" roughness={0.12} metalness={0.1} emissive="#14655e" emissiveIntensity={0.2} />
      </mesh>
      <mesh castShadow position={[0.95, 0.75, -0.12]}>
        <cylinderGeometry args={[0.14, 0.14, 0.7, 10]} />
        <meshStandardMaterial color="#565c58" roughness={0.6} metalness={0.5} flatShading />
      </mesh>
      <mesh castShadow position={[0.95, 1.45, -0.12]}>
        <cylinderGeometry args={[0.045, 0.045, 0.8, 8]} />
        <meshStandardMaterial color="#9aa19c" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  );
}

/* -------------------- fire pit, chairs, string lights ---------------- */

function LoungeChair({ position, rotY, cushion = "#e8e2d4" }: { position: [number, number, number]; rotY: number; cushion?: string }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* seat */}
      <mesh castShadow position={[0, 0.32, 0.02]} rotation={[-0.1, 0, 0]}>
        <boxGeometry args={[0.62, 0.07, 0.6]} />
        <meshStandardMaterial color="#9b7350" roughness={0.85} flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.37, 0.04]} rotation={[-0.1, 0, 0]}>
        <boxGeometry args={[0.54, 0.05, 0.52]} />
        <meshStandardMaterial color={cushion} roughness={0.95} />
      </mesh>
      {/* back, held by the arms so it reads as one chair from every angle */}
      <mesh castShadow position={[0, 0.64, -0.31]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.62, 0.68, 0.07]} />
        <meshStandardMaterial color="#a97e57" roughness={0.85} flatShading />
      </mesh>
      {/* armrests */}
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} castShadow position={[x, 0.5, -0.02]}>
          <boxGeometry args={[0.08, 0.05, 0.66]} />
          <meshStandardMaterial color="#8a6647" roughness={0.85} flatShading />
        </mesh>
      ))}
      {([[-0.31, 0.24], [0.31, 0.24], [-0.31, -0.28], [0.31, -0.28]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.24, z]}>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial color="#6d4429" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function FirePit({ dusk }: { dusk: Dusk }) {
  const fire = useGLTF(MODELS.campfire);
  const clones = useNormalizedClones(
    fire.scene,
    0.75,
    useMemo(() => [{ pos: [-4.6, 0, 6.2] as [number, number, number], rotY: 0.5 }], [])
  );
  const light = useRef<THREE.PointLight>(null);
  useLayoutEffect(
    () =>
      dusk.add((d) => {
        if (light.current) light.current.intensity = 0.8 + d * 1.8;
      }),
    [dusk]
  );
  useFrame(({ clock }) => {
    if (light.current) {
      const t = clock.elapsedTime;
      light.current.intensity *= 1 + Math.sin(t * 9.3) * 0.045 + Math.sin(t * 23.7) * 0.03;
    }
  });
  return (
    <group>
      <primitive object={clones[0]} />
      {/* stone ring */}
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={i} castShadow position={[-4.6 + Math.cos(a) * 0.85, 0.12, 6.2 + Math.sin(a) * 0.85]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.34, 0.24, 0.22]} />
            <meshStandardMaterial color="#7f8781" roughness={0.95} flatShading />
          </mesh>
        );
      })}
      <pointLight ref={light} position={[-4.6, 1.0, 6.2]} color="#ffb46b" intensity={1.2} distance={7} decay={2} />
      <LoungeChair position={[-6.35, 0, 5.9]} rotY={1.4} />
      <LoungeChair position={[-5.1, 0, 7.95]} rotY={2.86} cushion="#cfe4dc" />
      <LoungeChair position={[-3.05, 0, 7.0]} rotY={-2.05} />
      {/* log side table */}
      <mesh castShadow position={[-3.7, 0.19, 5.35]}>
        <cylinderGeometry args={[0.22, 0.24, 0.38, 9]} />
        <meshStandardMaterial color="#8a6647" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

/** Catenary string lights: sagging wire + warm bulbs that rise at dusk. */
function StringLights({ points, dusk }: { points: [number, number, number][]; dusk: Dusk }) {
  const { wire, bulbs } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = new THREE.Vector3(...points[i]);
      const b = new THREE.Vector3(...points[i + 1]);
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= a.distanceTo(b) * 0.12;
      if (i === 0) pts.push(a);
      pts.push(mid, b);
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.6);
    const wire = new THREE.TubeGeometry(curve, 64, 0.013, 4, false);
    const L = curve.getLength();
    const n = Math.floor(L / 0.55);
    const bulbs: THREE.Vector3[] = [];
    for (let i = 1; i < n; i++) {
      const p = curve.getPointAt(i / n);
      p.y -= 0.06;
      bulbs.push(p);
    }
    return { wire, bulbs };
  }, [points]);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#efe6d2", emissive: "#ffcf8a", emissiveIntensity: 0.03, roughness: 0.4 }),
    []
  );
  useLayoutEffect(
    () =>
      dusk.add((d) => {
        /* bulbs are OFF in daylight and come up with the dusk */
        mat.emissiveIntensity = 0.03 + d * 1.7;
      }),
    [dusk, mat]
  );
  return (
    <group>
      <mesh geometry={wire}>
        <meshStandardMaterial color="#2c2f2d" roughness={0.7} />
      </mesh>
      {bulbs.map((p, i) => (
        <mesh key={i} position={p} material={mat}>
          <sphereGeometry args={[0.034, 8, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function LightPole({ position }: { position: [number, number, number] }) {
  return (
    <mesh castShadow position={[position[0], position[1] / 2, position[2]]}>
      <cylinderGeometry args={[0.035, 0.055, position[1], 7]} />
      <meshStandardMaterial color="#4c4038" roughness={0.9} flatShading />
    </mesh>
  );
}

/* --------------------------- crest bench ---------------------------- */

function Bench({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {[0, 1].map((i) => (
        <mesh key={i} castShadow position={[0, 0.4, -0.09 + i * 0.2]}>
          <boxGeometry args={[1.4, 0.06, 0.16]} />
          <meshStandardMaterial color="#a97e57" roughness={0.85} flatShading />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={i} castShadow position={[0, 0.62 + i * 0.18, -0.3 - i * 0.05]} rotation={[0.24, 0, 0]}>
          <boxGeometry args={[1.4, 0.12, 0.05]} />
          <meshStandardMaterial color="#9b7350" roughness={0.85} flatShading />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} castShadow position={[x, 0.19, -0.05]}>
          <boxGeometry args={[0.08, 0.38, 0.34]} />
          <meshStandardMaterial color="#6d4429" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Stepping stones tracing the walked route: trailhead -> crest -> steps. */
const PATH_STONES: [number, number][] = [
  [-2.4, 33.0], [-2.1, 31.2], [-1.6, 29.2], [-0.6, 27.4], [0.3, 25.6], [0.9, 23.8], [0.6, 21.8],
  [-0.4, 19.6], [-1.4, 17.2], [-2.0, 14.8], [-1.9, 12.4], [-1.3, 10.4],
  [-0.5, 8.9], [0.1, 7.7],
];

/** Grass tufts dressing the trailhead meadow before the crest. */
const TUFTS: [number, number][] = [
  [-3.6, 32.2], [-1.1, 31.6], [0.8, 30.4], [-4.2, 29.8], [2.2, 29.0], [-2.8, 27.6],
  [1.6, 26.6], [-0.6, 25.2], [3.4, 27.8], [-5.4, 31.0], [4.2, 31.4], [1.2, 33.0],
  [-6.2, 27.2], [5.8, 28.6], [-3.2, 25.0], [2.8, 24.2],
  [-1.8, 33.6], [0.2, 32.4], [-4.8, 33.0], [3.0, 32.6], [-0.2, 29.2], [1.9, 31.8],
  [-2.6, 30.6], [4.8, 30.0], [-6.8, 29.6], [0.9, 28.0], [-1.6, 26.4], [2.6, 25.4],
];

/** Wildflower clusters — quiet color, trail-side only. */
const FLOWERS: { pos: [number, number]; tint: string }[] = [
  { pos: [-1.5, 32.6], tint: "#f3f0e2" },
  { pos: [0.9, 31.2], tint: "#ffd98a" },
  { pos: [-3.4, 30.9], tint: "#c9b8ee" },
  { pos: [1.8, 28.4], tint: "#f3f0e2" },
  { pos: [-1.0, 27.0], tint: "#ffd98a" },
  { pos: [-4.6, 28.4], tint: "#f3f0e2" },
  { pos: [2.6, 30.8], tint: "#c9b8ee" },
  { pos: [0.3, 33.4], tint: "#ffd98a" },
];

/** Small boulders framing the first steps of the trail. */
const TRAIL_ROCKS: { pos: [number, number]; s: number }[] = [
  { pos: [-3.3, 31.9], s: 0.32 },
  { pos: [1.7, 32.7], s: 0.24 },
  { pos: [-0.9, 29.6], s: 0.2 },
  { pos: [3.6, 29.4], s: 0.36 },
  { pos: [-5.2, 29.0], s: 0.28 },
];

function Trailhead() {
  return (
    <group>
      {TUFTS.map(([x, z], i) => (
        <group key={i} position={[x, terrainH(x, z) - 0.02, z]} rotation={[0, i * 2.1, 0]}>
          {[0, 1, 2, 3, 4].map((j) => (
            <mesh key={j} position={[(j - 2) * 0.11, 0.2, ((j * 7) % 3) * 0.08]} rotation={[0, j * 1.2, (j - 2) * 0.18]}>
              <coneGeometry args={[0.07, 0.42 + (j % 3) * 0.14, 4]} />
              <meshStandardMaterial color={["#7ba368", "#a8c77e", "#8fb573"][j % 3]} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {FLOWERS.map(({ pos: [x, z], tint }, i) => (
        <group key={`f${i}`} position={[x, terrainH(x, z) - 0.02, z]} rotation={[0, i * 1.9, 0]}>
          {[0, 1, 2].map((j) => {
            const h = 0.16 + (((i * 5 + j * 3) % 4) * 0.045);
            return (
              <group
                key={j}
                position={[
                  (j - 1) * 0.14 + Math.sin(i * 2.7 + j * 4.1) * 0.07,
                  0,
                  Math.cos(i * 1.9 + j * 2.3) * 0.11,
                ]}
                rotation={[Math.sin(i + j) * 0.14, 0, Math.cos(i * 2 + j) * 0.14]}
              >
                <mesh position={[0, h / 2, 0]}>
                  <cylinderGeometry args={[0.007, 0.011, h, 4]} />
                  <meshStandardMaterial color="#6f9c5e" roughness={1} />
                </mesh>
                <mesh position={[0, h + 0.02, 0]}>
                  <sphereGeometry args={[0.024 + ((i + j) % 2) * 0.007, 6, 5]} />
                  <meshStandardMaterial color={tint} roughness={0.9} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      {TRAIL_ROCKS.map(({ pos: [x, z], s }, i) => (
        <mesh key={`tr${i}`} castShadow receiveShadow position={[x, terrainH(x, z) + s * 0.28, z]} rotation={[0, i * 2.3, 0]}>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#8f9890" roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* trail sign */}
      <group position={[-3.1, terrainH(-3.1, 30.6), 30.6]} rotation={[0, 0.5, 0]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.045, 0.055, 1.0, 6]} />
          <meshStandardMaterial color="#6d5844" roughness={0.9} flatShading />
        </mesh>
        <mesh castShadow position={[0.14, 0.86, 0]} rotation={[0, 0, -0.04]}>
          <boxGeometry args={[0.52, 0.16, 0.04]} />
          <meshStandardMaterial color="#8a7358" roughness={0.9} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Split-rail fence along the parcel's front line, gap at the trail gate. */
function Fence() {
  const posts: [number, number][] = [];
  for (let x = -10.5; x <= 10.6; x += 2.1) {
    if (x > -1.6 && x < 1.6) continue; // gate gap where the path crosses
    posts.push([x, 8.5]);
  }
  const rails: { a: [number, number]; b: [number, number] }[] = [];
  for (let i = 0; i < posts.length - 1; i++) {
    const [ax] = posts[i];
    const [bx] = posts[i + 1];
    if (bx - ax > 2.2) continue; // skip the gate span
    rails.push({ a: posts[i], b: posts[i + 1] });
  }
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={`p${i}`} castShadow position={[x, terrainH(x, z) + 0.42, z]}>
          <boxGeometry args={[0.11, 0.9, 0.11]} />
          <meshStandardMaterial color="#84735e" roughness={0.95} flatShading />
        </mesh>
      ))}
      {rails.map(({ a, b }, i) => {
        const ya = terrainH(a[0], a[1]);
        const yb = terrainH(b[0], b[1]);
        return [0.3, 0.62].map((h, j) => {
          const cx = (a[0] + b[0]) / 2;
          const cy = (ya + yb) / 2 + h;
          const len = Math.hypot(b[0] - a[0], yb - ya);
          const tilt = Math.atan2(yb - ya, b[0] - a[0]);
          return (
            <mesh key={`r${i}-${j}`} castShadow position={[cx, cy, a[1]]} rotation={[0, 0, tilt]}>
              <boxGeometry args={[len + 0.15, 0.07, 0.07]} />
              <meshStandardMaterial color="#8d7c66" roughness={0.95} flatShading />
            </mesh>
          );
        });
      })}
    </group>
  );
}

function PathStones() {
  return (
    <group>
      {PATH_STONES.map(([x, z], i) => {
        const r = 0.22 + ((i * 7) % 3) * 0.04;
        return (
          <mesh
            key={i}
            receiveShadow
            castShadow
            position={[x + Math.sin(i * 3.7) * 0.15, terrainH(x, z) - 0.03, z]}
            rotation={[0, i * 1.3, 0]}
          >
            <cylinderGeometry args={[r, r + 0.05, 0.14, 7]} />
            <meshStandardMaterial color="#9aa39b" roughness={0.95} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

/* --------------------------- beat props ----------------------------- */

function BeatProps({ progressRef, reduced }: { progressRef: React.MutableRefObject<number>; reduced: boolean }) {
  const parcelMat = useRef<THREE.LineBasicMaterial>(null);
  const stakes = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Group>(null);

  const parcelGeo = useMemo(() => {
    const w = 10.5, d = 8.5, y = 0.09;
    const pts = [
      new THREE.Vector3(-w, y, -d), new THREE.Vector3(w, y, -d),
      new THREE.Vector3(w, y, -d), new THREE.Vector3(w, y, d),
      new THREE.Vector3(w, y, d), new THREE.Vector3(-w, y, d),
      new THREE.Vector3(-w, y, d), new THREE.Vector3(-w, y, -d),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useFrame(() => {
    if (reduced) return;
    const p = progressRef.current;
    const land = near(p, 1);
    const design = near(p, 2);
    if (parcelMat.current) parcelMat.current.opacity = land * 0.85;
    if (stakes.current) stakes.current.visible = land > 0.02;
    if (ringMat.current) ringMat.current.opacity = design * 0.8;
    if (ring.current) {
      ring.current.visible = design > 0.02;
      const s = 0.92 + 0.08 * easeOutCubic(design);
      ring.current.scale.set(s, 1, s);
    }
  });

  return (
    <group>
      <lineSegments geometry={parcelGeo}>
        <lineBasicMaterial ref={parcelMat} color="#84b32c" transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <group ref={stakes} visible={false}>
        {([[-10.5, -8.5], [10.5, -8.5], [10.5, 8.5], [-10.5, 8.5]] as [number, number][]).map(([x, z], i) => (
          <mesh key={i} position={[x, terrainH(x, z) + 0.3, z]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.6, 6]} />
            <meshStandardMaterial color="#84b32c" roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>
      <group ref={ring} visible={false}>
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[7.0, 7.18, 80]} />
          <meshBasicMaterial ref={ringMat} color="#10b981" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------ forest ------------------------------ */

const PATCHES: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [-23, 0, -14], rotY: 0.3, scale: 1.3 },
  { pos: [20, 0, -18], rotY: 1.2, scale: 1.35 },
  { pos: [-11, 0, -24], rotY: 2.1, scale: 1.5 },
  { pos: [28, 0, -8], rotY: 0.6, scale: 1.25 },
  { pos: [-31, 0, -4], rotY: 2.8, scale: 1.4 },
  { pos: [4, 0, -26], rotY: 5.0, scale: 1.6 },
  { pos: [30, 0, -24], rotY: 3.4, scale: 1.8 },
  { pos: [-33, 0, -20], rotY: 1.7, scale: 1.85 },
  { pos: [-26, 0, 16], rotY: 0.9, scale: 1.1 },
  { pos: [30, 0, 14], rotY: 5.6, scale: 1.15 },
  { pos: [-17, 0, -33], rotY: 4.1, scale: 1.9 },
  { pos: [15, 0, -34], rotY: 0.2, scale: 2.0 },
  { pos: [-13, 0, 27], rotY: 2.4, scale: 1.05 },
  { pos: [15, 0, 28], rotY: 3.9, scale: 1.1 },
  { pos: [-9, 0, 33], rotY: 1.4, scale: 1.0 },
  { pos: [10, 0, 34], rotY: 4.6, scale: 0.95 },
];

const TEAL_PINES: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [-10.5, 0, -5], rotY: 0.4, scale: 1.0 },
  { pos: [9.5, 0, -4.5], rotY: 1.9, scale: 0.9 },
  { pos: [-13.5, 0, 5.5], rotY: 3.1, scale: 1.1 },
  { pos: [5, 0, -10], rotY: 2.2, scale: 1.05 },
  { pos: [-5.5, 0, -11.5], rotY: 4.4, scale: 0.9 },
  { pos: [14.5, 0, -10], rotY: 5.1, scale: 1.2 },
  { pos: [12.5, 0, 15.5], rotY: 1.1, scale: 0.85 },
  { pos: [-11.5, 0, 17.5], rotY: 4.9, scale: 0.9 },
  { pos: [-6.5, 0, 24.5], rotY: 2.6, scale: 0.8 },
  { pos: [9.0, 0, 25.5], rotY: 5.7, scale: 0.75 },
  { pos: [-5.0, 0, 28.5], rotY: 1.3, scale: 0.85 },
  { pos: [6.0, 0, 29.5], rotY: 3.8, scale: 0.7 },
];

const ROCKS: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [3.8, 0, 8.6], rotY: 0.7, scale: 0.45 },
  { pos: [-6.4, 0, 3.4], rotY: 2.4, scale: 0.32 },
  { pos: [7.6, 0, -2.6], rotY: 1.1, scale: 0.6 },
  { pos: [-8.6, 0, -6.2], rotY: 3.8, scale: 0.85 },
  { pos: [2.1, 0, -6.6], rotY: 5.2, scale: 0.4 },
  { pos: [-2.9, 0, 9.8], rotY: 0.2, scale: 0.24 },
  { pos: [4.6, 0, 11.8], rotY: 1.6, scale: 0.4 },
];

/* Garden lanterns at the places a person would put them: flanking the
   steps, at the gate, by the tub, and one at the trail sign. */
const LANTERNS: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [1.15, 0, 7.15], rotY: 0.4, scale: 1 },
  { pos: [-1.05, 0, 7.05], rotY: 2.2, scale: 1 },
  { pos: [1.35, 0, 8.75], rotY: 1.1, scale: 1 },
  { pos: [4.75, 0, 6.9], rotY: 5.2, scale: 1 },
  { pos: [-2.65, 0, 30.15], rotY: 2.8, scale: 1 },
];

function Forest({ frozen }: { frozen: boolean }) {
  const pines = useGLTF(MODELS.pines);
  const teal = useGLTF(MODELS.pineTeal);
  const rocks = useGLTF(MODELS.rocks);
  const sway = useRef<THREE.Group[]>([]);

  useLayoutEffect(() => {
    pines.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.name === "Green") mat.color.set("#3f7048");
        if (mat.name === "Wood") mat.color.set("#5d4030");
      }
    });
    rocks.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).color.set("#828d84");
    });
  }, [pines.scene, rocks.scene]);

  const patchClones = useNormalizedClones(pines.scene, 5.2, PATCHES);
  const tealClones = useNormalizedClones(teal.scene, 4.3, TEAL_PINES);
  const rockClones = useNormalizedClones(rocks.scene, 1.4, ROCKS);

  useFrame(({ clock }) => {
    if (frozen) return;
    const t = clock.elapsedTime;
    sway.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.z = Math.sin(t * 0.4 + i * 1.7) * 0.006;
      g.rotation.x = Math.cos(t * 0.33 + i * 2.3) * 0.005;
    });
  });

  return (
    <group>
      {patchClones.map((g, i) => (
        <group
          key={`p${i}`}
          ref={(el) => {
            if (el) sway.current[i] = el;
          }}
        >
          <primitive object={g} />
        </group>
      ))}
      {tealClones.map((g, i) => (
        <group
          key={`t${i}`}
          ref={(el) => {
            if (el) sway.current[PATCHES.length + i] = el;
          }}
        >
          <primitive object={g} />
        </group>
      ))}
      {rockClones.map((g, i) => (
        <primitive key={`r${i}`} object={g} />
      ))}
    </group>
  );
}

function Props({ dusk }: { dusk: Dusk }) {
  const cabin = useGLTF(MODELS.cabin);
  const lantern = useGLTF(MODELS.lantern);
  const glowTex = useSoftTexture(
    useMemo<[number, string][]>(
      () => [
        [0, "rgba(255,205,130,0.9)"],
        [0.5, "rgba(255,205,130,0.25)"],
        [1, "rgba(255,205,130,0)"],
      ],
      []
    )
  );
  const glows = useRef<(THREE.SpriteMaterial | null)[]>([]);
  useLayoutEffect(
    () =>
      dusk.add((d) => {
        glows.current.forEach((m) => {
          if (m) m.opacity = 0.04 + d * 0.28;
        });
      }),
    [dusk]
  );

  // The old log cabin lives on at the forest edge — depth and a story.
  const cabinClones = useNormalizedClones(
    cabin.scene,
    2.9,
    useMemo(() => [{ pos: [-17.5, 0, 10.5] as [number, number, number], rotY: 1.9, scale: 1 }], [])
  );
  const lanternClones = useNormalizedClones(lantern.scene, 0.38, LANTERNS);

  return (
    <group>
      <primitive object={cabinClones[0]} />
      {lanternClones.map((g, i) => (
        <group key={i}>
          <primitive object={g} />
          <sprite position={[g.position.x, g.position.y + 0.24, g.position.z]} scale={[0.5, 0.5, 1]}>
            <spriteMaterial
              ref={(el) => {
                glows.current[i] = el;
              }}
              map={glowTex}
              transparent
              depthWrite={false}
              opacity={0.06}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------ hotspots ---------------------------- */

const HOTSPOTS = [
  {
    id: "glass",
    pos: [0, 2.7, 3.15] as [number, number, number],
    label: "Glass gable",
    spec: "Triple-glazed units on the south face — passive gain, zone 7A honest.",
  },
  {
    id: "solar",
    pos: [2.7, 3.4, 0] as [number, number, number],
    label: "Solar array",
    spec: "6.4 kW roof array with battery. December needs the wood stove — published, not hidden.",
  },
  {
    id: "tub",
    pos: [5.9, 1.5, 5.4] as [number, number, number],
    label: "Wood-fired tub",
    spec: "Cedar tub, wood-fired — no grid draw, snow optional.",
  },
];

function Hotspots() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <group>
      {HOTSPOTS.map((h) => (
        <Html key={h.id} position={h.pos} center occlude zIndexRange={[2, 2]}>
          <div className={`story-hotspot ${active === h.id ? "on" : ""}`}>
            <button
              type="button"
              aria-label={h.label}
              onClick={() => setActive(active === h.id ? null : h.id)}
            >
              <i />
            </button>
            <div className="story-hotspot-chip" role="status">
              <strong>{h.label}</strong>
              <span>{h.spec}</span>
            </div>
          </div>
        </Html>
      ))}
    </group>
  );
}

/* ------------------------------- rig -------------------------------- */

function CameraRig({ progressRef, reduced }: { progressRef: React.MutableRefObject<number>; reduced: boolean }) {
  const { camera } = useThree();
  const rig = useRef({ smooth: 0, mx: 0, my: 0, started: -1, lastDusk: -1 });
  const curves = useMemo(() => {
    const P = new THREE.CatmullRomCurve3(
      CTRL.map((c) => new THREE.Vector3(c.p[0], c.ground ? terrainH(c.p[0], c.p[2]) + c.p[1] : c.p[1], c.p[2])),
      false,
      "catmullrom",
      0.38
    );
    const T = new THREE.CatmullRomCurve3(CTRL.map((c) => new THREE.Vector3(...c.t)), false, "catmullrom", 0.38);
    return { P, T };
  }, []);
  const _p = useMemo(() => new THREE.Vector3(), []);
  const _t = useMemo(() => new THREE.Vector3(), []);
  const _d = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    if (reduced) {
      camera.position.set(...REDUCED_SHOT.p);
      camera.lookAt(new THREE.Vector3(...REDUCED_SHOT.t));
      (camera as THREE.PerspectiveCamera).fov = REDUCED_SHOT.fov;
      camera.updateProjectionMatrix();
      document.documentElement.style.setProperty("--st-dusk", "1");
    }
  }, [camera, reduced]);

  useFrame((state, dt) => {
    if (reduced) return;
    const r = rig.current;
    const d = Math.min(dt, 1 / 20);
    r.smooth = THREE.MathUtils.damp(r.smooth, progressRef.current, 5, d);
    r.mx = THREE.MathUtils.damp(r.mx, state.pointer.x, 3, d);
    r.my = THREE.MathUtils.damp(r.my, state.pointer.y, 3, d);
    if (r.started < 0) r.started = state.clock.elapsedTime;
    const intro = easeOutCubic(clamp01((state.clock.elapsedTime - r.started) / 2.2));

    const N = 6; // beats 0..6
    const u = clamp01(r.smooth / N);
    curves.P.getPoint(u, _p);
    curves.T.getPoint(u, _t);
    // fov follows the even-indexed beat controls
    const fi = Math.min(Math.floor(r.smooth), N - 1);
    const ff = clamp01(r.smooth - fi);
    let fov = THREE.MathUtils.lerp(CTRL[fi * 2].fov, CTRL[Math.min(fi + 1, N) * 2].fov, ff);

    // Tall-frame fix: step back along the view axis and open the lens.
    const aspect = state.size.width / state.size.height;
    const nf = clamp01((1.55 - aspect) / 1.0);
    if (nf > 0) {
      _d.subVectors(_p, _t).normalize();
      _p.addScaledVector(_d, nf * 5.5);
      _p.y += nf * 0.8;
      fov *= 1 + nf * 0.32;
    }

    // Opening dolly.
    const io = 1 - intro;
    _p.z += io * 4.2;
    _p.y += io * 0.5;
    fov += io * 6;

    // Pointer parallax — hand-held, fading deeper into the journey.
    const par = 1 - clamp01(r.smooth / 1.6) * 0.5;
    _p.x += r.mx * 0.5 * par;
    _p.y += r.my * 0.28 * par;
    _t.x -= r.mx * 0.16 * par;
    _t.y -= r.my * 0.09 * par;

    // Never sink into the terrain.
    const minY = terrainH(_p.x, _p.z) + 0.7;
    if (_p.y < minY) _p.y = minY;

    camera.position.copy(_p);
    camera.lookAt(_t);
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - fov) > 1e-4) {
      pc.fov = fov;
      pc.updateProjectionMatrix();
    }

    // Publish dusk to the DOM sky (throttled).
    const dusk = smoothstep(4.0, 6.0, r.smooth);
    if (Math.abs(dusk - r.lastDusk) > 0.01) {
      r.lastDusk = dusk;
      document.documentElement.style.setProperty("--st-dusk", dusk.toFixed(3));
    }
  });
  return null;
}

/* ------------------------- atmosphere / light ------------------------ */

function LightArc({ progressRef, reduced, dusk }: { progressRef: React.MutableRefObject<number>; reduced: boolean; dusk: Dusk }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  const rig = useRef({ smooth: 0 });
  const cools = useMemo(
    () => ({
      sunP: new THREE.Vector3(16, 26, 12),
      sunC: new THREE.Color("#fff3dd"),
      fogC: new THREE.Color("#e3ede7"),
    }),
    []
  );
  const warms = useMemo(
    () => ({
      sunP: new THREE.Vector3(-18, 7, 18),
      sunC: new THREE.Color("#ffb46b"),
      fogC: new THREE.Color("#eedcc6"),
    }),
    []
  );
  const _c = useMemo(() => new THREE.Color(), []);
  const _v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const target = reduced ? 6 : progressRef.current;
    rig.current.smooth = reduced ? 6 : THREE.MathUtils.damp(rig.current.smooth, target, 5, Math.min(dt, 1 / 20));
    const d = smoothstep(4.0, 6.0, rig.current.smooth);
    dusk.set(d);
    if (sun.current) {
      _v.lerpVectors(cools.sunP, warms.sunP, d);
      sun.current.position.copy(_v);
      _c.lerpColors(cools.sunC, warms.sunC, d);
      sun.current.color.copy(_c);
      sun.current.intensity = 2.6 - d * 0.9;
    }
    if (hemi.current) hemi.current.intensity = 0.5 - d * 0.18;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      _c.lerpColors(cools.fogC, warms.fogC, d);
      fog.color.copy(_c);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#eef7ff", "#94ad8e", 0.5]} />
      <ambientLight intensity={0.14} />
      <directionalLight
        ref={sun}
        castShadow
        position={[16, 26, 12]}
        color="#fff3dd"
        intensity={2.6}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
      <directionalLight position={[-12, 8, -14]} color="#bfeee0" intensity={0.5} />
    </>
  );
}

/* ------------------------------ scene ------------------------------- */

export default function Scene({
  progressRef,
  reduced,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  const dusk = useDuskRegistry();
  const archGlass = useArchGlass();
  const cheapGlass = useCheapGlass();
  return (
    <>
      <fog attach="fog" args={["#e3ede7", 30, 88]} />
      <LightArc progressRef={progressRef} reduced={reduced} dusk={dusk} />

      <Environment resolution={64} frames={1}>
        <mesh scale={90}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#dcebe2" side={THREE.BackSide} />
        </mesh>
        <Lightformer intensity={3} position={[8, 10, 6]} scale={[8, 6, 1]} color="#fff2d8" />
        <Lightformer intensity={1.2} position={[-8, 6, -6]} scale={[10, 4, 1]} color="#d9f4ea" />
      </Environment>

      <Terrain />
      <Forest frozen={reduced} />
      <Props dusk={dusk} />

      <AFrameHome dusk={dusk} archGlass={archGlass} cheapGlass={cheapGlass} />
      <Deck cheapGlass={cheapGlass} />
      <Walkway cheapGlass={cheapGlass} />
      <HotTub position={[5.9, 0, 5.4]} dusk={dusk} />
      <FirePit dusk={dusk} />
      <Bench position={[8.6, terrainH(8.6, 18.0) - 0.14, 18.0]} rotY={Math.PI * 1.12} />
      <PathStones />
      <Trailhead />
      <Fence />

      {/* string lights: a small canopy over the fire-pit lounge only —
          never crossing the glass facade or the deck framing */}
      <LightPole position={[-3.95, 2.5, 3.1]} />
      <LightPole position={[-6.7, 2.4, 5.3]} />
      <LightPole position={[-4.7, 2.45, 8.1]} />
      <StringLights
        points={[
          [-3.95, 2.46, 3.1],
          [-6.7, 2.36, 5.3],
          [-4.7, 2.41, 8.1],
        ]}
        dusk={dusk}
      />

      <BeatProps progressRef={progressRef} reduced={reduced} />
      <Hotspots />

      {/* chimney wisp; tub steam; fire pit smoke */}
      <Smoke origin={[0.9, 5.3, -2.2]} size={0.62} rise={3.0} opacity={0.3} frozen={reduced} />
      <Smoke origin={[5.9, 1.15, 5.4]} count={4} rate={0.2} size={0.36} rise={1.2} drift={0.12} opacity={0.24} frozen={reduced} />
      <Smoke origin={[-4.6, 0.8, 6.2]} count={5} rate={0.13} size={0.5} rise={2.2} drift={0.2} opacity={0.22} frozen={reduced} />

      <Mist frozen={reduced} />
      <Sparkles count={80} scale={[28, 8, 28]} position={[0, 3.5, 2]} size={2.2} speed={reduced ? 0 : 0.25} opacity={0.4} color="#fff6dd" />

      <CameraRig progressRef={progressRef} reduced={reduced} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.25} luminanceThreshold={0.9} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.16} darkness={0.26} />
        <Noise opacity={0.03} />
      </EffectComposer>
    </>
  );
}

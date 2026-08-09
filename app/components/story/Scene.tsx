"use client";

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sparkles } from "@react-three/drei";
import { withBase } from "../../lib/basePath";

/* ------------------------------------------------------------------ */
/* Motion vocabulary (principles studied from MengTo's kage page):     */
/* a CatmullRom camera path through one waypoint per story beat,       */
/* scroll progress damped frame-rate-independently, gentle pointer     */
/* parallax that fades with depth, and an opening dolly. Rebuilt from  */
/* scratch for our scene, our beats, and our brand.                    */
/* ------------------------------------------------------------------ */

type Waypoint = { p: [number, number, number]; t: [number, number, number]; fov: number };

const CAM: Waypoint[] = [
  { p: [-4.5, 5.4, 17.5], t: [0.0, 2.4, 0.0], fov: 38 }, // 0 hero — establishing drift
  { p: [10.0, 8.5, 12.0], t: [-1.5, 0.8, -2.0], fov: 46 }, // 1 land — survey the parcel
  { p: [-7.0, 2.4, 7.0], t: [0.2, 2.0, 0.0], fov: 42 }, // 2 design — close orbit
  { p: [4.0, 10.0, 20.0], t: [0.0, 1.6, 0.0], fov: 47 }, // 3 budget — pull back
  { p: [8.5, 2.6, 6.5], t: [-0.6, 2.2, 0.2], fov: 40 }, // 4 escrow — hold the frame
  { p: [-3.6, 1.8, 6.2], t: [1.2, 1.9, 0.6], fov: 41 }, // 5 build — deck and hot tub
  { p: [0.0, 4.2, 13.0], t: [0.0, 2.6, 0.0], fov: 39 }, // 6 end — settle centered
];

const REDUCED_SHOT = { p: [-5.5, 3.0, 10.5], t: [0.3, 2.0, 0.0], fov: 40 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** 1 near beat k, 0 elsewhere — drives beat-scoped scene props. */
const near = (prog: number, k: number, width = 0.85) => {
  const t = clamp01(1 - Math.abs(prog - k) / width);
  return t * t * (3 - 2 * t);
};

/* ------------------------------ assets ------------------------------ */

const MODELS = {
  cabin: withBase("/models/cabin.glb"),
  pines: withBase("/models/pines.glb"),
  pineTeal: withBase("/models/pine-teal.glb"),
  campfire: withBase("/models/campfire.glb"),
  rocks: withBase("/models/rocks.glb"),
};

useGLTF.preload(MODELS.cabin);
useGLTF.preload(MODELS.pines);
useGLTF.preload(MODELS.pineTeal);
useGLTF.preload(MODELS.campfire);
useGLTF.preload(MODELS.rocks);

/** Clone a GLTF scene normalized so its base sits at y=0, centered on x/z,
 *  scaled so its height equals `height` world units. */
function useNormalizedClones(
  src: THREE.Object3D,
  height: number,
  placements: { pos: [number, number, number]; rotY?: number; scale?: number }[],
  shadows = true
) {
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
      g.position.set(...pos);
      g.rotation.y = rotY;
      return g;
    });
  }, [src, height, placements, shadows]);
}

/* ----------------------------- terrain ------------------------------ */

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(70, 96);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      // Keep the clearing flat; let the far meadow roll gently.
      const t = clamp01((r - 11) / 30);
      const n =
        Math.sin(x * 0.16 + 1.7) * Math.cos(z * 0.13 - 0.6) +
        0.5 * Math.sin(x * 0.31 - 2.2) * Math.sin(z * 0.27 + 1.1);
      p.setY(i, t * t * n * 1.35);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color="#8fae86" flatShading roughness={1} metalness={0} />
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

const SMOKE_STOPS: [number, string][] = [
  [0, "rgba(255,255,255,0.85)"],
  [0.45, "rgba(255,255,255,0.35)"],
  [1, "rgba(255,255,255,0)"],
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
  { pos: [-14, 1.2, -6], scale: 15, speed: 0.05 },
  { pos: [12, 0.9, -10], scale: 13, speed: 0.035 },
  { pos: [-6, 0.8, -16], scale: 17, speed: 0.045 },
  { pos: [8, 1.4, 7], scale: 11, speed: 0.03 },
  { pos: [-16, 1.0, 8], scale: 12, speed: 0.04 },
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
      s.position.x = m.pos[0] + Math.sin(t * m.speed * 2 + i * 1.8) * 2.2;
      s.position.y = m.pos[1] + Math.sin(t * m.speed + i) * 0.25;
    });
  });
  return (
    <group>
      {MIST.map((m, i) => (
        <sprite
          key={i}
          position={m.pos}
          scale={[m.scale, m.scale * 0.42, 1]}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.16} />
        </sprite>
      ))}
    </group>
  );
}

/* ------------------------ built-from-primitives --------------------- */

/** The wood-fired hot tub — cedar barrel, teal water, a stove pipe. */
function HotTub({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.78, 0.72, 0.84, 14, 1, true]} />
        <meshStandardMaterial color="#8a5a3a" roughness={0.9} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.76, 0.05, 8, 14]} />
        <meshStandardMaterial color="#6d4429" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 14]} />
        <meshStandardMaterial color="#1d8f86" roughness={0.15} metalness={0.1} emissive="#0f4a44" emissiveIntensity={0.25} />
      </mesh>
      {/* wood-stove heater riding the rim */}
      <mesh castShadow position={[0.92, 0.55, -0.1]}>
        <cylinderGeometry args={[0.14, 0.14, 0.7, 10]} />
        <meshStandardMaterial color="#565c58" roughness={0.6} metalness={0.5} flatShading />
      </mesh>
      <mesh castShadow position={[0.92, 1.25, -0.1]}>
        <cylinderGeometry args={[0.045, 0.045, 0.8, 8]} />
        <meshStandardMaterial color="#9aa19c" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* step */}
      <mesh castShadow receiveShadow position={[-0.55, 0.16, 0.72]}>
        <boxGeometry args={[0.7, 0.32, 0.34]} />
        <meshStandardMaterial color="#7c5236" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/* ------------------------- beat-scoped props ------------------------ */

/** Lime survey stakes + boundary for LAND; emerald design ring for DESIGN. */
function BeatProps({ progressRef, reduced }: { progressRef: React.MutableRefObject<number>; reduced: boolean }) {
  const parcelMat = useRef<THREE.LineBasicMaterial>(null);
  const stakes = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Group>(null);

  const parcelGeo = useMemo(() => {
    const w = 9.5, d = 7.5, y = 0.09;
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
        {([[-9.5, -7.5], [9.5, -7.5], [9.5, 7.5], [-9.5, 7.5]] as [number, number][]).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.3, z]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.6, 6]} />
            <meshStandardMaterial color="#84b32c" roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>
      <group ref={ring} visible={false}>
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.55, 4.72, 72]} />
          <meshBasicMaterial ref={ringMat} color="#10b981" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.cos(a) * 4.64, 0.08, Math.sin(a) * 4.64]} rotation={[-Math.PI / 2, 0, -a]}>
              <planeGeometry args={[0.55, 0.05]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/* ------------------------------ forest ------------------------------ */

const PATCHES: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [-16, 0, -9], rotY: 0.3, scale: 1.2 },
  { pos: [13, 0, -13], rotY: 1.2, scale: 1.35 },
  { pos: [-9, 0, -19], rotY: 2.1, scale: 1.55 },
  { pos: [18, 0, -3], rotY: 0.6, scale: 1.1 },
  { pos: [-21, 0, 4], rotY: 2.8, scale: 1.3 },
  { pos: [15, 0, 9], rotY: 4.2, scale: 1.05 },
  { pos: [-5, 0, -26], rotY: 5.0, scale: 1.7 },
  { pos: [23, 0, -20], rotY: 3.4, scale: 1.8 },
  { pos: [5, 0, -19], rotY: 2.5, scale: 1.25 },
  { pos: [-26, 0, -14], rotY: 1.7, scale: 1.85 },
  { pos: [-14, 0, 13], rotY: 0.9, scale: 1.15 },
  { pos: [24, 0, 14], rotY: 5.6, scale: 1.4 },
];

const TEAL_PINES: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [-7.5, 0, -3.5], rotY: 0.4, scale: 1.1 },
  { pos: [8, 0, -5], rotY: 1.9, scale: 0.95 },
  { pos: [-11, 0, 2.5], rotY: 3.1, scale: 1.25 },
  { pos: [10.5, 0, 3.5], rotY: 0.8, scale: 0.85 },
  { pos: [4.2, 0, -9], rotY: 2.2, scale: 1.15 },
  { pos: [-4.5, 0, -10.5], rotY: 4.4, scale: 1.0 },
  { pos: [13, 0, -8], rotY: 5.1, scale: 1.3 },
];

const ROCKS: { pos: [number, number, number]; rotY?: number; scale?: number }[] = [
  { pos: [3.8, 0, 4.6], rotY: 0.7, scale: 0.5 },
  { pos: [-5.2, 0, 5.4], rotY: 2.4, scale: 0.32 },
  { pos: [6.6, 0, -2.6], rotY: 1.1, scale: 0.6 },
  { pos: [-8.6, 0, -6.2], rotY: 3.8, scale: 0.85 },
  { pos: [2.1, 0, -6.6], rotY: 5.2, scale: 0.4 },
  { pos: [-2.9, 0, 7.8], rotY: 0.2, scale: 0.26 },
];

function Forest() {
  const pines = useGLTF(MODELS.pines);
  const teal = useGLTF(MODELS.pineTeal);
  const rocks = useGLTF(MODELS.rocks);

  // Retint toward boreal spruce so the meadow palette stays ours.
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

  return (
    <group>
      {patchClones.map((g, i) => (
        <primitive key={`p${i}`} object={g} />
      ))}
      {tealClones.map((g, i) => (
        <primitive key={`t${i}`} object={g} />
      ))}
      {rockClones.map((g, i) => (
        <primitive key={`r${i}`} object={g} />
      ))}
    </group>
  );
}

function Home() {
  const cabin = useGLTF(MODELS.cabin);
  const campfire = useGLTF(MODELS.campfire);
  const cabinClones = useNormalizedClones(
    cabin.scene,
    3.6,
    useMemo(() => [{ pos: [0, 0, 0] as [number, number, number], rotY: Math.PI * 0.12 }], [])
  );
  const fireClones = useNormalizedClones(
    campfire.scene,
    0.85,
    useMemo(() => [{ pos: [-4.2, 0, 3.6] as [number, number, number], rotY: 0.5 }], [])
  );
  return (
    <group>
      <primitive object={cabinClones[0]} />
      <primitive object={fireClones[0]} />
      <pointLight position={[-4.2, 1.1, 3.6]} color="#ffb46b" intensity={2.2} distance={5.5} decay={2} />
      <HotTub position={[3.4, 0, 2.8]} />
    </group>
  );
}

/* ------------------------------- rig -------------------------------- */

function CameraRig({ progressRef, reduced }: { progressRef: React.MutableRefObject<number>; reduced: boolean }) {
  const { camera } = useThree();
  const rig = useRef({ smooth: 0, mx: 0, my: 0, started: -1 });
  const curves = useMemo(() => {
    const P = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c.p)), false, "catmullrom", 0.42);
    const T = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c.t)), false, "catmullrom", 0.42);
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

    const N = CAM.length - 1;
    const u = clamp01(r.smooth / N);
    curves.P.getPoint(u, _p);
    curves.T.getPoint(u, _t);
    const i = Math.min(Math.floor(r.smooth), N - 1);
    const f = clamp01(r.smooth - i);
    let fov = THREE.MathUtils.lerp(CAM[i].fov, CAM[Math.min(i + 1, N)].fov, f);

    // Tall-frame fix: step back along the view axis and open the lens a touch.
    const aspect = state.size.width / state.size.height;
    const nf = clamp01((1.55 - aspect) / 1.0);
    if (nf > 0) {
      _d.subVectors(_p, _t).normalize();
      _p.addScaledVector(_d, nf * 6.5);
      _p.y += nf * 0.9;
      fov *= 1 + nf * 0.33;
    }

    // Opening dolly: a longer lens easing in from further back.
    const io = 1 - intro;
    _p.z += io * 5.0;
    _p.y += io * 0.6;
    fov += io * 7;

    // Pointer parallax — a hand-held drift, attenuated deeper in the story.
    const par = 1 - clamp01(r.smooth / 1.6) * 0.55;
    _p.x += r.mx * 0.55 * par;
    _p.y += r.my * 0.3 * par;
    _t.x -= r.mx * 0.18 * par;
    _t.y -= r.my * 0.1 * par;

    camera.position.copy(_p);
    camera.lookAt(_t);
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - fov) > 1e-4) {
      pc.fov = fov;
      pc.updateProjectionMatrix();
    }
  });
  return null;
}

/* ------------------------------ scene ------------------------------- */

export default function Scene({
  progressRef,
  reduced,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  return (
    <>
      <fog attach="fog" args={["#e3ede7", 24, 62]} />
      <hemisphereLight args={["#eef7ff", "#94ad8e", 0.5]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        castShadow
        position={[16, 22, 10]}
        color="#ffe9c4"
        intensity={2.6}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <directionalLight position={[-12, 8, -14]} color="#bfeee0" intensity={0.55} />

      <Terrain />
      <Forest />
      <Home />
      <BeatProps progressRef={progressRef} reduced={reduced} />

      {/* wood-stove wisp from the chimney; steam off the tub water */}
      <Smoke origin={[0.75, 4.5, -0.4]} frozen={reduced} />
      <Smoke origin={[3.4, 0.95, 2.8]} count={4} rate={0.2} size={0.4} rise={1.4} drift={0.12} opacity={0.3} frozen={reduced} />
      <Smoke origin={[-4.2, 0.8, 3.6]} count={4} rate={0.12} size={0.5} rise={2.2} drift={0.2} opacity={0.22} frozen={reduced} />

      <Mist frozen={reduced} />
      <Sparkles count={70} scale={[26, 7, 26]} position={[0, 3, 0]} size={2.2} speed={reduced ? 0 : 0.25} opacity={0.4} color="#fff6dd" />

      <CameraRig progressRef={progressRef} reduced={reduced} />
    </>
  );
}

"use client";

/* ---------------------------------------------------------------------
   THE DETAIL LAYER

   Everything here is ADDITIVE — it mounts alongside the original scene and
   removes nothing. It is also entirely procedural: no downloaded meshes, no
   textures fetched over the wire, nothing to license or credit beyond the
   techniques listed in docs/CREDITS.md. That is a performance decision as
   much as a legal one — the whole layer costs a few hundred KB of JS and no
   extra network round-trips, which matters on a page whose payload budget
   is a brand rule.

   Performance shape:
     · grass is ONE InstancedMesh with GPU wind (no per-frame CPU work)
     · mountains are three low-segment ridges, no shadows, fog-blended
     · clouds and steam are canvas-gradient sprites — no image downloads
     · the moose, hammock, netting and lights are primitive assemblies
     · every animated piece honours `frozen` (prefers-reduced-motion)
--------------------------------------------------------------------- */

import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { terrainH } from "./Scene";

/* --------------------------- small helpers -------------------------- */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Deterministic pseudo-random — same layout every load, no Math.random. */
function rand(i: number, salt = 0) {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function useGradientSprite(stops: [number, string][]) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [stops]);
}

/* ============================ MOUNTAINS =============================
   Banff-style. Three ridge bands at increasing distance, each progressively
   paler and lower-contrast so aerial perspective does the depth work rather
   than geometry. They sit outside the fog far-plane deliberately: the fog
   colour IS the haze, so the far ridge dissolves into the sky exactly the
   way a real range does at 40km.
=================================================================== */

function ridgeGeometry(seed: number, width: number, height: number, segs: number, jag: number) {
  const g = new THREE.PlaneGeometry(width, height, segs, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const half = segs / 2;
  for (let i = 0; i <= segs; i++) {
    // Sum of three octaves — the classic ridge silhouette: a few big peaks,
    // some shoulders, and fine sawtooth so it never reads as a sine wave.
    const t = i / segs;
    const a = Math.sin(t * 5.1 + seed * 2.3) * 0.55;
    const b = Math.sin(t * 11.7 + seed * 5.9) * 0.26;
    const c = Math.sin(t * 27.3 + seed * 1.4) * 0.11;
    const peak = Math.pow(clamp01((a + b + c) * 0.5 + 0.5), 1.35);
    const y = peak * height * jag;
    // top row only (vertices 0..segs are the top of a 1-segment plane)
    p.setY(i, y);
    p.setY(i + segs + 1, -height * 0.5);
    void half;
  }
  g.computeVertexNormals();
  return g;
}

function MountainRange() {
  /* fog={false} is load-bearing. Scene fog runs 30–88 units, and these bands
     sit at 104–168 — inside the fog they resolved to pure fog colour and were
     effectively invisible. They opt out and paint their own aerial
     perspective through colour and opacity instead, which is what a matte
     painter would do anyway. */
  const bands = useMemo(
    () => [
      { seed: 1.7, z: -168, w: 700, h: 132, jag: 1.0, color: "#a8bcc9", op: 0.85, y: 2 },
      { seed: 4.2, z: -134, w: 600, h: 104, jag: 0.94, color: "#8ea7b8", op: 0.92, y: 1 },
      { seed: 8.9, z: -106, w: 500, h: 78, jag: 0.88, color: "#748ea3", op: 0.97, y: 0 },
    ],
    []
  );
  const geos = useMemo(
    () => bands.map((b) => ridgeGeometry(b.seed, b.w, b.h, 128, b.jag)),
    [bands]
  );

  /* Snow caps: a second, slightly smaller copy of each ridge drawn just in
     front and clipped to the top by its own geometry height. Cheap, and it
     is the single cue that says "Rockies" rather than "hills". */
  return (
    <group renderOrder={-10}>
      {bands.map((b, i) => (
        <group key={i}>
          <mesh geometry={geos[i]} position={[0, b.y, b.z]}>
            <meshBasicMaterial color={b.color} transparent opacity={b.op} fog={false} side={THREE.DoubleSide} />
          </mesh>
          {/* snowline — same silhouette, pushed up and lightened */}
          <mesh geometry={geos[i]} position={[0, b.y + b.h * 0.05, b.z + 1.5]} scale={[1, 0.955, 1]}>
            <meshBasicMaterial
              color="#f4f8fa"
              transparent
              opacity={0.72 - i * 0.14}
              fog={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ============================== CLOUDS ==============================
   Drifting sprite banks. They wrap rather than respawn, so there is no pop,
   and they are kept well under the bloom threshold so they read as vapour
   instead of glowing blobs.
=================================================================== */

const CLOUD_STOPS: [number, string][] = [
  [0, "rgba(255,255,255,0.72)"],
  [0.42, "rgba(250,252,253,0.3)"],
  [1, "rgba(250,252,253,0)"],
];

function Clouds({ frozen }: { frozen: boolean }) {
  const tex = useGradientSprite(CLOUD_STOPS);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const defs = useMemo(
    () =>
      /* Small, high and far. The first pass had them at scale 26–60 barely
         60 units out, which put house-sized white blobs in the mid-ground
         where they read as fog banks rather than sky. */
      Array.from({ length: 13 }, (_, i) => ({
        x: -120 + rand(i, 1) * 240,
        y: 44 + rand(i, 2) * 34,
        z: -120 - rand(i, 3) * 90,
        s: 15 + rand(i, 4) * 22,
        v: 0.22 + rand(i, 5) * 0.36,
        o: 0.16 + rand(i, 6) * 0.2,
      })),
    []
  );
  useFrame(({ clock }) => {
    if (frozen) return;
    const t = clock.elapsedTime;
    refs.current.forEach((s, i) => {
      if (!s) return;
      const d = defs[i];
      // wrap across a 220-unit band
      const x = ((d.x + t * d.v + 150) % 300) - 150;
      s.position.set(x, d.y + Math.sin(t * 0.08 + i) * 0.8, d.z);
    });
  });
  return (
    <group renderOrder={-9}>
      {defs.map((d, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[d.x, d.y, d.z]}
          scale={[d.s, d.s * 0.44, 1]}
        >
          <spriteMaterial map={tex} transparent opacity={d.o} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

/* =============================== GRASS ==============================
   One InstancedMesh, GPU wind, GPU pointer-push. The blade is three verts
   wide at the base tapering to a point — 1 triangle per blade — so 2,400
   blades is 2,400 triangles, which is nothing, and the sway costs zero CPU
   because it lives in the vertex shader.

   The pointer push is what makes the meadow feel alive under the cursor:
   the cursor is raycast onto the ground plane once per frame and handed to
   the shader as a single uniform; blades within ~2 units bend away from it.
=================================================================== */

const GRASS_COUNT = 2400;

function GrassField({ frozen }: { frozen: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const shaderRef = useRef<{ uniforms: Record<string, { value: unknown }> } | null>(null);
  const { camera, pointer } = useThree();

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // base-left, base-right, tip — y is 0..1 so the shader can use y as "bend"
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0]), 3)
    );
    /* Normals point UP, not forward. A blade is a vertical triangle, so a
       forward normal means each one is lit by whatever it happens to face —
       half the field turns away from the sun and reads as dark specks
       scattered on the grass rather than as grass. Facing them all skyward
       lights the meadow as one surface, which is what it is. */
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.computeBoundingSphere();
    return g;
  }, []);

  const mat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color("#8fb27f"),
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPointer = { value: new THREE.Vector3(9999, 0, 9999) };
      shader.vertexShader =
        "uniform float uTime;\nuniform vec3 uPointer;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           float bend = transformed.y;
           float w = sin(uTime * 1.5 + iPos.x * 0.55 + iPos.z * 0.42) * 0.5
                   + sin(uTime * 2.6 + iPos.x * 1.15) * 0.22;
           transformed.x += w * bend * 0.30;
           transformed.z += w * bend * 0.17;
           float d = distance(iPos.xz, uPointer.xz);
           float push = smoothstep(2.4, 0.0, d);
           vec2 dir = normalize(iPos.xz - uPointer.xz + vec2(0.0001));
           transformed.xz += dir * push * bend * 0.6;
           transformed.y -= push * bend * 0.22;
          `
        );
      shaderRef.current = shader as unknown as { uniforms: Record<string, { value: unknown }> };
    };
    return m;
  }, []);

  /* Placement: a ring around the home that deliberately avoids the deck,
     the walkway, the tub pad and the path, so nothing grows through built
     geometry. Colour varies per blade so the meadow doesn't read as one
     flat green. */
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const c = new Float32Array(GRASS_COUNT * 3);
    let n = 0;
    for (let i = 0; n < GRASS_COUNT && i < GRASS_COUNT * 4; i++) {
      const a = rand(i, 11) * Math.PI * 2;
      const r = 5.5 + Math.pow(rand(i, 12), 0.62) * 26;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // keep out of the built envelope + the tub/walkway corridor
      if (Math.abs(x) < 4.6 && z > -3.6 && z < 7.0) continue;
      if (x > 2.6 && x < 7.4 && z > 3.4 && z < 7.2) continue;
      const y = terrainH(x, z);
      if (y > 3.6) continue; // no grass up the bare ridge
      /* Blades are WIDE and LIGHT on purpose. The first pass used 5–8cm
         blades in a dark green: at any distance past a few metres each one
         collapsed below a pixel and aliased into a dark speck, so the meadow
         read as scattered debris rather than grass. Wider than life and
         lighter than the terrain underneath is what makes it read as a
         surface at the distances this camera actually flies. */
      const h = 0.2 + rand(i, 13) * 0.26;
      dummy.position.set(x, y - 0.02, z);
      dummy.rotation.set(0, rand(i, 14) * Math.PI, 0);
      dummy.scale.set(0.14 + rand(i, 15) * 0.08, h, 1);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      const shade = 0.94 + rand(i, 16) * 0.3;
      col.setRGB(0.66 * shade, 0.82 * shade, 0.55 * shade);
      c[n * 3] = col.r;
      c[n * 3 + 1] = col.g;
      c[n * 3 + 2] = col.b;
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    m.geometry.setAttribute("color", new THREE.InstancedBufferAttribute(c, 3));
    m.frustumCulled = false;
  }, []);

  const _ray = useMemo(() => new THREE.Raycaster(), []);
  const _plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const _hit = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const s = shaderRef.current;
    if (!s) return;
    if (!frozen) (s.uniforms.uTime as { value: number }).value = clock.elapsedTime;
    // cursor -> ground, one raycast a frame against a maths plane (no BVH)
    _ray.setFromCamera(pointer, camera);
    if (_ray.ray.intersectPlane(_plane, _hit)) {
      (s.uniforms.uPointer as { value: THREE.Vector3 }).value.copy(_hit);
    }
  });

  return <instancedMesh ref={mesh} args={[geo, mat, GRASS_COUNT]} receiveShadow />;
}

/* ========================== ENTRANCE STEPS ==========================
   A proper flight up to the front door — timber treads on steel stringers,
   with a glass cheek so it belongs to the same building as the deck.
=================================================================== */

function EntranceSteps({ glassRail }: { glassRail: THREE.Material }) {
  const cedar = ["#a97e57", "#9b7350", "#b0855e"];
  const N = 5;
  return (
    <group position={[0.05, 0, 6.55]}>
      {Array.from({ length: N }, (_, i) => {
        const y = 0.42 - (i + 1) * 0.082;
        const z = (i + 1) * 0.36;
        return (
          <group key={i}>
            <mesh castShadow receiveShadow position={[0, y, z]}>
              <boxGeometry args={[2.3, 0.1, 0.36]} />
              <meshStandardMaterial color={cedar[i % 3]} roughness={0.85} flatShading />
            </mesh>
            <mesh position={[0, y - 0.09, z]} castShadow>
              <boxGeometry args={[2.2, 0.08, 0.3]} />
              <meshStandardMaterial color="#6d523c" roughness={0.9} flatShading />
            </mesh>
          </group>
        );
      })}
      {/* stringers */}
      {[-1.16, 1.16].map((x, i) => (
        <mesh key={i} castShadow position={[x, 0.19, 0.94]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[0.08, 0.16, 2.0]} />
          <meshStandardMaterial color="#5d6663" roughness={0.5} metalness={0.55} />
        </mesh>
      ))}
      {/* glass cheeks, matching the deck balustrade */}
      {[-1.22, 1.22].map((x, i) => (
        <mesh key={`g${i}`} material={glassRail} position={[x, 0.42, 0.94]} rotation={[-0.22, 0, 0]} renderOrder={20}>
          <boxGeometry args={[0.04, 0.5, 2.0]} />
        </mesh>
      ))}
    </group>
  );
}

/* ============================== HAMMOCK =============================
   Slung between two posts in the lounge, west of the fire pit. The bed is a
   real catenary — sampled cosh, not a bent plane — because the eye knows
   the difference immediately.
=================================================================== */

function Hammock({ frozen }: { frozen: boolean }) {
  const swing = useRef<THREE.Group>(null);
  const A: [number, number, number] = [-7.5, 0, 8.6];
  const B: [number, number, number] = [-5.0, 0, 10.3];
  const gA = terrainH(A[0], A[2]);
  const gB = terrainH(B[0], B[2]);

  const geo = useMemo(() => {
    const dx = B[0] - A[0];
    const dz = B[2] - A[2];
    const span = Math.hypot(dx, dz);
    const SEG = 22;
    const W = 0.62;
    const sag = 0.42;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const u = (t - 0.5) * 2; // -1..1
      const y = (Math.cosh(u * 1.35) - Math.cosh(1.35)) / (1 - Math.cosh(1.35)) * -sag;
      const belly = 1 - Math.abs(u) * 0.22;
      pos.push(-W * belly, y, (t - 0.5) * span);
      pos.push(W * belly, y, (t - 0.5) * span);
    }
    for (let i = 0; i < SEG; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [A, B]);

  useFrame(({ clock }) => {
    if (frozen || !swing.current) return;
    swing.current.rotation.z = Math.sin(clock.elapsedTime * 0.55) * 0.035;
  });

  const cx = (A[0] + B[0]) / 2;
  const cz = (A[2] + B[2]) / 2;
  const ang = Math.atan2(B[0] - A[0], B[2] - A[2]);

  return (
    <group>
      {/* posts */}
      {[
        [A[0], gA],
        [B[0], gB],
      ].map(([x, g], i) => (
        <mesh key={i} castShadow position={[x, g + 0.85, i === 0 ? A[2] : B[2]]}>
          <cylinderGeometry args={[0.07, 0.09, 1.7, 7]} />
          <meshStandardMaterial color="#7a6248" roughness={0.9} flatShading />
        </mesh>
      ))}
      <group ref={swing} position={[cx, (gA + gB) / 2 + 1.28, cz]} rotation={[0, ang, 0]}>
        <mesh geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial color="#d9cdb4" roughness={0.95} side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/* ============================== NETTING =============================
   A slung net lounge off the deck's west shoulder — the thing people
   actually lie on at dusk. One plane with a canvas-drawn alpha grid beats
   200 crossed cylinders by about 200 draw calls.
=================================================================== */

function useNetTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = "#efe9dc";
    ctx.lineWidth = 3.2;
    for (let i = 0; i <= 8; i++) {
      const p = (i / 8) * 128;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(128, p);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function NetLounge() {
  const tex = useNetTexture();
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.5, 1.9, 12, 10);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / 1.25;
      const y = p.getY(i) / 0.95;
      p.setZ(i, -(1 - x * x) * (1 - y * y) * 0.3); // sag toward the middle
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group position={[-4.5, 0.5, 4.5]} rotation={[-Math.PI / 2, 0, 0.28]}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial
          map={tex}
          transparent
          alphaTest={0.42}
          color="#f2ece0"
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* rope edge */}
      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[1.42, 1.5, 4]} />
        <meshBasicMaterial color="#cdbfa4" side={THREE.DoubleSide} transparent opacity={0} />
      </mesh>
    </group>
  );
}

/* =============================== MOOSE ==============================
   Low-poly, in the scene's own faceted language. Two of them, well out in
   the meadow — one grazing, one standing — because a moose at the fire pit
   would read as a petting zoo rather than the Rockies.
=================================================================== */

function Moose({
  position,
  rotY = 0,
  scale = 1,
  graze = false,
  frozen,
}: {
  position: [number, number];
  rotY?: number;
  scale?: number;
  graze?: boolean;
  frozen: boolean;
}) {
  const head = useRef<THREE.Group>(null);
  const y = terrainH(position[0], position[1]);
  const hide = "#4a3526";
  const dark = "#33241a";

  useFrame(({ clock }) => {
    if (frozen || !head.current) return;
    const t = clock.elapsedTime;
    // grazers dip; standers just look around slowly
    head.current.rotation.x = graze
      ? 0.55 + Math.sin(t * 0.45) * 0.42
      : Math.sin(t * 0.3) * 0.09;
    head.current.rotation.y = graze ? 0 : Math.sin(t * 0.21) * 0.3;
  });

  return (
    <group position={[position[0], y, position[1]]} rotation={[0, rotY, 0]} scale={scale}>
      {/* barrel */}
      <mesh castShadow position={[0, 1.42, 0]}>
        <boxGeometry args={[0.62, 0.78, 1.62]} />
        <meshStandardMaterial color={hide} roughness={0.95} flatShading />
      </mesh>
      {/* shoulder hump — the moose tell */}
      <mesh castShadow position={[0, 1.86, 0.42]}>
        <boxGeometry args={[0.5, 0.3, 0.66]} />
        <meshStandardMaterial color={hide} roughness={0.95} flatShading />
      </mesh>
      {/* legs */}
      {([[-0.22, 0.62], [0.22, 0.62], [-0.22, -0.58], [0.22, -0.58]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.62, z]}>
          <boxGeometry args={[0.13, 1.24, 0.15]} />
          <meshStandardMaterial color={dark} roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* neck + head, animated */}
      <group ref={head} position={[0, 1.86, 0.78]}>
        <mesh castShadow position={[0, 0.12, 0.2]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.3, 0.62, 0.3]} />
          <meshStandardMaterial color={hide} roughness={0.95} flatShading />
        </mesh>
        <mesh castShadow position={[0, 0.36, 0.56]} rotation={[0.34, 0, 0]}>
          <boxGeometry args={[0.26, 0.28, 0.66]} />
          <meshStandardMaterial color={dark} roughness={0.95} flatShading />
        </mesh>
        {/* bell */}
        <mesh position={[0, 0.16, 0.5]}>
          <boxGeometry args={[0.1, 0.24, 0.1]} />
          <meshStandardMaterial color={dark} roughness={0.95} flatShading />
        </mesh>
        {/* palmate antlers */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.2, 0.5, 0.42]} rotation={[0, 0, s * 0.5]}>
            <mesh castShadow position={[s * 0.16, 0.06, 0]}>
              <boxGeometry args={[0.42, 0.07, 0.34]} />
              <meshStandardMaterial color="#b9a888" roughness={0.85} flatShading />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} castShadow position={[s * (0.3 + k * 0.06), 0.16, -0.1 + k * 0.12]}>
                <boxGeometry args={[0.05, 0.17, 0.05]} />
                <meshStandardMaterial color="#b9a888" roughness={0.85} flatShading />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/* ========================== OUTDOOR LIGHTING ========================
   Bollards along the path and two wall washers on the deck. The emissive
   lifts with dusk through the same registry the rest of the scene uses, so
   nothing has its own idea of what time it is. Only ONE of them carries a
   real point light — the rest are emissive geometry, which is the whole
   trick for keeping a lit night scene cheap.
=================================================================== */

function Bollard({ position, night }: { position: [number, number]; night: number }) {
  const y = terrainH(position[0], position[1]);
  return (
    <group position={[position[0], y, position[1]]}>
      <mesh castShadow position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.64, 7]} />
        <meshStandardMaterial color="#454d4a" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.09, 8]} />
        <meshStandardMaterial
          color="#ffe9c2"
          emissive="#ffca7a"
          emissiveIntensity={0.25 + night * 2.4}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

function OutdoorLighting({ night }: { night: number }) {
  const pts: [number, number][] = [
    [1.5, 8.2],
    [2.4, 10.0],
    [3.2, 11.9],
    [-2.4, 8.4],
    [-3.6, 10.2],
    [6.9, 6.6],
  ];
  return (
    <group>
      {pts.map((p, i) => (
        <Bollard key={i} position={p} night={night} />
      ))}
      {/* the one real light: a warm pool over the steps */}
      <pointLight position={[0.05, 1.5, 7.4]} color="#ffcf95" intensity={night * 3.2} distance={9} decay={2} />
      {/* deck wall-washers, emissive only */}
      {([[-3.2, 1.15, 6.0], [3.1, 1.15, 6.0]] as [number, number, number][]).map((p, i) => (
        <mesh key={`w${i}`} position={p}>
          <boxGeometry args={[0.14, 0.06, 0.14]} />
          <meshStandardMaterial
            color="#ffe9c2"
            emissive="#ffb86b"
            emissiveIntensity={0.2 + night * 2.6}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ============================= TUB STEAM ============================
   A denser, slower plume than the generic smoke — steam off water behaves
   differently from woodsmoke: it rises slower, spreads wider, and dies
   faster. Two overlapping rates so it never looks like a loop.
=================================================================== */

function TubSteam({ frozen }: { frozen: boolean }) {
  const tex = useGradientSprite([
    [0, "rgba(244,248,247,0.62)"],
    [0.45, "rgba(244,248,247,0.24)"],
    [1, "rgba(244,248,247,0)"],
  ]);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const N = 9;
  useFrame(({ clock }) => {
    if (frozen) return;
    const t = clock.elapsedTime;
    refs.current.forEach((s, i) => {
      if (!s) return;
      const rate = i % 2 === 0 ? 0.17 : 0.115;
      const life = (t * rate + i / N) % 1;
      s.position.set(
        5.9 + Math.sin(t * 0.6 + i * 1.7) * 0.26 * life * 2.2,
        1.02 + life * 1.9,
        5.4 + Math.cos(t * 0.44 + i * 1.1) * 0.22 * life * 2
      );
      const sc = 0.3 + life * 1.5;
      s.scale.set(sc, sc, 1);
      (s.material as THREE.SpriteMaterial).opacity = 0.3 * clamp01(life / 0.1) * Math.pow(1 - life, 1.9);
    });
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[5.9, 1.02, 5.4]}
        >
          <spriteMaterial map={tex} transparent opacity={0.3} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/* ============================ THE LAYER ============================= */

export default function SceneDetail({
  frozen,
  night,
  glassRail,
}: {
  frozen: boolean;
  night: number;
  glassRail: THREE.Material;
}) {
  return (
    <group>
      <MountainRange />
      <Clouds frozen={frozen} />
      <GrassField frozen={frozen} />
      <EntranceSteps glassRail={glassRail} />
      <Hammock frozen={frozen} />
      <NetLounge />
      <Moose position={[-15.5, 20.5]} rotY={2.1} graze frozen={frozen} />
      <Moose position={[16.5, 24.0]} rotY={-1.15} scale={0.86} frozen={frozen} />
      <OutdoorLighting night={night} />
      <TubSteam frozen={frozen} />
    </group>
  );
}

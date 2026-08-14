// Dependency-free GLB structural probe.
//
// WHY: Scene.tsx recolours pines.glb by MATERIAL NAME ("Green"/"Wood"). A
// compression pass that renames, merges or palettes materials would break that
// silently — the scene would still render, just in the wrong colours. So the
// before/after check has to assert on names, not on bytes alone. Reading the
// GLB JSON chunk directly keeps this probe honest: it has no shared code with
// the tool whose output it is judging.
//
// WHY world space: KHR_mesh_quantization rewrites POSITION accessor min/max
// into quantized integer units and pushes the dequantization scale/offset onto
// the parent node's transform. Comparing raw accessor bounds before/after
// therefore compares different unit systems and reports a meaningless ~2^15
// "drift". The only comparable quantity is the bounding box after the node
// hierarchy is applied, so that is what this computes.
import { readFileSync } from "node:fs";

const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Column-major 4x4 multiply, matching the glTF matrix convention.
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function trs(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

// KHR_mesh_quantization stores POSITION as normalized integers; the accessor's
// min/max are then raw integer bounds. The glTF spec's normalized-integer
// dequantization is value / MAX for the component type, and only after that
// does the node transform apply. Skipping this step compares integer space to
// metre space and reports a nonsense ~2^15 drift.
const NORMALIZE_DIVISOR = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

function dequantize(accessor, v) {
  if (!accessor.normalized) return v;
  const d = NORMALIZE_DIVISOR[accessor.componentType];
  if (!d) return v;
  // Signed types clamp at -1.0, per the spec's max(value/MAX, -1.0).
  return Math.max(v / d, -1.0);
}

export function probe(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  // Header is 12 bytes; chunks are [len u32][type u32][data]. JSON chunk first.
  const len = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${file}: first chunk is not JSON`);
  const gltf = JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
  const names = (arr) => (arr || []).map((x) => x.name ?? "(unnamed)");
  const accessors = gltf.accessors || [];
  const meshes = gltf.meshes || [];

  // Walk every scene node, accumulating world matrices down to mesh nodes.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  let vertices = 0;
  const counted = new Set();

  const visit = (idx, parent) => {
    const node = (gltf.nodes || [])[idx];
    if (!node) return;
    const world = mul(parent, trs(node));
    if (node.mesh !== undefined) {
      for (const p of meshes[node.mesh]?.primitives || []) {
        const a = accessors[p.attributes?.POSITION];
        if (a?.min && a?.max) {
          // Transform all 8 corners: a rotation can swing the box off-axis.
          for (let i = 0; i < 8; i++) {
            const corner = [
              dequantize(a, i & 1 ? a.max[0] : a.min[0]),
              dequantize(a, i & 2 ? a.max[1] : a.min[1]),
              dequantize(a, i & 4 ? a.max[2] : a.min[2]),
            ];
            const w = apply(world, corner);
            for (let k = 0; k < 3; k++) {
              if (w[k] < min[k]) min[k] = w[k];
              if (w[k] > max[k]) max[k] = w[k];
            }
          }
        }
        // Count each primitive once even when a mesh is instanced by many nodes.
        const key = `${node.mesh}/${meshes[node.mesh].primitives.indexOf(p)}`;
        if (!counted.has(key)) {
          counted.add(key);
          vertices += a?.count ?? 0;
          const idxAcc = p.indices !== undefined ? accessors[p.indices] : null;
          triangles += Math.floor((idxAcc ? idxAcc.count : a?.count ?? 0) / 3);
        }
      }
    }
    for (const c of node.children || []) visit(c, world);
  };
  for (const s of gltf.scenes || []) for (const n of s.nodes || []) visit(n, IDENT);

  return {
    bytes: buf.length,
    materials: names(gltf.materials),
    meshes: names(meshes),
    nodes: names(gltf.nodes),
    // Primitive count drives draw calls; a join pass would collapse these.
    primitives: meshes.reduce((n, m) => n + (m.primitives || []).length, 0),
    extensionsUsed: gltf.extensionsUsed || [],
    extensionsRequired: gltf.extensionsRequired || [],
    images: (gltf.images || []).length,
    triangles,
    vertices,
    worldMin: min.map((v) => (Number.isFinite(v) ? v : 0)),
    worldMax: max.map((v) => (Number.isFinite(v) ? v : 0)),
  };
}

// Only act as a CLI when invoked directly; glb-compare.mjs imports probe().
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const out = {};
  for (const f of process.argv.slice(2)) out[f] = probe(f);
  console.log(JSON.stringify(out, null, 2));
}

// Before/after gate for the PB02 GLB compression pass.
//
// WHY these specific assertions: the failure mode of a compression pass is not
// a crash, it is a silent semantic change. Scene.tsx recolours pines.glb by
// material name, so a renamed/merged material would render the wrong colour
// with every test still green. Triangle count catches an accidental simplify.
// World-space bounds catch quantization drifting the model off its mark.
import { probe } from "./glb-probe.mjs";
import { readdirSync } from "node:fs";
import path from "node:path";

const [beforeDir, afterDir] = process.argv.slice(2);
const files = readdirSync(beforeDir).filter((f) => f.endsWith(".glb"));

// RENEGOTIATED from an absolute 1e-3 tolerance. That threshold assumed every
// model was authored around unit scale; cabin.glb is authored ~1550 units
// across, so its perfectly healthy 0.049-unit quantization step tripped a gate
// that pine-teal.glb passed at 4e-5 purely because pine-teal is small. Scale
// is not error. The comparable quantity is drift RELATIVE to model extent.
//
// 1e-4 is deliberately just above the theoretical floor: meshopt quantizes
// positions to 14 bits, i.e. a relative step of 1/16384 = 6.1e-5. So this
// still FAILS on a real geometry change — the earlier broken-transform runs
// scored ~1e4 relative, four orders of magnitude over — while passing correct
// quantization. A gate that cannot fail would prove nothing.
const REL_TOL = 1e-4;

let failures = 0;
const fail = (f, msg) => {
  failures++;
  console.log(`  FAIL ${f}: ${msg}`);
};

let beforeTotal = 0;
let afterTotal = 0;

for (const f of files) {
  const a = probe(path.join(beforeDir, f));
  const b = probe(path.join(afterDir, f));
  beforeTotal += a.bytes;
  afterTotal += b.bytes;

  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!eq(a.materials, b.materials))
    fail(f, `materials changed ${JSON.stringify(a.materials)} -> ${JSON.stringify(b.materials)}`);
  if (!eq(a.meshes, b.meshes)) fail(f, `mesh names changed`);
  if (a.primitives !== b.primitives) fail(f, `primitive count ${a.primitives} -> ${b.primitives}`);
  if (a.images !== b.images) fail(f, `image count ${a.images} -> ${b.images}`);

  // RENEGOTIATED from "vertex count must be identical". That assertion was
  // wrong, not the data: `weld` merges bitwise-duplicate vertices, which is
  // lossless — the triangles that referenced them still reference the same
  // positions. cabin.glb legitimately drops 7050 -> 6519. The real invariant
  // is the triangle count, which welding must preserve exactly; vertices may
  // only go DOWN, never up.
  if (a.triangles !== b.triangles) fail(f, `triangle count ${a.triangles} -> ${b.triangles}`);
  if (b.vertices > a.vertices) fail(f, `vertex count grew ${a.vertices} -> ${b.vertices}`);

  let worst = 0;
  for (let k = 0; k < 3; k++) {
    worst = Math.max(worst, Math.abs(a.worldMin[k] - b.worldMin[k]), Math.abs(a.worldMax[k] - b.worldMax[k]));
  }
  const extent = Math.max(...a.worldMax.map((v, i) => v - a.worldMin[i]), 1e-9);
  const rel = worst / extent;
  if (rel > REL_TOL)
    fail(f, `world bbox drift ${rel.toExponential(2)} of extent exceeds ${REL_TOL}`);

  const pct = ((1 - b.bytes / a.bytes) * 100).toFixed(1);
  const weld = a.vertices !== b.vertices ? ` weld=${a.vertices}->${b.vertices}` : "";
  console.log(
    `  ${f.padEnd(15)} ${String(a.bytes).padStart(6)} -> ${String(b.bytes).padStart(6)} (-${pct.padStart(4)}%)  tris=${b.triangles}  drift=${rel.toExponential(2)}${weld}`,
  );
}

console.log(
  `\n  TOTAL ${beforeTotal} -> ${afterTotal} (-${((1 - afterTotal / beforeTotal) * 100).toFixed(1)}%, saved ${beforeTotal - afterTotal} bytes)`,
);
console.log(failures === 0 ? "  GATE: PASS" : `  GATE: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);

// Emits perf/PB02-models-<date>.json from the files themselves.
//
// WHY a generator rather than a hand-written JSON: every figure in the record
// has to come from one anchored source. Typing 88264 into a document by hand
// creates a second source that can drift from the file it describes. This
// reads both trees and writes what it finds.
//
// Usage: node emit-pb02-json.mjs <beforeDir> <afterDir> <baselineJson> <outJson>
import { probe } from "./glb-probe.mjs";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [beforeDir, afterDir, baselinePath, outPath] = process.argv.slice(2);
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const files = readdirSync(afterDir).filter((f) => f.endsWith(".glb")).sort();

const models = files.map((f) => {
  const a = probe(path.join(beforeDir, f));
  const b = probe(path.join(afterDir, f));
  let worst = 0;
  for (let k = 0; k < 3; k++)
    worst = Math.max(worst, Math.abs(a.worldMin[k] - b.worldMin[k]), Math.abs(a.worldMax[k] - b.worldMax[k]));
  const extent = Math.max(...a.worldMax.map((v, i) => v - a.worldMin[i]), 1e-9);
  return {
    file: f,
    beforeBytes: a.bytes,
    afterBytes: b.bytes,
    savedBytes: a.bytes - b.bytes,
    reductionPct: Number((((a.bytes - b.bytes) / a.bytes) * 100).toFixed(1)),
    triangles: b.triangles,
    trianglesUnchanged: a.triangles === b.triangles,
    vertexBefore: a.vertices,
    vertexAfter: b.vertices,
    materials: b.materials,
    materialsUnchanged: JSON.stringify(a.materials) === JSON.stringify(b.materials),
    relativeBboxDrift: Number(( worst / extent ).toExponential(2)),
    extensionsRequired: b.extensionsRequired,
  };
});

const beforeTotal = models.reduce((n, m) => n + m.beforeBytes, 0);
const afterTotal = models.reduce((n, m) => n + m.afterBytes, 0);
const saved = beforeTotal - afterTotal;

writeFileSync(
  outPath,
  JSON.stringify(
    {
      schema: "PerfDeltaV1",
      node: "PB02",
      measuredAt: new Date().toISOString(),
      against: path.basename(baselinePath),
      baselineTotalStaticAssetBytes: baseline.totalStaticAssetBytes,
      method:
        "gltf-transform@4.4.2 optimize --compress meshopt --meshopt-level high " +
        "--palette false --join false --flatten false --simplify false --instance false " +
        "--texture-compress false",
      decoderNote:
        "EXT_meshopt_compression needs no component change: @react-three/drei's useGLTF " +
        "statically imports MeshoptDecoder from three-stdlib and registers it by default " +
        "(useMeshopt defaults true). The decoder carries its wasm inline, so nothing is fetched.",
      modelBytesBefore: beforeTotal,
      modelBytesAfter: afterTotal,
      modelBytesSaved: saved,
      modelReductionPct: Number(((saved / beforeTotal) * 100).toFixed(1)),
      // Projection, not a measurement: it assumes public/ assets are inside the
      // baseline's totalStaticAssetBytes. The orchestrator's post-build capture
      // is the authority on the real after-state.
      projectedTotalStaticAssetBytes: baseline.totalStaticAssetBytes - saved,
      projectionIsUnverified: true,
      models,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${outPath}: ${beforeTotal} -> ${afterTotal} (saved ${saved})`);

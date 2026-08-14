# PB02 / PB03 — model and font/bundle weight, measured

Date: 2026-08-14
Contract: [`PB01-baseline-2026-08-14.json`](./PB01-baseline-2026-08-14.json)
Measured delta: [`PB02-models-2026-08-14.json`](./PB02-models-2026-08-14.json) (generated, not hand-typed)

Every byte figure below is read out of the files by
[`tools/emit-pb02-json.mjs`](./tools/emit-pb02-json.mjs). Nothing in this
document is retyped from a build log.

---

## PB02 — the six GLBs

**604,128 → 296,020 bytes. 308,108 saved, −51.0%.**

| file | before | after | saved | −% | triangles | material names |
|---|---:|---:|---:|---:|---:|---|
| `cabin.glb` | 279,376 | 88,264 | 191,112 | 68.4 | 4,355 unchanged | unchanged |
| `campfire.glb` | 168,428 | 144,300 | 24,128 | 14.3 | 500 unchanged | unchanged |
| `pines.glb` | 99,604 | 30,188 | 69,416 | 69.7 | 3,666 unchanged | unchanged |
| `lantern.glb` | 29,616 | 21,572 | 8,044 | 27.2 | 264 unchanged | unchanged |
| `pine-teal.glb` | 21,164 | 8,340 | 12,824 | 60.6 | 264 unchanged | unchanged |
| `rocks.glb` | 5,940 | 3,356 | 2,584 | 43.5 | 84 unchanged | unchanged |

Command actually run (gltf-transform 4.4.2, via `npx`):

```
optimize <in> <out> --compress meshopt --meshopt-level high \
  --palette false --join false --flatten false --simplify false \
  --instance false --texture-compress false
```

### Meshopt needs no component change — verified, not assumed

The brief said meshopt would be off-limits if it required registering a decoder
at runtime. It does not:

- `@react-three/drei/core/Gltf.js` declares
  `useGLTF(path, useDraco, useMeshopt, extendLoader)` and calls
  `loader.setMeshoptDecoder(...)` whenever `useMeshopt` is not explicitly
  false. Every call site in `Scene.tsx` passes only the path, so the default
  applies.
- `MeshoptDecoder` is a **static** import from `three-stdlib`, so it is already
  in the bundle today whether or not any model uses it.
- `three-stdlib/libs/MeshoptDecoder.js` instantiates its wasm from an inlined
  blob (`WebAssembly.instantiate(unpack(wasm))`). No network fetch, no CDN, no
  extra file to deploy — which matters because the site is a static export.

Draco was avoided for the opposite reason: drei defaults its Draco decoder path
to `https://www.gstatic.com/draco/versioned/decoders/1.5.5/`, so Draco would
have introduced a third-party runtime fetch on the landing page.

`three-stdlib`'s `GLTFLoader` also lists `KHR_mesh_quantization`,
`EXT_meshopt_compression` and `EXT_texture_webp` among its supported
extensions, so the two extensions these files now require are handled.

### Why not plain `optimize` — the silent break it would have caused

`Scene.tsx:2477-2478` recolours the pines by **material name**:

```ts
if (mat.name === "Green") mat.color.set("#356247");
if (mat.name === "Wood")  mat.color.set("#5d4030");
```

`optimize`'s defaults include `--palette true` and `--join true`. Running them
rewrites `pines.glb`'s materials from `["Wood","Green"]` to
`["PaletteMaterial001"]`. Nothing would throw. The page would still load, every
test would stay green, and the pines would quietly render in their raw source
colours instead of the tuned ones. That is why `palette`, `join` and `flatten`
are switched off.

This is not a hypothetical. It was run as a negative control, and the gate
caught it:

```
FAIL pines.glb: materials changed ["Wood","Green"] -> ["PaletteMaterial001"]
FAIL pines.glb: primitive count 2 -> 1
FAIL cabin.glb: triangle count 4355 -> 4053
GATE: FAIL (10)
```

The destructive variant saved 289,412 bytes against the safe variant's 296,020
— **6.6 kB more**, for a scene that renders wrong. Not a trade worth making.

`--simplify` is off for the same class of reason: it is lossy geometry
reduction on a hero scene, and the visual gate that would have to approve it
belongs to a different node.

### The gate, and proof it can fail

[`tools/glb-compare.mjs`](./tools/glb-compare.mjs) asserts, per file: material
names, mesh names, primitive count, image count and triangle count all
unchanged; vertex count never grows; world-space bounding box drift within
tolerance. [`tools/glb-probe.mjs`](./tools/glb-probe.mjs) reads the GLB JSON
chunk directly, so it shares no code with the tool it is judging.

Re-run it against any two directories:

```
node perf/tools/glb-compare.mjs <beforeDir> <afterDir>
```

Two assertions were **renegotiated in place** during this pass, both because
the assertion was wrong rather than the data. Both reasons are recorded as
comments at the assertion:

1. **"Vertex count must be identical" → "triangle count identical, vertices may
   only decrease."** `weld` merges bitwise-duplicate vertices, which is
   lossless — `cabin.glb` legitimately goes 7,050 → 6,519 while its 4,355
   triangles are untouched. Triangle count is the real invariant.
2. **Absolute position tolerance → tolerance relative to model extent.** The
   first version compared raw accessor `min`/`max` and reported ~2^15 of
   "drift" on every file. That was a units bug, not damage:
   `KHR_mesh_quantization` stores POSITION as normalized integers and moves the
   dequantization onto the node transform, so the probe now divides by the
   component maximum and applies the node hierarchy. Once fixed, `cabin.glb`
   still failed at 0.049 — but the cabin is authored ~1,550 units across, so
   that is 0.003%, below the 14-bit quantization floor. Scale is not error.

The relative tolerance is 1e-4, deliberately just above meshopt's theoretical
14-bit floor of 1/16384 = 6.1e-5. It is not a check that cannot fail: the
broken-transform runs scored ~1e4 relative, four orders of magnitude over, and
the negative control above failed on four separate assertions. Measured drift
on the shipped files is 1.66e-5 to 3.30e-5.

### Honest limits of what was measured

- Bounding-box drift is an **extremes-only** proxy. It cannot see interior
  vertex or normal precision, so `--meshopt-level high` was chosen on the
  grounds that these are flat-shaded low-poly meshes carrying only POSITION and
  NORMAL (no tangents, and three of six have no UVs at all) — not on the
  grounds that interior fidelity was independently verified. It was not.
- `medium` was measured as the fallback: **319,920 bytes, −47.0%**, identical
  triangle counts and identical bbox drift. If the orchestrator's visual gate
  flags shading on the cabin, changing `--meshopt-level high` to `medium` and
  re-running costs 23,900 bytes and nothing else.
- No visual gate was run here. `npm run test:ui` and `meadow-proof.mjs` are the
  orchestrator's to run.

### Textures were left alone

`cabin`, `campfire` and `lantern` carry one PNG each (24 kB / 130 kB / 15 kB);
the other three are untextured. WebP conversion was attempted and **failed** —
the CLI's encoder aborted with `error: colourspace: parameter space not set` on
all three. Rather than ship a half-applied pass, `--texture-compress false` was
set for every file so the recipe is uniform and the textures are byte-identical
to before. `campfire.glb`'s modest 14.3% is explained entirely by this: it is
mostly that 130 kB PNG, which this pass did not touch.

Left for a later node: those three textures are the largest remaining model
win, and KTX2 would additionally cut the 5.59 MB *VRAM* figure `cabin.glb`
reports — but KTX2 needs a transcoder wired into the loader, which is a
component change.

---

## PB03 — bundle analyzer

`app/next.config.mjs` gained an ANALYZE-gated wrapper; `app/package.json`
gained the devDependency and the `analyze` script. Nothing else in either file
changed — `reactStrictMode`, `experimental.externalDir`, the `env` block, the
`deploymentId` resolution and the whole `ghPages` branch are untouched, and
were re-read out of the loaded config to confirm it.

The import is **inside** the flag rather than at the top of the file:

```js
const withBundleAnalyzer =
  process.env.ANALYZE === "1"
    ? (await import("@next/bundle-analyzer")).default({ enabled: true })
    : (config) => config;
```

A top-level import would make every ordinary build — local, CI, and the
GH_PAGES export — hard-fail whenever the package is not installed. Verified
both ways:

```
ANALYZE unset : loaded OK; keys = reactStrictMode,experimental,env
                reactStrictMode = true · externalDir = true
                env = {"NEXT_PUBLIC_BASE_PATH":"","NEXT_PUBLIC_DEPLOYMENT_ID":"development"}
ANALYZE=1     : FAILED with ERR_MODULE_NOT_FOUND
```

**`@next/bundle-analyzer` is declared but not installed.** `npm install` was
deliberately not run: it rewrites `app/package-lock.json`, which is outside
this node's write-set, and churns `node_modules` while four other agents are
running `tsc` and Playwright against it. Someone must run `npm install` in
`app/` once before `npm run analyze` will work. Until then the default build
path is entirely unaffected, which is the point of the guard.

The analyzer was **not run** — it is a full build, which this node is barred
from. So the PB03 questions it exists to answer (is three/r3f reaching non-story
routes, is wagmi/viem confined to chain surfaces, is maplibre confined to
`/land`) are **not answered here**. The tooling is in place; the treemap and any
`next/dynamic` moves are the next node's work.

One caveat on the script: `"analyze": "ANALYZE=1 GH_PAGES=1 next build"` is
POSIX shell syntax and will not set the variables under Windows PowerShell.
There it needs `$env:ANALYZE='1'; $env:GH_PAGES='1'; npx next build`.

---

## PB03 — font audit

Four `@fontsource-variable` families are declared in `package.json`. Three are
imported in `app/app/layout.tsx` and all three are genuinely referenced:

| family | imported | referenced | verdict |
|---|---|---|---|
| space-grotesk | yes | `--st-display-font`, Tailwind `font-display`; also read from `node_modules` by `scripts/build-social-card.mjs` | keep |
| manrope | yes | `--st-body-font`, Tailwind `font-sans`; also read by `build-social-card.mjs` | keep |
| jetbrains-mono | yes | `--st-mono-font`, Tailwind `font-mono` | keep |
| **inter** | **no** | **nowhere** | **dead — reported, not removed** |

`@fontsource-variable/inter` is imported by no file and named by no
`font-family` declaration or Tailwind entry anywhere in the repo.

**It costs zero shipped bytes.** Because nothing imports it, no bundler ever
reaches it — removing it is dependency hygiene, not a payload win, and it
should not be counted as one. Per the brief a font removal wants a visual gate,
so it is reported and left in place.

### Separate live bug found during the audit — outside this write-set

`--st-sans-font` is used four times in `app/app/globals.css` (lines 474, 560,
576, 711) and **defined nowhere in the repo**. Only `--st-display-font`,
`--st-body-font` and `--st-mono-font` are declared, at lines 107-109. Those
four declarations resolve to nothing and are dropped, so the affected elements
— including `.quote-file input` and `.rfq-form select` — silently inherit
rather than taking the intended sans face. The likely intent is
`--st-body-font`.

Not fixed here: `globals.css` is outside this node's write-set, and a font-face
change wants a visual gate.

---

## What this node deliberately did not do

- No component was touched, and nothing was moved behind `next/dynamic`.
- The analyzer was not run, so no bundle-composition claim is made.
- The unused `inter` dependency was not removed.
- The `--st-sans-font` bug was not fixed.
- `npm install` was not run, so `npm run analyze` does not work yet.
- Textures were not recompressed; the WebP attempt failed and was reverted
  rather than half-applied.
- `PB01-baseline-2026-08-14.json` was not edited. It is the contract; this pass
  records a delta against it and leaves it alone.
- `projectedTotalStaticAssetBytes` (4,588,115) in the delta file is flagged
  `projectionIsUnverified: true`. It is arithmetic on the baseline assuming
  `public/` assets are inside that figure — not a measurement. The
  orchestrator's post-build capture is the authority on the after-state.

Originals: the pre-optimization GLBs are recoverable from the previous commit,
and were also staged at `C:\tmp\pb02\` during this session.

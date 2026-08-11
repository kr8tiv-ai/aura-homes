# The Builder Engine — a decision

*Written Aug 11, 2026. This is a decision document, not a survey. It closes questions; it does not present options.*

**Read this before adding any geometry, CAD, or BIM dependency to this repo.** The
short version is that we add none of them before the Aug 21 deadline, and the
measurements say that is the fast choice as well as the safe one.

---

## 0. What this decision was built on — and what is missing

Honesty first, because the rest of the document is only worth as much as its
provenance.

**Delivered to me:** two sweeps.

| Sweep | State | What it covered |
|---|---|---|
| `kernels` | Complete | Solid-modelling kernels, triangulation, 2D offsetting. 12 packages installed, benchmarked in Node, winners re-verified in Chromium 148 over HTTP. |
| `elements` | Findings complete, **summary truncated** | Building-element libraries, BIM interop, and NBC 9.8 stair code. The stair section cuts off mid-sentence at `"RISE — Table 9.8.4.1, forming part of Sentenc"`. |

**Not delivered:** sweeps 3 and 4. I was told four were complete; two arrived. I
do not know what they covered. Judging by the sections this document was asked
to contain, they were probably **solar** and **textures/materials**. I have
written those rows of the stack table from what I verified in this repo
first-hand, and labelled them as such. **Nothing in this document is invented to
fill a gap left by a sweep I never saw.**

**Verified by me, in this repo, today** (this is the third source, and on two
points it overrules both sweeps):

- `app/package.json` — `three@0.169.0`, `@react-three/fiber@8.18.0`,
  `@react-three/drei@9.122.0`, MIT, private.
- `app/node_modules/three@0.169.0` — licence MIT; `src/extras/Earcut.js` is
  17,687 bytes; `src/extras/ShapeUtils.js` contains
  `import { Earcut } from './Earcut.js'` and `Earcut.triangulate( vertices, holeIndices )`.
- **None** of `earcut`, `manifold-3d`, `@jscad/modeling`, `clipper2-js`,
  `three-bvh-csg`, `web-ifc`, `@thatopen/components`, `straight-skeleton` are
  installed. The dependency tree is clean.
- `app/lib/builder/` already contains `geometry.ts` (66,327 B), `toPlan.ts`
  (59,032 B), `share.ts` (32,489 B), `exportSpec.ts` (27,813 B), `drawings.ts`
  plus `drawings/{kit,model,sheets}.ts` (169,870 B).

---

## 1. The verdict

**We build the engine on what is already here: React Three Fiber over
`three@0.169.0` for the view, and analytic composition — plain arithmetic that
emits named boxes — for the geometry, with `three`'s own bundled Earcut doing
the one triangulation job that needs a triangulator. We add zero geometry
dependencies before Aug 21.** The `kernels` sweep benchmarked this exact
question in a real browser and analytic composition beat the best CSG kernel by
**125×** and the popular three.js CSG library by **3,843×** at 32 openings,
while matching CSG's volume to 1e-9 — and `app/lib/builder/geometry.ts` already
implements it, having reached the same conclusion independently before the sweep
ran (see its `prism()` comment: *"WHY NOT CSG… a hole in a flat wall is a 2D
problem, so it is solved in 2D"*). What we **deliberately do not** build on:
**any GPL or AGPL tool** — which rules out the four best pieces of engineering
in this field, `chili3d`, `xeokit-sdk`, Blender/Bonsai and Sweet Home 3D, all
confirmed AGPL or GPL and therefore unshippable in an MIT static site; **any
OCCT-derived kernel**, because the `kernels` sweep dumped the
`replicad-opencascadejs` WASM binary and found 604 `BRepBuilderAPI` / 850
`Geom_` / 473 `opencascade` symbol occurrences inside a package whose
`package.json` declares `"license":"MIT"` — that is LGPL-2.1 code wearing an MIT
label, and we do not ship it under any framing; and **any parametric
building-element library**, because the `elements` sweep proved by exhaustive
registry search that none exists under a permissive licence — GitHub's entire
public index returns **five** repositories for `"parametric stair"`, all at zero
stars. `manifold-3d` (Apache-2.0, 222 KB gzip, browser-verified with no
COOP/COEP requirement) is **approved and deferred**: it is the correct kernel
for export, mitred roofs and self-validation, and none of those land before the
deadline. The ten days go into **first-party TypeScript generators** — stairs,
railings, deck framing, wall assemblies, SIP panelisation — because that is the
work no library can do for us, and because writing it costs zero bytes, zero
licence surface, and zero risk to a working R3F 8 render stack.

---

## 2. The licence-cleared stack

One row per layer. **Status** is the decision; **size** is measured, not
estimated. Where two sources measured the same artifact, both figures appear.

| Layer | Chosen | Licence | Size (measured) | Status | Why it won |
|---|---|---|---|---|---|
| **Renderer** | `three@0.169.0` + `@react-three/fiber@8` + `@react-three/drei@9` | MIT (verified in `node_modules/three/package.json`) | Already shipped | **In use** | Already the dependency; already carries the landing page's camera journey, postprocessing and custom shader injection. Any library demanding `three >= 0.182` is a rendering-stack migration in disguise — see §3. |
| **CSG / kernel (hot path)** | **Analytic composition** — first-party, ~40 lines, no dependency | N/A (code we own) | 0 bytes | **In use**, in `geometry.ts` | Browser-measured at 0.0046 / 0.0146 / 0.0544 ms for 1 / 8 / 32 openings vs manifold's 0.6 / 2.4 / 6.8 ms and three-bvh-csg's 2.5 / 18.1 / 209.1 ms (`kernels`). Volume identical to CSG to 1e-9. Decisive reason is not speed: it preserves **named parts** (pier, sill, header, jamb) with exact numbers, which is what a dimensioned drawing consumes. CSG returns triangle soup and destroys the identity of what it built. |
| **CSG / kernel (heavy, off-loop)** | `manifold-3d` | **Apache-2.0** (verified in `package.json` **and** the shipped 11.1 KB LICENSE) | wasm 529 KiB raw / **203 KiB gzip**; glue 73 KiB / 19 KiB gzip → **~222 KB gzip** | **Approved, deferred past Aug 21** | The only kernel in the sweep whose correctness was *proven*: genus exactly equal to opening count at 1/4/8/16/32, volume error 0.0, `NoError` throughout, and it survived all six degenerate cases a slider produces. Critically for GitHub Pages: browser-verified running with `crossOriginIsolated === false` and `SharedArrayBuffer === undefined` — **no COOP/COEP headers needed**, which a static host cannot set. |
| **2D triangulation** | **Earcut — already inside `three`** | MIT (as part of `three`) | `three/src/extras/Earcut.js` = 17,687 B, **already paid for** | **In use** | This overrules the `kernels` sweep, which recommended adding `earcut` (ISC, 9 KB). I verified `ShapeUtils.triangulateShape` calls `Earcut.triangulate`, and `geometry.ts` already routes wall-with-hole faces through it (`prism()`). Adding the npm package duplicates a triangulator we already ship. The sweep's *correctness* finding still stands and is why we keep using it: deviation ~1e-16 at every hole count, and it tolerates a hole vertex sitting on the outer contour — a door running to the floor line — which `poly2tri` refuses outright. |
| **2D offsetting / boolean paths** | **None** — first-party convex clip + inset in `geometry.ts` | N/A | 0 bytes | **In use**; `clipper2-js` **rejected for now** | `geometry.ts` already has `clipToHalfPlanes` / `insetConvex`, exact because both operands are convex. Clipper2 (Boost-1.0, exact integer predicates, 186 KB ESM, 0.0225 ms per inset) is the right answer *if* we ever need non-convex offsetting — but the JS port is **untouched since 2024-01-01** and ships **no LICENSE file at all**, only the `package.json` field. If adopted: pin it, vendor the 186 KB, and copy the Boost licence text in ourselves. |
| **IFC interop** | `web-ifc` — **write path only**, dynamically imported | **MPL-2.0** — *not* MIT. File-level copyleft: fine to ship unmodified; any file we edit must stay MPL-2.0 and be published | ~**991 KB gzip** (`elements`) / ~**0.9–1.0 MB transfer** (repo's own Aug 2026 measurement in `exportSpec.ts`) | **Approved, deferred** — trigger below | Both sweeps and the repo agree it is the only browser-native library that can *write* IFC. It is the difference between "your designer can look at it" and "your designer can work in it". Deferred because the current export surface is ~20 kB gzip and this is a fiftyfold increase for one button — and because authoring a valid IFC entity graph by hand is days of work, not an afternoon. **Trigger to adopt:** a real user asks for IFC instead of glTF, or Phase-5 compliance work starts. |
| **Solar** | **First-party `parcel.ts`** — orientation geometry only | N/A | 0 bytes | **In use** | ⚠️ **No sweep delivered on this layer.** Sourced from the repo: `app/lib/design/parcel.ts` implements `solarFinding()` against `SOLAR_WINDOW_DEG = 30`, and states in its own copy that *"Aura has not modelled solar gain for your site — that is a calculation on real weather data and real horizon shading."* That is the honest position and it stays. A real gain model needs weather data with its own licence — **unresearched; do not assume permissive.** |
| **Textures / materials** | **Unresolved** | — | — | ⚠️ **No sweep delivered. Open question.** | I will not name a texture source I have not licence-checked. What is known from the repo: `design-api/README.md` already applies the discipline that matters here — *the code licence and the data/weights licence are separate*, which is how HouseDiffusion was caught (GPL-3.0 code **and** RPLAN research-only data) and why `flux-schnell` (Apache-2.0 weights) is the default over `flux-dev` (non-commercial). Any texture library, HDRI set or PBR pack gets the same two-part check before it enters the repo. |
| **Export** | `GLTFExporter` + `OBJExporter` (from `three`) + HomeSpec JSON | MIT (part of `three`) | **~20 kB gzip, already paid for** | **In use**, `exportSpec.ts` | glTF 2.0 is a Khronos royalty-free open standard read by Blender, SketchUp, Rhino, Unreal, Unity and every free web viewer; OBJ is the lowest common denominator that always opens; JSON is the only export that round-trips back into the builder. Deterministic — no timestamps, no random ids — so exports are diffable. |

**A note on the unit convention, so nobody "fixes" a non-bug.** The two sweeps
appear to disagree on three sizes. They do not. `manifold.wasm` reported as
"529 KB" and as "541,470 bytes" is the same file (541,470 ÷ 1024 = 528.8 KiB);
`@jscad/modeling` at "245 KB" and "250,793 bytes" is the same file;
`opencascade.js` at "66.7 MB" and "63.6 MB" is the same package (decimal MB vs
MiB). One sweep reported KiB and called it KB; the other reported raw bytes.
Every figure cross-checks.

---

## 3. Rejected, and why

### The GPL/AGPL family — first, because these are the ones everyone will suggest

These are not marginal projects. **They are the best work in the field**, and we
cannot ship a single byte of any of them. Say it out loud in the repo before
someone falls in love with one in month three.

| Tool | Licence (verified) | Signal | Why it is dead to us |
|---|---|---|---|
| **chili3d** | **AGPL-3.0** | 4,725 stars, pushed 2026-08-05 | The most advanced browser-native CAD kernel written in TypeScript. Exactly what this project would want to be built on. Unusable. |
| **xeokit-sdk** | **AGPL-3.0** | 921 stars, pushed 2026-08-04 | The best-engineered open-source BIM viewer on the web. Serving an AGPL bundle to a browser is *conveying over a network* under §13. xeokit sells a commercial licence — that is the only legal route. |
| **Blender + Bonsai/BlenderBIM** | **GPL** | — | External handoff only. The user opens their own exported glTF/IFC in it. Never linked, vendored or bundled. |
| **Sverchok** | **GPL-3.0** | 2,506 stars | The parametric node system people cite as "just use that". It is a GPL Blender add-on. It cannot cross into this repo in any form. |
| **Sweet Home 3D** | **GPL** | — | Named in the brief; confirming it is off the table. |
| **BIMserver** | **AGPL-3.0** | 1,735 stars | Also a server, which breaks the static-site constraint independently. |
| **bldrs-ai/Share** | **AGPL-3.0** | 181 stars | Same reason. |
| **Ladybug Tools core** (`ladybug-geometry`, `honeybee-core`) | **AGPL-3.0** both, pushed 2026-08-10 | — | Do not let *"Ladybug is open source"* become *"Ladybug is usable"*. Only `honeybee-schema` is permissive (BSD-3-Clause, though npm mislabels it MIT) and it models **energy**, not elements. |
| **Gleinkaa/railing-generator** | **AGPL-3.0** | 0 stars | The only thing on GitHub claiming to be a parametric compliant-railing generator with a bill of materials. Forbidden *and* unproven. |

### The LGPL trap — an MIT badge over an LGPL kernel

This is the most important licence finding across both sweeps, and it was proven
at the binary, not read off a manifest.

**`replicad-opencascadejs` is mislabelled.** It ships `package.json`
`{"license":"MIT"}` and a bare MIT LICENCE naming QuaroTech Sàrl, with **no LGPL
notice and no Open CASCADE copyright notice anywhere in the package**. The
`kernels` sweep dumped the 10.35 MB WASM and counted the symbols: **604**
`BRepBuilderAPI`, **850** `Geom_`, **323** `BRepPrimAPI`, **266** `TopoDS`,
**236** `BRepMesh`, **227** `ShapeFix`, **198** `BRepAlgoAPI`, **62**
`STEPControl`, **473** literal `"opencascade"`. That is Open CASCADE Technology,
which is **LGPL-2.1**. QuaroTech has no authority to relicense OCCT to MIT.
**Verify licences at the binary, not the manifest.**

On the famous OCCT exception, since it will come up: the sweep read
`OCCT_LGPL_EXCEPTION.txt`. It is narrow — it permits header-file material to
appear in object code given prominent notice. It grants **no general
static-linking relief** and **does not waive the LGPL relink requirement**. A
WASM blob statically bundled into a JS app on a static site is precisely the
murky case. Any use needs a lawyer's sign-off. The safer alternative is already
chosen: `manifold-3d`, Apache-2.0, no exception required.

| Rejected | Licence | Measured cost | Also |
|---|---|---|---|
| `replicad` + `replicad-opencascadejs` | MIT wrapper over **LGPL-2.1 OCCT**, falsely labelled | 10.35 MB raw / **4.4 MB gzip** WASM (≈20× manifold) | `replicad` itself is honestly MIT and well maintained. It is inert without the WASM. |
| `opencascade.js` | **LGPL-2.1** | **66.7 MB** unpacked | And dead: npm `latest` is **1.1.1 from 2020-09-27**; repo last pushed 2023-08-15. Fails on licence, maintenance **and** size independently. |
| `occt-import-js` | **LGPL-2.1** | 11.07 MB unpacked, last publish 2024-12-03 | Same LGPL-in-WASM exposure. |
| `IfcOpenShell` | **LGPL-3.0**, 2,702 stars | — | High risk, not merely "ask a lawyer". Safer alternative already recommended: `web-ifc` (MPL-2.0) does the read/write job. |
| `CadQuery` / `build123d` | Apache-2.0 wrappers over **LGPL OCCT** via `cadquery-ocp` | `cadquery-ocp` wheel **64.8 MB** + Pyodide core 2.67 MB ⇒ **~70 MB+** before the user sees a wall | Both projects are excellent and healthy. Rejected **for in-browser on size alone**, licence problem behind it. Fine as an opt-in server-side path outside the static site. |
| `FreeCAD` | LGPL-2.1 with GPL parts | — | External handoff only. |

### Rejected on correctness or maintenance, not licence

| Rejected | Licence | The disqualifier |
|---|---|---|
| **`three-csg-ts`** (and the whole `csg.js`/ThreeCSG fork family) | MIT — the licence is fine, **the code is not** | **It silently corrupts geometry.** On a 1e-5 m sliver cutter — a user dragging a width slider toward zero — it returned volume **2.699995** against an expected **5.399997**. It deleted half the wall and threw no error, no warning, nothing. Every other library in the sweep, *including the ones rejected on licence*, got that case right. Also 761 ms and 9,002 triangles at 32 openings (13.8× manifold's triangle count). Last publish 2024-05-28. A library that returns confidently wrong geometry during a normal slider drag cannot be in a product that emits construction drawings. |
| **`three-bvh-csg`** | MIT | Not corrupt — just too slow for what it is marketed for. Browser-measured **18.1 ms at 8 openings on one wall**, which exceeds a whole 16.7 ms frame budget before any other wall is touched; **209 ms at 32** (4.8 fps). Its own README calls it *"an experimental, in progress"* implementation, warns output *"may not be correctly completely two-manifold"*, and points CAD users to Manifold. Triangle bloat rises 2.0× → 4.87× vs manifold, and over 25 sequential re-cuts the mesh grew monotonically 340 → 373 → 392 — a long editing session silently accumulates geometry. **Never let its output feed the blueprint engine.** |
| **`poly2tri`** | BSD-3-Clause (GitHub's API misreports NOASSERTION) | Throws on input this domain produces constantly: a door whose opening runs to the floor line puts a hole vertex on the outer contour, and it raises `PointError: poly2tri EdgeEvent: Collinear not supported!`. Earcut triangulates the identical input without complaint. Also npm **1.5.0 from 2017-04-17** — nine years. |
| **`react-planner`** | MIT | Checked, then rejected. The `elements` sweep enumerated its catalog via the GitHub API: **52 items, of which exactly one is a stair** — `simple-stair`, a fixed demo prop with no code awareness. Last push 2024-04-20, React 16-era. Adopting it means inheriting a dead app to get a decorative staircase. |
| **`furnishup/blueprint3d`** | MIT | Dead since 2021-01-20. 2D floorplan → extruded walls only. No stairs, no roofs, no layered assemblies. |
| **`@speckle/objects`** | — | **Does not exist on npm.** The `elements` sweep searched the registry. Speckle's AEC object model (`Wall`, `Stair`, `Railing`, `Roof`) is a **.NET** library. Anyone who says "just use Speckle's object model in TypeScript" has not checked. (Also worth citing precisely: Speckle is Apache-2.0 *except* `packages/server/modules/workspaces/` and `gatekeeper/`, which are proprietary Enterprise Edition.) |
| **`Archimatix`** | Unity Asset Store commercial | Wrong licence and wrong runtime. Dead end twice over. |
| **`straight-skeleton`** | MIT — genuinely clean | **Deferred, not rejected.** It is the correct roof primitive (a straight skeleton of a footprint *is* a hip/valley roof), browser-verified turning an L-footprint into 6 roof faces. But it costs **336 KB gzip** with the WASM welded into the JS so it cannot be code-split, it is a **one-maintainer, 85-star** project, and its input contract is strict and undocumented (CCW outer ring, CW holes, every ring closed) — it returns `null` on violation. **`spec.ts` only expresses rectangular volumes**, so we do not need arbitrary-footprint hip roofs yet. When we do: vendor the dist file. |
| **`rhino3dm`** (MIT, 6.39 MB) and **`maker.js`** (Apache-2.0, maintenance mode) | Clean licences | **Hold.** `rhino3dm` is the only permissive NURBS option, but it is a geometry *library*, not a kernel — no booleans, no solid modelling. Adopt only if curved walls or curved stair flights ever need true NURBS. `maker.js` earns its place only if the blueprint engine needs **DXF out** in the browser — and a ~30 KB first-party DXF writer is the lower-risk path. (Note: the Python service already emits DXF via `ezdxf`; the browser path does not, and says so.) |

### Two corrections to things this repo already believes

1. **`design-api/README.md` (last line) recommends adopting
   `@thatopen/components` as "MIT, Three.js-native".** That is incomplete and
   should be corrected. The toolkit *is* MIT — but it does not author IFC;
   `web-ifc` does, and `web-ifc` is **MPL-2.0**. Worse, the repo's own
   `exportSpec.ts` found the blocker: **`@thatopen/components@3.4.8` declares a
   peer dependency of `three >= 0.182.0`, and this app is on `three@0.169.0`**
   with R3F 8 and drei 9. Adopting the toolkit is a thirteen-minor `three`
   upgrade underneath a working camera journey, postprocessing stack and custom
   shader injection — *a rendering-stack migration wearing an export button's
   clothes*. `web-ifc` alone has **zero dependencies and no `three` peer**, so
   the write path does not force this. Only the toolkit does.
2. **The `kernels` sweep's framing of manifold as "the kernel Blender adopted
   for booleans" is too strong.** Blender added Manifold as an **additional**
   solver alongside Float and Exact (PRs #136902, #137915); it did not replace
   them, and it only accepts strictly-manifold input. Still a strong
   endorsement — just not "Blender's boolean kernel".

---

## 4. Where the sweeps disagree

Surfaced rather than silently resolved, as instructed.

**D1 — `@jscad/modeling`: adopt as the default element kernel, or not at all?**
This is a real disagreement and it matters, because it is a 60 KB gzip
decision.

- The **`elements`** sweep recommends *"adopt as the default element kernel"*
  and browser-verified it building a 15-riser NBC-compliant stair (rise 193.3 mm,
  run 265 mm, width 900 mm) with `union()` and `subtract()`.
- The **`kernels`** sweep declined to recommend it, calling it *"a reasonable
  no-WASM fallback; not a reason to skip manifold"*, on measurements: **39.7 ms
  at 32 openings**, **1,569 ms on a 12-sphere torture test vs manifold's 202 ms**
  (≈8× slower where it hurts), and a **1.2e-6 drift** on the sliver case where
  manifold's error was exactly 0.0.

**Resolution — they measured different workloads, and both are right.**
`kernels` benchmarked wall-opening booleans (the drag loop); `elements`
benchmarked stair generation (not the drag loop, and needing `extrudeLinear`,
`hull`, `offset`, `extrudeRotate`, which manifold does not conveniently
provide). **Decision: `manifold-3d` is the kernel of record. JSCAD is
conditional** — it enters only when a *named* generator demonstrably needs an
operation manifold lacks, and then it is imported dynamically, never into the
first-paint bundle. Neither lands before Aug 21.

**D2 — JSCAD in the browser.** `kernels` explicitly flagged it *"benchmarked in
Node only… you should not treat that as verified."* `elements` then verified it
in a real Chrome tab. **The observation wins.** Carry the gotcha it found:
importing `/node_modules/@jscad/modeling/src/index.js` as ESM **fails** with
`module is not defined` (the `main` field points at CommonJS `src/`) — use the
`dist` UMD bundle or let a bundler resolve it.

**D3 — `three-bvh-csg` in the browser.** `elements` said *"treat 'works' as
likely-but-unproven"*. `kernels` measured it in Chromium 148 with numbers.
**The measurements win**; the verdict is unchanged (rejected from both the drag
loop and the drawing path).

**D4 — `earcut` as a dependency.** `kernels` recommends adopting it. **I
overrule both sweeps on repo evidence**: `three@0.169.0` already bundles Earcut
(`src/extras/Earcut.js`, 17,687 B) and `geometry.ts` already uses it via
`ShapeUtils`. Adding the package duplicates a triangulator we ship today.

**D5 — `web-ifc` payload.** `elements` measured `web-ifc-api.js` at 5,903,794 B
raw / 507,643 B gzip. `exportSpec.ts` measured 3.54 MB minified / 391 kB gzip.
Different JS artifacts. **Both agree on the WASM (1.3 MB raw) and both land at
~1 MB total transfer**, so the conclusion is unaffected — but note that two
independent measurements converged, which is why the ~1 MB figure is trustworthy.

---

## 5. What we must write ourselves

**Blunt answer: everything that makes this a *home* builder rather than a *shape*
builder.**

The `elements` sweep did not merely fail to find a parametric building-element
library — it proved absence by exhaustive search, which is a far stronger
result:

- GitHub repository search for **`"parametric stair"` returns 5 repositories in
  the entire public index**, every one at **0 stars**: a GPL-3.0 FreeCAD macro,
  an unlicensed three.js toy, an MIT React spiral-stair configurator with no
  code awareness, a Maya plugin, and an empty repo.
- **`"railing generator"` returns 2**: one AGPL-3.0 at 0 stars, and an Arduino
  music toy.
- **`"BIM parametric elements javascript"` returns 0.**
- npm search for `parametric stair`, `railing generator`, `deck framing`,
  `procedural building generator` surfaces nothing relevant — top hits are
  `is-generator-function` and the Elgato Stream Deck SDK.

The near-misses fail structurally, not by obscurity: **COMPAS / `compas_timber`**
(MIT, ETH Zurich — genuinely the best permissive prior art for a timber element
model, with `Beam`, `Plate` and a real joint taxonomy of butt/lap/miter/tenon) is
**Python with no browser build**; **Speckle's** object model is **.NET**;
**Archimatix** is a commercial Unity asset; **Sverchok** is GPL.

So: **port the object model, write the generators.** Both `compas_timber` (MIT)
and Speckle's `BuiltElements` (Apache-2.0) permit copying the *structure* — that
is the legal shortcut available, and it is worth taking.

### The work, scoped

| Module | What it produces | Depends on | Est. |
|---|---|---|---|
| `spec.ts` **v2** — `Stair`, `Railing`, extend `Deck` | New spec fields | — | **0.5 d** |
| `share.ts` **v1→v2 migration** | Old links keep working | spec v2 | **0.5 d** |
| `generators/stair.ts` | Stringers, treads, risers, landings, from rise/run/width | spec v2 | **1.5 d** |
| `generators/railing.ts` | Posts, top rail, infill at ≤100 mm sphere | spec v2 | **1 d** |
| `generators/deckFrame.ts` | Ledger, beams, joists, posts, decking | spec v2 | **1 d** |
| `validation/nbc.ts` | Falsifiable rules with clause numbers (§6) | spec v2 | **1 d** |
| `generators/panels.ts` | SIP panelisation + buildability check (§7) | spec v2 | **1.5 d** |
| `generators/wallAssembly.ts` | Layered assembly (sheathing / core / sheathing / drywall) | spec v2 | **deferred** |

**A spec change is not free, and `spec.ts` says so in its own header.**
`share.ts` is a **positional tuple codec** — field order *is* the wire format —
so adding a `Stair` means a `SPEC_VERSION` bump. The migration slot exists at
`share.ts:667` and is **empty**: today it logs
`"this link is spec v{n} and no migration to v{N} exists yet"` and returns
`null`. **Bump the version without writing the migration and every share link
ever created dies silently-but-loudly.** That 0.5 day is mandatory, not optional.

### The rule for all of it: validation is a module, not a comment

Every constraint in §6 is a **falsifiable assertion carrying a clause number**.
A stair the user drags to a 210 mm rise must fail with
`NBC 9.8.4.1 — private stair maximum rise 200 mm`, not render silently. A check
that cannot fail turns "unverified" into "verified" without doing the work. The
existing `placeOpenings()` in `geometry.ts` is the pattern to copy — it already
reports openings that fall outside a wall, openings trimmed to fit, and
overlapping openings, each by name, each with the numbers on both sides.

---

## 6. The stair rules, as a specification

### Source, and its limit — read this before implementing

The `elements` sweep's verbatim text is the **British Columbia Building Code
2018, Division B, Part 9, Section 9.8** (`free.bcpublications.ca`), which
reproduces **NBC 2015 Section 9.8 clause-for-clause including the article
numbering**. The sweep **did not read NBC 2020 Div. B 9.8 verbatim** — it is
behind NRC registration. Every value was cross-checked against the **City of
Edmonton Uncovered Deck Design Guide**, which cites NBC(AE) directly, and the
two agree.

**Alberta's code in force today is ABC / NBC(AE) 2023, based on NBC 2020.** Treat
these values as stable across NBC 2015 → 2020, but **the builder's UI must cite
the edition in force**, and a licensed residential designer confirms against the
current ABC before anything is sealed.

**⚠️ The sweep's summary was truncated mid-sentence** at
`"RISE — Table 9.8.4.1, forming part of Sentenc"`. Rules below are therefore
labelled by confidence:

- **[VERBATIM]** — the sweep quoted the clause text directly.
- **[CROSS-CHECKED]** — the value appears in the sweep's confirmed
  BCBC-vs-Edmonton agreement list, but the clause text was cut off. Implement,
  then verify the article against the current ABC before it reaches a drawing.
- **[NOT COVERED]** — the sweep did not reach it. Do not invent a number.

`"Private stair"` is defined in the notes to Tables 9.8.4.1 and 9.8.4.2:
exterior and interior stairs serving **single dwelling units**, or garages
serving single dwelling units. Everything below is the private-stair case.

### Stairs

```ts
// validation/nbc.ts — private stairs, single dwelling unit
// Units: millimetres. HomeSpec is in feet; convert once at the boundary.

WIDTH_MIN_MM            = 860   // [VERBATIM] 9.8.2.1(2) exit stairs serving a single
                                //            dwelling unit; and 9.8.2.1(4) at least one
                                //            stair between each floor level within a
                                //            dwelling unit, and exterior stairs serving
                                //            a single dwelling unit.

PROJECTION_MAX_MM       = 100   // [VERBATIM] 9.8.7.6(1) handrails, handrail supports and
                                //            stringers may project no more than 100 mm
                                //            into the REQUIRED width.
// THE TRAP: an 860 mm stair with a handrail is legal; an 860 mm stair with a
// 130 mm-deep handrail assembly is NOT. Validate CLEAR width after subtracting
// any projection over 100 mm. This is the rule a naive implementation misses.

HEADROOM_MIN_MM         = 1950  // [VERBATIM] 9.8.2.2(3) clear height over stairs serving
                                //            a single dwelling unit (≥ 2050 mm elsewhere).
HEADROOM_OVER_LANDING_MM= 1950  // [VERBATIM] 9.8.6.4(2) over landings serving a single
                                //            dwelling unit.
// [VERBATIM] 9.8.2.2(1) measurement method: vertically, over the clear width,
// from a straight line TANGENT TO THE TREAD AND LANDING NOSINGS to the lowest
// point above. Not floor-to-ceiling — implement the tangent line or the check
// is decorative.

RISE_MIN_MM             = 125   // [CROSS-CHECKED] Table 9.8.4.1
RISE_MAX_MM             = 200   // [CROSS-CHECKED] Table 9.8.4.1
RUN_MIN_MM              = 255   // [CROSS-CHECKED] Table 9.8.4.2
RUN_MAX_MM              = 355   // [CROSS-CHECKED] Table 9.8.4.2
// Tread depth limits: [NOT COVERED] — the sweep was truncated before them.
// Do NOT guess. Read Table 9.8.4.2 in the current ABC before implementing.

HANDRAIL_HEIGHT_MIN_MM  = 865   // [CROSS-CHECKED] (NBC 9.8.7)
HANDRAIL_HEIGHT_MAX_MM  = 1070  // [CROSS-CHECKED]
// Article-level citation not captured verbatim by the sweep. Confirm before
// the number reaches a sealed drawing.
```

**Uniformity within a flight: [NOT COVERED].** NBC constrains variation between
rises and between runs in a single flight, and it is one of the most commonly
failed items on inspection. The sweep did not reach the clause. **A generator
that divides total height by a chosen riser count and rounds will produce a
non-uniform flight and pass every check above.** Look this up before shipping
`generators/stair.ts`.

**Cross-check that the numbers are usable:** the `elements` sweep built a
15-riser flight at **rise 193.3 mm, run 265 mm, width 900 mm** and called it
NBC-compliant. That sits inside every bound above — 193.3 < 200, 265 ∈
[255, 355], 900 > 860 — which is a useful sanity anchor for the first test case.

### Guards

```ts
GUARD_HEIGHT_INTERIOR_MM = 900   // [CROSS-CHECKED] within a dwelling unit
GUARD_HEIGHT_MIN_MM      = 1070  // [CROSS-CHECKED] the higher case
// ⚠️ WHICH CASE TRIGGERS WHICH HEIGHT is governed by the height of the walking
// surface above adjacent ground/floor. The sweep reported both values but the
// SWITCHING THRESHOLD is [NOT COVERED]. This matters enormously for a deck:
// it is the difference between a 900 mm and a 1070 mm guard on the same build.
// Read NBC 9.8.8 in the current ABC. Do not pick one and hope.

SPHERE_MAX_MM            = 100   // [CROSS-CHECKED] no opening in a guard shall permit
                                 // the passage of a 100 mm sphere.
```

The 100 mm sphere rule is the one that constrains `generators/railing.ts`
geometrically: **infill spacing is derived, never chosen.** Given a clear span
between posts, solve for the smallest integer baluster count whose resulting
clear gap is < 100 mm, and emit the count and the gap as named outputs the
drawing can dimension.

**[NOT COVERED] and deliberately not guessed:** the climbability provision
(NBC restricts guard members that could form a ladder for a child). It shapes
railing design directly. Look it up.

### Decks

```ts
STRINGER_SPACING_MM = 900 | 1200  // [CROSS-CHECKED] City of Edmonton Uncovered Deck
                                  // Design Guide, citing NBC(AE). The sweep reported
                                  // "stringer spacing"; in a deck context this is
                                  // almost certainly JOIST spacing — the guide's span
                                  // tables are indexed by joist spacing, and it varies
                                  // with member size and species.
// ⚠️ TREAT AS A PARAMETER, NOT A CONSTANT. Do not hard-code 900 or 1200 as
// though they were universal. `generators/deckFrame.ts` takes spacing as an
// input and cites the guide's table row that justified it.
```

The **span tables** — joist size vs spacing vs allowable span, beam size vs post
spacing, ledger fastening schedules, pile/footing sizing — are **[NOT COVERED]**
by the delivered sweeps. They are also exactly where a deck generator either
becomes useful or becomes dangerous. **`generators/deckFrame.ts` ships as a
massing and layout tool with member sizes named as INPUTS, and every sheet keeps
the existing `NOT FOR CONSTRUCTION` stamp**, until a real span table is sourced
and cited. That is consistent with standing repo doctrine (`AI-HANDOFF.md`: the
screw-pile foundation needs a P.Eng; the truss design arrives stamped from the
plant).

---

## 7. The SIP-panel reality

**The point of this section:** a builder that lets someone drag a 40-foot
unbroken wall with a 30-foot window in it has produced a picture, not a
building. The panel plant is the real constraint, and it is upstream of
everything — it decides where walls can break, where openings can go, and how
long the lead time is.

### What this repo already knows, verified first-hand

| Fact | Source |
|---|---|
| SIP wall thickness **165 mm** (CLT 128, timber frame 190, rammed earth 450) | `app/lib/design/materials.ts` — and it is *modelled*, not drawn as a generic line: it changes the plan, the net area and the price per sq ft |
| **12–20 week lead time** from approved drawings, and *"no software shortens a panel plant's queue"* | `materials.ts` — *"Order at week zero"* |
| The kit is **"panels, splines, sealant"** | `materials.ts` BOM line — splines are the panel-to-panel joint, and therefore the module boundary |
| **Drywall goes over interior SIP faces regardless** | `AI-HANDOFF.md` (never un-learn) — the interior finish layer is not optional and belongs in the assembly |
| A screw-pile home's floor is legally a **floor over unheated space**: **RSI 5.02 / R-28.5 minimum** in zone 7A. **A 6½" SIP floor FAILS.** Spec **8¼–10¼" floor SIPs** (or added polyiso), pile-cap thermal breaks, a taped continuous under-floor air barrier, heat-traced boxed plumbing | `AI-HANDOFF.md` (founder's research notebook, Aug 2026) — *"Never quote the elevated design without them"* |
| Foundation is **screw piles on an ~8 ft grid**, never concrete | `materials.ts`, `geometry.ts` (`PILE_GRID_FT = 8`) |
| Glazing is checked against the **22% NBC 9.36 FDWR** prescriptive ceiling and trimmed with a warning naming the performance path | `design-api/README.md`, `lib/design/` |

### What is NOT verified, and must not be invented

**No sweep delivered on panel manufacturing constraints.** The numbers that
would make a buildability check real — **maximum panel length, panel width
module, maximum opening width before a structural header is required, minimum
pier width between openings, spline spacing, crane/transport limits** — are
**unsourced**. I will not write plausible dimensions into a repo whose stated
policy is that a plausible number in a gap costs a professional more to check
than to redraw.

**The honest shape of the fix, and it is better than a guess anyway:** these are
**plant parameters, not universal constants**. Different SIP manufacturers press
different billet sizes. So `generators/panels.ts` takes a **plant profile** —

```ts
interface PanelPlantProfile {
  supplier: string;          // an entry in data/alberta/suppliers.json, with a basis
  sourceDoc: string;         // the technical manual the numbers came from. REQUIRED.
  coreThicknessMm: number;   // 165 for the current SIP default
  panelWidthModuleMm: number;
  panelLengthMaxMm: number;
  openingMaxWidthMm: number; // beyond this, a header is engineered — flag, do not silently allow
  pierMinWidthMm: number;    // minimum panel between two openings
  splineType: string;
}
```

— and **refuses to run without one**, in the same spirit as `parcel.ts`
refusing to check solar orientation when it does not know where south is. An
empty profile produces a named gap, not a green check.

### The buildability rules the generator enforces once a profile exists

These are structural claims about *what a panelised wall is*, and they hold
regardless of which plant fills in the numbers:

1. **A wall longer than `panelLengthMaxMm` must break on a spline.** The
   builder shows the break. A wall the user cannot see the joints in is a wall
   they will be surprised by on site.
2. **An opening must not straddle a spline** without that being called out —
   it is a detail, and details cost money.
3. **An opening wider than `openingMaxWidthMm` requires an engineered header.**
   Flag it, name it, price it. Do not silently allow it and do not silently
   forbid it.
4. **The pier between two openings must be ≥ `pierMinWidthMm`.**
   `geometry.ts` already detects overlapping openings and reports them by name;
   this is the same check with a non-zero minimum.
5. **Panel count and panel schedule are outputs**, and they feed the BOM.
   This is the number that connects the toy to the 12–20 week queue — and it is
   the single most commercially useful thing this whole engine can emit.

**The prize.** Every other builder on the web produces a shape. A builder that
emits a **panel schedule a plant can quote from** is producing a purchase order.
That is the moat, and it costs 1.5 days plus one phone call to an Alberta
supplier for their technical manual.

---

## 8. The 10-day plan

**Deadline: Aug 21, 2026, 23:59 UTC** (`docs/AI-HANDOFF.md`). Today is Aug 11.
That is **10 days**, one operator, who is **also** mid-flight on the U4 buy flow
(task #15, in progress), and who still owes testnet deployment and a 90-second
demo video per `SUBMISSION.md`.

**A plan that assumes the builder engine gets all ten days is a lie.** Assume
roughly **half** of it. Everything below is scoped to that.

### The governing decision: zero new dependencies before Aug 21

Not caution — arithmetic. Every measurement in this document says the existing
analytic path is *faster* than the alternatives; `three` already ships the
triangulator; and the only library that would visibly change the demo
(`web-ifc`) costs ~1 MB and days of entity-graph authoring. `npm install`
before a deadline buys bundle weight, licence surface and a chance to break a
working R3F 8 render stack. **Nothing on the critical path needs one.**

### Priority order — what actually lands

| # | Day | Work | Why it makes the cut |
|---|---|---|---|
| **1** | 11 | `spec.ts` **v2**: add `Stair`, `Railing`; extend `Deck` with a railing. **Plus the `share.ts` v1→v2 migration in the same commit.** | Everything else blocks on it, and shipping the bump without the migration kills every existing share link (`share.ts:667` returns `null` today). Non-negotiable pairing. |
| **2** | 12–13 | `generators/stair.ts` — stringers, treads, risers, landing. Analytic boxes, same pattern as `geometry.ts`. | The single most visible missing element. `spec.ts` has `storeys: 1 | 2` and **no way to get between them**. A two-storey home with no stair is the demo's most obvious hole. |
| **3** | 13–14 | `validation/nbc.ts` — the §6 rules as falsifiable assertions with clause numbers, surfaced in the UI. | This is the differentiator, and it is cheap. Nobody else's web builder tells you *"NBC 9.8.4.1 — private stair maximum rise 200 mm"* while you drag. Ship the **[VERBATIM]** rules; mark **[CROSS-CHECKED]** ones as provisional in the UI copy; **omit [NOT COVERED] entirely rather than guess.** |
| **4** | 15 | `generators/railing.ts` — posts, top rail, derived infill at < 100 mm sphere. | Guards are required on the deck the brief promises on every home. Derived spacing is a 20-line solver and it demonstrates the whole thesis: *the code drives the geometry*. |
| **5** | 16 | `generators/deckFrame.ts` — ledger, beams, joists, posts, decking, spacing as a **parameter**. | The deck already exists in `spec.ts` as a box. Framing it is the visual upgrade with the best effort-to-impact ratio, and it wires straight into the BOM. |
| **6** | 17–18 | `generators/panels.ts` + `PanelPlantProfile` + the five buildability rules. **Requires one phone call to an Alberta SIP supplier for a technical manual.** | §7. The panel schedule is the commercial moat. **Make the supplier call on day 11**, not day 17 — if the manual does not arrive, the generator ships taking a profile and reporting an honest gap, which is still a working feature. |
| **7** | 19 | Wire generators into `toPlan.ts` and `drawings/sheets.ts` so stairs and guards appear on **A3 Floor Plan** and **A5 Elevations**, and validation results appear in the returned `notes`. | Otherwise the work is invisible to the judges. The 8-sheet set (A0–A7) already exists — this is plumbing, not new drawing code. |
| **8** | 20 | Buffer + the demo video. | Something always slips. If nothing has, this is where the video gets made properly instead of at 23:00 on the 21st. |
| **9** | 21 | Submission. Nothing new after 12:00 UTC. | — |

### Explicitly deferred, with the trigger that un-defers it

| Deferred | Trigger |
|---|---|
| **`manifold-3d`** (approved, Apache-2.0, 222 KB gzip) | The first time we need a **mitred roof, dormer, or a stair stringer through a sloping soffit** — non-orthogonal geometry the analytic composer cannot express. *Also* worth adding purely as a **falsifiable self-test**: on a debounced idle tick, run the same HomeSpec through manifold and assert volume and genus match the analytic result. That check caught `three-csg-ts` corrupting geometry instantly. |
| **`web-ifc`** (approved, MPL-2.0, ~1 MB) | A real user asks for IFC instead of glTF, **or** Phase-5 compliance work starts. Shape when it happens is already written down in `exportSpec.ts`: `web-ifc` only, `await import()`, wasm served from our own `/wasm/` never a CDN, used **unmodified** so MPL is satisfied by attribution, both licences into `docs/CREDITS.md`. **Skip `@thatopen/components` entirely** unless the plan↔3D toggle and DXF are wanted at the same time — and then price the `three` 0.169 → 0.182 upgrade as its own piece of work first. |
| **`straight-skeleton`** (MIT, 336 KB gzip) | `spec.ts` gains a non-rectangular footprint. Until then rectangular volumes with five roof forms are fully served by `geometry.ts`. |
| **`clipper2-js`** (Boost-1.0) | Non-convex 2D offsetting is needed. The current convex clip/inset is exact for what the spec can express. Pin and vendor when adopted. |
| **`generators/wallAssembly.ts`** (layered SIP assembly) | Post-deadline. Walls are single-thickness solids today and the thickness is already real and material-driven. The layer set is an IFC-shaped concern (`IfcMaterialLayerSetUsage`) and should land with IFC, not before. |
| **Browser DXF** (`maker.js` or a first-party writer) | A designer asks. The Python service already emits DXF via `ezdxf`. |
| **Multi-storey interior, stair-to-plan integration in `layout.ts`** | Post-deadline. The packer solves one floor. |

### The one dependency-free risk worth naming

`geometry.ts` is 66 KB of carefully-invarianted code with a documented **ridge
invariant** (*"for every roof form, the highest point of the built model equals
`ridgeHeightFt(v)` exactly"*) and two **named departures** in its header. Adding
stairs and railings means touching it. **Read that header before editing it**,
and if a change breaks an invariant, add a named departure rather than a silent
one. The file's own doctrine is that a silent departure is a bug waiting to be
discovered.

---

## 9. The honest limits

Stated here so nobody has to discover them — and so no marketing copy outruns
them. This is the same discipline as the existing `NOT FOR CONSTRUCTION` stamp
and the `review-ready design package` framing that `AI-HANDOFF.md` protects.

**This engine will not do structure.** No member sizing, no span checks, no load
paths, no lateral bracing, no beam or header design. `generators/deckFrame.ts`
takes member sizes as **inputs** and draws them; it does not decide them.
Standing repo doctrine already names the professionals: **screw piles need a
P.Eng**, and **truss design arrives stamped from the truss plant**.

**It will not do energy modelling.** `parcel.ts` checks *solar orientation
geometry* — is the glazing wall within ~30° of south — and says in its own copy
that Aura *"has not modelled solar gain for your site — that is a calculation on
real weather data and real horizon shading."* The FDWR check against the 22% NBC
9.36 prescriptive ceiling is a **glazing-area ratio**, not a performance
calculation. There is no heat loss model, no HVAC sizing, no HOT2000 path.

**It will not produce permits.** *"Permit-ready AI drawings" do not exist
anywhere.* AI has no standing under the Safety Codes Act, cannot hold
credentials, and cannot execute Schedules A/B. In Alberta the Architects Act
exempts dwellings of one to four units, so the professional who completes and
seals a single-family permit set is a **licensed residential designer** — and a
human seal is always required. Our output is a **review-ready design package**:
complete and correct enough to be *worth* sealing, and cheap for a professional
to correct.

**Code validation is a helper, not a compliance certificate.** §6 ships rules
against **BCBC 2018 reproducing NBC 2015**, cross-checked against a City of
Edmonton guide citing NBC(AE). **NBC 2020 Div. B 9.8 was not read verbatim.**
Alberta's code in force is **ABC / NBC(AE) 2023**. Several rules are marked
**[NOT COVERED]** and are genuinely absent — most consequentially **flight
uniformity**, the **guard-height switching threshold**, **tread-depth limits**,
the **climbability provision**, and **every deck span table**. A green check
from `validation/nbc.ts` means *"this passed the subset of rules we implemented,
against a code edition we have named"* — nothing more, and the UI must say so in
those words.

**Geometry is massing and layout.** `geometry.ts` says it first: *"Nothing here
is a structural member, a permit set, or an engineered assembly. The roof slab is
a slab, not a rafter schedule."* Walls are single-thickness solids at the
material's real thickness — real enough to change the plan, the net area and the
price, not an assembly.

**The exports carry shape, not building semantics.** glTF and OBJ hand over
geometry. Until `web-ifc` lands, we export a **massing model**, and we say
massing model — not a BIM model we would be implying we had.

**`spec.ts` constrains what can be expressed, on purpose.** Rectangular volumes
only, up to two storeys, five roof forms. `spec.ts` defends this in its own
words: an arbitrary polygon footprint *"would look freer and would quietly break
the handoff to production, which is the one thing this file exists to protect."*
The builder is deliberately less expressive than a CAD program so that
everything it *can* draw actually reaches a drawing.

**And the handoff itself is lossy, by design and out loud.** `toPlan.ts` exists
because the builder can express an L of two volumes with a rotated annexe, and
the plan engine solves **one rectangle**. It returns the drawing *and* an
itemised account of what was **LOST, ASSUMED, CARRIED or BLOCKED**, with the
numbers on both sides — because *"handing somebody a drawing of a rectangle
after they built an L, with no word about it, is worse than handing them
nothing, because a drawing is believed."*

---

## Appendix — the four sentences to remember

1. **Analytic composition beat every CSG kernel by 125× to 3,843×, matched their
   volume to 1e-9, and is already what this repo does.**
2. **`replicad-opencascadejs` ships `"license":"MIT"` over 10.35 MB of LGPL
   Open CASCADE — verify licences at the binary, not the manifest.**
3. **`chili3d` and `xeokit-sdk` are the best browser CAD/BIM work in existence
   and both are AGPL-3.0; we cannot ship one byte.**
4. **No permissively-licensed library generates parametric stairs, railings,
   deck framing or wall assemblies — GitHub's whole index has five
   `"parametric stair"` repos, all at zero stars. We write them.**

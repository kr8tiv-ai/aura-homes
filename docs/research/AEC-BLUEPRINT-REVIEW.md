# Review of the AEC technical blueprint

*Written Aug 11, 2026. This document verifies five contested claims from the
founder's AEC blueprint against measurement and primary sources. It is a review,
not a survey — each claim gets a verdict and the evidence behind it.*

**Companion document:** `docs/research/BUILDER-ENGINE.md` already closed the
kernel and licence questions. This review does not re-open them; it checks the
claims the blueprint makes *on top of* that decision, and corrects the ones that
are wrong for this product.

---

## 0. Provenance — what I actually did, and one correction to the brief

Everything below is either measured on this machine or read from a primary
source. Where I could not verify something, it says so.

**Measured first-hand.** I installed `web-ifc@0.0.77` and `three-mesh-bvh@0.9.14`
into a **scratch directory outside the repo**
(`…\scratchpad\ifctest`), booted them in Node 
and wrote the numbers down. **The repo's `app/package.json` and
`node_modules` were not touched. No dependency was added to this project.**
`npx tsc --noEmit` in `app/` exits **0**.

(One package in this review *is* already present in `app/node_modules` —
`three-mesh-bvh@0.7.8`, pulled in transitively by `@react-three/drei`. I did not
put it there, and it matters more than it looks: see the trap in Claim 4.)

**A correction to the brief I was given.** The brief states the repo "already
measured a 395 ms WASM boot and a valid 43-entity IFC4 wall." **That measurement
does not exist in this repo.** I grepped every tracked file for `395`,
`43-entity`, `CreateModel`, `WriteLine`, `SaveModel` and `ISO-10303`; the only
hits are the *prose* in `app/lib/builder/exportSpec.ts` (lines ~579-645), which
describes what `web-ifc` can do and cites package sizes — it reports **no boot
time and no entity count**. Either that measurement was taken by another agent
and not yet written down, or it was assumed. Rather than repeat an unsourced
figure, **I ran the experiment myself.** My numbers are close enough to support
the same conclusion, and they are reproducible (§6).

---

## Claim 1 — "ifcSPF is fundamentally incompatible with performant web environments; we MUST use ifcJSON as the primary format"

### VERDICT: **REJECT.** Both halves are wrong, and the second half would actively damage the product.

This is the most consequential claim in the blueprint and the one it gets most
badly wrong. It is wrong on the premise, wrong on the standards status, and —
decisively — wrong on the thing that actually matters, which is whether a
designer can open the file.

### (a) Is ifcSPF unworkable in a browser? No. I authored one.

I booted `web-ifc`, created an IFC4 model, authored a wall (6.0 m × 0.165 m SIP
× 2.6 m) with a full spatial hierarchy, saved it to ifcSPF, and read it back.

| Measurement | Result |
|---|---|
| `IfcAPI.Init()` — WASM boot, median of 5 cold Node processes | **30.4 ms** (28.6 / 30.2 / 30.4 / 34.0 / 52.8) |
| Author 38 entities + `SaveModel()` | **30.4 ms** |
| Entities written / entities in file | **38 / 38** (they agree — nothing was dropped) |
| Output | **2,453 B** raw, **1,118 B** gzip |
| Header | `ISO-10303-21;` … `FILE_SCHEMA(('IFC4'));` |
| Round-trip `OpenModel` → `GetLineIDsWithType(IFCWALL)` | **1 wall**, Name `Exterior Wall W1`, Tag `W1` |
| Two runs byte-compared (timing fields stripped) | **byte-identical — deterministic** |

The wall line it produced:

```
#37=IFCWALL('0Aura$Wall$000000001',#5,'Exterior Wall W1','SIP 165 mm',$,#28,#36,'W1',*);
```

**Read the numbers against the claim.** A 30 ms kernel boot and a 30 ms author-
and-serialise pass is not "fundamentally incompatible with performant web
environments" — it is faster than a single animation frame at 30 fps, and it
happens once, behind a button, off the render loop. The blueprint's premise is
not merely overstated; it is contradicted by direct measurement.

**Two honest caveats on my own numbers, because they cut the other way:**

1. **Node is not the browser.** My 30 ms is `Init()` only — instantiating a WASM
   module already on local disk. A browser must *also* fetch **`web-ifc.wasm`,
   1,303,940 B raw / 479,158 B gzip**, plus **`web-ifc-api.js`, 5,903,794 B raw
   / 496,961 B gzip** — call it **~976 KB of gzipped transfer** before `Init()`
   is even called. On a cold cache over a slow link that is seconds, not
   milliseconds. A browser figure in the ~400 ms range is entirely plausible and
   would be dominated by network, not by the kernel. **This is a payload
   argument, and it is a real one — but it is an argument against loading
   `web-ifc` eagerly, not an argument for ifcJSON.** It is exactly why
   `BUILDER-ENGINE.md` defers `web-ifc` behind a dynamic `await import()`.
2. **One fidelity quirk worth recording.** `web-ifc`'s IFC4 `IfcWall`
   constructor takes 8 arguments and emits a trailing `*` (the STEP "derived"
   marker) for the 9th attribute, `PredefinedType`. Some strict validators will
   flag that. It is a note for whoever implements the export, not a blocker.

**The payload cost is real and cross-checks the repo.** My gzip figures
(496,961 B for the JS) sit between the two independent measurements
`BUILDER-ENGINE.md` §4 D5 records (`elements` at 507,643 B; `exportSpec.ts` at
391 kB). Three measurements now converge on **~1 MB total transfer**. That
number is trustworthy.

### (b) What is ifcJSON's actual status at buildingSMART? A community draft, not a standard.

- The specification lives at **`buildingsmart-community/ifcJSON`** — note
  *community*, not the `buildingSMART` organisation proper. 164 stars, 80
  commits. The README describes it as the specification for ifcJSON-4, "in sync
  with the IFC EXPRESS Schema," and is written in the language of an active
  development effort — "getting started," "contributions are welcome" — not of a
  ratified standard. There is **no formal standard designation anywhere in it.**
- **IFC 4.3 is published by ISO as ISO 16739-1:2024.** That standard specifies,
  among other things, the **serialization formats**. The serializations
  buildingSMART and ISO recognise are the **STEP Physical File (`.ifc`/SPF)**,
  **ifcXML**, and **ifcZIP**. **ifcJSON is not among them.**
- A 2025 systematic literature review of IFC in project control found **no
  evidence of ifcJSON use in practice**.

So the blueprint recommends making the product's primary output a format that is
**not in the ISO standard the rest of the industry certifies against.**

### (c) THE DECIDING QUESTION — which professional tools can open ifcJSON today?

This is where the recommendation stops being merely wrong and becomes harmful,
because the entire point of this product is to hand a set to a designer who can
seal it.

| Tool | Opens ifcSPF (`.ifc`) | Opens ifcJSON | Evidence |
|---|---|---|---|
| **Revit** (2026) | Yes — native + Autodesk `revit-ifc`, plus the free Graphisoft exchange add-in | **No** | No ifcJSON path in Autodesk or Graphisoft 2026 documentation |
| **ArchiCAD** (2026) | Yes — native, and the flagship IFC implementation | **No** | Same |
| **Solibri** | Yes — it is an IFC model checker | **No evidence found** | No ifcJSON support documented |
| **Rhino** | Yes (via plug-ins) | **No evidence found** | — |
| **SketchUp** (2025+) | Yes — improved IFC import/export for Pro | **No evidence found** | — |
| **FreeCAD** (BIM workbench) | Yes — round-trips with Revit/ArchiCAD | **No** (SPF is the path) | — |
| **Bonsai** (ex-BlenderBIM) | Yes | **Export only, "experimental"** (v4 / v5a, compact + non-compact) | The one genuine data point — and it is *write*, not *read* |
| **IfcOpenShell** | Yes | **Yes** — reads/writes SPF, ifcJSON, ifcXML, HDF5, SQL | The toolkit, not a design seat |

**The score: of the seven professional design tools named, zero can open
ifcJSON.** The only things that can are IfcOpenShell (a Python toolkit) and
Bonsai's experimental *exporter*.

**Therefore:** exporting ifcJSON as the primary format hands the customer a file
their designer cannot open. It converts the product's single most valuable
promise — *"a set complete and correct enough to be worth sealing"* — into a file
that requires a Python programmer before a designer can even look at it. That is
the exact opposite of the goal.

### What we do instead

**ifcSPF, when IFC lands at all.** `BUILDER-ENGINE.md` already has this right:
`web-ifc`, MPL-2.0, dynamically imported, WASM served from our own `/wasm/`,
deferred until a real user asks for IFC or Phase-5 compliance starts. My
measurements support that decision rather than changing it. Until then glTF +
OBJ + HomeSpec JSON, described honestly as a **massing model**.

If ifcJSON is ever wanted, it is a **secondary, additive** export for
web/database consumers — never the primary, and never at the cost of SPF.

---

## Claim 2 — "Use OpenCascade.js"

### VERDICT: **REJECT.** It fails on licence, on size, and on maintenance, independently — and no job in this product needs a BRep kernel.

### The licence, read at the source

`opencascade.js` **declares its own licence on npm as `LGPL-2.1-only`.** There is
no ambiguity to resolve here and no mislabelling to catch — unlike
`replicad-opencascadejs`, which `BUILDER-ENGINE.md` §3 caught shipping
`"license":"MIT"` over 10.35 MB of OCCT symbols. This package is honest about
being LGPL.

**On the OCCT exception, which is what the blueprint would lean on.** I read
`OCCT_LGPL_EXCEPTION.txt` in the Open CASCADE repository. Its operative grant is
that the object-code form of a work that uses the library "can incorporate
material from a header file that is part of the Library," given prominent notice.

That is a **narrow header-file carve-out**. It does not mention static linking
generally, and it is **silent on the LGPL §6 relink requirement**. It does not
grant what bundling a monolithic WASM blob into a static site would need: a
clear right to distribute the combined work without providing the means to
relink against a modified library.

**The hard rule for this repo is that LGPL is high-risk for WASM bundling, and
this is precisely the murky case it names.** A WASM binary compiled from LGPL
C++ and shipped inside a JS bundle on GitHub Pages is the scenario nobody has
litigated. **Flagged as high-risk. Not adoptable without a lawyer's sign-off,
which we are not going to buy for a feature we do not need.**

### The size, from the project's own documentation

| Figure | Value | Source |
|---|---|---|
| Full WASM, uncompressed | **48.9 MB** | OpenCascade.js docs, "A Note About File Size" |
| Full WASM, brotli | **9.1 MB** | Same |
| Custom build powering their own website examples | **2.4 MB** compressed | Same |
| Stated load time | ~9 s on 3G | Same |

Against the already-approved alternative:

| Kernel | Licence | Compressed size | Ratio |
|---|---|---|---|
| **`manifold-3d` 3.5.1** | **Apache-2.0** | **~222 KB gzip** (203 KiB wasm + 19 KiB glue) | **1×** |
| `opencascade.js` custom build | LGPL-2.1 | 2.4 MB | **~11×** |
| `opencascade.js` full build | LGPL-2.1 | 9.1 MB brotli | **~41×** |

### The maintenance, from the registry

I queried npm directly:

| Package | Latest | Licence | npm `time.modified` |
|---|---|---|---|
| `opencascade.js` | **1.1.1** | LGPL-2.1-only | **2023-03-23** |
| `manifold-3d` | 3.5.1 | Apache-2.0 | 2026-06-04 |
| `three-mesh-bvh` | 0.9.14 | MIT | 2026-08-01 |
| `web-ifc` | 0.0.77 | MPL-2.0 | 2026-03-06 |

**The stable release of `opencascade.js` is 1.1.1 and the registry has not seen
a change since March 2023.** A `2.0.0-beta` exists but has been in beta for
years. The blueprint prescribes the least-maintained package in the comparison.

### Is there any job here that genuinely needs a full BRep kernel?

**No. I looked for one.**

A BRep kernel earns its keep on NURBS surfaces, filleting, chamfering, lofting,
shelling, draft angles, and STEP/IGES import — mechanical-CAD work.
`app/lib/builder/spec.ts` expresses **rectangular volumes, up to two storeys,
five roof forms**, and defends that limit deliberately: an arbitrary polygon
footprint *"would look freer and would quietly break the handoff to
production."* Every solid this product emits is a box, a prism, or an extrusion.

The three hardest geometry jobs on the roadmap and what each actually needs:

| Job | Needs BRep? | What it actually needs |
|---|---|---|
| Wall openings | No | Analytic composition — **already shipped**, measured at 0.0146 ms vs manifold's 2.4 ms at 8 openings, matching CSG volume to 1e-9 |
| Mitred roofs / dormers | No | `manifold-3d` mesh booleans (approved, deferred) |
| Hip/valley roofs on non-rectangular footprints | No | A straight skeleton — `straight-skeleton`, MIT, deferred |
| Stairs, railings, deck framing | No | First-party TypeScript generators — no library exists (§5 of `BUILDER-ENGINE.md`) |

**A 9.1 MB LGPL kernel to cut rectangular holes in rectangular walls is not a
trade-off; it is a category error.** The existing analytic path is
**125× faster** than the best kernel benchmarked, and it preserves something a
BRep kernel destroys: **named parts**. Which brings us to the next claim.

---

## Claim 3 — "The choice is SVGRenderer vs three-mesh-bvh for architectural drawings"

### VERDICT: **REJECT THE FRAMING.** This is a false dilemma. It omits the third option, which is what this repo already ships and is the only one that can produce a drawing at all.

Both options in the blueprint's dilemma are **projections of a 3D scene**.
`SVGRenderer` rasterises — sorry, *vectorises* — the scene graph to SVG paths.
BVH-accelerated edge extraction finds silhouettes in a mesh. Both take a
**picture** of geometry.

**A floor plan is not a picture of a building.** It is a **measured orthographic
projection carrying annotation that does not exist in the 3D scene**: dimension
strings with witness lines and ticks, poché, door swing arcs, a section cut line
with a bubble and a direction, a north arrow, a graphic scale, room names, window
and door marks keyed to a schedule, and a title block. **None of that is in the
model.** No projector can invent it, because it was never there to project.

### What the repo already does — the third option the blueprint missed

`app/lib/builder/drawings.ts` and `drawings/{kit,model,sheets}.ts` (169,870 B
plus the entry point) generate the eight-sheet set **analytically from the
`HomeSpec`** — arithmetic and string building, no scene, no renderer, no camera.

Verified in the source:

| Drawing element | Where | Note |
|---|---|---|
| **Poché** | `kit.ts:376-383` — `poche()`, outer ring minus inner ring, `fill-rule="evenodd"` | Walls read as solid-filled, the way a plan reads |
| **Dimension strings** | `kit.ts:389-461` — `dim()`, ported from `lib/design/blueprint.ts` | 45° ticks, witness lines, `DIM_OFFSET = 26`, and it **never letters a dimension upside-down** (`if (rot > 90 \|\| rot < -90) rot += 180`) |
| **Door swing arcs** | `sheets.ts:321-322` | *"leaf + swing arc, hinged at the a-end, swinging INWARD"* — and `sheets.ts:1123` names the assumption on the sheet, rather than implying it was designed |
| **Elevations with true opening positions** | `drawings.ts:36-37`, `model.ts` `allElevations` / `elevationOf` | All four, one scale, grade, wall height, ridge, pitch triangle |
| **Section** | `model.ts` `sectionOf` | Cut on the long axis with assemblies |
| **Schedules** | `sheets.ts:2078-2213` | Window/door schedule keyed to marks, assembly R-values, FDWR |
| **Graphic scale, title block, general notes** | `kit.ts:548-663` | Including *"Verify all dimensions on site before ordering."* |
| **Theme-aware** | `kit.ts:193-218` | Every colour is a CSS custom property (`--adw-ink`, `--adw-dim`) — no literal hex in the drawing output |
| **Deterministic** | `drawings.ts:48-50` | *"No `Math.random`, no `Date.now` — the date is a required parameter, so the same spec and the same date always produce byte-identical SVG"* |

### Which approach can carry what

| Capability | `SVGRenderer` | BVH edge extraction | **Analytic (shipped)** |
|---|---|---|---|
| Vector output | Yes | Yes | Yes |
| **True dimensions** | **No** — measures pixels, not the building | **No** | **Yes** — reads the spec's feet directly |
| **Poché** | No — fills come from materials | No | **Yes** |
| **Door swings** | **No** — a swing arc is not geometry | **No** | **Yes** |
| **Annotation, marks, schedules** | **No** | **No** | **Yes** |
| Hidden-line correctness | Painter's-algorithm sorting; degrades on intersecting geometry | Good | **Not applicable** — nothing is hidden, the projection is constructed |
| Determinism | Depends on camera + sort order | Depends on mesh tessellation | **Byte-identical** |
| Cost | Adds an addon | Adds 61 KiB | **0 bytes — already shipped** |

**And the structural reason this is not a close call.** CSG returns triangle
soup and destroys the identity of what it built — a hole in a wall stops being
"a header over a 1200 mm window" and becomes anonymous triangles. Analytic
composition keeps **named parts with exact numbers**, which is precisely what a
dimensioned drawing consumes. The drawing engine and the geometry engine want
the same thing, and the repo already gives it to them.

**`SVGRenderer` is not used anywhere in this repo. It should not be added.** The
blueprint's dilemma should be answered "neither," and the answer is already
built.

---

## Claim 4 — "three-mesh-bvh for face selection, so a user can assign a material to one wall face"

### VERDICT: **ADOPT WITH CHANGES.** The library is sound and the blueprint is right to like it. The *mechanism* it prescribes — `faceIndex` picking — is wrong for this architecture and would produce a worse result than what the repo can already do in one line.

### The library checks out

Measured and queried directly:

| Property | Value |
|---|---|
| Version | **0.9.14** |
| Licence | **MIT** (verified in the shipped `LICENSE`, first line `MIT License` — not just the manifest) |
| Dependencies | **zero** |
| Peer dependency | **`three >= 0.159.0`** |
| Size | `index.module.js` **290,630 B raw / 62,376 B gzip**; UMD 300,714 B / 62,959 B gzip |
| npm `time.modified` | **2026-08-01** — ten days ago |
| Maintenance | Very active; `gkjohnson`, long-running, widely used |

**The peer dependency is the important line, and it is good news.**
`three-mesh-bvh` needs `three >= 0.159.0`; this app is on **`three@0.169.0`**, so
it **already satisfies it**. This is the exact opposite of
`@thatopen/components@3.4.8`, which demands `three >= 0.182.0` and would force a
thirteen-minor upgrade underneath a working R3F 8 camera journey, postprocessing
stack and custom shader injection. **`three-mesh-bvh` is licence-clean,
dependency-free, 61 KiB, actively maintained, and drops into the current
rendering stack unchanged.** Nothing about it is objectionable.

### ⚠️ It is already in the tree — and that changes how to adopt it

**`three-mesh-bvh` is not a new dependency. It is already installed**, pulled in
transitively by the renderer:

```
aura-app@0.1.0
`-- @react-three/drei@9.122.0
  `-- three-mesh-bvh@0.7.8
```

`@react-three/drei@9.122.0` declares **`three-mesh-bvh: ^0.7.8`**, and
`app/node_modules/three-mesh-bvh` is at **0.7.8, MIT**.

**Two consequences, and the second is a trap:**

1. **The licence surface is already paid for.** MIT, already in the tree,
   already in whatever `docs/CREDITS.md` owes for drei's dependency set. Using
   the copy that is present costs **zero new licence exposure**.
2. **Do NOT `npm install three-mesh-bvh@0.9.14`.** `^0.7.8` resolves to
   `>=0.7.8 <0.8.0`, so **0.9.14 does not satisfy drei's range.** npm would keep
   drei's 0.7.8 and nest a *second* copy at the top level — **two BVH
   implementations in one bundle**, roughly 62 KiB of duplicate code, two sets
   of `three` prototype patches if both call `computeBoundsTree`, and a live
   risk of API drift between 0.7 and 0.9 (the accelerated-raycast and
   `BatchedMesh` surfaces both moved across that span).

**If a BVH is ever genuinely needed, use the 0.7.8 already present** and pin the
expectation explicitly, or upgrade `@react-three/drei` first and take
`three-mesh-bvh` along with it — **never bolt a mismatched major onto the side.**
This is the same class of mistake as the `@thatopen/components` `three >= 0.182`
trap: a version constraint hiding inside a dependency you already have.

### But `faceIndex` is the wrong mechanism here — and this is not a nitpick

**`faceIndex` identifies a triangle. The user wants to select a wall.** Those are
different things, and in this repo they are *very* different things.

**First, the repo does not have one big merged mesh.** `Viewport.tsx:172-173`
renders **one `<mesh>` per `Part`**:

```tsx
{volume.parts.map((p) => (
  <PartMesh key={p.id} part={p} night={night} />
))}
```

**Second, every `Part` already carries its own identity.** From
`geometry.ts:1135-1146`:

```ts
export interface Part {
  /** stable and derived only from the spec — no counters, no randomness */
  id: string;
  surface: Surface;
  volumeId: string | null;
  /** set when the part belongs to a specific wall */
  wall?: Wall;
  /** set when the part belongs to a specific opening */
  openingId?: string;
  geometry: THREE.BufferGeometry;
}
```

A plain three.js raycast — which R3F already gives you free via `onClick` on the
mesh — returns `intersection.object`. The `Part` is right there, with a **stable,
spec-derived `id`**, its `surface` tag, its `volumeId`, and its `wall`. **You get
"the north wall of the main volume" directly.** No BVH, no `faceIndex`, no
triangle-to-semantic mapping.

**Third, `faceIndex` would actively give a worse answer.** Because openings are
composed analytically into **pier / sill / header** parts, a wall with a window
is already several named solids. A `faceIndex` hit would select **one triangle of
one pier** — not "the wall," and not even "the wall face." You would then have to
map that triangle back to a semantic element, which means rebuilding the exact
identity the geometry engine already handed you and CSG would have thrown away.

### What to actually do

**For material assignment: use the existing per-`Part` `onClick` and key material
overrides by `Part.id` (or by `volumeId` + `wall`).** This is deterministic,
survives a re-generation of the geometry because the ids derive only from the
spec, and is round-trippable into `HomeSpec` and therefore into `share.ts`. A
`faceIndex` is a tessellation artefact — it is not stable across a geometry
rebuild and **must never be persisted into a share link or an export.**

**Adopt `three-mesh-bvh` when, and only when, there is a measured picking or
spatial-query bottleneck** — a large scene, or a feature like measurement
snapping, sun-ray occlusion or interior-clearance checks where accelerated
raycasts genuinely pay. At a few hundred parts, default three.js raycasting is
not the bottleneck. **61 KiB is cheap but it is not free, and today it would buy
nothing.** Defer, with that trigger named.

---

## Claim 5 — "Add a Brick / SHACL / BuildingMOTIF / IoT semantic layer"

### VERDICT: **REJECT for now — and it is not close.** Not because the technology is bad; it is genuinely good. Because it operates a building that does not exist, using sensors nobody has installed, for an owner who has not broken ground.

### What this stack is actually for, stated plainly

- **Brick** is an open ontology for **building assets, systems and devices** and
  the relationships between them. Its purpose is to let software query
  **measurement points from a Building Management System** in a standard,
  machine-readable way — which AHU serves which zone, which sensor reports that
  zone's temperature.
- **SHACL** is a W3C constraint language for validating **RDF graphs**. In this
  stack it validates that a building's metadata graph is well-formed.
- **BuildingMOTIF** (NREL) is an SDK that wraps RDF, SHACL validation and
  ontology interoperability, with **connectors to Building Automation System
  data**. Its stated objectives are to lower cost and installation time and
  improve quality of **building controls and services**, and to simplify
  **procurement for building managers**.

**Every one of those is an operations concern.** This stack exists because a
commercial building has thousands of BMS points with vendor-specific names, and
somebody has to make them queryable. It is the metadata layer of a **running**
building with a **BMS**.

### Does it apply to this product?

**Not in any form, today.** Point by point:

1. **The building does not exist.** Aura's output is a design package for a
   self-build home that has not been permitted, let alone constructed. Brick
   models the operational reality of a standing building. There is nothing to
   model.
2. **There is no BMS and there will not be one.** This is an **off-grid**
   single-family home. It has no Building Automation System, no BACnet trunk, no
   AHUs, no VAV boxes, no chilled-water plant — the things Brick's class
   hierarchy is overwhelmingly about.
3. **It breaks the hard architectural constraint.** RDF graphs, SHACL validation
   and BuildingMOTIF are **server-side Python**. This is a **static export with
   no server, no database and no backend**. Adopting this layer means adopting a
   backend, which is the one thing the product's architecture forbids.
4. **It is the wrong scale.** Brick's value scales with point count. A commercial
   tower has tens of thousands. An off-grid cabin has, optimistically, a battery
   monitor and a thermostat.
5. **It solves a problem the repo does not have.** The blueprint implicitly
   frames semantic richness as the gap. The actual gap, per
   `BUILDER-ENGINE.md` §5, is that **no permissively-licensed library generates
   parametric stairs, railings or deck framing** — and `spec.ts` has
   `storeys: 1 | 2` with **no way to get between them**. A two-storey home with
   no stair is a visible hole. An ontology does not fill it.

### Where I will not be dismissive — the real future use

There is a genuine one, and it should be written down so it is not lost:

**If Aura ever ships monitored off-grid homes** — solar production, battery
state of charge, water level, greywater, indoor temperature and humidity — then
a **fleet** of them generates exactly the problem Brick solves: heterogeneous
points across many buildings that an owner-facing dashboard wants to query
uniformly. At that point Brick is a reasonable choice and BuildingMOTIF is a
reasonable way to author and validate the models.

**The honest sequencing is:**

| Precondition | Status |
|---|---|
| A home is actually built | Not yet |
| It has instrumentation worth modelling | Not yet |
| There is more than one, so a *schema* beats a hard-coded dashboard | Not yet |
| There is a backend to host an RDF store | **Architecturally excluded today** |

**Does it belong in the next ten days? No — and not in the next ten months.**
Record it in the post-deadline column with the trigger named: *"first monitored
home in the field, plus a second one."* Until then it is a solution shopping for
a problem, and it costs a backend the product deliberately does not have.

---

## What we are taking from this blueprint

The blueprint is not worthless — it is a commercial-BIM document applied to a
residential self-build product, and the parts that survive that translation are
worth having.

**Take:**

1. **`three-mesh-bvh` as a named, licence-cleared future adoption.** MIT, zero
   deps, 62,376 B gzip, `three >= 0.159.0` so **no rendering-stack migration**,
   published 2026-08-01. The blueprint found a genuinely clean library. Adopt it
   on a **measured** picking or spatial-query bottleneck — not for material
   assignment, which per-`Part` `onClick` already does better. **And use the
   `0.7.8` already in the tree via `@react-three/drei`; installing `0.9.14`
   alongside it would nest a second, duplicate copy.**
2. **The instinct that a user should be able to select one surface and change
   it.** This is a good product idea and it is nearly free: `Part.id` is stable
   and spec-derived, so a material override keyed to it round-trips through
   `share.ts` and into export. **Key overrides by `Part.id`, never by
   `faceIndex`.**
3. **Taking IFC seriously as the professional handoff.** The blueprint is right
   that glTF is a shape and IFC is a building. It picked the wrong
   serialisation, but the priority is correct, and `BUILDER-ENGINE.md`'s
   deferred-`web-ifc` plan is the way to act on it.
4. **The confirmation that ifcSPF authoring in the browser is viable.** My
   measurement (30 ms boot, 30 ms to author and serialise a valid 38-entity
   IFC4 file, deterministic and round-trippable) **de-risks the deferred
   `web-ifc` decision.** When the trigger fires, the technical path is known to
   work — the cost is the ~976 KB payload and the entity-graph authoring, not
   feasibility.
5. **Brick/BuildingMOTIF filed against a real future trigger** — a fleet of
   monitored off-grid homes — rather than discarded.

**Leave:**

1. **ifcJSON as the primary format.** Not an ISO 16739-1:2024 serialisation, a
   community draft rather than a published standard, and **openable by zero of
   the seven professional tools checked.** It would break the product's core
   promise.
2. **The claim that ifcSPF cannot work in a browser.** Measured false.
3. **OpenCascade.js.** LGPL-2.1-only (self-declared), 9.1 MB brotli full build /
   2.4 MB custom, stable release 1.1.1 with no registry activity since
   **2023-03-23**, and **no job in this product needs a BRep kernel**.
   `manifold-3d` (Apache-2.0, ~222 KB gzip, updated 2026-06-04) already holds
   that slot and remains deferred.
4. **`SVGRenderer`.** Cannot carry dimensions, poché, swings or annotation.
   Not used in this repo and should stay that way.
5. **`faceIndex` as the selection key.** A tessellation artefact. Not stable
   across a geometry rebuild; must never be persisted to a share link or export.
6. **The entire IoT / BMS / BACnet / RDF layer**, for now. No building, no
   sensors, no backend, and it violates the static-site constraint.

**Net effect on the plan: zero changes.** `BUILDER-ENGINE.md`'s ten-day
priority order stands, its zero-new-dependencies-before-Aug-21 rule stands, and
this review adds no dependency to `app/package.json`. What it adds is
**evidence**: three of the blueprint's five prescriptions are now refuted with
measurements rather than opinion, and the two sound ideas have triggers attached.

---

## 6. Reproducing the measurements

Everything in §1 and §4 is reproducible. Run **outside the repo** — this adds
nothing to `app/`:

```
mkdir ifctest && cd ifctest && npm init -y
npm install web-ifc three-mesh-bvh three
node wall.js     # boot, author 38-entity IFC4 SPF, save, round-trip
node det.js      # byte-compare two runs; 5 cold-process boot timings
```

The scripts used are at
`…\scratchpad\ifctest\{wall.js,det.js}`.
`wall.js` builds the spatial hierarchy (Project → Site → Building → Storey), a
`IfcRectangleProfileDef` swept by `IfcExtrudedAreaSolid`, and the
`IfcRelContainedInSpatialStructure` that puts the wall on the storey. GUIDs are
fixed and `CreationDate` is `0`, which is what makes the output byte-identical
across runs — **the same determinism discipline `drawings.ts` already enforces**,
and proof that a future IFC export can meet the repo's no-`Date.now` rule.

**Environment:** Windows 11, Node (system), `web-ifc@0.0.77`,
`three-mesh-bvh@0.9.14`, `three@0.169.0`. Verification: `npx tsc --noEmit` in
`app/` exits **0**.

---

## Appendix — every package figure in one table

| Package | Version | Licence | Size | npm `time.modified` | Verdict here |
|---|---|---|---|---|---|
| `web-ifc` | 0.0.77 | **MPL-2.0** (verified in `LICENSE.md`) | 496,961 B gzip JS + 479,158 B gzip wasm ≈ **976 KB transfer** | 2026-03-06 | Approved, **deferred** — unchanged from `BUILDER-ENGINE.md`. Requires a `docs/CREDITS.md` NOTICE entry; use **unmodified** so MPL is satisfied by attribution |
| `three-mesh-bvh` | 0.9.14 latest; **0.7.8 already installed** via `@react-three/drei@9.122.0` (`^0.7.8`) | **MIT** (verified in `LICENSE`) | **62,376 B gzip**, 0 deps, peer `three >= 0.159.0` ✅ | 2026-08-01 | **Approved, deferred** — trigger: a measured picking/spatial-query bottleneck. **Use the installed 0.7.8; `^0.7.8` excludes 0.9.x, so adding 0.9.14 nests a duplicate copy** |
| `manifold-3d` | 3.5.1 | Apache-2.0 | ~222 KB gzip | 2026-06-04 | Approved, deferred (unchanged) |
| `opencascade.js` | 1.1.1 | **LGPL-2.1-only** | 48.9 MB raw / **9.1 MB brotli**; 2.4 MB custom | **2023-03-23** | **REJECTED** — licence risk for WASM bundling, size, maintenance, and no need |

*`app/package.json` is unchanged by this review. Of the four packages above,
only `three-mesh-bvh` is present in `app/node_modules`, and only because
`@react-three/drei` already depended on it — it is not a direct dependency and
this review did not add it. `web-ifc`, `manifold-3d` and `opencascade.js` are
absent, as `BUILDER-ENGINE.md` intends.*

---

## Sources

- [buildingsmart-community/ifcJSON](https://github.com/buildingsmart-community/ifcJSON)
- [buildingSMART — Industry Foundation Classes (IFC)](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/)
- [buildingSMART Technical — IFC](https://technical.buildingsmart.org/standards/ifc/)
- [IFC 4.3.2 Documentation](https://ifc43-docs.standards.buildingsmart.org/)
- [ISO 16739-1:2024 (IFC4.3): what architects need to know](https://datadrivenaec.com/insights/iso-16739-ifc4-3-what-architects-need-to-know)
- [IFC and Project Control: A Systematic Literature Review](https://www.mdpi.com/2075-5309/16/1/91)
- [IfcOpenShell](https://ifcopenshell.org/)
- [Bonsai (ex-BlenderBIM)](https://bonsaibim.org/) and [OSArch — Bonsai release notes on IfcJSON export](https://community.osarch.org/discussion/26/bonsai-new-release/p2)
- [IFC Model Exchange with Archicad for Revit 2026 (Graphisoft)](https://community.graphisoft.com/t5/Graphisoft-Insights/IFC-Model-Exchange-with-Archicad-for-Revit-2026/ba-p/686279)
- [Autodesk/revit-ifc](https://github.com/Autodesk/revit-ifc)
- [FreeCAD BIM workbench](https://freecad-app.com/workbenches/bim/)
- [OpenCascade.js — A Note About File Size](https://ocjs.org/docs/getting-started/file-size)
- [donalffons/opencascade.js releases](https://github.com/donalffons/opencascade.js/releases)
- [Open-Cascade-SAS/OCCT — OCCT_LGPL_EXCEPTION.txt](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt)
- [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and [API.md](https://github.com/gkjohnson/three-mesh-bvh/blob/master/API.md)
- [NREL/BuildingMOTIF](https://github.com/NREL/BuildingMOTIF)
- [Brick: Towards a Unified Metadata Schema For Buildings (BuildSys'16)](https://cseweb.ucsd.edu/~dehong/pdf/buildsys16-paper.pdf)

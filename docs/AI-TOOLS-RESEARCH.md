# AURA HOMES — Open-Source Tooling Evaluation

**Research report · 2026-08-09 · evaluation only, no app changes made**

> **For the builder session.** This is the AI-architecture / open-source tooling research,
> consolidated into this repo so the single Aura Homes thread has it. Ora Homes and Aura Homes
> are the same project. §5 is the ranked shortlist and integration plan, §6 is the licence
> compatibility map (the part that bites — Aura is MIT + hosted, so AGPL is a hard no in the
> request path), and **§8 is a paste-ready Credits & Licenses block intended to be merged into
> [`docs/CREDITS.md`](CREDITS.md)** when the corresponding tools are actually adopted. Nothing in
> here has been integrated yet; adopt-on-use rule applies — nothing ships until its credits row
> exists.

Scope: what already exists (free/AI apps + maintained open source) that Aura Homes could
incorporate for one-click home design → property → agent → budget → materials pricing →
contractor matching, with the eco-first constraint (SIP-panel glass homes, no concrete, AWG,
solar, greywater) and the X Layer USDC payment rail.

Aura Homes is an **MIT-licensed public repo** shipping a **hosted web app**. That single fact
decides most of this report: it makes AGPL a hard no in the request path, GPL a
"server-side-only, never vendored" tool, and MIT/Apache/BSD/MPL the only things that go in the
bundle. §6 is the compatibility map; §8 is the paste-ready credits block.

---

## 0. Verdict in one paragraph

Nothing on the market — free, paid, or open source — does what Aura does end to end. The
AI-architecture apps in the article are **renderers and drafting tools**, not design engines:
none has a public API, none is open source, none knows what a SIP panel costs. The open-source
world, by contrast, has a genuinely excellent **plumbing layer** (IFC, geometry, viewers,
takeoff, energy, solar) and a **weak generation layer** (floor-plan AI is research code on
non-commercial datasets). So: **adopt the plumbing, skip the generators, and build the one
piece nobody has — a SIP panelizer**. Ranked shortlist in §5, fork target in §5.9.

---

## 1. The remodelai.io list, catalogued

Source: <https://www.remodelai.io/blog/best-free-ai-architecture-apps> (fetched 2026-08-09).
The page names **6 tools plus one asset library**. Every one is closed source; **none publishes
a public API**. Full sweep of the page confirmed — no comparison table or honourable-mentions
section beyond these.

| # | Tool | What it does | Free tier | Paid | API? | Open source? | Use for Aura |
|---|------|--------------|-----------|------|------|--------------|--------------|
| 1 | **Remodel AI** | Re-renders a building photo in 30+ interior / 11 exterior styles in ~10s | 3 designs, no card, no watermark | $29/mo Pro, unlimited | Not published | No | ❌ Photo restyler. Aura generates *new* homes, not restyles of existing ones. Our own ComfyUI+ControlNet stack (§4.7) does this without per-seat cost. |
| 2 | **SketchUp Free** | Browser 3D modeller, industry standard | Web version, feature-limited | from $119/yr | Ruby API is **desktop-Pro only**; no web/cloud API | No | ❌ Human-driven modelling. Can't be called from a pipeline. |
| 3 | **Planner 5D** | 2D + 3D measured plans, multi-room/multi-floor | Free with HD render limits | $7/mo | No public API | No | ⚠️ Closest UX reference for the consumer design step. Study the interaction model, don't integrate. |
| 4 | **Hover** | Photogrammetry — measured 3D model of an *existing* building from phone photos | Basic exterior model | Paid unlocks | Partner API exists but is enterprise/contract-gated, not self-serve | No | ⚠️ Only relevant to a future *renovation* product. Irrelevant to new-build. |
| 5 | **Floorplanner** | Detailed 2D architectural drawings | Watermarked | $5+/mo | No public self-serve API | No | ❌ |
| 6 | **RoomSketcher** | Clean 2D plans for listings and permits | Watermarked | $49+/yr | No | No | ❌ |
| 7 | **3D Warehouse** | Free model library (SketchUp ecosystem) | Free | — | — | No (assets carry individual terms) | ⚠️ Asset terms are per-model and mostly **non-redistributable** — do NOT pull props into Aura's GLBs. Use CC0 sources (Poly Haven, Kenney) as already done for the lantern. |

**Takeaway.** The article is a consumer-tool roundup. It confirms the market gap rather than
filling it: there is no "design a house from a brief and hand me a bill of materials" product in
that list. Aura's wedge is intact.

---

## 2. What Aura actually needs, stated as engineering requirements

Before judging candidates, the requirements the eco-first + one-click model imposes:

1. **R1 — Layout generation.** Brief (bedrooms, budget, site, orientation) → valid floor plan,
   metric, machine-readable (not a raster image).
2. **R2 — Building model.** Plan → 3D volume with walls/roof/openings that carries *data*, not
   just triangles — because the budget and the panel list are derived from it.
3. **R3 — Panelization.** Wall/roof surfaces → discrete SIP panels with sizes, joints, openings,
   and a cut list. **This is the load-bearing requirement and the one nobody has solved.**
4. **R4 — Quantities → money.** Panel + glazing + screw-pile + AWG + solar + greywater
   quantities → Alberta pricing, reconciled to the dollar (Aura's existing frozen anchor).
5. **R5 — Eco verification.** Solar yield, energy demand, and an honest embodied-carbon claim
   that can survive scrutiny — "no concrete" has to be provable, not marketing.
6. **R6 — Web presentation.** Everything above, viewable and configurable in the browser at
   mobile weight (Aura already ships 604 KB of GLB and cares about frame budget).
7. **R7 — Agent-callable.** Aura's brain is an MCP server. Anything adopted should be reachable
   as a tool call, not only as a GUI.

Constraint: **MIT repo + hosted app + commercial intent.**

---

## 3. Candidate register — the full evaluated set

Legend for **Fit**: ✅ adopt · 🟡 conditional · 🔶 reference/inspiration only · ❌ reject.

### 3.1 AI floor-plan / layout generation (R1)

| Project | What it does | License | API / self-host | Maturity | Fit |
|---|---|---|---|---|---|
| **HouseDiffusion** (aminshabani) | Vector floorplan generation via diffusion, discrete+continuous denoising; the most-cited model in the space | **GPL-3.0** | Self-host, Python; temporary weights on Google Drive | Research drop, ~3 commits, effectively unmaintained since publication | ❌ **Blocked twice:** GPL-3.0 code, and it is trained on **RPLAN**, which is distributed by request for **research use** — not a commercial licence. Authors themselves flag RPLAN download problems. |
| **ChatHouseDiffusion** | LLM + diffusion, *text prompt* → room plan, editable by conversation. Trained on RPLAN, evaluated on Tell2Design | Repo licence to verify | Self-host | Recent, active research | 🔶 Architecturally the closest to Aura's "describe your home" UX. **Same RPLAN provenance problem.** Read the paper, copy the LLM-in-the-loop pattern, don't ship the weights. |
| **FloorDiffusion** | Fine-tunes a pretrained diffusion model to the floorplan domain, conditional inpainting of unfinished regions | To verify | Self-host | Research | 🔶 Technique is reusable (cheap adaptation, no full retrain). |
| **AI4SC/bim-diffusion-models** | *Procedural generator* that synthesises floor plans as **training data** | To verify | Self-host | Research | 🟡 The interesting one for us: it sidesteps dataset licensing by generating plans procedurally. Same trick works for SIP-constrained plans. |
| **ResPlan** (m-agour) | **17,000 residential floor plans** — vector geometry (walls, doors, windows, balconies) + room-connectivity graphs, metric scale, no PII | **Data CC BY 4.0 · Code MIT** | Pickle + loaders + baselines on GitHub | 2025, clean release | ✅ **The unlock.** This is the only large, *commercially usable*, vector-native residential plan corpus found. It replaces RPLAN as Aura's training/priors base. |
| **CubiCasa5K** | 5,000 vectorised plans, 80+ object categories, from Finnish real-estate material | Licence **not stated on the repo page**; must be read from the LICENSE file / Zenodo record before any use | Self-host | Established, widely cited | 🟡 Useful only if the licence checks out. **Do not use until verified in writing** — real-estate-derived corpora frequently carry non-commercial terms. |
| **Text-to-Layout**, **DStruct2Design**, **MaskPlan**, **Tell2Design** | 2024-2026 academic work on LLM-drafted and structure-driven plans | Mixed / mostly research | — | Papers, patchy code | 🔶 Read for method. Benchmarks, not products. |

**Section verdict.** There is **no production-grade, commercially licensed, maintained AI
floor-plan generator**. This is a research field wearing a product costume. Aura should *not*
build stage one on a diffusion model. See §5.1 for the recommended alternative (constraint
solver over a ResPlan-derived typology library), which is also cheaper, deterministic,
explainable to a building official, and doesn't need a GPU in the request path.

### 3.2 Building model / IFC / parametric (R2, R7)

| Project | What it does | License | API / self-host | Maturity | Fit |
|---|---|---|---|---|---|
| **IfcOpenShell** | The open IFC toolkit + geometry engine. `ifcopenshell.api` creates walls, slabs, roofs, openings, placements, spatial containment **programmatically in Python** | **LGPL-3.0-or-later** | Python lib, `IfcConvert` CLI, self-host | Very mature, active (0.8.5 docs current), the backbone of open BIM | ✅ **Adopt — the spine of Aura's model layer.** LGPL is fine: use it as an unmodified library in a separate Python service, don't statically link, don't vendor. |
| **Bonsai** (fka BlenderBIM) | Native-IFC authoring inside Blender: parametric stairs/roofs, IDS validation, **quantity takeoff**, clash detection, measurement | **GPL-3.0-or-later** | Blender add-on; drivable headless | Mature, very active | 🟡 **Server-side only, never vendored.** Run headless as an offline job. GPL's network loophole means a hosted service that merely *calls* it does not trigger source disclosure — but shipping any of its code inside Aura would. Aura already has Blender MCP installed and connected, so the runway exists. |
| **ifc-bonsai-mcp / MCP4IFC** (Show2Instruct) | **MCP server exposing 50+ IFC design tools to an LLM** — create walls, roofs, slabs, doors, windows, stairs parametrically; PBR styles; semantic search over IFC docs; dynamic code-gen with RAG | **MIT** (repo) — paper + site CC BY-SA 4.0 | Needs Blender 4.4+ with Bonsai 0.8.2+, Python 3.10+, uv | New (2025 paper, 57★, 7 commits) — young but exactly on-target | ✅ **Highest-leverage single find.** It is the *same architecture Aura already built* (aura-brain MCP). MIT means we can fork it. It stands on GPL Bonsai at runtime, so keep the same server-side boundary. |
| **FreeCAD** (+ BIM/Arch workbench) | Full parametric CAD/BIM modeller, Python scriptable, IFC in/out | **LGPL-2.1+** | Self-host, headless scripting | Very mature; 1.1 released 2026-03-24 | 🟡 Viable headless geometry kernel and a good fallback/validator. Heavier than IfcOpenShell for pure IFC authoring. |
| **CadQuery / build123d** | Python parametric solid modelling (OCCT) | **Apache-2.0** | Python lib | Mature, active | ✅ Best permissive kernel for **panel-level** solids — the actual SIP boxes, splines, cam-locks, and window bucks. No copyleft anywhere near it. |
| **BHoM** | Object model + computational framework for AEC | LGPL-3.0 (verify) | .NET | Mature, Buro Happold-backed | 🔶 .NET-centric; wrong stack for Aura. |
| **Dynamo** | Visual programming / generative design | Apache-2.0 | .NET, Revit-coupled | Mature | ❌ Revit gravity well. |
| **bim2sim** | IFC → domain simulation models | To verify | Python | Active research | 🔶 Relevant later for HVAC/energy handoff. |

### 3.3 Web 3D, viewers, configurators (R6)

| Project | What it does | License | Notes | Fit |
|---|---|---|---|---|
| **web-ifc** (ThatOpen `engine_web-ifc`) | Read/write IFC in the browser at native speed (C++→WASM) | **MPL-2.0** | 4,253 commits, active | ✅ MPL is file-level copyleft: safe to use as a dependency in an MIT app; only *modified MPL files* must stay open. |
| **@thatopen/components** (+ `components-front`) | BIM toolkit on Three.js: IFC load/display/navigate, **2D floor-plan navigation and generation**, clipping planes, dimensions, DXF export, measurement, annotation | **MIT** | 1,615 commits, 693★, npm, works in browser + Node + Electron | ✅ **Adopt.** MIT, Three.js-native, and Aura's landing is already R3F/Three. Gives us the plan↔3D toggle for free. |
| **@thatopen/fragments** | Optimised geometry container for large models | (part of the ThatOpen suite — verify per-package) | — | ✅ pairs with the above |
| **xeokit-sdk** | High-performance BIM/IFC/point-cloud web viewer, double-precision coords | **AGPL-3.0** + paid commercial licence | Excellent tech | ❌ **Reject for the hosted app.** AGPL §13 triggers on network use — shipping it would force Aura's server source open. Commercial licence via creoox is the only alternative. ThatOpen (MIT) does the job without the trap. |
| **Three.js** | Renderer | **MIT** | Already in use | ✅ in use |
| **Blueprint3D / architect3d / react-planner** | Browser 2D floor-plan drawing → 3D | **MIT** (react-planner) | react-planner: **v2.0.6 published ~6 years ago, unmaintained**, 1.4k★/468 forks, open issues unanswered into 2025; React 16 era | 🔶 **Do not adopt as a dependency.** Harvest the geometry/state model (SVG 2D ↔ Three 3D on one document) and reimplement in Aura's stack. |
| **Thios geodesic configurator** (Pete Bartsch) | Browser configurator → **bill of materials → local supplier quotes via tokenised share links, no phone call** | **CERN-OHL-S** (strongly reciprocal) | Three.js r172, vanilla JS, PHP/MySQL, Draco GLB, OnShape REST | 🔶 **Read it, don't fork it.** This is Aura's exact business shape proven end to end at small scale — the supplier-quote flow is worth studying line by line. CERN-OHL-S reciprocity makes forking expensive; the *pattern* is free. |

### 3.4 SIP panels / prefab / eco-home (R3) — **the gap**

Searched specifically for open-source SIP/prefab/panelization tooling. **There is none.**
Everything found is commercial and Revit-bound: **MWF SIPs**, **Be.Smart SIP Panels**
(ARKANCE), **Dietrich's CAD**, plus in-house systems at fabricators like Porter SIPS. All are
per-seat Revit add-ons; none is scriptable from a web pipeline.

Adjacent open source that *partially* covers it:

| Project | What it does | License | Fit |
|---|---|---|---|
| **COMPAS Timber** (Gramazio Kohler Research, ETH Zürich) | Toolkit to **streamline design of timber frame structures** — beams, walls, joints, fabrication-oriented workflows; Grasshopper plugin + Python API; DOI-published | **MIT** | ✅ **The single best foundation for R3.** MIT, 4,510 commits, actively maintained, and timber-frame logic is ~70% of SIP logic (a SIP is an OSB-skinned insulated cassette with timber edge splines). CNC/BTLx output not confirmed on the repo page — **verify before relying on it for fabrication files.** |
| **COMPAS** (core) | Python framework for computational architecture, engineering, fabrication; CGAL/libigl/Triangle bindings; Rhino/GH/Blender integrations | **MIT** | ✅ Adopt as the geometry/data substrate under the panelizer. |
| **compas_wood** (Petras Vestartas) | Timber **joint generation** | verify | 🟡 Directly relevant to panel-to-panel connections. |
| **WikiHouse / Skylark 250** | The reference open-source house: CNC-cut plywood **cassette** system, free block library, built in real projects | **Creative Commons ShareAlike** (per WikiHouse: free to use, modify, and **use commercially**; improvements to the system must be published under the same open licence) | ✅ **Adopt as precedent and geometry reference, with care.** Skylark is a cassette system — the closest open analogue to SIP. **ShareAlike is viral over the design files**: if Aura's panel geometry derives from Skylark blocks, Aura must publish those panel files openly. That is arguably *on-brand*, but it must be a deliberate decision, not an accident. |
| **Open Source Ecology / OpenDesk** | Open hardware / open furniture precedents | CC / CERN-OHL variants | 🔶 Governance precedent only. |

**Section verdict.** R3 is unbuilt. This is Aura's defensible technical moat, and §5.9 sets out
what to fork to build it.

### 3.5 Materials takeoff & cost (R4)

| Project | What it does | License | API / self-host | Maturity | Fit |
|---|---|---|---|---|---|
| **OpenConstructionERP** (DataDrivenConstruction) | Full construction ERP: **BOQ, PDF/CAD/BIM quantity takeoff, AI cost matching**, 42 regional catalogues, 120,000+ priced items across 9 cost bases, 4D scheduling, 5D cost model, tendering, 161 modules; `pip install openconstructionerp`, Docker images, desktop installers, **full REST API with SSE** | **AGPL-3.0** (commercial licence sold separately) | Self-host, REST API, PyPI | 618★, 201 forks, 3,481 commits, v3.0 — the most mature OSS in this category by a wide margin | 🟡 **Best-in-class but licence-hostile.** AGPL means a hosted Aura calling it over the network is squarely in §13 territory. Three honest options: (a) run it **offline/internal-only** as an estimator's tool, never in the user request path; (b) buy the commercial licence; (c) take the *catalogue schema* as inspiration and build Aura's own MIT takeoff. **Do not casually `pip install` this into the app.** |
| **IfcOpenShell / Bonsai QTO** | Quantity takeoff straight off the IFC model — this is the technically correct source of truth for Aura, since Aura *authors* the model | LGPL / GPL | Python / headless Blender | Mature | ✅ **Adopt.** Quantities derived from the model we generated are exact, not inferred from a PDF. |
| **PlanSwift and the commercial field** | PDF/plan takeoff | Proprietary | — | — | ❌ |
| **Cost data for Alberta** | — | — | — | — | ⚠️ **No open Canadian unit-price database exists.** RSMeans is paid. Statistics Canada's Building Construction Price Index is free but is an *index*, not unit prices. Aura's existing supplier directory + quoted prices remain the only trustworthy source; keep reconciling to the dollar. |

### 3.6 Eco stack — solar, energy, carbon (R5)

| Project | What it does | License | Fit |
|---|---|---|---|
| **pvlib python** | PV system simulation; irradiance, module/inverter models, `iotools` for weather data | **BSD-3-Clause** | ✅ **Adopt.** Permissive, mature, Sandia-lineage. Sizes Aura's solar honestly for an Alberta latitude and roof pitch. |
| **NREL PVWatts API (v8)** | Hosted energy-production estimate from a handful of inputs | Free API key, US-gov data | ✅ Adopt as a cross-check / zero-infrastructure path. Credit NREL; respect rate limits. |
| **NREL SAM (System Advisor Model)** | Full techno-economic renewable modelling | BSD-3 (verify current text) | 🟡 Heavier; useful for the financing story. |
| **EnergyPlus** | DOE whole-building energy simulation engine | Permissive, BSD-3-style (**verify exact text before shipping**) | ✅ The engine to call directly for heating demand — critical for a glass-heavy home at Alberta winter design temperatures. |
| **OpenStudio SDK** | SDK/translation layer over EnergyPlus | BSD-3 (verify) | 🟡 |
| **Ladybug Tools / Honeybee** | The friendly Python SDK over EnergyPlus + Radiance + OpenStudio; the nicest developer experience in the space | **AGPL-3.0** (honeybee-energy confirmed) | ❌ **for the hosted path.** AGPL. Use EnergyPlus/Radiance directly, or keep Honeybee strictly to internal, offline design studies that never serve output over the network. |
| **Radiance** | Daylight simulation — matters a great deal for a glass house | Permissive (LBNL) | ✅ For the glazing/daylight/overheating story. |
| **EC3** (Building Transparency) | Free embodied-carbon calculator over a large third-party-verified EPD database; **API programme available** | Free/open-access tool + API programme (terms apply) | ✅ **Adopt for R5.** This is how "no concrete" becomes a defensible number instead of a claim. Register for the API; honour their attribution terms. |
| **openLCA** | Professional LCA modelling | **MPL-2.0** | 🟡 If a full LCA is ever needed. |
| **Brightway2** | Python LCA framework, matrix-based, Monte Carlo | BSD | 🟡 Powerful, heavier; pairs with ecoinvent (**ecoinvent data is commercially licensed — that's the real cost**). |
| **AWG / greywater** | — | — | ⚠️ **No open-source design tooling exists** for atmospheric water generation or greywater sizing. Aura's existing physics work (AWG ≈ 0 L/day outdoors in Alberta winter) remains hand-rolled, and is a genuine asset — nobody else has done it honestly. |

### 3.7 Site, parcel, terrain (property stage)

| Project | License | Fit |
|---|---|---|
| **OpenStreetMap data** | ODbL — **share-alike on derived databases**; attribution required | 🟡 Fine for display/context; be careful about deriving a redistributed database. |
| **blender-osm** (vvoovv) | **GPL** (free base version; premium build $17.80, source still GPL) | 🟡 Server-side terrain/context generation only. |
| **BlenderGIS** (domlysz) | GPL-3.0 | 🟡 Same boundary. |
| **Alberta parcel/assessment data** | Per-municipality open-data terms | ⚠️ Aura's LAND filter already encodes the district-vs-county minimum-dwelling trap (592 vs 1,076 sqft). That domain knowledge has no open-source equivalent — keep it. |

### 3.8 Generative visuals (marketing, not engineering)

| Project | License | Fit |
|---|---|---|
| **ComfyUI** | **GPL-3.0** | 🟡 Run as a **separate server-side service**, never vendored into the MIT repo. Node-graph render pipeline. |
| **ControlNet + SD 3.5 / Flux checkpoints** | **Stability AI Community License** — free commercially **only under $1M annual revenue**; ControlNet code Apache-2.0; checkpoints vary | ⚠️ **Tripwire.** Fine today, becomes a licensing event the moment Aura crosses $1M. Log it now so it isn't a surprise later. Prefer permissively licensed checkpoints where quality allows. |
| **TRELLIS** (Microsoft) | **MIT** for the bulk of code and models; **submodule exceptions** (`diffoctreerast`, modified Flexicubes have their own terms) | ✅ Image/text → 3D (Gaussians, radiance fields, textured GLB). 13.4k★. Good for props and site furniture, **not** for the house itself — the house must be parametric and quantifiable, not generated triangles. |
| **Hunyuan3D** | **Tencent Hunyuan Community License** — commercial use of *outputs* permitted, model redistribution restricted, regional carve-outs | 🟡 TRELLIS's MIT is cleaner. Prefer TRELLIS. |

---

## 4. Where each candidate lands in Aura's existing five stages

```
LAND ──────► DESIGN ────────► BUDGET ────────► MATERIALS ──────► BUILD
  │            │                 │                 │                │
OSM/ODbL   ResPlan priors   IFC QTO (exact)   supplier directory  MCP tools
Alberta     + constraint    ─────────────►    + Alberta quotes    + escrow
bylaws        solver          pvlib · EnergyPlus · EC3            (X Layer)
(Aura's       │                 (the eco proof)                     │
 own)         ▼                                                     │
        IfcOpenShell (author IFC)                                   │
              │                                                     │
              ├─► aura-panelizer  ◄── COMPAS Timber + CadQuery ─────┤
              │   (SIP cut list)      (the thing to build)          │
              ▼                                                     │
        ThatOpen components + web-ifc (browser) ────────────────────┘
              │
              └─► TRELLIS / ComfyUI (marketing renders, side path)
```

---

## 5. Ranked shortlist and integration plan

Ranked by **(value to Aura) × (licence safety) ÷ (integration cost)**.

### 5.1 — **ResPlan** · dataset · CC BY 4.0 (data) + MIT (code) · ⭐ adopt first
**Why #1.** It removes the single hardest blocker in the whole report: every good floor-plan
model is trained on a research-only dataset. ResPlan is 17,000 vector plans with connectivity
graphs, metric scale, no PII, under a licence that permits commercial use with attribution.

**How to integrate — *not* as a model.** Do not train a diffusion model. Instead:
1. Ingest the pickle, cluster into a **typology library** (3-bed rectangle, L-plan, great-room-
   south, etc.) filtered to Aura-compatible shapes (simple envelopes panelize cheaply).
2. Extract **adjacency priors** from the connectivity graphs — which rooms touch, typical areas,
   circulation patterns. That's the "architectural taste" layer, learned from 17,000 real homes.
3. Feed those priors into a **constraint solver** (room areas, adjacency, south glazing, SIP
   module grid, budget ceiling) that emits a plan deterministically.

**Why this beats a diffusion model for Aura:** deterministic, explainable to a building
official, no GPU in the request path, fits the module grid *by construction*, and reruns
instantly when the user drags the budget slider. Diffusion gives pretty plans that don't
panelize; a solver gives buildable ones.

**Effort:** ~2 weeks for a credible v1.

### 5.2 — **IfcOpenShell** · LGPL-3.0-or-later · ⭐ adopt
**Why.** The authoritative way to *author* a data-rich building model in Python. Once Aura's
homes exist as IFC, quantities, energy models, viewers, and contractor handoff all come for
free from one artifact.

**How:** a **separate Python microservice** (`aura-model-service`) that takes the solver's plan
JSON and emits IFC via `ifcopenshell.api` — `project.create_file`, `root.create_entity`,
`geometry.add_wall_representation`, `spatial.assign_container`. Call it over HTTP from the
Next.js app and expose it as an MCP tool for the brain.

**Licence discipline:** unmodified library, separate process, dynamically imported. Never vendor
or patch it. If IfcOpenShell itself ever needs a fix, contribute upstream rather than forking.

### 5.3 — **ThatOpen components + web-ifc** · MIT + MPL-2.0 · ⭐ adopt
**Why.** MIT BIM toolkit built on Three.js — the exact stack Aura's landing already runs. IFC
load/display/navigate, **2D floor-plan generation and navigation**, clipping planes, dimensions,
DXF export. It gives the plan↔3D toggle, the measurement UI, and the "download a DXF for your
contractor" button without writing any of it.

**How:** `npm i @thatopen/components @thatopen/components-front @thatopen/fragments web-ifc`,
mount in the design page, load the IFC produced by 5.2. Convert to Fragments for weight — this
also solves the queued meshopt/KTX2 compression concern for model geometry.

**Licence note:** MPL-2.0 (web-ifc) is *file-level* copyleft — safe inside an MIT app; only
files of theirs that we modify must stay open. Don't modify them.

### 5.4 — **COMPAS Timber + COMPAS core** · MIT · ⭐ adopt (foundation for the fork)
**Why.** MIT, actively maintained (4,510 commits), from Gramazio Kohler Research at ETH Zürich,
DOI-published. Timber-frame walls, beams, and joints are the nearest existing abstraction to SIP
cassettes.

**How:** use as the library beneath `aura-panelizer` (§5.9). Walls from the IFC model become
timber-frame assemblies; Aura adds panel splitting, skin/core/spline layering, opening bucks,
and the cut list.

**Verify first:** whether it emits **BTLx** or other CNC fabrication data. Not confirmed on the
repo page, and it changes whether we can hand a file straight to a panel shop.

### 5.5 — **ifc-bonsai-mcp / MCP4IFC** · MIT (code) · ⭐ adopt (fork candidate)
**Why.** 50+ MCP tools that let an LLM create walls, roofs, slabs, doors, windows and stairs
parametrically on a real IFC model, plus semantic search over IFC docs and RAG-backed dynamic
code generation. It is the same architecture Aura already shipped in `aura-brain` — which means
the integration is a merge, not a port.

**How:** fork it, strip to the tools Aura needs, and **merge the tool surface into `aura-brain`**
so the design agent can manipulate the model directly. MIT permits this outright.

**Boundary:** it drives **Bonsai (GPL-3.0)** inside Blender. Keep Blender+Bonsai as a
**server-side worker process** invoked over its socket — Aura already has Blender MCP installed
and connected user-scope, so the runway is there. Never copy Bonsai code into the repo.

**Maturity caveat:** 57★, 7 commits, and the authors note a newer version elsewhere. Fork the
concept and the tool schema; expect to own the code.

### 5.6 — **pvlib (BSD-3) + EnergyPlus (permissive) + Radiance + EC3 API** · ⭐ adopt
**Why.** This turns Aura's eco claims into numbers. A **glass-forward home in Alberta** lives or
dies on solar gain vs winter heat loss; Radiance and EnergyPlus are how that gets answered
honestly, and EC3 is how "no concrete" becomes a measured embodied-carbon delta instead of a
slogan.

**How:** a second Python service (`aura-eco-service`) alongside the model service. IFC → energy
model → annual demand; pvlib/PVWatts → PV yield; EC3 API → embodied carbon per material line.
Expose all three as MCP tools. Publish the numbers on the site — that transparency *is* the
brand.

**Licence discipline:** **avoid Honeybee/Ladybug (AGPL)** in the hosted path despite the nicer
DX. Call the permissive engines directly.

### 5.7 — **Bonsai / Blender headless** · GPL-3.0 · 🟡 adopt server-side only
**Why.** Best-in-class IFC quantity takeoff, IDS validation, clash detection, and parametric
stairs/roofs. Also renders.

**How:** offline job queue, invoked as a subprocess/socket. Nothing GPL enters the repo or the
browser bundle. GPL (unlike AGPL) imposes no obligation on a network service that merely calls
it — but this only holds if the boundary stays clean.

### 5.8 — **WikiHouse / Skylark** · CC ShareAlike · 🟡 adopt as precedent, with a decision
**Why.** The only proven open-source house construction system: CNC cassettes, free block
library, real buildings, commercial use explicitly permitted. Their Wall XL / Skylark 250 block
geometry is a working reference for how a cassette system handles openings, junctions and
tolerances.

**The decision Matt has to make:** ShareAlike is viral **over the design files**. If Aura's SIP
panel geometry is *derived* from Skylark blocks, Aura must publish its panel files under the
same open licence. Given Aura is already MIT and open by disposition, that may be a feature —
but it must be chosen, not stumbled into. **Safe default: study the system, cite it as prior
art, and derive Aura's panel geometry independently from SIP manufacturer specs** (SIPA design
guidance, panel dimensional standards), keeping the ShareAlike obligation off the table.

### 5.9 — **The fork target: `aura-panelizer`** (nothing to adopt — build it)

**Nothing open source does SIP panelization.** The commercial field is Revit add-ons at per-seat
prices, unreachable from a web pipeline. This is the piece Aura must own, and it is also the
piece that makes the rest of the platform defensible.

**Build on (all MIT/Apache — no copyleft in the moat):**
- **COMPAS + COMPAS Timber** (MIT) — assembly, beams, joints, fabrication orientation
- **CadQuery / build123d** (Apache-2.0) — the panel solids: OSB skins, EPS core, timber splines,
  cam-lock hardware, window bucks
- **IfcOpenShell** (LGPL, separate process) — read the authored model, write the panel set back
  as IFC elements so quantities and cost stay on one artifact

**What Aura adds — the actual IP:**
1. **Panel subdivision** honouring stock sheet sizes (4×8 / 4×24 ft), crane/transport limits,
   and Alberta road width constraints.
2. **Opening handling** — glass is Aura's signature; large glazed openings drive panel splits,
   headers, and structural checks. This is where a naive tool fails.
3. **Joint library** — splines, cam-locks, sealing/tape schedule, thermal-bridge accounting.
4. **Cut list + BOM** keyed to Aura's supplier directory, reconciled to the dollar (existing
   frozen anchor).
5. **Screw-pile foundation layout** from panel loads — the "no concrete" claim made structural
   (protected galvanized/AC228 piles, per Aura's existing research).
6. **CNC output** (BTLx or DXF nest) so a panel shop can quote and cut from the file.

**Effort:** the largest single item in the report — call it 6–10 weeks for a defensible v1 — and
the only one that can't be bought, borrowed, or npm-installed.

### Not adopted, and why (explicit)

| Rejected | Reason |
|---|---|
| **HouseDiffusion** and every RPLAN-derived model | GPL-3.0 code **and** research-only dataset provenance. Commercial use is not available. |
| **xeokit-sdk** | AGPL-3.0 — network use forces Aura's server source open. ThatOpen (MIT) is equivalent for our needs. |
| **Honeybee / Ladybug** | AGPL-3.0. Call EnergyPlus/Radiance directly instead. |
| **OpenConstructionERP** | AGPL-3.0. Genuinely the best OSS estimator found — revisit only via commercial licence or strictly-offline internal use. |
| **react-planner** | MIT but ~6 years since last publish, unmaintained, React 16 era. Harvest the model, not the package. |
| **Thios configurator** | CERN-OHL-S reciprocity. Study the supplier-quote flow; don't fork. |
| **All six apps from the article** | Closed source, no public API, wrong problem (restyling/drafting existing spaces, not generating new buildable homes). |
| **3D Warehouse assets** | Per-model, mostly non-redistributable terms. Stick to CC0 sources. |

---

## 6. Licence compatibility map — the part that can bite

Aura Homes = **MIT repo + hosted web app + commercial intent**. Three tiers:

**🟢 Tier 1 — ships inside the app.** MIT, Apache-2.0, BSD-3, MPL-2.0, CC BY 4.0.
`@thatopen/*` · `web-ifc` (MPL, unmodified) · COMPAS + COMPAS Timber · CadQuery · pvlib ·
ResPlan · TRELLIS (mind the submodules) · Three.js.

**🟡 Tier 2 — server-side worker only, never vendored, never in the browser bundle.**
GPL: IfcOpenShell is LGPL and gentler (unmodified dynamic use is fine), Bonsai/Blender/ComfyUI/
blender-osm are GPL and must stay behind a process boundary. GPL is not triggered by network
service use — **but only while the boundary is clean.** The moment someone copies a GPL file
into the repo "just to fix one thing", Aura's MIT licence is compromised.

**🔴 Tier 3 — do not use in the hosted path.**
AGPL-3.0: xeokit, Honeybee/Ladybug, OpenConstructionERP. AGPL §13 extends copyleft to users
interacting **over a network** — precisely Aura's deployment model. Either buy the commercial
licence or don't use it.

**⚠️ Special cases to diary now, not later:**
- **Stability AI Community License** — free commercial only **under $1M annual revenue**. Set a
  reminder; this is a future licensing event, not a permanent freedom.
- **WikiHouse CC ShareAlike** — viral over derived *design files*. Decide deliberately (§5.8).
- **OSM / ODbL** — share-alike on derived *databases*; attribution mandatory.
- **RPLAN and CubiCasa5K** — verify in writing before any commercial use. Assume non-commercial
  until proven otherwise.
- **ecoinvent** (if Brightway is used) — the software is free, the data is commercially licensed.
- **TRELLIS submodules** — `diffoctreerast` and modified Flexicubes carry their own terms.

---

## 7. Recommended build order

| Wave | Do | Unblocks |
|---|---|---|
| **1** | Ingest ResPlan → typology library + adjacency priors. Stand up `aura-model-service` (IfcOpenShell) emitting IFC from a plan spec. | Real generated homes instead of fixed models |
| **2** | Mount `@thatopen/components` + web-ifc in the design page; plan↔3D toggle, dimensions, DXF export. | The visible product leap |
| **3** | Constraint solver over the priors, wired to the budget slider. | "One-click design" becomes literal |
| **4** | `aura-eco-service`: pvlib + EnergyPlus + Radiance + EC3. Publish the numbers. | The eco claims become defensible |
| **5** | **`aura-panelizer`** on COMPAS Timber + CadQuery. Cut list → BOM → supplier directory. | The moat; closes design→money loop |
| **6** | Fork `ifc-bonsai-mcp` tool surface into `aura-brain`; Blender/Bonsai as headless worker. | Agent can design and take off directly |

Waves 1–3 are the demo-visible ones. Wave 5 is the business.

---

## 8. CREDITS & LICENSES — paste-ready

> Append to `docs/CREDITS.md` in `kr8tiv-ai/aura-homes` (alongside the existing Kay Lousberg CC0
> lantern credit). Every entry below carries the attribution its licence actually requires —
> plus a few that don't require it but have earned it. **Adopt-on-use rule: nothing ships until
> its row exists here.**

```markdown
## Credits & Licenses

Aura Homes is MIT-licensed and stands on the work of people who gave theirs away first.
Everything below is credited because its licence requires it, or because it deserves it.

### Building model, IFC & geometry

- **IfcOpenShell** — open IFC toolkit and geometry engine. Licensed **LGPL-3.0-or-later**.
  Copyright © IfcOpenShell contributors. https://ifcopenshell.org ·
  https://github.com/IfcOpenShell/IfcOpenShell
  *Used unmodified as a Python library in a separate service to author and read IFC models.*

- **Bonsai** (formerly BlenderBIM) — native IFC authoring in Blender. Licensed **GPL-3.0-or-later**.
  Copyright © IfcOpenShell / Bonsai contributors. https://bonsaibim.org
  *Invoked as a separate server-side process for quantity takeoff and validation. No Bonsai
  code is included in or distributed with Aura Homes.*

- **Blender** — 3D creation suite. Licensed **GPL-3.0-or-later** (Blender Foundation).
  https://www.blender.org
  *Run headless as an external tool. Not redistributed.*

- **COMPAS** — computational framework for architecture, engineering and fabrication.
  Licensed **MIT**. Copyright © COMPAS contributors, ETH Zürich. https://compas.dev ·
  https://github.com/compas-dev/compas

- **COMPAS Timber** — timber-frame design toolkit, developed by **Gramazio Kohler Research,
  ETH Zürich**. Licensed **MIT**. https://github.com/gramaziokohler/compas_timber ·
  DOI 10.5281/zenodo.7934266
  *Foundation of Aura's SIP panelization engine. Cited per the project's DOI.*

- **compas_wood** — timber joint generation. Petras Vestartas.
  https://github.com/petrasvestartas/compas_wood

- **CadQuery** — Python parametric CAD (OCCT). Licensed **Apache-2.0**.
  https://github.com/CadQuery/cadquery

- **FreeCAD** — parametric 3D CAD/BIM modeller. Licensed **LGPL-2.1-or-later**.
  https://www.freecad.org

### Web 3D & BIM front end

- **That Open Engine — @thatopen/components, @thatopen/components-front, @thatopen/fragments**
  — BIM toolkit on Three.js. Licensed **MIT**. Copyright © That Open Company.
  https://github.com/ThatOpen/engine_components

- **web-ifc** (That Open Engine) — IFC read/write at native speed via WebAssembly.
  Licensed **MPL-2.0**. Copyright © That Open Company.
  https://github.com/ThatOpen/engine_web-ifc
  *Used unmodified. Any modified MPL-2.0 files would be published under MPL-2.0.*

- **Three.js** — WebGL rendering library. Licensed **MIT**. Copyright © three.js authors.
  https://threejs.org

- **react-planner** (CVDLAB) — MIT. https://github.com/cvdlab/react-planner
  *Credited as a design reference for Aura's 2D↔3D plan editor. No code reused.*

### Data & priors

- **ResPlan: A Large-Scale Vector-Graph Dataset of 17,000 Residential Floor Plans** — M. Agour et al.
  Data licensed **CC BY 4.0**; code **MIT**. https://github.com/m-agour/ResPlan ·
  arXiv:2508.14006
  *Source of Aura's residential typology library and room-adjacency priors. Used under CC BY 4.0
  with attribution.*

- **OpenStreetMap** — © OpenStreetMap contributors, licensed **ODbL**.
  https://www.openstreetmap.org/copyright

### Energy, solar & carbon

- **pvlib python** — PV performance modelling. Licensed **BSD-3-Clause**. Copyright © pvlib
  python developers; originally PV_LIB MATLAB, Sandia National Laboratories (PVPMC).
  https://github.com/pvlib/pvlib-python

- **EnergyPlus** — whole-building energy simulation. © U.S. Department of Energy / Alliance for
  Sustainable Energy / U.S. National Laboratories. https://energyplus.net

- **Radiance** — lighting and daylight simulation. © Lawrence Berkeley National Laboratory.
  https://www.radiance-online.org

- **NREL PVWatts® API** — © Alliance for Sustainable Energy, LLC. Used under NREL Developer
  Network terms. https://developer.nrel.gov/docs/solar/pvwatts/

- **EC3 — Embodied Carbon in Construction Calculator** — © Building Transparency.
  Embodied-carbon figures in Aura Homes are derived from EC3's EPD database via its API,
  under Building Transparency's terms. https://www.buildingtransparency.org/tools/ec3/

### Precedent & prior art (credited, not incorporated)

- **WikiHouse / Skylark** — open-source construction system by the **WikiHouse Foundation**,
  files licensed **Creative Commons ShareAlike**. https://www.wikihouse.cc
  *Credited as the prior art that proved open-source cassette housing works. Aura's SIP panel
  geometry is derived independently from SIP manufacturer specifications; no Skylark design
  files are copied or adapted.*

- **Thios open-source geodesic shelter configurator** — Pete Bartsch, licensed **CERN-OHL-S**.
  https://blog.thios.co/i-built-an-open-source-3d-configurator
  *Credited as the design→bill-of-materials→supplier-quote pattern that informed Aura's
  materials stage. No code reused.*

- **MCP4IFC: IFC-Based Building Design Using Large Language Models** — Bharathi Kannan
  Nithyanantham, Tobias Sesterhenn, Ashwin Nedungadi, Sergio Peral Garijo, Janis Zenkner,
  Christian Bartelt, Stefan Lüdtke. arXiv:2511.05533. Reference implementation
  `Show2Instruct/ifc-bonsai-mcp`, licensed **MIT**; project site content CC BY-SA 4.0.
  https://show2instruct.github.io/mcp4ifc/
  *Aura's IFC agent tool surface derives from this work. Cited as requested:*

      @misc{nithyanantham2025mcp4ifcifcbasedbuildingdesign,
        title={MCP4IFC: IFC-Based Building Design Using Large Language Models},
        author={Bharathi Kannan Nithyanantham and Tobias Sesterhenn and Ashwin Nedungadi
                and Sergio Peral Garijo and Janis Zenkner and Christian Bartelt
                and Stefan Lüdtke},
        year={2025}, eprint={2511.05533}, archivePrefix={arXiv}}

- **CubiCasa5K** — Kalervo, Ylioinas, Häikiö, Karhu, Kannala. arXiv:1904.01920.
  https://github.com/CubiCasa/CubiCasa5k
  *Evaluated; not used pending written licence confirmation.*

- **HouseDiffusion** — Shabani, Hosseini, Furukawa. arXiv:2211.13287. **GPL-3.0**.
  https://github.com/aminshabani/house_diffusion
  *Evaluated as prior art. Not used: GPL-3.0 code and research-only RPLAN training data.*

### Visual generation (side path)

- **TRELLIS** — structured 3D asset generation, Microsoft. **MIT** for the majority of code and
  models; some submodules (`diffoctreerast`, modified Flexicubes) carry separate licences.
  https://github.com/microsoft/TRELLIS

- **ComfyUI** — node-based diffusion workflow engine. Licensed **GPL-3.0**.
  https://github.com/comfyanonymous/ComfyUI
  *Run as a separate server-side service. Not redistributed with Aura Homes.*

- **ControlNet** — Lvmin Zhang, Anyi Rao, Maneesh Agrawala. arXiv:2302.05543. Code Apache-2.0.

- **Stability AI** models used under the **Stability AI Community License** (free for commercial
  use by organisations under US$1M annual revenue). https://stability.ai/license

### 3D assets

- Lantern model by **Kay Lousberg** (kaylousberg.com) — **CC0 1.0**.
- Additional CC0 assets from **Poly Haven** (polyhaven.com) and **Kenney** (kenney.nl).

### Fonts

- **Space Grotesk**, **Manrope**, **JetBrains Mono** — SIL Open Font License 1.1.

---

**Licence hygiene policy.** Aura Homes is MIT. AGPL-licensed software is not used in the hosted
request path. GPL-licensed software (Blender, Bonsai, ComfyUI) is invoked only as separate
server-side processes and is never vendored, linked into, or distributed with this repository.
No dependency is added without an entry in this file.
```

---

## 9. Open questions for Matt

1. **WikiHouse ShareAlike** — publish Aura's SIP panel files openly (on-brand, community upside)
   or keep the geometry independent and proprietary (§5.8)? Affects how §5.9 is built.
2. **OpenConstructionERP commercial licence** — worth pricing? It is genuinely the best OSS
   estimator found, and buying out of AGPL may beat rebuilding takeoff from scratch.
3. **CubiCasa5K licence** — worth 20 minutes reading the LICENSE file and Zenodo record; if it's
   permissive it doubles the plan corpus.
4. **Stability licence tripwire** — diary the $1M revenue threshold now.
5. **EC3 API registration** — needs a real account; this is the single cheapest credibility win
   for the "no concrete" claim.

## 10. Confidence notes

Verified directly from source repos/sites: licences for IfcOpenShell (LGPL-3.0-or-later), Bonsai
(GPL-3.0-or-later), engine_web-ifc (MPL-2.0), engine_components (MIT), COMPAS Timber (MIT),
ifc-bonsai-mcp (MIT), honeybee-energy (AGPL-3.0), OpenConstructionERP (AGPL-3.0), HouseDiffusion
(GPL-3.0), TRELLIS (MIT + submodule exceptions), ResPlan (CC BY 4.0 / MIT), react-planner (MIT,
dormant), Thios (CERN-OHL-S), Speckle (Apache-2.0), xeokit (AGPL + commercial).

**Not yet verified — check before shipping:** exact EnergyPlus and OpenStudio licence text;
NREL SAM current licence; CubiCasa5K and RPLAN terms; ChatHouseDiffusion, FloorDiffusion and
compas_wood repo licences; whether COMPAS Timber emits BTLx/CNC fabrication data; per-package
licence of `@thatopen/fragments`. These are flagged throughout rather than assumed.

*Report ends. No Aura Homes app files were modified. evolveecoblasting.com untouched.*

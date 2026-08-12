# Credits

The landing experience stands on other people's generosity. Everything below is
used within its license terms; nothing here carries NC or ND restrictions.

## Motion and storytelling inspiration

- **MengTo — kage** — [mengto.github.io/kage](https://mengto.github.io/kage/) ·
  [announcement post](https://x.com/MengTo/status/2085765403729653877)
  Motion and storytelling inspiration only — the scroll-driven camera path through
  per-beat waypoints, frame-rate-independent damping, pointer parallax that fades
  with depth, and word-mask text reveals. Rebuilt from scratch in our own stack
  (React Three Fiber), our own scene, our own copy, and our own branding. No code,
  assets, writing, or visual identity were taken from the kage page.

- **MengTo — towers** — [github.com/MengTo/towers](https://github.com/MengTo/towers)
  Offered by our founder as a source of ideas for the parametric home builder, so
  we looked, and saying so is the honest thing to do. **Nothing from it is used,
  and nothing from it can be:** the repository carries no LICENSE file and the
  GitHub API reports `"license": null`, which is all-rights-reserved by default.
  No licence is granted for reuse.

  It is also, on inspection, a different kind of program — a single-file WebGL
  generative-art demo (a 2.4 MB `index.html`, most of it a vendored Three.js
  build plus base64 textures and audio) that stacks procedural towers behind a
  descending clip plane. There is no SVG output, no orthographic projection, and
  no dimension, schedule or sheet machinery in it — none of the things a
  TypeScript drawing engine would want to borrow.

  So two independent reasons: we may not, and there is nothing to take. Every
  line of `app/lib/builder/` is original, continuing the drafting conventions
  already established in `app/lib/design/blueprint.ts`. This entry stands as
  conceptual prior art and as a record that we checked the licence before
  writing code, rather than after.

## Interface pattern reference

- **Beautiful UI, by Turbo** —
  [beautiful-ui-five.vercel.app](https://beautiful-ui-five.vercel.app/)
  A gallery of primitives for AI-native interfaces. Referenced for the *shape* of
  the concierge surfaces — the approval card (which is exactly the "stop for
  payments and permission" boundary the product needs), tool chips, task rows,
  expandable thinking traces, and the prompt bar — plus its numbered-section
  rhythm. Patterns only: our components are written in our own stack against our
  own tonal ladder and typography. No code or assets copied.

## Ecosystem marks

- **OKX logo** (`app/public/brand/okx-logo.svg`) — authored by OKX, used
  unmodified from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:OKX_Logo.svg)
  under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It
  links to the official Build X page and does not imply endorsement.
- **X Layer** — rendered as plain typographic text linked to the
  [official X Layer site](https://web3.okx.com/xlayer). Aura does **not** bundle
  or recreate the X Layer logo: the published X Layer terms require express
  approval for logo/trademark use, so the interface keeps the attribution
  factual and permission-safe.

## 3D models (in `app/public/models/`)

| File | Model | Author | License | Source |
|---|---|---|---|---|
| `cabin.glb` | Cabin | Poly by Google | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [poly.pizza/m/1GpgtI-C05M](https://poly.pizza/m/1GpgtI-C05M) |
| `pines.glb` | Pine Trees | [Quaternius](https://quaternius.com/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [poly.pizza/m/oYtDty0fR6](https://poly.pizza/m/oYtDty0fR6) |
| `pine-teal.glb` | Pine Tree | Danni Bittman | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [poly.pizza/m/2Qo-fmVKuSG](https://poly.pizza/m/2Qo-fmVKuSG) |
| `campfire.glb` | Campfire | Poly by Google | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [poly.pizza/m/0vzzmM-t8CP](https://poly.pizza/m/0vzzmM-t8CP) |
| `rocks.glb` | Rocks | [Quaternius](https://quaternius.com/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [poly.pizza/m/OQvi8PIZ40](https://poly.pizza/m/OQvi8PIZ40) |
| `lantern.glb` | Lantern (Halloween Bits pack) | [Kay Lousberg](https://kaylousberg.com/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [poly.pizza/m/CtHBJ1ufeW](https://poly.pizza/m/CtHBJ1ufeW) |

Attribution for the CC-BY models: "Cabin" and "Campfire" by **Poly by Google**,
"Pine Tree" by **Danni Bittman**, all via [Poly Pizza](https://poly.pizza/).
Models are used as-is except for material color retints (spruce green, rock grey)
applied at runtime to sit in our palette. The wood-fired hot tub is built from
primitives in our own code.

## Procedural scene detail (no downloaded assets)

The August 2026 elevation pass — mountains, drifting clouds, the wind-blown
grass field, the entrance steps, the hammock, the net lounge, the moose, the
outdoor bollard lighting, the hot-tub steam and the night-mode star field —
adds **no third-party meshes or textures at all**. Every one of them is
generated in code from Three.js primitives, `BufferGeometry` and
canvas-drawn textures in
[`app/components/story/SceneDetail.tsx`](../app/components/story/SceneDetail.tsx).

That was a payload decision first: a single good grass or tree pack is
2–10 MB with textures, and this page has a payload budget. It also means
there is no licence to track and no upstream that can move or change terms.

### Grass — the shipped implementation and its sources

The meadow in `SceneDetail.tsx` is a synthesis of three open-source
references. No files were copied; the geometry layout, the wind model and the
distance handling come from them and the credit is owed in full:

| Source | Licence | What was taken |
|---|---|---|
| **[muratkamci/snakey-locomotion](https://github.com/muratkamci/snakey-locomotion)** | **MIT** | The load-bearing reference. `InstancedBufferGeometry` with compact per-instance attributes (`aOffset` vec2, `aRand` vec4) instead of a per-blade matrix; the 4-segment blade tapering to a tip; layered gust + ripple value-noise wind; the quadratic-Bézier bend pinned at the root; the `pow(vT, 1.4)` tip gradient; backlit translucency and specular glint; and **blade width that grows with camera distance** to kill shimmer, paired with a per-blade randomised distance dissolve. |
| **[Aleksandar Gjoreski — *Trimming my Grass Shader*](https://aleksandargjoreski.dev/blog/trimming-my-grass-shader/)** | article | The performance doctrine: drop `InstancedMesh` for `InstancedBufferGeometry` so you stop paying 16 floats of `instanceMatrix` per blade (he measured 67 MB saved), thin stochastically with distance, and reject blades below a scale threshold before they reach the vertex stage. |
| **[thebuggeddev/football](https://github.com/thebuggeddev/football)** | **none — all rights reserved** | **Nothing was taken, and nothing may be.** Re-examined Aug 2026 at the founder's suggestion: the repository publishes no licence file, so default copyright applies and none of it can be used in an MIT project. Its grass is also not reusable in practice — a 126 KB inline `index.html`, with `src/main.js` containing no grass, shader, or post-processing code at all. Listed here so no future contributor "borrows" from it on the assumption it was already vetted. |

**The correction those references produced.** Three earlier attempts here were
too *sparse* — 2,400 then 6,000 blades over a 12–22 m ring is roughly 3–6
blades per square metre, so every blade read as a separate object and aliased
into a dark speck. The references run ~49 blades/m² (16,000 per 18 m tile). At
that density blades stop being objects and become a surface. Density, plus
widening blades with distance, was the whole fix.

### August 2026 beauty pass — research applied

The "keep it complex but fast" research round (Aug 2026) studied and adopted
the following. Techniques only — no code or assets were copied:

- **[Codrops — *How to Make The Fluffiest Grass With Three.js*](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/)**
  (article; technique credit) — **adopted**: "match the terrain to the colour
  of the grass and fake the occlusion with a dark base." The terrain vertex
  colours now darken 18% under the meadow (`meadowShade` in
  `SceneDetail.tsx`, mirrored in the blade shader's root colour), so gaps
  between blades read as sward shadow instead of bare lawn.
- **Sucker Punch — Ghost of Tsushima grass** (via the
  [GDC talk summary](https://gist.ly/youtube-summarizer/procedural-grass-systems-in-ghost-of-tsushima-achieving-art-direction)
  and [Tiger Abrodi's write-up](https://tigerabrodi.blog/what-we-can-learn-from-grass-in-ghost-of-tsushima-renders);
  technique credit) — **confirmed and kept**: Bézier-bent blades, per-patch
  clumping of species/traits rather than per-blade randomness, and slim
  ~1:12 blade proportions; **rejected for this scene**: their compute-driven
  tile pipeline (no compute in a WebGL static export).
- **[Oleksandr Popov — *Efficient WebGL vegetation rendering*](https://keaukraine.medium.com/efficient-webgl-vegetation-rendering-b09a7fa904cc)**
  (article; technique credit) — corroborated the tile-instancing and
  proportional-density-reduction LOD already in place.

### Earlier grass research (studied during the rejected attempts)

No code was copied from these either, but they shaped the approach:

- **[Codrops — *How to Make The Fluffiest Grass With Three.js*](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/)**
  — chunked `InstancedMesh`, three LOD levels, base→tip colour lerp along
  `uv.y`, sine wind modulated by a scrolling noise texture.
- **[CK42BB/procedural-grass-threejs](https://github.com/CK42BB/procedural-grass-threejs)** — **MIT**
  — tapered triangle strips on a quadratic Bezier, the three-layer wind model
  (global sway / gust fronts / per-blade turbulence) computed entirely in the
  vertex shader, and distance-based LOD rings.
- **[James Smyth — *Breath of the Wild style grass in Three.js*](https://smythdesign.com/blog/stylized-grass-webgl/)**
  — the 5-vertex blade layout and using height along the blade to scale
  displacement so the bend is anchored at the root.
- **[Nitash-Biswas/grass-shader-glsl](https://github.com/Nitash-Biswas/grass-shader-glsl)**
  — R3F + custom GLSL instancing reference.

### Mountains

The snow-capped range is **procedural, not a downloaded model** — a ridged
fractal heightfield with the snow line assigned by altitude modulated by
slope, sun shading baked into vertex colours, and aerial perspective blended
by depth. Poly Haven's model catalogue (CC0) was checked first and carries
props and rocks rather than terrain or ranges, so there was nothing to
source; a mountain range is also geometry a heightfield generates better
than a mesh download ships.

Two further techniques are owed credit even though no code was copied:

- **Instanced grass with vertex-shader wind** — the general approach is the
  one demonstrated in the [three.js examples](https://threejs.org/examples/)
  (MIT) and explained most clearly in
  [Simon Dev's](https://github.com/simondevyoutube) public work (MIT). Our
  blade is a single triangle and the wind and cursor-push are injected into
  a stock `MeshLambertMaterial` via `onBeforeCompile`.
- **Aerial-perspective mountains** — three ridge bands, each paler and
  lower-contrast, dissolving into the fog colour. Traditional matte-painting
  practice rather than any one source.

## Design service — floor plans and renders (`design-api/`)

The service generates plans **procedurally**, which sidesteps dataset
licensing entirely. No third-party model weights, datasets or plan corpora are
bundled. Sources evaluated, and the verdict on each:

| Source | Licence | Verdict |
|---|---|---|
| **[ResPlan](https://github.com/m-agour/ResPlan)** — 17,000 vector residential floor plans | **Data CC BY 4.0 · Code MIT** | ✅ The only large, *commercially usable* vector plan corpus found. Not yet used; it is the priors base if proportion learning is ever added. |
| **HouseDiffusion** (aminshabani) | **GPL-3.0**, trained on **RPLAN** (research-only) | ❌ **Blocked twice** — copyleft code and a non-commercial dataset. Recorded so nobody adopts it later assuming it was vetted. |
| **[AI4SC/bim-diffusion-models](https://github.com/AI4SC)** | to verify | 🟡 Technique borrowed, not code: synthesise plans procedurally to avoid dataset licensing. That is what `services/layout.py` does. |
| **[@thatopen/components](https://github.com/ThatOpen/engine_components)** | **MIT** | ✅ Recommended for the plan ↔ 3D toggle and in-browser DXF. Not yet mounted. |
| **react-planner / Blueprint3D / architect3d** | MIT | 🔶 Geometry/state model studied; **not adopted** — react-planner's last release is ~6 years old. |
| **[z-aqib/Floor-Plan-Generator-Using-AI](https://github.com/z-aqib/Floor-Plan-Generator-Using-AI)** · **[abdshomad/ai-floor-plan-generator](https://github.com/abdshomad/ai-floor-plan-generator)** · **[adrianhajdin/roomify](https://github.com/adrianhajdin/roomify)** | per repo — verify before reuse | 🔶 Reviewed as prior art for the questionnaire → plan → render shape. No code taken. |
| **Planner 5D · Floorplanner · HomeByMe · PromeAI · Remodel AI · Krea · DecAI · Synapse AI · Floor-Plan.ai · Ideal House** | commercial SaaS | ⚠️ **Study the UX, do not integrate.** None expose a public self-serve API suitable for this flow; Planner 5D is the closest interaction reference. Full evaluation in [AI-TOOLS-RESEARCH.md](AI-TOOLS-RESEARCH.md). |

**Libraries** — [svgwrite](https://github.com/mozman/svgwrite) (MIT) ·
[ezdxf](https://github.com/mozman/ezdxf) (BSD-3-Clause) ·
[CairoSVG](https://github.com/Kozea/CairoSVG) (LGPL-3.0, invoked as a separate
process, not linked) · [FastAPI](https://github.com/fastapi/fastapi) (MIT) ·
[Pydantic](https://github.com/pydantic/pydantic) (MIT) ·
[httpx](https://github.com/encode/httpx) (BSD-3-Clause).

**Image models — licence tripwire.** ControlNet code is Apache-2.0, but SD 3.5
and Flux *checkpoints* ship under the **Stability AI Community License**, free
commercially **only under US$1M annual revenue**. Default is
`black-forest-labs/flux-schnell` (**Apache-2.0 weights**);
`black-forest-labs/flux-dev` is **non-commercial and must not ship**. The note
lives in code at `design-api/app/services/images.py`.

## Audio

- **Forest ambience** (`app/public/audio/forest-ambience.mp3`) — carried over
  from the founder's own [Evolve Apparel](https://evolveapparel.shop) site
  (the `evolve-lifestyle` repo), where this play-button pattern originated.
  Founder-owned, reused across his own properties. Loaded on demand only
  (`preload="none"`), so a visitor who never presses play never downloads it.

## Open-source libraries

- [three.js](https://threejs.org/) — MIT
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) — MIT
- [drei](https://github.com/pmndrs/drei) — MIT
- [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) — MIT
- [postprocessing](https://github.com/pmndrs/postprocessing) — Zlib
- [Next.js](https://nextjs.org/) — MIT
- [Tailwind CSS](https://tailwindcss.com/) — MIT

## Where to source assets next

The researched shortlist — Quaternius, Kenney, Poly Haven, ambientCG,
Sketchfab's CC0 filter, Freesound — with licences, verdicts, and the reasons
we rejected certain options, lives in
[docs/research/SCENE-ASSETS-AND-LIBRARIES.md](research/SCENE-ASSETS-AND-LIBRARIES.md).

**The standing rule:** nothing enters `app/public/models/` without a row in
the table above carrying title, author, licence and source URL.

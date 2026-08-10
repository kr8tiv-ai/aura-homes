# Grass — state of the art, and what to change

*Research spec, August 10, 2026. Written for the agent who implements it. Every recommendation carries an expected cost and a confidence level. Sources at the bottom; every number that came from a source is attributed, every number that came from arithmetic on our own code is marked **derived**.*

**Scope.** `app/components/story/SceneDetail.tsx` (GRASS section) and the `Terrain()` vertex-colour pass in `app/components/story/Scene.tsx`. Nothing else.

---

## 0. The verdict in one page

The meadow is **not** short of blades. It is short of three things, and one of them is an arithmetic mistake rather than an art problem.

1. **The double falloff.** The planting mask fades over r = 16 → 35 m *and* the LOD keep-fraction fades over d = 14 → 34 m. They multiply. Between roughly **24 m and 45 m** the surviving blade density collapses to under 2 blades/m², which is where the crest and trailhead beats put the middle of the frame. Derived below: bare-ground fraction goes from 7% at 25 m to **64% at 30 m**. That band is the "sparse" read.

2. **Two clearance fields that disagree.** `Terrain()` computes its meadow shading from `clearance(x, z)` with the **wide** pads. The filler layer — the layer that actually covers the ground — plants with `clearance(x, z, 0.22, 0.5, true)`, the **tight** pads. Around the fire pit that is a 1.65 m → 4.0 m annulus where the ground is painted bright, walked-lawn colour while full-height dark-rooted grass stands on it. Bright ground behind dark blades is the exact perceptual recipe for "blades read as separate objects."

3. **Per-blade variance that never dies with distance.** Hue/value jitter (±13%), a tip glint, root AO and a per-blade normal all run at full strength at 30 m, where a blade is a few pixels. Ghost of Tsushima's fix is explicit and free: *blend the blade normal toward a clump-common normal as camera distance increases* ([GDC 2021, via Abrodi](https://tigerabrodi.blog/grass-in-ghost-of-tsushima)). A field whose blades share a normal shades as one surface. Ours shades as N objects.

Near the house the field is **over**-provisioned. Derived: the carpet layer runs 318–636 blades/m² where roughly **200/m² closes the ground at every camera beat we ship.** The founder has asked for more grass four rounds running and each round bought density into a region that was already opaque. The honest answer is that the missing grass is 20–45 m out, not at his feet.

**Stop counting triangles as the budget.** Measured, `C:\tmp\aura-shots\metrics\round3-clean.json`: frame time tracks **draw calls** more tightly than triangles across all seven desktop beats (553 draws → 62.6 ms; 1019 draws → 103.9 ms; ≈ 0.09 ms per draw, the classic three.js per-draw CPU cost). Triangle count moves 1.04M → 1.34M over the same span. See §7 for the falsification test before acting on this.

---

## 1. When does a field of blades become a surface?

### 1.1 The carpet criterion (derived)

A vertical blade is a ribbon of width `w` and height `h`. Standing on ground with `n` blades per m², viewed with the ground receding at depression angle θ (θ = atan(eye height ÷ horizontal distance)), the blades occupy a *screen band* of height `h·proj/d`. The depth of ground that stacks into that band is `h / tan θ`. So the horizontal fraction of that band covered by blade material is

```
C  =  n · w · h / tan θ
```

With independent (Poisson-ish) placement, the fraction of the band that still shows bare ground is

```
B  =  exp(−C)
```

| C | Bare ground B | Reads as |
|---|---|---|
| 0.5 | 61% | scattered sticks |
| 1.0 | 37% | sparse field |
| 2.0 | 14% | grass, with visible ground |
| **3.0** | **5%** | **a carpet** |
| 4.6 | 1% | solid sward |

**Design rule: hold C ≥ 3 at every camera beat, at every distance the beat frames.** That is the whole spec in one line. It is also why "more blades" and "wider blades" and "taller blades" are interchangeable — they enter the same product — and why *shrinking height* to dissolve a blade is the worst of the three levers, because it removes coverage linearly while removing almost no cost.

Looking straight down is the degenerate case: tan θ → ∞ and C → 0 for a perfectly vertical blade. Our steepest beat is 3-BUDGET (camera y = 5.6, target 8 m away), θ ≈ 35°, tan θ = 0.70 — recoverable. The lean term (`rest` in the vertex shader, 0.03–0.19) is what saves top-down beats; keep it.

### 1.2 What our field actually scores (derived from the shipped constants)

Assumptions: `uProjScale` ≈ 2.75 (fov 40°), eye 2.0–2.5 m above ground, hero mean width 3.5 cm before multipliers, hero mean height ≈ 0.30–0.39 m, carpet mean width 5.8 cm, carpet mean height 0.13 m. Effective planted areas from integrating `meadowDensity` × the filler mask over the sample boxes: hero E ≈ 3,000 m², carpet E ≈ 2,250 m².

| Distance | Hero n/m² surviving | Carpet n/m² | C (combined) | Bare ground | Verdict |
|---|---|---|---|---|---|
| 5 m | 40 | 636 | ≈ 30 | 0% | over-provisioned ≈ 6–10× |
| 10 m | 40 | 318 | ≈ 15 | 0% | over-provisioned ≈ 5× |
| 16 m | 36 | 0 (LOD off) | ≈ 6 | 0.2% | fine |
| 20 m | 30 | 0 | 4.9 | 0.7% | fine |
| **26 m** | **7.0** | 0 | **1.4** | **24%** | patchy |
| **30 m** | **1.9** | 0 | **0.45** | **64%** | bare |
| 34 m+ | ≈ 0 | 0 | ≈ 0 | ~100% | ground only |
| fog help at 32 m | — | — | — | `smoothstep(30,88,32)` = 0.005 | none |

The fog row matters: the current scene fog does essentially nothing at 32 m, so nothing hides the collapse. **The sparse band is 24–45 m, and it is arithmetic, not taste.**

### 1.3 Width vs spacing — the memorable form

Spacing `s = 1/√n`. Rearranged, C ≥ 3 at grazing (tan θ ≈ 0.2, the 10 m case) means

```
w · h / s²  ≥  0.6 m
```

At the shipped carpet height (h = 0.13 m) and width (w = 0.058 m), that permits `s` up to **0.11 m**, i.e. **~85 blades/m²**. We run 318–636. Even trebling the safety margin lands at 250/m².

**Outerra's law, and the one to implement:** *"each detail level halves the amount of blades, while also doubling the width of the remaining ones"* ([Outerra, 2012](https://outerra.blogspot.com/2012/05/procedural-grass-rendering.html)). Ghost of Tsushima does the same thing discretely — *"when switching to larger tiles, 3 out of 4 blades are dropped"* with a wider low-LOD blade mesh ([Abrodi](https://tigerabrodi.blog/grass-in-ghost-of-tsushima)). That is exactly `w ∝ 1/p`, which holds C constant through the entire LOD range. **We currently widen at a flat 1%/metre that is unrelated to the keep-fraction.** That is the single highest-value line of GLSL in this document.

---

## 2. How the industry gets continuity

| Technique | Who | What it buys us | Verdict here |
|---|---|---|---|
| Stochastic thinning weighted by projected size, not a cull ring | [Gjoreski, 2025](https://aleksandargjoreski.dev/blog/growing-my-grass-shader/) (R0 = 10, R1 = 60, pMin = 0.10, ~1M instances, 4 segments, 130×130 patch ⇒ ≈ 70 blades/m²) | no popping, no visible ring | **already have it** — but our pMin is 0.04 and our mask fades on top of it |
| Halve count → double width per LOD step | [Outerra](https://outerra.blogspot.com/2012/05/procedural-grass-rendering.html), Ghost of Tsushima | constant C through LOD | **missing — adopt (P1)** |
| Blend blade normals toward a clump-common normal with distance | Ghost of Tsushima ([1](https://tigerabrodi.blog/grass-in-ghost-of-tsushima), [2](https://gist.ly/youtube-summarizer/procedural-grass-systems-in-ghost-of-tsushima-achieving-art-direction)) | the field shades as one surface; kills specular aliasing | **missing — adopt (P2)** |
| Voronoi/cellular clumping of height, lean, facing | Ghost of Tsushima, [GodotGrass](https://github.com/2Retr0/GodotGrass) | organic patches instead of a lattice | **have it, but on an axis-aligned square lattice — fix (P4)** |
| Stretch edge-on blades horizontally in view space | Ghost of Tsushima, GodotGrass | mass at grazing angles | **have it** (`edgeOn`, 1.3×) |
| Ground carries the canopy past the blade range | [Outerra](https://outerra.blogspot.com/2012/05/procedural-grass-rendering.html) ("the canopy data is also directly used when rendering the terrain in the distance"); GoT LOD3 "replace entire grass field with a single texture on terrain" | the 40 m+ field costs nothing and never ends | **partly** (`meadowShade`) — but it is per-vertex on a 0.85 m flat-shaded grid; fix (P3) |
| Match terrain colour to grass, fake AO with a dark base, hide the transition with fog | [Codrops "Fluffiest Grass", Feb 2025](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/) | gaps read as shadow, not soil | **have it — but the two clearance fields disagree (P0)** |
| Aggregate voxels once a blade is sub-pixel | UE 5.7 Nanite Foliage ([Epic docs](https://dev.epicgames.com/documentation/unreal-engine/nanite-foliage)) | continuity at any distance | not portable; its *principle* is P3 |
| Clamp AO by distance to stop shimmer | [Gjoreski](https://aleksandargjoreski.dev/blog/growing-my-grass-shader/) | temporal stability | **missing — adopt (P2)** |

### 2.1 Techniques evaluated and rejected

- **Shell texturing / fur shells for the mid-field.** Shells are stacked offset copies of the ground with a per-shell dither ([Godot Shaders](https://godotshaders.com/shader/fur-grass-with-shell-texturing/), [Al Remeithi](https://j-2k.github.io/shelltexture/)). Rejected: shells read correctly from above and fall apart at grazing angles, and every one of our seven beats is a 5–35° grazing view. A 16-shell stack over the visible meadow is 16× full-screen overdraw on a device class that already needs `dpr` clamped to 1.75. Cost of the failure mode is high, and the technique's own literature names overdraw and scalability as its trade-offs.
- **Billboard/alpha-card grass for the far field.** The classic hybrid ([Unity terrain details](https://docs.unity3d.com/2020.1/Documentation/Manual/terrain-Grass.html), [DynDOLOD grass LOD](https://dyndolod.info/Help/Grass-LOD)) is near geometry → mid cards → far terrain texture. Rejected for the *card* stage only: cards need alpha, alpha needs either sorting or alpha-to-coverage, and both introduce failure modes (halo fringes, MSAA-dependent behaviour) into a scene whose blades are currently **opaque and therefore perfectly temporally stable**. We keep the hybrid's first and third stages and skip the middle: geometry near, ground-as-canopy far.
- **`BatchedMesh`.** It renders many *geometries*, not many *instances* — `multiDrawElementsInstanced` is still an open request ([three.js #31935](https://github.com/mrdoob/three.js/issues/31935)). It cannot batch instanced grass. Do not spend a day on it.
- **Indirect draw / GPU compaction.** Not available. WebGL 2 has no `drawElementsIndirect`, and `WEBGL_multi_draw_instanced_base_vertex_base_instance` is a [draft extension](https://registry.khronos.org/webgl/extensions/WEBGL_multi_draw_instanced_base_vertex_base_instance/) with no Safari support and no Chrome/macOS support. The GPU-compaction architectures in the reference material (Gjoreski, GoT) are WebGPU/console-only. This is already correctly noted in the file's own comments; keep it noted.
- **TAA.** `alphaHash` would need it, and TAA on a scroll-driven camera smears. Our anti-aliasing is `EffectComposer multisampling={4}`, which super-samples opaque thin geometry well. Do not change it.

---

## 3. Prioritised implementation spec

Ordered by (expected improvement ÷ risk). Triangle costs are **submitted** triangles at the worst beat (2-crest, currently 1,343,546) unless stated.

### P0 — One clearance field for the ground. Zero triangles. Confidence: high.

**Problem.** `meadowShade()` calls `clearance(x, z)` (wide pads). The carpet layer plants with `clearance(x, z, 0.22, 0.5, true)` (tight pads). Around the fire pit that is bright lawn from 1.65 m to 4.0 m under full-height grass; around the tub pad, 1.42 m to 2.3 m; along the trail, ±0.72 m to ±1.05 m; and the whole under-deck slot is painted bright lawn while the carpet grows through it unimpeded (tight mode skips the deck rect entirely).

**Change.** In `meadowShade()`:

```ts
// The ground must be shaded by the clearance of the layer that actually
// covers it — the carpet — not by the hero layer's tall-blade pads.
return clamp01(d) * Math.pow(clearance(x, z, 0.22, 0.5, true), 0.6);
```

Raise the exponent 0.35 → 0.6 at the same time: with tight pads the field no longer needs the soft power to keep shade on the mown shoulders, and 0.6 lets the true aprons (fire ring, stones, steps) read walked and bright the way they should.

**Expected.** The pale annuli around the fire pit, the tub, the deck slot and the trail shoulders disappear. This is the change most likely to answer "patchy near the house" on its own.

**Verify.** Beats 2-DESIGN, 4-ESCROW, 5-BUILD. Sample the rendered pixel value at (x, z) = (−4.7, 6.5) + 2.0 m and compare to the same sample at + 5.0 m; the two should differ by under 6% in luminance. Before the change they differ by roughly 25–30% (derived from the terrain colour law).

---

### P1 — Coverage-compensating width, and one distance falloff instead of two. ≈ +150–200k submitted tris. Confidence: high.

This is the fix for the 24–45 m band.

**1a. Collapse the double falloff.** In `meadowDensity()`, the planting ring is the wrong place to express distance. Widen it so the LOD is the only distance term:

```ts
const ring = 1 - smooth01(30, 48, r);           // was smooth01(16, 35, r)
const scatter = 0.45 * (1 - smooth01(34, 56, r)); // was 0.34 * (1 - smooth01(28, 48, r))
```

Mirror the same two lines in `meadowD()` inside `grassVert` and in `meadowShade()` — they are three copies of one function and they must not drift. (Consider extracting the constants to a single exported object so a future round cannot desync them.)

**1b. Widen the LOD band and raise its floor.**

```ts
export const G_HERO: GrassLayerCfg = { near: 12, far: 46, pmin: 0.30, band: 0.16, tile: 8, segs: 4 };
export const G_FILL: GrassLayerCfg = { near: 8,  far: 15, pmin: 0.0,  band: 0.16, tile: 6, segs: 1 };
```

**1c. Compensate width by the keep-fraction — Outerra's law.** In `grassVert`, immediately after `bw` is computed:

```glsl
  /* COVERAGE COMPENSATION.
     Keeping fraction p of the blades removes (1-p) of the field's projected
     coverage. Widening the survivors by 1/p puts it back exactly, which is
     Outerra's "halve the blades, double the width" and Ghost of Tsushima's
     "drop 3 of 4 blades, swap to the wide low-LOD mesh" in continuous form.
     Cap at 3.2x: past that a blade reads as a ribbon rather than a blade,
     and the ground colour is carrying that distance anyway (see P3). */
  float comp = clamp(1.0 / max(p, 0.08), 1.0, 3.2);
  comp = mix(1.0, comp, aClear);   // a blade cut short by clearance stays slim
  bw *= comp;
```

and **delete** the unrelated flat term `bw *= 1.0 + dist * 0.010;` — it double-counts and it is not tied to what the LOD removed.

Note that `p` is already multiplied by the projected-height gate, so `comp` also rescues the short blades on apron rims that the gate currently deletes. That is a second bug fixed by the same three lines.

**1d. Tighten the projected-height gate** now that survivors are wider: `smoothstep(0.0052, 0.023, projH)` → `smoothstep(0.0035, 0.016, projH)`.

**Expected, derived.** With the mask flat to 30 m, planted hero density holds at ≈ 42/m² (see §4 budgets). Recomputing the §1.2 table:

| Distance | p | comp | n/m² | C | Bare |
|---|---|---|---|---|---|
| 20 m | 0.90 | 1.11× | 37.8 | 5.7 | 0.3% |
| 26 m | 0.75 | 1.33× | 31.5 | 8.0 | 0.0% |
| 30 m | 0.62 | 1.61× | 26.0 | 10.3 | 0.0% |
| 38 m | 0.42 | 2.38× | 17.6 | 11.0 | 0.0% |
| 44 m | 0.32 | 3.13× | 13.4 | 12.5 | 0.0% |

C over-shoots badly past 26 m, which is the signal to **spend the surplus by lowering the planted density** rather than by tightening `comp`: drop the hero budget until C lands in the 3–5 band at 26–44 m. Tune it as one number (`heroCount`) and measure; do not hand-tune the falloff curve.

**Cost.** Submitted triangles rise because a much larger area now survives the trim. Budget the worst beat at ≤ 1.35M submitted (unchanged ceiling) by paying with P5.

---

### P2 — Make the field shade as one surface. Zero triangles. Confidence: high.

Four small edits, all in the same spirit: **per-blade identity must die with distance.** Ghost of Tsushima states the mechanism outright — blend the output normal toward a clump-common normal as camera distance grows, specifically to stop specular aliasing and to make blades read as unified clumps.

In `grassVert`, after the normal is built:

```glsl
  /* Ghost of Tsushima's aggregation: a blade close enough to resolve keeps
     its own normal; past that the clump lends its normal to every blade in
     it, so a patch shades as ONE surface. This is what stops a field from
     reading as N objects, and it costs nothing. */
  float agg = smoothstep(9.0, 28.0, dist);
  vec3 clumpN = normalize(vec3(rest.x * 0.6, 1.0, rest.y * 0.6));
  nrm = normalize(mix(nrm, clumpN, agg * 0.85));
  vAgg = agg;                          // new varying
```

In `GRASS_FRAG`:

```glsl
  // per-clump value/hue jitter is texture up close and pixel noise at range
  float vary = mix(1.0, 0.0, vAgg);
  col *= mix(1.0, 0.88 + vHue * 0.26, vary)
       * mix(vec3(1.0), vec3(1.0 + vHue*0.04 - 0.02, 1.0, 1.0 - vHue*0.04 + 0.02), vary);

  // root AO clamps with distance (Gjoreski: AO at range is pure shimmer)
  float ao = mix(mix(0.78, 1.0, vAgg), 1.04, smoothstep(0.0, 0.6, vT));

  // no tip glint on a blade that is two pixels wide
  col += uSunCol * pow(max(dot(N, H), 0.0), 26.0) * 0.06 * vT * (1.0 - vAgg);

  /* AGGREGATE COLOUR — the Nanite-voxel idea in one line, and Outerra's
     "the canopy is also what paints the distant terrain". Once a blade is
     sub-pixel the honest colour is the canopy average, which is the ground
     tone the terrain is already painting. Converging on it makes the
     blade-to-ground handoff invisible instead of a visible edge. */
  col = mix(col, vGround * 1.06, vAgg * 0.55);
```

**Expected.** The "blades read as separate objects" complaint. Also removes most far-field shimmer during scroll, which is a second, unstated founder complaint waiting to happen.

---

### P3 — The ground must already look like grass. Zero triangles. Confidence: medium-high.

`Terrain()` is a 170 × 170 m plane at 200 segments — **0.85 m per vertex, flat-shaded, 80,000 triangles.** Every meadow cue (mottle, `meadowShade`, trail) is a per-vertex colour on that grid, so at 10–25 m the ground is visibly a lattice of 0.85 m flat facets, and every clearance boundary quantises to a facet edge. That is a second, independent source of "patchy," and it is the surface the whole 45 m+ field hands off to.

**Change.** Move the meadow's high-frequency character into the fragment stage. Patch `meshStandardMaterial` with `onBeforeCompile` (keeps shadows, lights, tone mapping — do **not** hand-roll a replacement material):

```ts
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
mat.onBeforeCompile = (s) => {
  s.vertexShader = s.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
  s.fragmentShader = s.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      /* SWARD DETAIL — the canopy painted at pixel resolution, not at 0.85 m
         vertex resolution. Three octaves at blade-clump scale so the ground
         beyond the last blade already reads as grass. Amplitude rises with
         distance so it never competes with real blades up close. */
      float d = length(vWPos - cameraPosition);
      float amp = smoothstep(8.0, 26.0, d) * 0.16;
      float m = vn(vWPos.xz * 1.7) * 0.6 + vn(vWPos.xz * 5.3) * 0.3 + vn(vWPos.xz * 13.0) * 0.1;
      diffuseColor.rgb *= 1.0 + (m - 0.5) * 2.0 * amp;`);
};
```

Do **not** raise `SEG` past 200 to chase this — that is 80k → 320k triangles for a worse result.

Also drop `flatShading` on the terrain in the meadow ring, or accept it and rely on the fragment mottle to break the facets; measure both. Flat shading is part of the scene's visual language elsewhere, so treat this as an art call, not a bug.

**Expected.** The 45 m+ field stops being "a lawn with the grass switched off," and the P2 aggregate-colour convergence has something correct to converge onto.

---

### P4 — Break the axis-aligned hash lattice. Zero triangles. Confidence: medium-high.

Three per-blade properties are seeded from `floor(worldXZ · k)`, which is a square, world-axis-aligned lattice:

| Line | Cell size | What it controls |
|---|---|---|
| `h21(floor(base.xz * 0.55) + 19.3)` | **1.82 m** | species (blade / tuft / stem) |
| `h21(floor(base.xz * 2.3) + 3.1)` | **0.43 m** | per-clump hue and value |
| `h21(floor(base.xz * 3.7))` | **0.27 m** | rest lean direction |

A 1.82 m square grid of species is exactly the scale the eye reads as "clumps" from 10–25 m, and the lattice is aligned to the camera's own axes for most of the journey. Ghost of Tsushima and GodotGrass both use **cellular/Voronoi** noise for this specifically because it produces irregular cells.

**Change.** Replace `floor(p)` cell hashing with a domain-warped cell lookup — one extra noise fetch, no new attributes:

```glsl
/* Warp the lattice before quantising. Two cheap noise samples rotate and
   stretch the cells into irregular patches; the seed stays a pure function
   of world position, so a blade's identity is still stable across tiles. */
vec2 warp(vec2 p, float k){
  return p + vec2(vnoise(p * 0.31 + 5.1), vnoise(p * 0.29 + 17.7)) * k;
}
float sp = h21(floor(warp(base.xz, 2.4) * 0.55) + 19.3);
```

Apply the same warp (with smaller `k`) to the hue and lean lookups. Additionally widen the species transition bands so a clump boundary is a gradient rather than an edge: `smoothstep(0.48, 0.54, sp)` → `smoothstep(0.44, 0.60, sp)`, and the same for the stem band.

---

### P5 — Rebalance the budget: take from the near field, give to 20–45 m. Net ≈ −100k to −200k submitted tris. Confidence: medium.

Derived (§1.2, §1.3): the carpet layer is 3–6× denser than it needs to be. Recommended planted counts:

| Layer | Now (desktop / mobile) | Recommended | Rationale |
|---|---|---|---|
| Hero, 7 tri | 120,000 / 42,000 | **165,000 / 58,000** | mask area grows ≈ 1.3× under P1a; per-m² density holds at ≈ 42 |
| Carpet, 1 tri | 715,000 / 250,000 | **300,000 / 110,000** | 200–240 blades/m² in the yard core, ≈ 130/m² in the ring — C stays ≥ 3 at every beat |

Also tighten the carpet's yard boost, which is the term that pushed the yard to 636/m²:

```ts
const yard = 1 - smooth01(7, 15, Math.hypot(x, z - 3.6));
dens *= 1 + yard * 0.4;     // was: dens *= 1 + yard  (i.e. up to 2x)
```

**This will be unpopular and it needs evidence before it ships.** Run the falsifiable test in §7.2 first. If the pixel diff exceeds the threshold, keep the density and pay for P1 elsewhere.

---

### P6 — Grass must receive the sun's shadow. Zero triangles, some fill. Confidence: medium.

`GRASS_FRAG` samples no shadow map. The terrain has `receiveShadow` and the scene runs PCSS (`<SoftShadows size={14} samples={10} />`). So inside the house's and the pines' cast shadows, the ground is dark and every blade standing in it is fully sunlit. Lit blades on dark ground is the most literal possible version of "blades read as separate objects," and it happens exactly where the founder is looking — beside the house.

Two routes.

**Option A — real shadow map (correct, ~1 day, medium risk).** Rebuild the material as `new THREE.ShaderMaterial({ lights: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, ourUniforms]), ... })` and include the standard chunks: `<common>`, `<packing>`, `<shadowmap_pars_vertex>` / `<shadowmap_vertex>` in the vertex stage (declare `vec4 worldPosition = vec4(world, 1.0);` and `vec3 objectNormal = nrm;` before the chunk), and `<shadowmap_pars_fragment>` plus a `getShadowMask()` multiply in the fragment stage. Risk: shadow-chunk names and required locals move between three.js releases; verify against the installed version before writing.

**Option B — analytic shadow proxy (fast, ~2 hours, low risk). Recommended for Aug 21.** The scene has fewer than a dozen shadow casters at known, static positions. Project each onto the ground along `uSunDir` in the vertex shader and accumulate occlusion:

```glsl
/* uSunDir moves with the dusk arc, so the proxy must be evaluated per frame,
   not baked. Six casters is ~12 ALU per vertex — free next to the fetch. */
float shadowProxy(vec2 g){
  vec2 slide = -uSunDir.xz / max(uSunDir.y, 0.25);   // ground offset per metre of height
  float s = 1.0;
  s *= 1.0 - 0.72 * boxMask(g, HOUSE_MIN + slide * HOUSE_H, HOUSE_MAX + slide * HOUSE_H, 0.55);
  s *= 1.0 - 0.55 * boxMask(g, DECK_MIN  + slide * DECK_H,  DECK_MAX  + slide * DECK_H,  0.40);
  // ...the four nearest pines as discs
  return s;
}
```

Multiply `light` by it in the fragment stage. It will not match PCSS exactly. It does not need to — it needs the grass and the ground to *agree*, which is the whole point.

---

### P7 — Draw calls, instance memory, and the tile grid. Confidence: medium (measure first).

**7a. Draw calls.** Measured correlation in `round3-clean.json` (desktop): 553 → 62.6 ms, 654 → 69.3, 737 → 76.4, 845 → 96.7, 890 → 83.2, 965 → 83.4, 1019 → 103.9. Slope ≈ 0.09 ms/draw. **Caveat, stated plainly: that run's absolute frame times (62–104 ms) indicate a degraded or software GL path — the same code measured 13.9 ms on the mobile viewport in `v10c-final.json`. The correlation is valid within the run; the conclusion "we are draw-call bound on real hardware" is not yet established.** Run §7.1 before acting.

If confirmed, the fix is **path-adaptive tile sizing**, not a uniform tile increase. The camera path is a fixed seven-beat spline known at build time, so:

```ts
// tile edge by distance to the camera spline: fine culling where the camera
// gets close, coarse where it never does. Cuts far-field draws ~4x without
// making the near-field LOD trim coarse.
const tileEdge = (x: number, z: number) =>
  distToCameraSpline(x, z) < 18 ? 8 : distToCameraSpline(x, z) < 34 ? 16 : 32;
```

Coarse far tiles submit more instances per draw, which raises `info.render.triangles` even as frame time falls — another reason not to treat that counter as the budget.

**7b. Instance memory.** Per instance today: `aPos` vec3 + `aRand` vec4 + `aClear` float = 32 bytes. At 1.04M blades that is **33 MB** of vertex buffer, re-fetched every frame. Pack it:

- `aPos` → `THREE.Float16BufferAttribute` (WebGL 2 supports `HALF_FLOAT` vertex attributes): 12 B → 6 B. Half-float has ~3 decimal digits, giving ≈ 5 mm precision at 46 m — under blade width, so safe.
- `aRand` → `Uint8Array` with `normalized: true`: 16 B → 4 B. Yaw, height, width and fade seed are all fine at 1/255 resolution; height and width are remapped in the shader anyway.
- `aClear` → fold into a fifth `aRand` byte, or a separate `Uint8` normalized: 4 B → 1 B.

32 B → **11 B**, a 66% cut in grass vertex-fetch bandwidth. This is the single best mobile change in the document and it changes no pixels.

**7c. Build time.** ~1M blades are planted in JS on first paint. Move `buildGrassTiles` into a Web Worker returning transferable typed arrays, or precompute the arrays into a binary blob shipped with the static export. Not a rendering fix; it is a first-impression fix.

**7d. `InstancedBufferGeometry` limits worth knowing (verified against the WebGL 2 spec).**
- No `baseInstance` in core WebGL 2 `drawElementsInstanced`, and the base-instance multi-draw extension is [draft with no Safari or Chrome/macOS support](https://registry.khronos.org/webgl/extensions/WEBGL_multi_draw_instanced_base_vertex_base_instance/). You therefore **cannot** sub-range a shared instance buffer — tiles are mandatory, not a stylistic choice. The existing sort-by-fade-seed + `instanceCount` truncation is the correct and only free per-frame lever in this API. Keep it.
- 16 vertex attributes guaranteed. We use 5 (`position`, `uv`, `aPos`, `aRand`, `aClear`), so there is room for a `aClump` vec2 if P4 ever wants precomputed cells.
- `Uint16` indices are fine at 9 vertices per blade.
- `material.alphaToCoverage` **would** work here (`EffectComposer multisampling={4}` gives an MSAA target, and three.js documents A2C as requiring an MSAA context). We do not need it, because the blades are opaque. Note it and move on.

---

## 4. Exact parameter recommendations

```ts
/* LOD bands — one distance term, compensated width. */
export const G_HERO: GrassLayerCfg = { near: 12, far: 46, pmin: 0.30, band: 0.16, tile: 8, segs: 4 };
export const G_FILL: GrassLayerCfg = { near: 8,  far: 15, pmin: 0.0,  band: 0.16, tile: 6, segs: 1 };
```

| Parameter | Now | Recommended | Basis |
|---|---|---|---|
| Hero planted density (mask = 1) | ≈ 40 /m² | **42–48 /m²** | Gjoreski ≈ 70/m² at 4 segments; Codrops reference ≈ 49/m² |
| Carpet planted density, yard core | ≈ 636 /m² | **200–240 /m²** | C ≥ 3 at the steepest beat (θ = 35°) with 3× margin |
| Carpet planted density, ring | ≈ 318 /m² | **120–140 /m²** | C ≥ 3 at θ = 11°, 3× margin |
| Hero blade width | 2.6–4.4 cm | unchanged, **× comp (1.0–3.2)** | Outerra 1/p law |
| Carpet blade width | 4.2–7.5 cm | unchanged | already ≥ spacing at the new density |
| Hero height | 17.6–49.6 cm | unchanged | founder-approved |
| Carpet height | 8–18 cm | unchanged | founder-approved |
| Planting ring feather | 16 → 35 m | **30 → 48 m** | remove the second falloff |
| Scatter floor / reach | 0.34 to 48 m | **0.45 to 56 m** | keep C ≥ 1 to the fog |
| Shade ring feather | 16 → 46 m | **30 → 56 m** | ground must outlast the blades |
| Projected-height gate | 0.0052 → 0.023 | **0.0035 → 0.016** | survivors are wider now |
| Grass aerial dissolve | scene fog 30/88 | **grass-only 34 → 70 m** | scene fog does nothing at 32 m |
| Hero budget desktop / mobile | 120k / 42k | **165k / 58k** | larger mask, same per-m² |
| Carpet budget desktop / mobile | 715k / 250k | **300k / 110k** | §1.3 |
| Terrain segments | 200 (0.85 m) | unchanged | fix in the fragment stage instead |
| Worst-beat draw calls | 965–1019 | **≤ 750** | if §7.1 confirms |
| Worst-beat submitted triangles | 1,343,546 | **≤ 1,350,000** | unchanged ceiling |

**LOD band summary:**

| Band | Carrier | Notes |
|---|---|---|
| 0–8 m | carpet (1 tri) + hero (7 tri) | carpet closes the ground; hero owns silhouette |
| 8–15 m | hero + carpet dissolving | carpet gone by 15 m |
| 15–30 m | hero, p 0.95 → 0.62, width × 1.05 → 1.6 | aggregation ramps in (P2) |
| 30–46 m | hero, p 0.62 → 0.30, width × 1.6 → 3.2, colour → ground | reads as canopy, not blades |
| 46 m+ | terrain sward fragment detail + grass fog | zero geometry, never ends |

---

## 5. What to STOP doing

1. **Stop raising blade count as the answer.** Derived near-field C is 8–30 where 3 closes the ground. Four rounds of density have bought invisible blades. The deficit is at 24–45 m.
2. **Stop dissolving blades by shrinking HEIGHT alone.** Coverage is linear in height (`C = n·w·h/tanθ`), so a height fade removes coverage as fast as it removes cost. Fade in width and count, or shrink uniformly.
3. **Stop stacking two distance falloffs.** The planting mask and the LOD keep-fraction must not both encode distance. One does; the other is flat.
4. **Stop using `floor(worldXZ · k)` for clump identity.** Three axis-aligned square lattices at 1.82 m, 0.43 m and 0.27 m are producing the clumping the founder is complaining about.
5. **Stop shading the ground with a different clearance field than the grass that stands on it.** One field, or the bright annuli come back every round.
6. **Stop running per-blade hue jitter, root AO, per-blade normals and tip glint at full strength past ~25 m.** That is the "separate objects" read, and at range it is also shimmer.
7. **Stop treating `info.render.triangles` as the budget.** It counts submitted instances, including the ones the per-tile trim over-submits and the shader then scales to zero. It is a proxy for vertex work, not for what you can see. Budget draw calls and measured frame time.
8. **Stop reaching for architecture.** No `BatchedMesh` (it cannot batch instances — [three.js #31935](https://github.com/mrdoob/three.js/issues/31935)). No indirect draw (WebGL 2 does not have it). No GPU compaction (WebGPU only). No TAA. No alpha blending on blades — opaque blades are the reason this field is temporally stable today, and that is an asset, not an oversight.
9. **Stop adding a third geometry layer.** If §7.1 confirms the draw-call hypothesis, a third layer costs more than it buys.

---

## 6. Order of work, and expected effect

| # | Change | Time | Δ submitted tris | Confidence | Answers |
|---|---|---|---|---|---|
| P0 | One clearance field for `meadowShade` | 15 min | 0 | high | "patchy near the house" |
| P2 | Aggregation: clump normals, variance fade, AO clamp, aggregate colour | 1–2 h | 0 | high | "blades read as separate objects" |
| P1 | Width compensation + single falloff + wider band | 2–3 h | +150–200k | high | "sparse" at the crest and trailhead |
| P5 | Rebalance density near → far | 1 h | −100–200k | medium | pays for P1 |
| P4 | Warp the hash lattice | 45 min | 0 | medium-high | "visible clumps" |
| P3 | Terrain sward detail in the fragment stage | 2 h | 0 | medium-high | the 45 m+ handoff |
| P6 | Shadow proxy (Option B) | 2 h | 0 | medium | grass and ground agreeing in shade |
| P7b | Pack instance attributes to 11 B | 2 h | 0 | high | phones |
| P7a | Path-adaptive tiles | 3 h | +, but frame time − | medium | only if §7.1 confirms |

P0 + P2 alone are under three hours and address both halves of the founder's complaint. Ship those first and re-shoot before touching anything else.

---

## 7. How to know it worked — falsifiable tests

A check that cannot fail is not a check. Each of these has a stated pass line and a stated way to fail.

**7.1 — Is the scene draw-call bound?** Re-run the seven-beat harness twice on the same machine and the same GPU path: once as shipped, once with `G_HERO.tile` and `G_FILL.tile` doubled (draws fall ≈ 4×, submitted triangles rise). If frame time falls despite more triangles, the hypothesis holds and P7a is worth three hours. If frame time rises, it does not, and P7a is dropped. **Also record `gl.getParameter(gl.RENDERER)` in the metrics JSON** — the 62–104 ms band in `round3-clean.json` is not a real-GPU number and must not be compared against a run that is.

**7.2 — Is the near field over-provisioned?** Render beats 2, 3, 4 and 6 at the shipped carpet budget and at half of it. Compute the mean absolute per-pixel luminance difference over the lower third of the frame only. **Pass line: < 2%.** If it is under 2%, half those blades were never visible and P5 is safe. If it is over 5%, P5 is wrong and the density stays; say so and pay for P1 by cutting the far scatter instead.

**7.3 — Did the 24–45 m band close?** Add a debug uniform that tints fragments by `C` computed per-fragment (`n·w·h/tanθ` is not available per-fragment; use the surviving keep-fraction × planted density as a stand-in) and screenshot beats 1 and 2. **Pass line: no region of the framed meadow reads below C = 2.** Alternatively, and more simply: sample the mean luminance of a 100 × 100 px patch centred on ground 30 m out, and compare it to the same patch at 18 m. **Pass line: within 12%.** Before the change the derived gap is ~60%.

**7.4 — Temporal stability.** Capture 60 frames while scrolling through beat 1 → 2 and compute mean frame-to-frame absolute difference over the meadow region. It must not increase versus the current build. Width compensation, aggregation and the AO clamp should reduce it; if it rises, `comp` is uncapped somewhere or the gate is letting sub-pixel blades through.

**7.5 — The founder's test.** Show him beats 2 and 4 side by side, before and after, with no explanation. If he still says "patchy," the remaining candidate is P3 (the 0.85 m flat-shaded terrain lattice) and it is the next thing to build.

---

## 8. Licences of everything studied

| Source | Licence / status | Used how |
|---|---|---|
| [Outerra procedural grass](https://outerra.blogspot.com/2012/05/procedural-grass-rendering.html) | blog post, no code taken | the 1/p width law (P1c), canopy-paints-the-distance (P3) |
| Ghost of Tsushima, GDC 2021 (via [Abrodi](https://tigerabrodi.blog/grass-in-ghost-of-tsushima), [summary](https://gist.ly/youtube-summarizer/procedural-grass-systems-in-ghost-of-tsushima-achieving-art-direction), [GDC Vault](https://gdcvault.com/play/1027033/Advanced-Graphics-Summit-Procedural-Grass)) | talk, no code taken | clump normals with distance (P2), Voronoi clumping (P4), drop-3-of-4 LOD |
| [Codrops "Fluffiest Grass"](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/) | tutorial, already credited in `docs/CREDITS.md` | terrain-matches-grass, dark base as fake AO — already in the build |
| [Gjoreski "Growing my Grass Shader"](https://aleksandargjoreski.dev/blog/growing-my-grass-shader/) | blog, already credited | stochastic thinning doctrine, AO clamp by distance |
| [2Retr0/GodotGrass](https://github.com/2Retr0/GodotGrass) | no repo licence stated; third-party assets CC BY 4.0 / CC0 | **read only** — techniques described, nothing copied. Do not lift code. |
| [CK42BB/procedural-grass-threejs](https://github.com/CK42BB/procedural-grass-threejs) | **MIT** | safe to borrow from if needed. Its published targets: mobile 50–100k blades, desktop 200–500k, WebGPU 500k–2M. Ours already exceeds the desktop band — another sign the count is not the problem. |
| [spacejack/terra](https://github.com/spacejack/terra) | **CC BY-NC 4.0** | **non-commercial — do not use.** Aura Homes is a commercial product. |
| [Nitash-Biswas/grass-shader-glsl](https://github.com/Nitash-Biswas/grass-shader-glsl) | check before use | not needed |
| UE 5 Nanite Foliage ([docs](https://dev.epicgames.com/documentation/unreal-engine/nanite-foliage)) | reference only | the aggregate principle behind P2's colour convergence |
| [bgolus, alpha-to-coverage](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f) | article | why we are staying opaque |

Add the Outerra width law and the Ghost of Tsushima clump-normal technique to `docs/CREDITS.md` when P1 and P2 land.

---

## 9. Known limitations of this spec

Published plainly, per `docs/BRAND.md` §5.

- **Every density and coverage figure in §1.2 and §1.3 is derived**, not measured. They come from integrating the shipped mask functions analytically and from the blade constants in `SceneDetail.tsx`. They are good to roughly ±30%, which is enough to tell "C = 0.45" from "C = 5.7" but not enough to fine-tune a falloff curve. Measure before tuning.
- **The draw-call finding rests on one harness run** whose absolute frame times indicate a degraded GL path. §7.1 exists because of that.
- **P6 Option B will not match PCSS.** It buys agreement between grass and ground, not correctness. If the difference is visible at beat 4, Option A is the real fix and it is a day of work.
- **The founder may reject P5 on sight.** He has asked for more grass four times. The test in §7.2 exists so the answer is a number rather than an argument, and if the number disagrees with this spec, the spec is what changes.
- **P3 changes a shared material.** `Terrain()`'s material is also the receiver for PCSS shadows; `onBeforeCompile` on a `MeshStandardMaterial` preserves that, hand-rolling a `ShaderMaterial` does not. Do not hand-roll it.
- **No screenshots were taken for this spec.** The captures in `C:\tmp\aura-shots\shots\before\` are from a failed Aug 9 run and render black. Every claim here is from source reading, the metrics JSON, and the cited research — not from looking at the current build. A verification pass with fresh shots should precede implementation.

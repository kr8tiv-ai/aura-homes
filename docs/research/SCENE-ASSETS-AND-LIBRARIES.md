# Scene assets & open-source libraries — what we use, what we recommend, and the licences

*Written for the Aura Homes landing scene, August 2026. Two audiences: whoever extends this scene next, and whoever ports the technique to another KR8TIV build (the 2240 Speed Shop car scenes are the immediate case).*

---

## 0. The rule that governs this file

**Nothing enters `app/public/models/` without a row in [CREDITS.md](../CREDITS.md)** carrying title, author, licence and source URL. That has been true since the first GLB and it stays true.

A second rule was added with the elevation pass:

> **Prefer procedural over downloaded, when procedural is honestly as good.**

Not for purity — for three concrete reasons. A procedural prop costs bytes of JavaScript instead of hundreds of kilobytes of mesh and texture over the wire, on a page whose payload is a brand rule. It carries no licence obligation to track or get wrong. And it flexes: the moose can be re-proportioned, the mountains re-seeded, the grass re-tinted, without going back to a source that may have moved or changed terms.

The elevation pass therefore added **zero new downloaded assets.** Everything in `SceneDetail.tsx` — mountains, clouds, grass, steps, hammock, netting, moose, bollards, steam — is generated in code from Three.js primitives, `BufferGeometry`, and canvas-drawn textures. The six credited GLBs from the original build are untouched and still credited.

---

## 1. What the scene actually uses today

### Downloaded assets (unchanged, all credited)

Six GLBs, all from [Poly Pizza](https://poly.pizza/), each with its row in [CREDITS.md](../CREDITS.md): `cabin.glb`, `pines.glb`, `pine-teal.glb`, `campfire.glb`, `rocks.glb`, `lantern.glb`. Authors: Poly by Google (CC-BY 3.0), Quaternius (CC0 1.0), Danni Bittman (CC-BY 3.0), Kay Lousberg (CC0 1.0).

### Audio

`app/public/audio/forest-ambience.mp3` — forest ambience loop, carried over from Matt's own **Evolve Apparel** site (`evolveapparel.shop`, the `evolve-lifestyle` repo), where the same play-button pattern originated. Owned by the founder; reused across his own properties. Loads only on demand (`preload="none"`), so the 6.5 MB is never paid by a visitor who doesn't ask for it.

### Libraries (all MIT unless noted)

| Library | Licence | What it does here |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | MIT | The renderer. Everything below is a client of it. |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) | MIT | React reconciler for three — the scene graph *is* the component tree |
| [@react-three/drei](https://github.com/pmndrs/drei) | MIT | `useGLTF`, `Environment`, `Lightformer`, `Sparkles`, `Html` |
| [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) | MIT | Bloom, Vignette, Noise |
| [postprocessing](https://github.com/pmndrs/postprocessing) | Zlib | The effect implementations underneath |

### Techniques borrowed (credit owed even where no code was copied)

| Source | Licence | What we took |
|---|---|---|
| [MengTo — *kage*](https://mengto.github.io/kage/) | credited by request | The scroll-driven camera-journey concept. Credited in the site footer and in CREDITS.md. Our spline, geometry, materials and copy are our own. |
| [three.js examples](https://threejs.org/examples/) | MIT | The instanced-grass-with-vertex-wind pattern, and the `onBeforeCompile` approach to injecting wind into a stock material without forking it |
| Aerial-perspective ridge painting (traditional matte-painting practice) | n/a | Three ridge bands, each paler and lower-contrast, dissolving into the fog colour |

---

## 2. Recommended sources — researched, with licences

This is the shortlist worth using. Each entry says what it is genuinely good for, because "free 3D assets" sites vary enormously in whether the meshes are actually shippable to the web.

### Models

| Source | Licence | Verdict |
|---|---|---|
| **[Quaternius](https://quaternius.com/)** | **CC0 1.0** | The best free low-poly nature and vehicle packs on the internet for this style. Consistent scale within a pack, clean topology, no attribution required (credit anyway). Already the source of our pines and rocks. **First stop.** |
| **[Kenney](https://kenney.nl/assets)** | **CC0 1.0** | Enormous, consistent, genuinely CC0. Strong for props, kits, and UI. Style is chunkier than Quaternius. |
| **[Poly Pizza](https://poly.pizza/)** | mixed **CC0 / CC-BY 3.0** | The Google Poly archive plus community uploads. **Licence varies per model — check each one**, which is exactly why our CREDITS table records it per file. |
| **[Sketchfab, CC0 filter](https://sketchfab.com/search?licenses=cc0&type=models)** | **CC0 1.0** | Huge range including photogrammetry. Quality varies wildly; expect to spend real time on retopology and texture budgets. Always confirm the licence on the model page itself, not from a search listing. |
| **[Poly Haven — Models](https://polyhaven.com/models)** | **CC0 1.0** | Small catalogue, but every asset is production-grade PBR with sane UVs. Genuinely CC0 with no attribution requirement. |

### HDRIs, textures, materials

| Source | Licence | Verdict |
|---|---|---|
| **[Poly Haven — HDRIs](https://polyhaven.com/hdris)** | **CC0 1.0** | The reference source for image-based lighting. *We deliberately do not use one here* — a baked `<Environment resolution={64} frames={1}>` with two Lightformers costs nothing and a 2K HDRI is megabytes. For a car scene where paint and chrome are almost entirely environment reflection, an HDRI earns its bytes; for a stylised meadow it does not. |
| **[Poly Haven — Textures](https://polyhaven.com/textures)** | **CC0 1.0** | PBR sets with proper roughness/normal/displacement maps |
| **[ambientCG](https://ambientcg.com/)** | **CC0 1.0** | Very large PBR material library, reliable licensing |

### Water, sky, weather, vegetation — technique sources

| Source | Licence | Verdict |
|---|---|---|
| **three.js `Water` / `Water2` examples** | MIT | The standard reflective/refractive water. Correct choice for a lake; overkill for a 2 m hot tub, where an emissive standard material plus sprite steam reads better and costs nothing. |
| **three.js `Sky` (Preetham)** | MIT | Physically-derived sky dome with sun position. Worth adopting if the day/night toggle ever needs true dawn/dusk gradients rather than our fog-colour lerp. |
| **[drei `<Cloud>` / `<Clouds>`](https://github.com/pmndrs/drei)** | MIT | Billboard volumetric clouds. Good, but heavier than our gradient sprites; consider if clouds ever need to be flown through rather than looked at. |
| **[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)** | MIT | Fast raycasting against complex meshes. **Not needed here** — our cursor raycast hits a mathematical `THREE.Plane`, which is a handful of FLOPs. Adopt only if the cursor must hit real terrain. |
| **[Simon Dev's grass work](https://github.com/simondevyoutube)** | MIT | The clearest public explanation of instanced grass with GPU wind. Our blade is simpler (one triangle) but the shape of the solution is his. |

### Audio

| Source | Licence | Verdict |
|---|---|---|
| **[Freesound](https://freesound.org/)** | per-file: CC0 / CC-BY / CC-BY-NC | Best library for nature ambience. **Per-file licences differ and NC variants exist** — check each, and avoid NC for anything commercial. |
| **[Pixabay Audio](https://pixabay.com/sound-effects/)** | Pixabay Content Licence | Broad and free for commercial use; the licence is *not* CC0, so read it before shipping. |

---

## 3. What we deliberately did NOT do, and why

Being explicit about rejected options is worth more than a longer list of adopted ones.

- **No HDRI environment map.** A 2K HDRI is 3–8 MB and would have dwarfed the entire rest of the payload. The baked 64px `<Environment frames={1}>` gives believable glass and metal reflections for effectively zero bytes and zero per-frame cost after the first frame.
- **No downloaded grass/tree/animal meshes.** A single good grass pack is 2–10 MB with textures. Instanced procedural blades cost a few KB of JS and gave us GPU wind and cursor interaction for free, because we own the shader.
- **No `three-mesh-bvh`.** The cursor only needs the ground plane. Adding a BVH would be a dependency and a build cost for a problem we don't have.
- **No physically-based water sim on the tub.** `Water2` reflections on a 2 m circle, behind steam, at the distance the camera actually passes, would be invisible and expensive.
- **No generated (AI text-to-3D) assets.** Evaluated as part of the WorldClaw research — see [WORLDCLAW.md](WORLDCLAW.md). Verdict was skip: no code, no weights, no LICENSE. That verdict stands.

---

## 4. Performance budget, and how the elevation pass respected it

The landing route's first-load JS went from **4.29 kB → 5.8 kB** of route-specific code (shared chunks unchanged at 87.6 kB). Total static export: **~3.0 MB across 71 files**, unchanged in shape — the only new network asset is the audio, and it is `preload="none"`.

The rules that kept it there:

1. **One InstancedMesh for 2,400 blades of grass**, one triangle each — 2,400 triangles and one draw call. Wind and cursor-push live in the vertex shader, so the CPU cost per frame is **one uniform write and one ray-plane intersection**.
2. **Mountains are three ridge bands**, `meshBasicMaterial`, no shadows, no lighting. They are backdrop, and backdrop should never be lit.
3. **Sprites, not volumes,** for clouds and steam — canvas-drawn gradients generated at runtime, so nothing is downloaded.
4. **One real point light** was added for the whole night mode (the pool over the steps). Every other "light" is emissive geometry, which costs nothing per fragment beyond its own pixels.
5. **`frozen` is honoured everywhere.** Under `prefers-reduced-motion` the grass wind, clouds, steam, hammock swing and wildlife all stop, exactly like the existing smoke and mist already did.
6. **Nothing new casts shadows** except the steps, hammock posts and moose — the shadow camera is a fixed ±30 box and every extra caster inside it costs map resolution the home needs more.

---

## 5. Porting this to the 2240 Speed Shop car scenes

The differences that matter, so nobody copies the wrong half:

- **An HDRI is worth it there.** Car paint and chrome are almost entirely environment reflection; the Lightformer trick that flatters a matte meadow will look cheap on a fender. Take a Poly Haven CC0 studio or garage HDRI.
- **Meshes are downloaded, not procedural.** Cars cannot be made from boxes. That flips the whole balance: the Blender refine + meshopt + KTX2 pipeline in the [3D playbook](../../../outputs/3D-MODELING-BLENDER-MCP-PLAYBOOK.md) becomes the main event, and everything in §2 above about per-file licence checking becomes load-bearing.
- **The grass shader ports directly** if any of the scenes go outdoors, and so do the mountains, clouds and day/night arc.
- **The flicker fix ports directly and should be applied pre-emptively:** any scene with more than one transparent surface needs split materials, explicit `renderOrder` bands, and real air between coplanar faces. See §6.

---

## 6. The glass-flicker fix, written down so it isn't re-learned

The walkway to the hot tub strobed when the camera approached it. Two independent bugs, stacked:

1. **Transparent sort thrash.** One shared material with `depthWrite: false` put every glass surface — walkway deck, its rails, the deck panel, the deck rails — in three's transparent bucket, re-sorted by centroid distance every frame. Walking the bridge swept the camera through the point where those centroids swap, so the draw order flipped back and forth and the panels visibly popped.
2. **Z-fighting.** The walkway glass spanned y `0.385–0.455` and its steel frame `0.335–0.385` — coplanar to the micron. The deck panel (`0.40–0.48`) and its frame (`0.35–0.41`) actually interpenetrated.

The fix, in three parts:

- **Split the material by role.** Structural glass you walk on (`useGlassFloor`) writes depth and is slightly more opaque; balustrade glass (`useGlassRail`) does not write depth, because it genuinely must layer.
- **Pin the order.** `renderOrder` bands — floors at 10, rails at 20 — so resolution order is deterministic instead of camera-dependent.
- **Give coplanar surfaces air.** Frames were dropped so there is real separation, and the floor glass carries `polygonOffset` as a belt-and-braces measure.

The general lesson: **`depthWrite: false` is a statement that an object must layer, not a default for anything transparent.** Apply it to thin see-through things; deny it to anything that reads as solid.

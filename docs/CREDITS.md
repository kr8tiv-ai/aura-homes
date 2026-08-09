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

Two techniques are owed credit even though no code was copied:

- **Instanced grass with vertex-shader wind** — the general approach is the
  one demonstrated in the [three.js examples](https://threejs.org/examples/)
  (MIT) and explained most clearly in
  [Simon Dev's](https://github.com/simondevyoutube) public work (MIT). Our
  blade is a single triangle and the wind and cursor-push are injected into
  a stock `MeshLambertMaterial` via `onBeforeCompile`.
- **Aerial-perspective mountains** — three ridge bands, each paler and
  lower-contrast, dissolving into the fog colour. Traditional matte-painting
  practice rather than any one source.

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

# WorldClaw — can it build our 3D world, and is it free?

*Research pass, August 9, 2026. Question from the founder: can Tencent's Hunyuan3D "WorldClaw" generate the 3D world for our website, and is it free? Short answer: not yet, and unknowable — there is no code, no weights, and no license to be free under. Full findings below.*

---

## What it is

**WorldClaw** (Tencent Hunyuan3D research, paper submitted to arXiv August 5, 2026 — [2608.05248](https://arxiv.org/abs/2608.05248)) is an **agentic framework**, not a single model: a team of planning agents that turns one open-ended text prompt into a large, explorable, editable 3D world in three coarse-to-fine stages.

1. **Intent analysis and planning** — LLM agents translate the prompt into a structured scene specification: regions, terrain constraints, object constraints.
2. **Global terrain generation** — a semantic layout map, reusable asset prototypes, and surface materials are composed into a region-aware height field; materials are authored as **executable Blender node graphs and shader scripts**.
3. **Regional object generation and placement** — selected regions are rendered, turned into terrain-conditioned composition images, segmented into instances, reconstructed as **independent textured meshes**, and placed with terrain-aligned transforms. Render-guided agents then iteratively fix pose, scale, mesh quality, and object–terrain contact.

The important architectural fact: WorldClaw is an **orchestration layer over other people's models**. Per the paper it drives Claude Opus 4.8 (agent reasoning), GPT-Image-2 (image generation), SAM3D (segmentation/reconstruction), and Hunyuan3D (3D asset generation), and executes everything inside **Blender 5.1.1**. It is, ironically, the same shape as Aura Homes — an agent graph coordinating specialized tools — pointed at world-building instead of home-building.

It is a different project from **HunyuanWorld-1.0** (the panorama-based world model, released with code and weights in 2025). WorldClaw's output is explicit geometry, not panoramas and not gaussian splats.

## Outputs and pipeline fit

**What a WorldClaw run produces:** a composed Blender scene — explicit terrain plus a set of independently editable textured mesh instances, each with its own placement transform. The project page demos render four channels per world (RGB, instance masks, surface normals, metric depth), and the paper claims direct hand-off to "rendering, animation-authoring, and game-engine workflows."

**Could that feed our Three.js / R3F landing scene?** Technically, yes, and cleanly:

- The scene lives in Blender, and Blender exports **GLB/glTF natively** — the exact format our landing page already loads (`useGLTF` in R3F). No exotic conversion path.
- Instance-level meshes mean we could cherry-pick objects (a cabin, conifers, a terrain tile) rather than shipping a whole world.
- The honest engineering caveats: generated worlds are large-scale by design, so meshes would need decimation, Draco compression, and KTX2 texture compression to hit web budgets, and generated topology/UVs are typically messier than authored assets. Budget real cleanup time per asset.

So the *format* fit is good. The *access* fit is the problem, next section.

## License verdict

**There is nothing to license.** As of August 9, 2026:

- **No code release.** The paper contains no code, repo, or release statement. The GitHub repository [`Tencent-Hunyuan/Hunyuan3D-WorldClaw`](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw) exists but contains only the Vue/Vite source of the project page itself — no framework code, no weights, and **no LICENSE file at all** (23 stars, 0 forks at time of writing).
- **No weights.** Nothing on Hugging Face; the [paper page](https://huggingface.co/papers/2608.05248) links no models, spaces, or datasets.
- **No stated license for outputs.** You cannot clear generated assets under a license that does not exist.
- Even the page's demo media carries no stated reuse terms — treat the videos and renders as **all rights reserved, Tencent**, and do not redistribute them in this repo.

**If it does release, expect a Tencent community license, not open source.** The family pattern is consistent: [Hunyuan3D-2.0](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE) and [Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE) ship under the custom **"Tencent Hunyuan 3D 2.0 Community License"**, and HunyuanWorld-1.0 under **"tencent-hunyuanworld-1.0-community"**. Key recurring terms, verified against the Hunyuan3D-2 license text:

- **Territory exclusion:** the license grant explicitly excludes the **European Union, United Kingdom, and South Korea**. For an MIT open-source repo with global users, that is a structural conflict, not a footnote.
- **Scale cap:** rights terminate if a product built on it exceeds ~100M monthly active users without a separately negotiated license (irrelevant at our scale, but it is a use-based restriction — the definition of not-open-source).
- **Acceptable-use policy** that travels with the model and, in some Hunyuan licenses, with derivatives.
- These licenses generally do **not claim ownership of outputs** — but they bind *how* the model may be used to produce them, and the territory exclusion arguably taints an "anyone, anywhere may use this repo" promise if generated assets are baked in.

**Can generated assets ship in our MIT repo today? No — precisely: the question is unanswerable until a license exists,** and the family precedent says the answer will be "with restrictions that sit awkwardly inside MIT." Anything we committed now would be assets generated by a system we have no grant to run, which is not a position this repo takes on anything.

**Is it free to *run*?** Also no, even in the best case: the pipeline consumes paid frontier APIs (Claude Opus 4.8, GPT-Image-2) plus heavy reconstruction compute, and the paper itself lists multi-stage computational overhead as a limitation. A "free" code release would still carry real per-world inference cost.

## Practical verdict for Aura Homes

**Skip for the hackathon. Watch for release. Re-evaluate only if three gates all open.**

- **Use now: no.** There is nothing to download, no license to comply with, and a 12-day hackathon window. Our landing already ships with **CC0 GLB assets** — zero legal surface, zero cost, already integrated. That is the correct call and it stands.
- **Use later: maybe, honestly maybe.** A generated Alberta-parcel world — terrain, conifers, a SIP cabin, editable per-instance — would be a genuinely strong post-hackathon upgrade for the DESIGN stage's 3D story. Gates, in order: (1) Tencent actually releases code/weights; (2) the license permits redistribution of generated assets inside an MIT repo for a commercial-adjacent product outside the territory exclusions — read it, do not assume it; (3) the per-world API + compute cost fits a $0-budget product. Gate 2 is the one the family precedent says will bite.
- **The nearer-term cousin is more useful anyway.** For single assets (a home model, a hot tub, a stove), **Hunyuan3D-2.1 is already released** with weights — but under the same community-license pattern, so the same license reading is required before any generated asset touches this repo. Same gates, smaller blast radius.
- **What we take from WorldClaw today costs nothing and is already ours to take:** the validation. A frontier lab shipped "agents orchestrating specialized tools through typed intermediate representations, with render-inspect-refine loops" as the architecture for hard 3D generation. That is this repo's graph doctrine, independently converged on. (Its page design is separately credited as a presentation reference in [BRAND.md](../BRAND.md).)

**One-line answer for the founder:** beautiful research, real architecture kinship, nothing shippable — no code, no weights, no license exists yet, so "is it free" has no answer; our CC0 GLBs stay, and we re-read this the day Tencent ships a repo with a LICENSE file in it.

## Sources

- Project page: [tencent-hunyuan.github.io/Hunyuan3D-WorldClaw](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/) (JS-rendered; read live August 9, 2026)
- Paper: [arXiv 2608.05248 — WorldClaw: Agentic 3D Open-World Generation at Scale](https://arxiv.org/abs/2608.05248) · [HTML version](https://arxiv.org/html/2608.05248) (dependencies: Claude Opus 4.8, GPT-Image-2, SAM3D, Hunyuan3D, Blender 5.1.1; limitations incl. compute overhead)
- Hugging Face paper page (no linked models/code): [huggingface.co/papers/2608.05248](https://huggingface.co/papers/2608.05248)
- Page-source repo, no LICENSE: [github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw)
- License family precedent: [Hunyuan3D-2 LICENSE](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE) · [Hunyuan3D-2.1 LICENSE](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE) · [HunyuanWorld-1.0](https://github.com/Tencent-Hunyuan/HunyuanWorld-1.0) ([HF model card](https://huggingface.co/tencent/HunyuanWorld-1), license tag `tencent-hunyuanworld-1.0-community`)

*Verification note: "no code, no weights, no license" was checked three ways (paper text, GitHub org, Hugging Face) on August 9, 2026. This verdict has a shelf life — recheck the GitHub org before repeating it.*

# Step 8 visual system design

## Decision

Refine the existing paper/ink/emerald brand and the authored Three.js world rather than replacing either. The release keeps the story's single-camera scroll, procedural landscape, WebGL fallback, and the builder's demand render loop.

## Customer journey

The persistent header carries five forward actions: design a home, find land, build a team, buy a home, and ask Aura. Overview, questionnaire, budget, escrow, FAQ, and dashboard move into one utility menu. Mobile receives the same information architecture in a full-height sheet.

## Builder composition

`/build` opens with one concise design-intent statement, the persistent model/plan control, and the canvas. Detailed project-integrity copy is available in a disclosure. Export and purchase limitations remain beside their actions.

## Scene quality

Scene quality is deterministic from viewport size, reduced-motion preference, memory, and CPU hints:

- `still`: demand-rendered, composed grass, no post-processing, no PCSS;
- `balanced`: capped DPR, reduced procedural grass, one-pass environment, no post-processing;
- `full`: full authored meadow, PCSS, higher shadow/environment budgets, restrained bloom/vignette/noise.

Unknown capability hints choose balanced. Software WebGL renderers downgrade immediately. A full scene also samples delivered visible-tab frames after warm-up and permanently downgrades when it cannot sustain 42 fps. Reduced motion never becomes an empty world.

## Materials and light

The story and builder share one Nordic material vocabulary for cedar, ash, standing-seam steel, lime render, stone, black aluminium, imperfect glazing, wool, water, soil, and vegetation. Profiles distinguish visual finish from structural or quote data. The story keeps its authored, route-lazy procedural grain/mottle/ripple maps. The builder adds physical glass/water depth, a one-frame environment, contact grounding, and atmospheric distance while preserving demand rendering. Builder texture maps remain held until Box and Extrude UVs have one physical scale; stretching a map would be polish at the cost of truth.

## Verification contract

- deterministic tests for tier selection and one-way downgrade;
- desktop and mobile navigation tests;
- canvas-first builder test;
- mobile scene-tier and overflow test;
- TypeScript, complete deterministic suite, complete browser suite, static Pages build, visual inspection, then production smoke tests.

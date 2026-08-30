# IP04 Deterministic Intent-to-Project Compiler Plan

> **For the implementing agent:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development`; do not cross the committed ExecutionNode write set.

**Goal:** Compile one strict `DesignIntent` into a deterministic, editable graph-backed `BuilderDocument` proposal whose document and proposal hashes repeat exactly, without accepting model-authored coordinates or touching persistence, providers, money, UI, or frozen 3D/design code.

**Authority:** Founder-approved Aura Full-System Operating Graph v2.0 (`f7616886f9f8a171c847ef5eb49e932246ff989b`, approval `e031a83b8d9dcd428ffaab46d83b39370f2962a0`) and independently verified IP03 (`0fd80cf62f49b1364f261fac4ce9c05579583b4c`). The graph's activation sequence places local IP04/IP05 before hosted OR01/OR02; OR03 can later feed the same compiler but is not an IP04 activation dependency.

**Architecture:** Add `app/lib/ai/designIntentCompiler.ts` as a pure compiler. It reparses unknown input through `parseDesignIntent`, derives a rectangular editable footprint from bounded area rules, creates graph/storey/partition/opening/roof state only through existing builder factories, embeds that graph into a validated `BuilderDocument`, and returns a detached deeply frozen proposal with canonical intent, document, and proposal hashes. Fixed, versioned rules map program, climate, material, siting, roof, storeys, rooms, and openings; any default or approximation is emitted as a structured decision. Unsupported or impossible requests return bounded compiler refusals rather than being silently clamped or repaired.

**Scope boundary:** IP04 does not call a model, choose a provider, persist a project, create timestamps or IDs from clock/random state, calculate cost or fees, validate release readiness, render a preview, commit an edit, or alter any public UI/3D path. IP05 owns broader constraints and refusal presentation; IP06 owns preview/commit; IP07 owns durable project provenance.

---

## Task 1: Commit the plan and ready execution boundary

Create and commit this plan, then create `docs/plans/execution/v2/IP04-intent-to-project-compiler.json` with dependency `IP03:verified`, no external gates or side effects, one bounded repair, and exactly these five paths:

1. `docs/plans/2026-08-29-ip04-intent-to-project-compiler-plan.md`
2. `docs/plans/execution/v2/IP04-intent-to-project-compiler.json`
3. `app/lib/ai/designIntentCompiler.ts`
4. `app/tests-ip04/design-intent-compiler.contract.ts`
5. `app/playwright.ip04.config.ts`

Run Graph v2 authority/position checks, confirm a clean worktree, verified IP03, zero live ownership overlap, zero protected paths, and no external gate. Commit the ready manifest, then reconcile and commit it `active` before behavior work.

## Task 2: Specify the compiler test-first

Write the dedicated Playwright contract before the implementation exists and prove RED. Cover:

1. Unknown input is promoted only through `parseDesignIntent`; unknown keys, geometry, accessors, custom prototypes, and revoked proxies fail closed.
2. The same valid intent and compiler version produce byte-identical canonical hashes and detached deeply frozen proposals.
3. Target footprint, bounded range midpoint, and the disclosed default each derive deterministic half-foot rectangular dimensions without reading model coordinates.
4. One- and two-storey requests use existing graph factories; split-level and more than two storeys are visibly refused.
5. Requested room counts become named derived room faces; minimum areas are respected or the program is refused rather than squeezed.
6. Supported gable, hipped, shed, and flat roofs use the graph roof factory; A-frame is refused until the graph owns that topology; unknown roof uses a disclosed gable rule.
7. Explicit or rule-derived door/window counts are represented exactly, honor orientation priority ordering, and fail if the shell cannot hold them.
8. Material, climate, and siting mappings are deterministic and every fallback/approximation is named.
9. The returned `BuilderDocument` passes `validateBuilderDocument`; its document hash is `hashBuilderDocument`'s own value.
10. The proposal hash binds compiler version, intent hash, document hash, decisions, unresolved questions, and source fingerprints.
11. Caller input, factory intermediates, and returned objects do not remain mutable aliases.
12. The module contains no provider SDK/name, network, storage, clock, randomness, wallet, payment, fee, project persistence, React, 3D, renderer, scene, animation, camera, light, shader, model, or texture dependency.

## Task 3: Implement the smallest pure compiler

Expose:

- `DESIGN_INTENT_COMPILER_VERSION`;
- bounded compiler error codes and a discriminated `DesignIntentCompilationResult`;
- structured `DesignIntentCompilerDecision` records;
- `CompiledDesignIntentProject` with `intentHash`, `document`, `documentHash`, `sourceFingerprints`, decisions, unresolved questions, and `projectHash`;
- `compileDesignIntentToProject(value: unknown)`.

Use only deterministic arithmetic and ordinary data. Quantize dimensions to half feet. Create up to two storeys. Partition each storey into deterministic stripes using `splitWallAt`, `addPartitionEdge`, and `renameGraphRoom`; allocate stated minimum room areas before distributing remaining area. Add openings through `addGraphOpening`, roofs through `setGraphRoofForm`, and storeys through `duplicateGraphStorey`. Create the surrounding document from `builderDocumentFromLegacySpec`, replace only its geometry with the validated graph proposal, then pass the whole result through `validateBuilderDocument` and `hashBuilderDocument`.

Do not silently drop requested rooms, openings, storeys, roof intent, minimum areas, or orientation priorities. If an existing factory refuses a candidate, return a bounded compiler refusal with no partial output.

## Task 4: Verify, commit, and close

Run:

```powershell
npx playwright test --config=playwright.ip04.config.ts
npm run typecheck
npm test
npm run test:graph-v2
npm run test:graph-position
git diff --check
```

Commit the implementation candidate, then invoke exact G05 preflight from the node base to that candidate. The diff must be exactly the declared five paths with zero protected/frozen paths. Record immutable gate receipts and close the manifest as `verification-pending` in a manifest-only commit. A fresh-context verifier must independently pass every declared gate before IP05 can activate.

## Stop conditions

- IP03 loses verified status or another live node claims an IP04 path.
- OR03, a provider, network, secret, budget, payment, persistence, UI, public design, or frozen 3D path enters the node.
- Model-authored coordinates or unparsed intent become geometry.
- A default, approximation, dropped request, or factory refusal is hidden.
- Output is nondeterministic, mutable/aliased, invalid, or carries a hash not produced from canonical validated data.
- A second repair loop would be required.

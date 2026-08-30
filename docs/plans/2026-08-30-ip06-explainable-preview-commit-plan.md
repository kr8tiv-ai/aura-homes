# IP06 Explainable Preview and Explicit Commit — Implementation Plan

**Date:** 2026-08-30
**Graph:** `aura-graph/v2.0@680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8`
**Node:** IP06
**Depends:** independently verified IP05
**Side effects in this node:** none

## Outcome

Create one pure, provider-neutral contract that turns an IP05-valid image-to-plan proposal into an explainable, immutable preview and then—only after an exact deliberate confirmation—returns one inert editor load action representing one undoable project change. Cancelling returns a zero-write receipt and no applyable document.

IP06 does not render the preview, dispatch the action, persist a project, call a provider, calculate or charge money, retain an image, or touch the existing website design or frozen 3D/rendering/animation system. UX06 will later place this contract into the Guided Studio. IP07 will later own persistence, provenance, and recovery.

## Dependency interpretation

- IP05 is independently verified and is the only authority that may promote an IP04 proposal to `concept-preview-valid`.
- IP06 must re-run IP05 validation from the full proposal input; it cannot trust a caller-supplied success flag, receipt, project hash, or preview.
- Existing `BuilderDocument` hashing and validation remain canonical. IP06 does not invent another geometry or document model.
- Existing editor history already treats one `{ type: "load", doc, label }` action as one undo step. IP06 returns that inert action but never imports React, the editor component, reducer, or dispatcher.
- OR02 is disjoint hosted-execution work and is not an IP06 dependency.

## Contract

`app/lib/ai/designIntentPreviewCommit.ts` will expose three pure functions.

### Prepare

`prepareDesignIntentPreview(input)` will:

1. Accept exactly `validationInput`, `beforeDocument`, and provider-neutral `costEvidence` as bounded plain data.
2. Snapshot without invoking accessors or hostile prototypes, reject aliases/cycles/sparse arrays/unknown keys/unsafe numbers, and never mutate the caller.
3. Re-run `validateDesignIntentProject` and refuse unless IP05 returns a complete valid proposal.
4. Require the current document to be an exact canonical, unmigrated `BuilderDocument` and hash it through the existing document owner.
5. Refuse a proposal whose canonical document hash equals the current document hash, because a no-op cannot truthfully become an undo step.
6. Require safe-integer USD-micro cost evidence with separate provider cost, Aura fee, exact total, declared evidence basis, and opaque evidence identifier. IP06 verifies arithmetic but neither calculates a fee nor authorizes payment.
7. Return one detached, deeply frozen preview containing:
   - the full strict extracted `DesignIntent`;
   - assumptions, confidence, and unresolved questions already owned by that intent;
   - the IP05 validation status, checks, concept-only notice, and largest derived clear span;
   - current/candidate document hashes and candidate project hash;
   - the exact changed top-level `BuilderDocument` sections;
   - provider cost, Aura fee, total cost, currency, basis, and evidence identifier;
   - an exact confirmation sentence and a deterministic preview identifier bound to all of the above.
8. Exclude the applyable candidate document, editor action, raw image bytes, prompts, provider bodies, credentials, and hidden persistence instructions from the preview.

### Commit

`commitDesignIntentPreview(input, confirmation)` will:

1. Recompute the complete preview from the original input at commit time.
2. Require an exact plain confirmation containing that preview identifier, current-document hash, and exact confirmation sentence.
3. Refuse stale, partial, forged, mismatched, or extra confirmation data.
4. Return one detached, deeply frozen commit receipt containing exactly one inert editor action:
   `{ type: "load", doc: validatedCandidateDocument, label: "image-plan:accept" }`.
5. Record `undoSteps: 1` and the exact prior document hash. It does not dispatch the action, touch editor state, or claim persistence.

### Cancel

`cancelDesignIntentPreview(preview)` will accept only the strict public preview shape and return one detached, deeply frozen receipt with `cancelled: true`, `writes: 0`, and no document/action/project mutation surface. Cancellation does not require or invoke validation, a provider, storage, or an editor.

## Exact write set

1. `docs/plans/2026-08-30-ip06-explainable-preview-commit-plan.md`
2. `docs/plans/execution/v2/IP06-explainable-preview-commit.json`
3. `app/lib/ai/designIntentPreviewCommit.ts`
4. `app/tests-ip06/design-intent-preview-commit.contract.ts`
5. `app/playwright.ip06.config.ts`

No component, route, stylesheet, public-site file, project store, provider wrapper, payment surface, or frozen 3D/rendering/animation path is in scope.

## Test-first proof

The dedicated IP06 contract will fail first because the module does not exist, then prove:

- a valid IP05 proposal produces the complete explainable preview with exact intent, assumptions, unresolved fields, validation checks, cost facts, hashes, and changed document sections;
- the public preview contains no applyable document or action and no raw image/provider content;
- exact confirmation recomputes the proposal and returns exactly one `image-plan:accept` load action and one-step undo metadata;
- stale current documents, forged previews, changed validation inputs, wrong confirmation text, and no-op proposals fail closed;
- cancel returns zero writes and no action/document surface;
- malformed cost arithmetic, unsafe micros, unknown evidence basis, and hidden/extra fields fail closed;
- IP05 refusals remain bounded refusals and never return partial previews or projects;
- hostile accessors, prototypes, aliases, cycles, sparse arrays, symbols, revoked proxies, and mutation attempts reveal no private detail and invoke nothing hidden;
- successful preview, commit, cancel, nested intent/check/action/document, and cost surfaces are detached and deeply frozen;
- source scans prove no provider name/SDK, network, secret, environment, storage, clock, randomness, payment execution, React/UI, CSS, or frozen 3D dependency enters IP06.

## Required gates

1. `npm run typecheck`
2. `npx playwright test --config=playwright.ip06.config.ts`
3. `npm test`
4. `npm run test:graph-v2`
5. `npm run test:graph-position`
6. `git diff --check`
7. Exact base-to-candidate five-path comparison
8. Explicit closure-aware G05 receipt
9. Independent fresh-context verification before `verified`

## Stop conditions

Stop and refuse rather than expanding IP06 if implementation requires a provider request, route, secret, environment read, account mutation, spend, fee calculation, checkout, wallet, storage/persistence adapter, editor dispatch, React/UI/CSS change, public-site design change, or any website 3D, rendering, animation, engine, scene, model, texture, shader, geometry, camera, lighting, motion, or quality-tier path.

## Implementation evidence

- The ready manifest was committed at `6c66921d90b2640985c2ee2c72c318ca3f65216b` and activated at `51685819033bebbb36447531221039bb0a6fc077` only after Graph v2 authority passed 25/25 and graph-position passed 14/14.
- Initial RED: the dedicated IP06 suite failed at module resolution because `designIntentPreviewCommit.ts` did not exist.
- Initial GREEN: the new pure contract reached 10/10 focused proofs and a clean TypeScript check after the fixture was corrected to use mutable detached inputs and canonical `HomeSpec.name` changes.
- Boundary RED: a tampered public preview surfaced `invalid-cost-evidence` through cancellation instead of the public `invalid-preview` classification.
- Boundary GREEN: cancellation now maps every malformed cost surface to `invalid-preview`; the complete focused suite remains 10/10 and TypeScript remains clean.
- The deterministic repository suite passed with 733 tests and four intentional served-only skips; Graph v2 passed 25/25, graph-position passed 14/14, and `git diff --check` passed before candidate sealing.
- The implementation imports only the existing IP02/IP05 contracts, canonical builder document owner, and a deterministic hash primitive. It introduces no route, provider request, environment read, storage, editor dispatch, payment execution, UI, CSS, or protected/frozen path.
- Candidate, closure-aware G05, full repository receipts, and independent fresh-context verification remain mandatory before this node can become `verified`.

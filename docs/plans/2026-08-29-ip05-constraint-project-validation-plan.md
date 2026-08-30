# IP05 Constraint and Project Validation Implementation Plan

> **For the implementing agent:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development`; do not cross the committed ExecutionNode write set.

**Goal:** Validate one IP04 compiled proposal for concept preview through exact document, graph, program, opening, climate, provenance-rights, and span-review gates, returning either a detached immutable validation receipt or one bounded refusal without silently repairing the proposal.

**Authority:** Founder-approved Aura Full-System Operating Graph v2.0 (`f7616886f9f8a171c847ef5eb49e932246ff989b`, approval `e031a83b8d9dcd428ffaab46d83b39370f2962a0`) and independently verified IP04 (`76d463c`). The approved activation sequence places IP05 immediately after IP04 and before IP06 preview/commit.

**Architecture:** Add `app/lib/ai/designIntentProjectValidator.ts` as a pure fail-closed boundary. It snapshots hostile input through data descriptors only, reparses the original intent, validates and canonically reopens the compiled `BuilderDocument` and `BuildingGraph`, verifies every compiler/document/project hash, reconciles rooms, storeys, openings, climate, source fingerprints, and uploaded-image rights evidence, and emits ordered gate receipts. Structural spans remain explicitly unverified professional evidence: the validator reports the largest derived clear room span and a review-required notice instead of claiming engineering adequacy.

**Tech Stack:** TypeScript, existing IP01/IP02/IP04 contracts, existing building-graph and builder-document validators, `viem` Keccak hashing, deterministic Playwright contracts, Node static-source inspection.

**Scope boundary:** IP05 does not modify a project, repair geometry, infer missing intent, persist data, render a preview, choose/call a provider, calculate money, perform professional code/structure review, or touch React, public UI, CSS, website visuals, or frozen 3D/rendering/animation paths. IP06 owns preview/commit/undo; IP07 owns durable persistence/provenance; locality and professional-review lanes own sourced jurisdictional and engineering evidence.

---

### Task 1: Commit the plan and ready execution boundary

**Files:**
- Create: `docs/plans/2026-08-29-ip05-constraint-project-validation-plan.md`
- Create: `docs/plans/execution/v2/IP05-constraint-project-validation.json`

**Step 1: Commit this plan**

Run Graph v2 authority and position gates from `app/`, confirm the worktree is clean, and commit this plan alone.

**Step 2: Create the ready manifest**

Declare dependency `IP04:verified`, no side effects or external gates, one bounded repair, and exactly these five paths:

1. `docs/plans/2026-08-29-ip05-constraint-project-validation-plan.md`
2. `docs/plans/execution/v2/IP05-constraint-project-validation.json`
3. `app/lib/ai/designIntentProjectValidator.ts`
4. `app/tests-ip05/design-intent-project-validator.contract.ts`
5. `app/playwright.ip05.config.ts`

Record verified IP04 lineage, zero live ownership overlap, zero protected/frozen paths, and the absence of an external gate. Commit the ready manifest, rerun graph-position reconciliation, then commit it as `active` before behavior work.

### Task 2: Specify the validation boundary test-first

**Files:**
- Create: `app/tests-ip05/design-intent-project-validator.contract.ts`
- Create: `app/playwright.ip05.config.ts`
- Test: `app/tests-ip05/design-intent-project-validator.contract.ts`

**Step 1: Write failing contracts before implementation**

Cover these independently observable behaviors:

1. A valid IP04 proposal plus exact uploaded-image approval produces a detached deeply frozen `concept-preview-valid` receipt with ordered `pass` gates and one `review-required` span gate.
2. Unknown keys, accessors, custom prototypes, cycles, sparse arrays, symbols, oversized structures, revoked proxies, and aliases fail with one bounded `invalid-boundary` refusal and no raw exception detail.
3. `parseDesignIntent` is the only intent promotion boundary; geometry or unknown intent fields fail.
4. Project format/version/compiler version/intent version, exact source fingerprints, intent hash, document hash, and project hash must all match canonical recomputation.
5. The document must be an exact canonical v2 building-graph document. Legacy geometry, migrations, unknown fields, normalization, quarantine entries, or validation repair are refused.
6. `validateBuildingGraph` and `validateBuilderDocument` must pass without throwing or silently changing the candidate.
7. Storey count, requested room names/counts, and minimum room areas must match intent exactly; stale, missing, renamed, duplicated, undersized, or extra non-default rooms fail.
8. Explicit window and exterior-door counts must match intent; every opening must remain within its wall length and storey head and no overlap may pass.
9. Compiler default opening decisions are required when intent omits counts; missing or contradictory default evidence fails.
10. Compiler climate mapping must match the strict intent climate rule; default climate requires its disclosed decision.
11. Every uploaded-image source fingerprint requires exactly one matching consent/rights/retention approval; missing, duplicate, mismatched, unsupported, or extra approval fails. Non-image sources do not gain image-rights claims.
12. The span check derives finite positive room clear-span facts but always reports professional structural adequacy as `review-required`, never `pass`, code-compliant, engineered, permit-ready, or construction-ready.
13. Every failure uses a stable gate/code/message, returns no partial project or validation receipt, and leaves all inputs unchanged.
14. Static proof excludes network, providers, secrets, storage, clock, randomness, money, React/UI, CSS, and frozen 3D/rendering/animation dependencies.

**Step 2: Run RED**

Run:

```powershell
npx playwright test --config=playwright.ip05.config.ts
```

Expected: FAIL because `@/lib/ai/designIntentProjectValidator` does not exist.

### Task 3: Implement the smallest pure validator

**Files:**
- Create: `app/lib/ai/designIntentProjectValidator.ts`
- Test: `app/tests-ip05/design-intent-project-validator.contract.ts`

**Step 1: Add the public contract**

Export:

- `DESIGN_INTENT_PROJECT_VALIDATOR_VERSION`;
- stable validation gate, outcome, and refusal-code unions;
- `DesignIntentImageSourceApproval` with exact fingerprint, consent, rights, retention, and disposition evidence;
- `DesignIntentProjectValidationInput` containing unknown intent/project/approval boundaries;
- `ValidatedDesignIntentProject` with canonical detached intent/project, ordered checks, source fingerprints, largest derived clear span, and concept-only notice;
- discriminated `DesignIntentProjectValidationResult`;
- `validateDesignIntentProject(value: unknown)`.

**Step 2: Implement hostile-safe snapshotting**

Read only enumerable own data descriptors from ordinary records and dense arrays. Reject symbols, accessors, custom prototypes, cycles, sparse arrays, unsupported values, excessive depth/nodes/keys/string lengths, and revoked boundaries. Never invoke getters, `toJSON`, or caller functions.

**Step 3: Reopen canonical contracts without repair**

Parse the intent through `parseDesignIntent`. Require exact compiled-project keys and versions. Revalidate the document and graph, serialize the accepted document canonically, and reject if canonical validation would drop, migrate, normalize, or change any input field. Recompute intent, document, and project hashes from the exact IP04 basis and require equality.

**Step 4: Reconcile semantic gates**

Check storeys, requested room labels/counts/minimum areas, opening counts and vertical/head fit, compiler default decisions, strict climate mapping, source fingerprints, and uploaded-image rights approvals. Derive each room clear span from its face bounds. Emit the span check as `review-required` with a concept-only professional-review message; it cannot become a blocking engineering claim or a silent pass.

**Step 5: Freeze output or refuse once**

Return a canonical detached deeply frozen success value only after all blocking checks pass. On any problem, return one stable bounded refusal containing only gate, code, and public message; no partial project, raw exception, path internals, or repaired value survives.

### Task 4: Verify, commit, and close

**Files:**
- Modify: `docs/plans/execution/v2/IP05-constraint-project-validation.json`

**Step 1: Run focused and repository gates**

```powershell
npx playwright test --config=playwright.ip05.config.ts
npm run typecheck
npm test
npm run test:graph-v2
npm run test:graph-position
git diff --check
```

Expected: every command exits zero; the focused contract reports all IP05 proofs passing without a server or external service.

**Step 2: Commit the candidate and run exact G05**

Commit the implementation candidate. Invoke the exact G05 preflight from the node base to the candidate. The candidate must change exactly the five declared paths with zero protected/frozen paths, ownership conflicts, or external gates.

**Step 3: Close for independent verification**

Record immutable gate receipts and close the manifest as `verification-pending` in a manifest-only commit. A separately authorized fresh-context verifier must independently pass the exact lineage, source review, focused/full/graph gates, and G05 receipt before IP06 can activate.

## Stop conditions

### Authorized repair loop 1 — independent verification findings

The fresh-context verifier found that code-only decision membership did not authenticate the compiler's exact disclosure, room matching flattened storey ownership, and a `0.1 ft²` tolerance admitted a real minimum-area shortfall. The single Graph-authorized repair adds adversarial fixtures for all three cases, requires exact compiler decision objects, compares rooms within their assigned storey, and enforces the stated minimum without a business tolerance. No dependency, output, side effect, or write-set boundary changes.

The final fresh-context passes on the same still-open repair attempt also proved that converting any compiler refusal into `null` can skip exact compiler decisions and accept rehashed stale geometry. The bounded correction never returns `null`: canonical `program-does-not-fit` and `openings-do-not-fit` outcomes become their stable public mismatch gates immediately, while every other compiler refusal fails at integrity. A-frame/stale-gable, orientation-capacity, and long-room-label regressions prove that neither unsupported nor semantically plausible stale projects can bypass the canonical compiler. This remains repair-loop use `1`, not a new implementation loop.

- IP04 loses verified status or another live manifest claims an IP05 path.
- Validation needs a provider, network, secret, clock, randomness, persistence, money, UI, CSS, public design, or frozen 3D/rendering path.
- A candidate is migrated, repaired, normalized, or partially returned instead of refused.
- Structural, code, permit, engineering, or construction adequacy is presented as verified.
- Uploaded-image rights are inferred without exact source-bound evidence.
- Any further finding after this still-open authorized repair is independently closed would require new graph authority.

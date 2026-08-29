# IP03 Provider-Neutral Design-Intent Adapter Implementation Plan

> **For the implementing agent:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task and `superpowers:test-driven-development` for every behavior change.

**Goal:** Add one provider-neutral, fail-closed image-to-`DesignIntent` task contract and a deterministic fake that exercise the same request, response, error, cancellation, timeout, and cost surfaces a future hosted adapter must use, without network access, provider credentials, money movement, project mutation, or 3D/public-design changes.

**Authority:** Founder-approved Aura Full-System Operating Graph v2.0, proposal `f7616886f9f8a171c847ef5eb49e932246ff989b`, approval `e031a83b8d9dcd428ffaab46d83b39370f2962a0`, verified `IP01` safe image intake, and verified `IP02` `DesignIntent` schema.

**Architecture:** Create `app/lib/ai/designIntentAdapter.ts` as an orchestration boundary, not a provider implementation. A caller supplies a bounded task request, and an injected adapter receives a detached byte snapshot plus a composed abort signal. The boundary validates request metadata, MIME signature, declared byte length, source fingerprint, adapter identity, timeout, raw usage/cost receipt, and untrusted model output. Only `parseDesignIntent` can promote output into a typed intent. The boundary returns a detached deep-frozen canonical response and converts every failure into a bounded, non-secret `DesignIntentTaskError`. `createDeterministicDesignIntentFake` implements the exact same adapter interface with fixed fixtures and no clock, randomness, storage, network, wallet, payment, or project access.

**Compatibility boundary:** The contract carries provider/model/request identifiers and provider-reported token/cost facts in generic fields because hosted model APIs expose those concepts. It does not name OpenRouter, select a model, hold an API key, perform a live call, calculate Aura's 15% usage fee, create credit, charge a user, or decide retention. Those concerns remain in `OR01` and `OR02`; actual live image-to-intent execution remains in `OR03`.

---

## Task 1: Commit the IP03 plan and ready execution boundary

**Files:**
- Create: `docs/plans/2026-08-29-ip03-provider-neutral-adapter-plan.md`
- Create: `docs/plans/execution/v2/IP03-provider-neutral-adapter.json`

**Step 1: Commit this plan alone**

```powershell
git add docs/plans/2026-08-29-ip03-provider-neutral-adapter-plan.md
git commit -m "docs: plan IP03 provider-neutral adapter"
```

**Step 2: Write the ready `ExecutionNode` manifest**

Declare `IP02:verified`, no external gate, no side effects, one repair maximum, and this exact write set:

```json
[
  "docs/plans/2026-08-29-ip03-provider-neutral-adapter-plan.md",
  "docs/plans/execution/v2/IP03-provider-neutral-adapter.json",
  "app/lib/ai/designIntentAdapter.ts",
  "app/tests-ip03/design-intent-adapter.contract.ts",
  "app/playwright.ip03.config.ts"
]
```

Reject undeclared writes, unverified `IP02`, provider-specific imports or names, network/provider/model/wallet/payment/persistence/project calls, live secrets, fee calculation, raw error leakage, accepting unparsed intent output, floating-point cost, shared mutable aliases, unbounded timeout/cancel behavior, or any frozen/public-design path.

Reference the exact plan commit from Step 1 and the exact verified IP02 commit.

**Step 3: Run authority and ownership checks**

Run:

```powershell
npm --prefix app run test:graph-v2
git status --short
```

Expected: Graph v2 authority passes; IP02 is verified; UX08 may remain verification-pending because its write set does not overlap IP03; no other live manifest owns an IP03 path.

**Step 4: Commit the ready manifest**

```powershell
git add docs/plans/execution/v2/IP03-provider-neutral-adapter.json
git commit -m "docs(graph): ready IP03 provider-neutral adapter"
```

## Task 2: Reconcile and activate IP03

**Files:**
- Modify: `docs/plans/execution/v2/IP03-provider-neutral-adapter.json`

**Step 1: Reconcile committed readiness**

Confirm the checked-in graph gate passes, IP02 is committed `verified`, the worktree is clean, no live manifest overlaps the declared write set, all external gates are empty, and declared protected paths are zero.

**Step 2: Activate with an immutable receipt**

Set the manifest to `active`, record the exact ready commit, dependency receipt, ownership result, and existing-surface audit, then commit only the manifest.

```powershell
git add docs/plans/execution/v2/IP03-provider-neutral-adapter.json
git commit -m "docs(graph): activate IP03 provider-neutral adapter"
```

G05 exact-write preflight is reserved for the completed candidate because it compares the entire node-base-to-candidate diff to the complete declared write set.

## Task 3: Specify the shared contract test-first

**Files:**
- Create: `app/tests-ip03/design-intent-adapter.contract.ts`
- Create: `app/playwright.ip03.config.ts`
- Create: `app/lib/ai/designIntentAdapter.ts`

**Step 1: Write failing contract tests**

Cover these required surfaces before production code exists:

1. A deterministic fake and a hosted-shaped fixture implement the same `DesignIntentAdapter` method and feed the same `runDesignIntentTask` boundary.
2. A valid request includes a bounded request ID, safe IP01 intake receipt, byte content, canonical `sha256:` source fingerprint, and timeout.
3. Adapter input bytes and metadata are detached from caller mutation before the adapter turn begins.
4. A valid raw response is parsed through `parseDesignIntent`, receives a provider-neutral execution receipt, and returns a fully detached frozen response.
5. The same fake request and fixture yield structurally identical results on repeated calls, with no clock or random field.
6. Malformed, unknown-key, geometry-bearing, accessor, hostile-proxy, or otherwise invalid adapter output fails as `invalid-output` without leaking parser or provider-private detail.
7. Receipt cost is non-negative integer USD micros; token counts are null or non-negative safe integers; identifiers are bounded data strings; unknown receipt fields fail.
8. Caller cancellation and timeout are distinct, deliver an aborted signal to the adapter, and settle even if the adapter never settles.
9. Known retryable adapter failures normalize to safe bounded codes; arbitrary thrown objects, causes, stack text, accessors, and revoked proxies become a generic `provider-failed` error.
10. Request mismatch, empty bytes, unsupported signature, encoded-length mismatch, invalid fingerprint, invalid timeout, or unsafe ID fails before adapter invocation.
11. The module contains no provider SDK, `fetch`, `XMLHttpRequest`, `WebSocket`, wallet, payment, persistence, project, geometry, 3D, renderer, or animation dependency.

**Step 2: Prove RED**

Run:

```powershell
npx playwright test --config=playwright.ip03.config.ts
```

Expected: FAIL because `designIntentAdapter.ts` does not exist.

**Step 3: Define the smallest public types**

Expose:

- `DESIGN_INTENT_ADAPTER_VERSION`;
- `DesignIntentTaskRequest` and its image input;
- `DesignIntentAdapter` with one `run(request, context)` method;
- `RawDesignIntentAdapterResponse`;
- `DesignIntentExecutionReceipt` using integer USD micros;
- `DesignIntentTaskResponse`;
- `DesignIntentTaskError` and bounded codes;
- `runDesignIntentTask`;
- `createDeterministicDesignIntentFake`.

Do not add a router, provider registry, API handler, model selector, prompt editor, user fee, ledger, or persistence surface.

## Task 4: Implement validation, isolation, timeout, and error normalization

**Files:**
- Modify: `app/lib/ai/designIntentAdapter.ts`
- Modify: `app/tests-ip03/design-intent-adapter.contract.ts`

**Step 1: Make request preflight pass**

Validate only ordinary JSON-like metadata without invoking accessors. Snapshot the `Uint8Array` synchronously, check its supported encoded signature and exact byte length against the IP01 receipt, validate the source fingerprint format, and create a detached frozen adapter request. Fail before calling the adapter on any mismatch.

The fingerprint is an already-computed provenance fact at IP03. Recomputing and persistence remain downstream concerns; a hosted boundary must not pretend this node proves cryptographic binding it does not yet perform.

**Step 2: Implement composed cancellation and timeout**

Create an internal `AbortController`, forward an optional caller signal, set a bounded integer timeout, and race adapter work with the abort event. Remove listeners and clear timers in `finally`. A caller abort wins as `cancelled`; the local deadline wins as `timeout`.

**Step 3: Validate and promote adapter output**

Treat raw output and receipt as hostile. Inspect only data properties, reject unknown keys, validate provider-neutral IDs and integer usage/cost values, call `parseDesignIntent` on the raw intent, clone validated output, and recursively freeze the response. No raw response alias may survive.

**Step 4: Normalize errors without private detail**

Permit adapters to throw only the exported bounded adapter-failure shape for recognized retryable categories. Read it through a hostile-safe boundary. All other thrown values become `provider-failed`. Never retain `cause`, arbitrary message text, stack content, response bodies, headers, URLs, credentials, or provider names.

**Step 5: Make the deterministic fake pass**

The fake stores a validated frozen fixture at construction, emits a fixed provider-neutral receipt, respects the supplied signal, and returns a new detached raw response per call. It must not inspect globals, call a clock/random source, or perform side effects.

**Step 6: Run GREEN and typecheck**

Run:

```powershell
npx playwright test --config=playwright.ip03.config.ts
npm run typecheck
```

Expected: every IP03 contract test passes and TypeScript is clean.

## Task 5: Keep the IP03 contract isolated from UX08-owned evidence paths

**Files:**
- Create: `app/playwright.ip03.config.ts`

**Step 1: Run the dedicated deterministic contract gate**

Run:

```powershell
npx playwright test --config=playwright.ip03.config.ts
```

Expected: all 18 IP03 contract cases pass without a server or external service.

The IP03 test lives outside `app/tests/*.spec.ts` intentionally. G05 discovered that UX08 still owns `app/tests/gate-coverage.spec.ts`, `README.md`, and `docs/SUBMISSION.md` while awaiting independent verification. Folding IP03 into the shared runner would require changing those live-owned count surfaces. The dedicated checked-in Playwright configuration preserves committed deterministic proof without crossing that ownership boundary.

**Step 2: Run the unchanged complete deterministic gate**

```powershell
npm test
```

Expected: the existing 737-test gate remains green at 733 passed plus four documented served-only skips. Do not change shared counts or evidence documents until UX08 is independently closed and a future committed manifest owns them.

**Step 3: Run remaining local gates**

Run:

```powershell
npm run test:graph-v2
npm run test:graph-position
git diff --check
```

Expected: dedicated contract evidence, the unchanged deterministic gate, authority, position-contract tests, and whitespace all pass.

No served UI suite is required because IP03 has no browser surface. Existing UI counts remain unchanged.

## Task 6: Commit, preflight, close, and independently verify IP03

**Files:**
- Modify: `docs/plans/execution/v2/IP03-provider-neutral-adapter.json`

**Step 1: Commit the implementation candidate**

Verify the complete node-base-to-candidate diff is exactly the declared five paths and contains no protected path. Commit the non-manifest behavior and dedicated test configuration first.

```powershell
git add app/lib/ai/designIntentAdapter.ts app/tests-ip03/design-intent-adapter.contract.ts app/playwright.ip03.config.ts docs/plans/2026-08-29-ip03-provider-neutral-adapter-plan.md
git commit -m "feat(ai): add provider-neutral design-intent adapter"
```

**Step 2: Invoke G05 preflight against the completed candidate**

Use the node start commit that predates this plan as the base, the implementation commit as candidate, all manifest verification commands as fresh evidence, and request `movement: remain`.

Expected: exact declared writes, no protected path, clean worktree, verified dependency, complete evidence, and decision history pass.

**Step 3: Close the node**

Set IP03 to `verification-pending`, record immutable lineage, exact write-set and gate receipts, then commit only the manifest.

```powershell
git add docs/plans/execution/v2/IP03-provider-neutral-adapter.json
git commit -m "docs(graph): close IP03 for verification"
```

**Step 4: Require independent fresh-context verification**

The verifier works read-only and probes authority, IP02 lineage, exact writes, freeze, request mutation, byte isolation, hostile output and receipt boundaries, timeout/cancel races, error sanitization, deterministic fake parity, no side effects, and every declared gate. On PASS, record the verdict and set `verified`. On FAIL, use at most one bounded repair within the declared write set; after the repair is exhausted, mark IP03 blocked and move laterally.

## Stop conditions

- IP02 loses independently verified status.
- Any live manifest overlaps the IP03 write set.
- Any undeclared, protected, public-site, 3D, rendering, animation, engine, scene, model, texture, shader, camera, lighting, motion, or quality-tier path enters the diff.
- Any OpenRouter/provider SDK, network call, credential, live model, user fee, credit, payment, wallet, persistence, project mutation, or autonomous geometry enters IP03.
- Invalid output reaches callers as `DesignIntent`, or cost uses a floating-point amount.
- Caller bytes, fixture output, request metadata, or receipt objects remain aliased and mutable.
- Cancellation or timeout cannot settle independently of a hung adapter.
- Raw thrown values, provider messages, causes, stack text, URLs, headers, bodies, or secrets escape the normalized error boundary.
- A second repair would be required.

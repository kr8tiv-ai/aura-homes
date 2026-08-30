# IP07 Project Provenance and Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist an explicitly accepted IP06 image-to-plan revision inside the existing `AuraProject` as one canonical design update plus one strict provenance record, then prove durable recovery without retaining raw image content by default.

**Architecture:** Add one provider-neutral orchestration module between the verified IP06 commit receipt and an injected atomic project-revision store. The module re-runs IP06, compares the stored project against the exact expected project hash, commits the canonical document and provenance record in one store transaction, and confirms durability through an operation-specific revision witness rather than whole-project equality. The record lives in the existing `artifactManifests` collection; no second project model, storage implementation, route, UI, clock, random identifier, provider call, or frozen rendering path is introduced.

**Tech Stack:** TypeScript, existing `AuraProject`/`BuilderDocument` canonical validators and hashes, verified IP02–IP06 contracts, `viem` Keccak hashing, Playwright contract tests.

---

## Approved design boundary

Graph v2 already supplies the founder-approved design for this node: IP07 follows verified IP06 and owns persistence, provenance, and recovery. This plan narrows that approved outcome to the existing local project model and an injected transactional seam. It does not enter UX06, IP08, hosted execution, accounts, cloud storage, provider activation, payment, public-site design, or 3D/rendering/animation work.

The exact persisted revision record will contain:

- a deterministic revision identifier and format/version;
- the project identifier and exact pre-commit project hash;
- IP06 preview identifier, before/after document hashes, candidate project hash, and transition-bound action label;
- `AuraProject`, `DesignIntent`, adapter, compiler, validator, and preview/commit contract versions;
- adapter id/version/kind, model id, provider request id, input/output token counts, and exact provider/Aura/total USD-micro cost evidence;
- source fingerprints plus explicit consent, rights, retention choice, and raw-image disposition;
- the user-supplied commit instant as a strict ISO string;
- no raw bytes, filename, prompt, model output, provider body, credential, or hidden persistence instruction.

`delete-after-analysis` requires a null retained-image reference. `retain-with-project` may record one opaque bounded reference, but this node never accepts or stores the bytes themselves.

## Exact write set

1. `docs/plans/2026-08-30-ip07-project-provenance-recovery-plan.md`
2. `docs/plans/execution/v2/IP07-project-provenance-recovery.json`
3. `app/lib/ai/designIntentProjectRevision.ts`
4. `app/tests-ip07/design-intent-project-revision.contract.ts`
5. `app/playwright.ip07.config.ts`

No existing project model/store, component, route, stylesheet, public-site file, provider wrapper, payment surface, or frozen 3D/rendering/animation path is in the candidate write set.

### Task 1: Commit the implementation plan and ready manifest

**Files:**

- Create: `docs/plans/2026-08-30-ip07-project-provenance-recovery-plan.md`
- Create: `docs/plans/execution/v2/IP07-project-provenance-recovery.json`

**Step 1: Prove dependency and ownership readiness**

Run:

```powershell
npm --prefix app run test:graph-v2
npm --prefix app run test:graph-position
git status --short --branch
```

Expected: Graph v2 25/25, graph-position 14/14, IP06 `verified`, no overlapping live owner, clean worktree, no external gate, and zero protected paths.

**Step 2: Commit this plan**

```powershell
git add docs/plans/2026-08-30-ip07-project-provenance-recovery-plan.md
git commit -m "docs(ip07): plan project provenance recovery"
```

**Step 3: Create and validate the ready manifest**

The manifest must bind the plan commit, IP06 verified commit, exact five-path write set, rejection gates below, one bounded repair loop, and `status: ready`.

**Step 4: Commit the ready manifest**

```powershell
git add docs/plans/execution/v2/IP07-project-provenance-recovery.json
git commit -m "chore(ip07): declare project revision manifest"
```

### Task 2: Write the failing persistence and provenance contract

**Files:**

- Create: `app/tests-ip07/design-intent-project-revision.contract.ts`
- Create: `app/playwright.ip07.config.ts`
- Create later: `app/lib/ai/designIntentProjectRevision.ts`

**Step 1: Write the first failing test**

Construct a canonical `AuraProject`, a complete IP05 validation input, an IP06 preview/confirmation, and provider-neutral execution evidence. Use an in-memory store whose `transact` callback runs against the current project and whose `read` returns the durable project.

The first proof must call the wished-for API:

```ts
const receipt = await persistDesignIntentProjectRevision(input, store);
expect(receipt.committed).toBe(true);
expect(receipt.revision.afterDocumentHash).toBe(preview.projectChange.afterDocumentHash);
expect(hashBuilderDocument(receipt.project.design.document)).toBe(receipt.revision.afterDocumentHash);
expect(receipt.project.artifactManifests).toContainEqual(receipt.revision);
```

**Step 2: Run the focused suite and observe RED**

```powershell
cd app
npx playwright test --config=playwright.ip07.config.ts
```

Expected: FAIL because `designIntentProjectRevision.ts` does not exist.

### Task 3: Implement the minimal strict revision contract

**Files:**

- Create: `app/lib/ai/designIntentProjectRevision.ts`
- Modify: `app/tests-ip07/design-intent-project-revision.contract.ts`

**Step 1: Define the public boundary**

Expose only:

```ts
export interface DesignIntentProjectRevisionStore {
  transact(
    projectId: string,
    operation: (current: unknown) => AuraProject,
  ): Promise<unknown>;
  read(projectId: string): Promise<unknown>;
}

export async function persistDesignIntentProjectRevision(
  input: DesignIntentProjectRevisionInput,
  store: DesignIntentProjectRevisionStore,
): Promise<DesignIntentProjectRevisionReceipt>;

export async function recoverDesignIntentProjectRevision(
  input: DesignIntentProjectRevisionRecoveryInput,
  store: Pick<DesignIntentProjectRevisionStore, "read">,
): Promise<DesignIntentProjectRevisionRecoveryReceipt>;
```

The transaction callback must validate the store-provided current project, require its canonical project hash to equal the exact expected hash, re-run IP06 commit, require the current design hash to equal IP06's before hash, update through `withProjectDesign`, append exactly one strict revision record, and refuse duplicates or collisions.

**Step 2: Bind the deterministic revision identifier**

Derive the revision id from the canonical record body before `revisionId` is added. The body includes project id, exact prior project hash, IP06 preview and document/project hashes, all contract/model/rule versions, execution/cost evidence, source/retention evidence, and committed-at ISO time. Never use a clock or random source.

**Step 3: Confirm durability with an operation-specific witness**

After `transact`, perform a strongly consistent `read`. Validate the project and require exactly one revision record matching the complete canonical record and revision id. Do not require whole-project equality: a later valid edit may advance the project before read-back. Refuse a fabricated transaction result, missing/mutated witness, unreadable store, or duplicate conflicting revision.

**Step 4: Return detached immutable receipts**

Return the transaction project and revision only after durable witness confirmation. Recovery reads the current project, finds exactly one matching strict revision, verifies the revision's internal hashes/versions/evidence, and returns a detached deeply frozen receipt without changing storage.

**Step 5: Run GREEN**

```powershell
cd app
npx playwright test --config=playwright.ip07.config.ts
npm run typecheck
```

Expected: focused contract passes and TypeScript reports no errors.

### Task 4: Prove fail-closed persistence, retention, and recovery

**Files:**

- Modify: `app/tests-ip07/design-intent-project-revision.contract.ts`
- Modify only if a new failing proof requires it: `app/lib/ai/designIntentProjectRevision.ts`

Add one failing proof at a time, observe RED, implement the minimum correction, then observe GREEN for:

1. stale input project, stale stored project, changed IP06 input, forged confirmation, invalid IP06 proposal, and no-op proposal;
2. fabricated transaction return without durable commit, unreadable read-back, missing revision witness, mutated witness, and store errors;
3. two commits with the same revision id, conflicting duplicate records, and a later legitimate project edit before read-back;
4. exact adapter/model/token/cost evidence and mismatch between IP03 provider cost and IP06 cost evidence;
5. delete retention with any retained reference, retain choice without a bounded opaque reference, and any raw byte/content-shaped field;
6. unknown keys, symbols, accessors, custom prototypes, cycles, aliases, sparse arrays, unsafe numbers, revoked values, raw errors, and mutable output attempts;
7. recovery success, missing project, missing revision, corrupt project, corrupt record, and zero writes during recovery;
8. detached and deeply frozen input-independent project, revision, persistence receipt, and recovery receipt;
9. static proof of no network, environment, secret, provider SDK, browser storage implementation, clock, randomness, payment, fee calculation, UI, CSS, or frozen rendering dependency.

### Task 5: Run repository gates and seal the exact candidate

**Files:** the exact five-path IP07 write set only.

Run after the final edit:

```powershell
cd app
npm run typecheck
npx playwright test --config=playwright.ip07.config.ts
npm test
cd ..
npm --prefix app run test:graph-v2
npm --prefix app run test:graph-position
git diff --check
git diff --name-only <IP07-base>...<IP07-candidate>
```

Expected: all commands pass; candidate names exactly five declared paths and zero protected paths.

Commit the exact candidate, then update only the manifest with the candidate hash and commit a manifest-only closure. Run explicit closure-aware G05 with the manifest's complete verification array, push both commits, and request one fresh immutable independent verification. IP07 remains `verification-pending` until that verifier returns PASS.

## Rejection and stop conditions

Stop rather than broadening IP07 if any implementation requires:

- changing `AuraProject`, `BuilderDocument`, the existing project store, a component, route, stylesheet, or public-site design;
- a provider request, live model, credential, environment read, account/cloud mutation, or external service;
- a raw image byte, filename, prompt, model output, or provider body in the project or revision record;
- autonomous editor dispatch, hidden mutation, inferred confirmation, a second project model, or a non-atomic persistence claim;
- payment, wallet, checkout, fee calculation, spend, deployment, DNS, legal/provider/partner approval, or any other external gate;
- any website 3D, rendering, animation, engine, scene, model, texture, shader, geometry, camera, lighting, motion, or quality-tier path.

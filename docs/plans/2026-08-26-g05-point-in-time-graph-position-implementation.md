# G05 Point-in-Time Graph Position Check Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an explicitly invoked, read-only Graph v2 position checker that traverses complete decision history, reconciles a node candidate, and emits a strict evidence receipt with safe movement choices.

**Architecture:** A pure validation core accepts safely snapshotted inputs and returns bounded errors. A repository adapter reopens committed manifests and every registry-changing Git commit, then produces an exact-key `AuraGraphPositionReceiptV1`; it never performs remote or write actions and never self-approves independent verification.

**Tech Stack:** Node.js ESM, `node:test`, Git read-only plumbing through `execFileSync`, JSON Schema 2020-12, existing `prove-graph-v2.mjs` authority/freeze validators.

---

### Task 1: Commit the bounded G05 manifest

**Files:**
- Create: `docs/plans/execution/v2/G05-point-in-time-graph-position.json`

**Step 1: Write the ready manifest**

Declare G01 as the only graph dependency, the design and approved graph as inputs, the receipt/policy/checker as outputs, and this exact write set:

```json
[
  "docs/plans/execution/v2/G05-point-in-time-graph-position.json",
  "docs/plans/registry/graph-position-policy.json",
  "docs/plans/execution/schema/aura-graph-position-receipt.schema.json",
  "app/scripts/graph-position-check.mjs",
  "app/scripts/graph-position-check.test.mjs",
  "app/package.json"
]
```

The rejection gates must cover scheduled invocation, self-verification, incomplete decision history, stale or uncommitted manifests, dependency/status contradictions, non-exact write sets, protected paths, overlapping ownership, missing evidence, unsafe forward moves, and any external side effect.

**Step 2: Run the graph gate**

Run: `npm --prefix app run test:graph-v2`

Expected: PASS with G05 `status: ready` and no manifest errors.

**Step 3: Commit**

```powershell
git add docs/plans/execution/v2/G05-point-in-time-graph-position.json
git commit -m "docs: ready G05 graph position checker"
```

### Task 2: Specify the receipt and hostile-input boundary test-first

**Files:**
- Create: `app/scripts/graph-position-check.test.mjs`
- Create: `docs/plans/registry/graph-position-policy.json`
- Create: `docs/plans/execution/schema/aura-graph-position-receipt.schema.json`
- Create: `app/scripts/graph-position-check.mjs`

**Step 1: Write failing tests**

Import the wished-for API:

```js
import {
  buildGraphPositionReceipt,
  validateDecisionHistorySequence,
  validateGraphPositionInput,
  validateRepositoryDecisionHistory,
} from "./graph-position-check.mjs";
```

Add tests proving:

```js
test("exact preflight input emits a non-self-approved receipt", () => {
  const receipt = buildGraphPositionReceipt(validInput());
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.independentVerification, "required");
  assert.equal(receipt.invocation.mode, "explicit");
});

test("unknown keys, accessors, and revoked values fail closed", () => {
  const input = validInput();
  input.scheduled = true;
  assert.match(validateGraphPositionInput(input).join("\n"), /unknown key scheduled/);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.doesNotThrow(() => validateGraphPositionInput(revoked.proxy));
});
```

**Step 2: Run RED**

Run: `node --test scripts/graph-position-check.test.mjs`

Expected: FAIL because `graph-position-check.mjs` and its exports do not exist.

**Step 3: Implement minimal safe validation and exact receipt**

Implement own-data-property snapshotting, exact root/nested keys, full commit validation, phase enum (`preflight`, `integration`, `release`), explicit invocation only, evidence status validation, and a receipt whose `independentVerification` is always `required` before external review.

The policy file must set:

```json
{
  "schema": "AuraGraphPositionPolicyV1",
  "invocation": "explicit-only",
  "phases": ["preflight", "integration", "release"],
  "moveClasses": ["remain", "backward-repair", "lateral-ready", "blocked-authority"],
  "recurringAutomation": "forbidden"
}
```

**Step 4: Run GREEN**

Run: `node --test scripts/graph-position-check.test.mjs`

Expected: the receipt and hostile-input tests pass.

### Task 3: Prove complete decision-registry history

**Files:**
- Modify: `app/scripts/graph-position-check.test.mjs`
- Modify: `app/scripts/graph-position-check.mjs`

**Step 1: Write the buried-rewrite tests**

Create three V2 snapshots: accepted, rewritten with a recomputed chain, and appended after the rewrite. Assert:

```js
assert.match(
  validateDecisionHistorySequence([pinnedV1, accepted, rewritten, appended]).join("\n"),
  /history rewrite at transition 2/,
);
```

Build a temporary real Git repository with `mkdtemp`, commit the same sequence to `docs/plans/registry/decisions.json`, and assert `validateRepositoryDecisionHistory` rejects it even though the final adjacent pair is valid.

**Step 2: Run RED**

Run: `node --test scripts/graph-position-check.test.mjs --test-name-pattern="decision history"`

Expected: FAIL because full sequence traversal is not implemented.

**Step 3: Implement full traversal**

Use read-only Git argument arrays:

```js
git("log", "--reverse", "--format=%H", anchor + ".." + candidate, "--", registryPath)
git("cat-file", "blob", commit + ":" + registryPath)
```

Include the pinned V1 anchor, validate its stored/object SHA-256, require a zero-change V2 migration, and call the canonical prefix validator for every subsequent V2 transition. Never validate only the last pair.

**Step 4: Run GREEN**

Run: `node --test scripts/graph-position-check.test.mjs --test-name-pattern="decision history"`

Expected: PASS for valid history and FAIL-closed assertions for buried rewrites.

### Task 4: Reconcile node position and movement

**Files:**
- Modify: `app/scripts/graph-position-check.test.mjs`
- Modify: `app/scripts/graph-position-check.mjs`

**Step 1: Write failing position tests**

Cover:

- verified dependencies allow evaluation while blocked/missing dependencies reject forward movement;
- candidate paths exactly equal the declared write set;
- closure contains only the target manifest;
- protected/public-visual paths reject;
- another ready/active/verification-pending manifest claiming the same path rejects;
- missing declared evidence rejects;
- blocked nodes expose only remaining repair or committed ready lateral moves; and
- a strategic row without a committed ready manifest never appears as a move.

**Step 2: Run RED**

Run: `node --test scripts/graph-position-check.test.mjs --test-name-pattern="position|movement"`

Expected: FAIL on the first unimplemented reconciliation assertion.

**Step 3: Implement minimal reconciliation**

Reuse `verifyApprovedGraph`, `validateExecutionNode`, `loadProtectedPaths`, and `validateCandidatePaths` from `prove-graph-v2.mjs`. Reopen manifests from their candidate commit, compare exact Git diffs, enforce closure-only rules, and derive move choices only from committed manifest states and dependency truth.

**Step 4: Run GREEN**

Run: `node --test scripts/graph-position-check.test.mjs --test-name-pattern="position|movement"`

Expected: PASS.

### Task 5: Add the explicit CLI and package gate

**Files:**
- Modify: `app/scripts/graph-position-check.test.mjs`
- Modify: `app/scripts/graph-position-check.mjs`
- Modify: `app/package.json`

**Step 1: Write a failing CLI test**

Invoke the CLI against G05 with explicit `--phase`, `--node`, `--base`, `--candidate`, and `--closure` arguments. Assert valid JSON, exact schema, explicit invocation, and no filesystem mutation. Assert missing args, `--schedule`, URLs, and provider/payment/deploy tokens reject.

**Step 2: Run RED**

Run: `node --test scripts/graph-position-check.test.mjs --test-name-pattern="CLI"`

Expected: FAIL because the CLI is incomplete.

**Step 3: Implement the read-only CLI**

Add:

```json
"test:graph-position": "node --test scripts/graph-position-check.test.mjs"
```

The CLI writes its receipt only to stdout and sets a nonzero exit code on any failed invariant. It must reject all recurring/scheduled flags and any URL or external-action option.

**Step 4: Run GREEN**

Run: `npm run test:graph-position`

Expected: all focused tests pass.

**Step 5: Commit the candidate**

```powershell
git add docs/plans/registry/graph-position-policy.json docs/plans/execution/schema/aura-graph-position-receipt.schema.json app/scripts/graph-position-check.mjs app/scripts/graph-position-check.test.mjs app/package.json
git commit -m "feat: add point-in-time graph position receipts"
```

### Task 6: Close and independently verify G05

**Files:**
- Modify: `docs/plans/execution/v2/G05-point-in-time-graph-position.json`

**Step 1: Run all declared gates**

```powershell
npm --prefix app run test:graph-position
npm --prefix app run test:decision-ledger
npm --prefix app run test:graph-v2
npm --prefix app run typecheck
git diff --check
git diff --name-only <G05-base>...<G05-candidate>
```

Expected: every test passes, the write-set delta is zero, the protected-path count is zero, and the worktree is clean before closure.

**Step 2: Record immutable evidence and commit the closure**

Set the manifest to `verification-pending`, record full commits and exact receipts, then commit only the manifest:

```powershell
git add docs/plans/execution/v2/G05-point-in-time-graph-position.json
git commit -m "docs: close G05 for verification"
```

**Step 3: Invoke one independent verifier**

The verifier works read-only and probes full-history traversal, exact write ownership, dependency reconciliation, movement derivation, hostile inputs, and absence of scheduling/external side effects.

**Step 4: Record the verdict**

On PASS, set G05 to `verified`. On FAIL, use at most one bounded repair inside the declared write set; after an exhausted failed repair, set G05 to `blocked` and move laterally.


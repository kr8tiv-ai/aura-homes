# UX07 Versioned Scheme Comparison Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a person select two or three saved cabin schemes and compare their exact versions, measurable program, area, cost, constraint, and export facts without calling one option “best” or changing the active project.

**Architecture:** A pure `schemeComparison` projection reopens existing `SavedDesign` records, verifies each stored signature against its canonical `BuilderDocument` hash, and derives comparison rows only through the repository’s existing geometry, budget, parcel/readiness, and export boundaries. A separate builder component reads the existing local library and renders an accessible comparison table in the already-mounted Library workspace. Comparison is view state only: opening a scheme remains the existing explicit, undoable library action, and selecting or clearing comparison candidates never mutates project state.

**Tech Stack:** Next.js, React, TypeScript, IndexedDB through the existing builder store, existing `BuilderDocument`/hash/budget/readiness/export contracts, Playwright, and Graph v2 freeze/write-set gates.

---

### Task 1: Bind the lateral UX07 execution node

**Files:**
- Create: `docs/plans/execution/v2/UX07-versioned-scheme-comparison.json`

**Step 1:** Declare `UX03:verified` as the sole graph dependency, record UX04 as the reason for lateral movement, own an exact non-frozen write set, and reject duplicate/stale hashes, guessed rankings, autonomous mutation, and public/3D changes.

**Step 2:** Run `npm run test:graph-v2` and prove the committed ready manifest before production work begins.

**Step 3:** Commit the ready manifest, activate it in a manifest-only commit, and rerun the authority/freeze gate.

### Task 2: Specify one canonical comparison projection

**Files:**
- Create: `app/lib/builder/schemeComparison.ts`
- Test: `app/tests/scheme-comparison.spec.ts`

**Step 1:** Write failing deterministic tests for two-to-three candidate bounds, exact saved-record/hash identity, stale or duplicate refusal, legacy and planar-graph program/area projection, canonical budget bands, site/readiness blockers, quarantine state, and honest export capability.

**Step 2:** Confirm the focused tests fail because no comparison projection exists.

**Step 3:** Implement the smallest pure projection by composing existing repository owners. Do not copy their arithmetic, persist comparison state, invent scores, or label any scheme “best.”

**Step 4:** Rerun the focused deterministic tests and commit the green contract.

### Task 3: Make saved schemes selectable and comparable

**Files:**
- Create: `app/components/builder/SchemeComparison.tsx`
- Modify: `app/components/builder/BuilderApp.tsx`
- Test: `app/tests/scheme-comparison.spec.ts`

**Step 1:** Add a served failing test that saves three distinct documents, selects two by keyboard, compares them, verifies their full canonical identities and measurable rows, swaps the reference scheme, clears comparison, and proves the active design hash/history never changes.

**Step 2:** Implement a bounded two-or-three selection surface in the existing Library workspace. Reuse `listDesigns`, `readDesign`, and library change notifications; keep unavailable/corrupt/stale states explicit and preserve a usable empty state.

**Step 3:** Render a semantic table with a user-chosen reference column and factual deltas. Opening a candidate delegates to the existing library flow; comparison itself has no project mutator.

**Step 4:** Rerun the focused served and deterministic tests, typecheck, and commit the green implementation.

### Task 4: Reconcile the declared gate surface

**Files:**
- Modify: `app/playwright.ui.config.ts`
- Modify: `app/tests/gate-coverage.spec.ts`
- Modify: `README.md`
- Modify: `docs/SUBMISSION.md`

**Step 1:** Add the served comparison proof to the production UI gate.

**Step 2:** Measure rather than guess the new deterministic/UI declaration counts, update only the measured receipts, and rerun the counter gate.

**Step 3:** Commit the reconciled truth surfaces.

### Task 5: Verify and close UX07

**Files:**
- Modify: `docs/plans/execution/v2/UX07-versioned-scheme-comparison.json`

**Step 1:** Run `npm run typecheck`, the focused deterministic/served comparison proof, `npm test`, `npm run test:ui`, and `npm run test:graph-v2`.

**Step 2:** Prove the candidate diff exactly equals the committed manifest write set, the closure changes only the UX07 manifest, the point-in-time graph-position receipt permits the lateral move, and zero protected paths changed.

**Step 3:** Record receipts and move the manifest to `verification-pending`.

**Step 4:** Obtain one independent verdict. Only PASS may move UX07 to `verified`; any repair is limited to the single declared loop and write set.

# UX04 Command and Measurement Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an active-tool-aware command and measurement bar to the existing Guided Studio project chrome without creating a second editor, parser, history, or mutation path.

**Architecture:** `GuidedStudioShell` renders a compact projection of the current inspector measurement, command discovery, and named history actions. `GraphPlanEditor` remains the owner of exact-value drafts and commits; the bar only moves focus into its existing numeric field, so pointer, keyboard, panel, and bar-assisted edits share the same validation and `moveGraphVertex` path. The existing deterministic phrase parser and Ctrl+K dialog remain the only command execution path.

**Tech Stack:** Next.js, React, TypeScript, Playwright, the existing `BuilderDocument` reducer/history, `StudioInspectorState`, `GraphPlanEditor`, and Graph v2 freeze/write-set gates.

---

### Task 1: Bind the UX04 execution node

**Files:**
- Create: `docs/plans/execution/v2/UX04-command-measurement-bar.json`

**Step 1:** Declare dependency `UX03:verified`, exact source/test write ownership, no external gates, and the frozen-path rejection rules.

**Step 2:** Run `npm run test:graph-v2` and verify the committed ready manifest is valid before production work begins.

**Step 3:** Commit the ready manifest.

### Task 2: Specify the bar as a pure projection

**Files:**
- Modify: `app/lib/builder/guidedStudio.ts`
- Test: `app/tests/builder-plans-first.spec.ts`

**Step 1:** Write failing deterministic tests for empty/tool, editable measurement, invalid raw value, and human-readable undo/redo descriptions.

**Step 2:** Run the focused deterministic file and confirm the tests fail because the UX04 projection does not exist.

**Step 3:** Add the smallest pure projection that derives labels, units, invalid feedback, and history descriptions from existing inspector/history state. It must not own geometry or call a mutator.

**Step 4:** Rerun the focused deterministic tests and commit the green contract.

### Task 3: Add focus, cancel, and compact chrome

**Files:**
- Modify: `app/components/builder/GraphPlanEditor.tsx`
- Modify: `app/components/builder/GuidedStudioShell.tsx`
- Modify: `app/components/builder/BuilderApp.tsx`
- Test: `app/tests/builder-plans-first.spec.ts`

**Step 1:** Write a served failing test that selects a wall, invokes the measurement affordance from the compact project bar, reaches the existing exact-length field, submits a measured edit, sees named undo, cancels an invalid draft with Escape, and keeps the document unchanged on cancellation.

**Step 2:** Run the served test against a fresh export and verify the missing affordance is the failure.

**Step 3:** Add a bounded focus request to the existing primary exact field, Escape-to-canonical reset, the compact measurement projection, Ctrl+K discovery, and accessible named undo/redo. Do not add a second numeric input, phrase parser, reducer, or history stack.

**Step 4:** Rerun the served test, focused deterministic tests, and typecheck; commit the green implementation.

### Task 4: Reconcile declared gate receipts

**Files:**
- Modify: `app/tests/gate-coverage.spec.ts`
- Modify: `README.md`
- Modify: `docs/SUBMISSION.md`

**Step 1:** Run the counter test and observe the exact declaration delta caused by the new served regression.

**Step 2:** Update only the measured declaration/pass/skip receipts and rerun the counter test.

**Step 3:** Commit the reconciled truth surfaces.

### Task 5: Verify and close UX04

**Files:**
- Modify: `docs/plans/execution/v2/UX04-command-measurement-bar.json`

**Step 1:** Run `npm run typecheck`, `npm test`, `npm run test:ui`, the focused Guided Studio served tests, and `npm run test:graph-v2`.

**Step 2:** Prove the candidate diff exactly equals the committed manifest write set, the closure changes only the UX04 manifest, the point-in-time graph-position receipt passes, and zero protected paths changed.

**Step 3:** Record receipts and move the manifest to `verification-pending`.

**Step 4:** Obtain a one-time independent verdict. Only a PASS may move UX04 to `verified`; the single repair loop is otherwise bounded to UX04's declared write set.


# UX08 Accessible Device Contract Implementation Plan

> **For the implementing agent:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task.

**Goal:** Make Aura's approved desktop/tablet/phone editor contract visible, honest, and testable while giving phone users a real canonical review-note path and preserving keyboard, exact-value, target-size, focus, status, and reflow guarantees.

**Authority:** Founder-approved Aura Full-System Operating Graph v2.0, proposal `f7616886f9f8a171c847ef5eb49e932246ff989b`, approval `e031a83b8d9dcd428ffaab46d83b39370f2962a0`, and approved Canvas-first Guided Studio design `docs/plans/2026-08-24-canvas-first-guided-studio-design.md`.

**Architecture:** Keep `BuilderDocument`, `HomeSpec`, the existing reducer/history, and the current exact-value and keyboard mutation paths as the only editor model. Project a device-specific capability statement from `app/lib/builder/guidedStudio.ts` into the controlled Guided Studio shell. Reuse `HomeSpec.notes` and `BuilderApp`'s existing `edit` callback for review comments so typing a note creates a normal hashable, undoable project revision. Add only builder-scoped CSS. Do not change any 3D, renderer, animation, engine, scene, model, texture, shader, camera, lighting, motion, quality-tier, or public-site design surface.

**Standards:** WCAG 2.2 2.4.11 Focus Not Obscured (Minimum), 2.5.7 Dragging Movements, and 2.5.8 Target Size (Minimum), plus WCAG 2.1 1.4.10 Reflow at 320 CSS pixels. The plan treats a scaled drawing as an allowed two-dimensional exception only inside its own bounded panning frame; the page itself may not scroll sideways.

---

## Task 1: Commit the UX08 execution boundary

**Files:**
- Create: `docs/plans/execution/v2/UX08-accessible-device-contract.json`
- Use: `docs/plans/2026-08-29-ux08-accessible-device-contract-plan.md`

**Step 1: Commit this implementation plan**

```powershell
git add docs/plans/2026-08-29-ux08-accessible-device-contract-plan.md
git commit -m "docs: plan UX08 accessible device contract"
```

**Step 2: Write the ready ExecutionNode manifest**

Declare verified dependencies `UX02`, `UX04`, and `UX05`, no external gates, one repair maximum, and this exact write set:

```json
[
  "docs/plans/execution/v2/UX08-accessible-device-contract.json",
  "docs/plans/2026-08-29-ux08-accessible-device-contract-plan.md",
  "app/lib/builder/guidedStudio.ts",
  "app/components/builder/GuidedStudioShell.tsx",
  "app/components/builder/BuilderApp.tsx",
  "app/app/globals.css",
  "app/tests/builder-plans-first.spec.ts",
  "app/tests/builder-mobile.spec.ts",
  "app/tests/gate-coverage.spec.ts",
  "README.md",
  "docs/SUBMISSION.md"
]
```

Reject any second project/comment/history model, hidden full-CAD phone claim, page-level 320/390 px overflow, drag-only edit, obscured focus, sub-24px core target, color-only state, evidence/claim promotion, protected-path change, or undeclared write.

Reference the exact plan commit produced in Step 1.

**Step 3: Run the authority gate**

Run: `npm --prefix app run test:graph-v2`

Expected: Graph v2 authority passes and UX08 is valid at `status: ready`.

**Step 4: Commit the ready manifest**

```powershell
git add docs/plans/execution/v2/UX08-accessible-device-contract.json
git commit -m "docs(graph): ready UX08 accessible device contract"
```

## Task 2: Run the point-in-time preflight and activate UX08

**Files:**
- Modify: `docs/plans/execution/v2/UX08-accessible-device-contract.json`

**Step 1: Invoke G05 explicitly**

Use the ready-manifest commit as both `--base` and `--candidate`, pass evidence entries for the three verified dependencies, authority, clean worktree, declared write set, no external gates, and zero protected paths, and request `remain` during preflight.

Run from `app/`:

```powershell
node scripts/graph-position-check.mjs --phase preflight --node UX08 --base <ready-commit> --candidate <ready-commit> --evidence-json '<evidence-json>' --movement remain
```

Expected: `verdict: pass`, dependency/write/worktree/evidence/decision-history checks pass, `movement.allowed: true`, and independent verification remains required.

**Step 2: Record the receipt and activate**

Set `status` to `active`, record the exact ready commit and G05 receipt, and commit only the manifest.

```powershell
git add docs/plans/execution/v2/UX08-accessible-device-contract.json
git commit -m "docs(graph): activate UX08 accessible device contract"
```

## Task 3: Specify the device language and canonical note path test-first

**Files:**
- Modify: `app/tests/builder-plans-first.spec.ts`
- Modify: `app/lib/builder/guidedStudio.ts`

**Step 1: Write failing deterministic tests**

Add assertions for a wished-for `deviceCapabilityMessage(device)` projection:

```ts
expect(deviceCapabilityMessage("phone")).toEqual({
  heading: "Phone review workspace",
  summary: "Review, measure, comment, and make light corrections here.",
  limitation: "Use a tablet or desktop for full layout authoring.",
});
expect(deviceCapabilityMessage("desktop").limitation).toBeNull();
```

Also require the returned action language to derive from `deviceCapabilities` and contain no claim that phone has full CAD parity.

**Step 2: Run RED**

Run: `npx playwright test tests/builder-plans-first.spec.ts --grep "device capability"`

Expected: FAIL because the projection does not exist.

**Step 3: Implement the smallest pure projection**

Add an immutable `StudioDeviceCapabilityMessage` and `deviceCapabilityMessage`. It owns copy only, calls `deviceCapabilities`, and never owns viewport state, project state, or editor behavior.

**Step 4: Run GREEN**

Run: `npx playwright test tests/builder-plans-first.spec.ts --grep "device capability"`

Expected: PASS.

## Task 4: Surface the phone contract and real review notes

**Files:**
- Modify: `app/components/builder/GuidedStudioShell.tsx`
- Modify: `app/components/builder/BuilderApp.tsx`
- Modify: `app/app/globals.css`
- Modify: `app/tests/builder-mobile.spec.ts`

**Step 1: Write the served browser tests before production code**

Add phone tests that require:

1. At 320 × 800 and 390 × 844, `html`, the builder page, shell, project bar, and review-note surface do not create page-level horizontal overflow.
2. A visible `Phone review workspace` status states the supported actions in words and explicitly sends full layout authoring to tablet/desktop.
3. The Guided `Review` step exposes a labeled review-note textarea backed by the current project.
4. Typing a note changes `data-active-design-hash`; one Undo restores the prior note and exact prior hash.
5. Keyboard-only movement through the existing exact width field changes the same canonical hash and one Undo restores it, proving a non-drag alternative.
6. Every visible interactive target inside Project controls is at least 24 × 24 CSS pixels or is a native inline-text exception with sufficient spacing.
7. Keyboard focus on the review note is visibly styled and its bounding rectangle is not covered by sticky author content.
8. Current step, read-only state, input errors, and phone scope remain stated with text/ARIA rather than color alone.

**Step 2: Run RED**

Run against a served export:

```powershell
npx playwright test tests/builder-mobile.spec.ts --config=playwright.r0.config.ts --grep "UX08"
```

Expected: the visible phone-scope and review-note cases fail while the pre-existing no-overflow and keyboard controls remain green.

**Step 3: Add controlled shell props**

Add `reviewNote` and `onReviewNote` to `GuidedStudioShell`. Render:

- a phone-only status derived from `deviceCapabilityMessage("phone")`; and
- a Guided Review note form only while `activeStepId === "review"` and the read-only drawings route is closed.

The shell remains controlled and owns no document, persistence, viewport, or history state.

**Step 4: Connect the existing canonical edit path**

From `BuilderApp`, pass `spec.notes` and:

```ts
(notes) => edit({ ...spec, notes: notes.slice(0, 500) }, "home:notes")
```

This must be the same `HomeSpec.notes` already rendered by `SpecPanel`; do not add a comment collection, local shell state, or second save path.

**Step 5: Add builder-scoped responsive/focus styles**

Add only `.builder-*` / `.guided-*` selectors. The phone contract is hidden above the phone breakpoint and visible below it. The review textarea has a minimum target area, clear focus-visible ring, wrapping copy, and `min-width: 0`. Preserve the drawing's bounded internal pan exception and do not edit any `.story-*`, scene, renderer, or global visual token.

**Step 6: Run GREEN**

Run:

```powershell
npx playwright test tests/builder-mobile.spec.ts --config=playwright.r0.config.ts --grep "UX08"
npx playwright test tests/builder-plans-first.spec.ts
npm run typecheck
```

Expected: all focused cases pass.

## Task 5: Wire count evidence and run complete gates

**Files:**
- Modify: `app/tests/gate-coverage.spec.ts`
- Modify: `README.md`
- Modify: `docs/SUBMISSION.md`

**Step 1: Update the observed gate counts only after runner output**

Run the complete deterministic and served suites, capture their declared/passed/skipped totals, then update the hard gate counts and matching README/submission evidence. Never predict counts before the runner reports them.

Run:

```powershell
npm test
npm run test:ui
```

Expected: deterministic suite has zero failures with only documented served-only skips; UI suite has zero failures against a fresh export.

**Step 2: Update evidence documents and rerun the counter guard**

Update `UNIT_TESTS`, `UI_TESTS`, their explanatory comments, the README badge/evidence rows, and submission evidence rows to the observed totals.

Run:

```powershell
npx playwright test tests/gate-coverage.spec.ts
npm run test:graph-v2
git diff --check
```

Expected: counts, authority, write-set policy, and whitespace all pass.

## Task 6: Commit, reconcile, close, and independently verify UX08

**Files:**
- Modify: `docs/plans/execution/v2/UX08-accessible-device-contract.json`

**Step 1: Commit the implementation candidate**

Verify `git diff --name-only <activation>...HEAD` is exactly the declared non-manifest implementation/evidence paths and contains zero protected paths.

```powershell
git add app/lib/builder/guidedStudio.ts app/components/builder/GuidedStudioShell.tsx app/components/builder/BuilderApp.tsx app/app/globals.css app/tests/builder-plans-first.spec.ts app/tests/builder-mobile.spec.ts app/tests/gate-coverage.spec.ts README.md docs/SUBMISSION.md
git commit -m "feat(builder): add accessible device contract"
```

**Step 2: Invoke G05 at integration**

Use the ready commit as base, implementation commit as candidate, all fresh gate receipts as evidence, and `movement: remain`.

Expected: exact declared writes, protected-path policy, clean worktree, dependencies, evidence, and complete decision history pass.

**Step 3: Close the node**

Set UX08 to `verification-pending`, record immutable receipts and candidate lineage, then commit only the manifest.

```powershell
git add docs/plans/execution/v2/UX08-accessible-device-contract.json
git commit -m "docs(graph): close UX08 for verification"
```

**Step 4: One-shot independent verification**

The verifier works read-only and probes authority, exact write set, dependencies, freeze, 320/390 reflow, visible phone-scope truth, canonical note hash/undo, exact-value keyboard alternative, targets, focus, non-color status, and fresh full gates. On PASS, record the verdict and set `verified`. On FAIL, use at most one bounded repair inside the declared write set; after an exhausted repair, mark the node blocked and move laterally.

## Stop conditions

- Any frozen/public-site/3D/rendering/animation/engine path enters the diff.
- Any comment, device, or shell state becomes a second project/history/persistence model.
- Phone copy implies full CAD parity or a capability the served test cannot perform.
- A drag operation lacks an explicit-value or single-pointer alternative.
- Page-level horizontal scrolling appears at 320 or 390 CSS pixels.
- Focus is hidden/obscured, a core target falls below the declared minimum without a valid exception, or state becomes color-only.
- A warning or claim state advances without evidence.
- A deployment, provider, payment, legal, professional, property, or mainnet action is reached.

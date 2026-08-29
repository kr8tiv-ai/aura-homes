# HM02 Community and Treasury Dashboard Implementation Plan

> **For the implementing agent:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task and `superpowers:test-driven-development` for every behavior change.

**Goal:** Add a deterministic, receipt-backed HOMES community and treasury dashboard projection that separates gross fees, provider cost, Aura share, claimed amounts, treasury transfers, balances, and use-of-funds categories while making missing evidence impossible to mistake for a verified zero.

**Authority:** Founder-approved Aura Full-System Operating Graph v2.0, proposal `f7616886f9f8a171c847ef5eb49e932246ff989b`, approval `e031a83b8d9dcd428ffaab46d83b39370f2962a0`, and independently verified `HM01` HOMES truth registry.

**Architecture:** Create `app/lib/homes/communityDashboard.ts` as a pure accounting projection. It consumes a strict, hostile-safe evidence bundle containing fee rows, fee claims, treasury transfers, use-of-funds rows, and independently reported balances. Every monetary value is a canonical non-negative integer USD-micros string and every non-zero event carries a bounded source receipt. The projection validates chronology, identities, exact keys, unique receipts, and conservation rules; then returns detached, deeply frozen totals, category summaries, activity rows, balance reconciliations, and explicit missing-data states. The current exported dashboard uses an empty evidence bundle and the verified HM01 registry, so unknown claim receipts and treasury identity render as missing rather than fabricated zeroes.

**Compatibility boundary:** HM02 performs structural validation and arithmetic reconciliation only. A receipt URI or transaction hash is evidence provenance, not proof of authenticity, legal authority, custody, ownership, return rights, or fund status. The module performs no network, provider, wallet, claim, transfer, payment, persistence, legal, property, public-page, visual-design, 3D, rendering, or animation action.

---

## Task 1: Commit the plan and ready execution boundary

**Files:**
- Create: `docs/plans/2026-08-29-hm02-community-treasury-dashboard-plan.md`
- Create: `docs/plans/execution/v2/HM02-community-treasury-dashboard.json`

**Step 1: Commit this plan alone**

```powershell
git add docs/plans/2026-08-29-hm02-community-treasury-dashboard-plan.md
git commit -m "docs: plan HM02 community treasury dashboard"
```

**Step 2: Write the ready `ExecutionNode` manifest**

Declare `HM01:verified`, no external gate, no side effects, one repair maximum, and this exact disjoint write set:

```json
[
  "docs/plans/2026-08-29-hm02-community-treasury-dashboard-plan.md",
  "docs/plans/execution/v2/HM02-community-treasury-dashboard.json",
  "app/lib/homes/communityDashboard.ts",
  "app/tests-hm02/community-dashboard.contract.ts",
  "app/playwright.hm02.config.ts"
]
```

Reject undeclared writes, an unverified HM01 dependency, public-page or visual changes, evidence-free money, false verified-zero states, mixed gross/provider/Aura/treasury amounts, negative or non-integer money, broken conservation, duplicate receipts, unsafe identifiers, raw hostile-input errors, legal/fund/property/return claims, runtime external actions, or any frozen 3D/rendering/animation/engine path.

**Step 3: Run authority and ownership checks**

Run:

```powershell
npm --prefix app run test:graph-v2
git status --short
```

Expected: Graph v2 authority passes; HM01 is committed `verified`; UX08 and IP03 may remain verification-pending because their live write sets do not overlap HM02; no other live manifest owns an HM02 path.

**Step 4: Commit the ready manifest**

```powershell
git add docs/plans/execution/v2/HM02-community-treasury-dashboard.json
git commit -m "docs(graph): ready HM02 community treasury dashboard"
```

## Task 2: Reconcile and activate HM02

**Files:**
- Modify: `docs/plans/execution/v2/HM02-community-treasury-dashboard.json`

**Step 1: Reconcile committed readiness**

Confirm Graph v2 authority, committed HM01 verification, clean worktree, empty external gates, zero protected paths, and no live write-owner overlap.

**Step 2: Activate with an immutable receipt**

Set the manifest to `active`; record the exact plan and ready-manifest commits, dependency receipt, ownership result, and existing-surface audit; then commit only the manifest.

```powershell
git add docs/plans/execution/v2/HM02-community-treasury-dashboard.json
git commit -m "docs(graph): activate HM02 community treasury dashboard"
```

## Task 3: Specify the dashboard contract test-first

**Files:**
- Create: `app/tests-hm02/community-dashboard.contract.ts`
- Create: `app/playwright.hm02.config.ts`
- Create: `app/lib/homes/communityDashboard.ts`

**Step 1: Write failing contract tests**

Cover these surfaces before production code exists:

1. The current dashboard binds to the exact verified HM01 registry version and reports unknown fee-claim receipts and treasury identity as missing, never as verified zero.
2. A structurally valid fixture keeps gross fees, provider cost, Aura share, fee claims, treasury transfers, reported balances, and use-of-funds amounts in separate named fields.
3. Fee rows reconcile `gross = provider + Aura`; claims cannot exceed accrued Aura share; transfers cannot exceed claimed Aura funds; spending cannot exceed treasury inflows.
4. Reported Aura and treasury balances reconcile exactly to event-derived balances; absent balance evidence remains visibly missing.
5. Every non-zero fee, claim, transfer, spend, or balance row carries bounded receipt provenance; duplicate event or receipt identities fail closed.
6. Use-of-funds accepts only the published HM02 categories and returns stable per-category totals, including explicit zero categories without claiming that a zero was independently verified.
7. Money is a canonical non-negative integer USD-micros string; signs, decimals, exponents, whitespace, unsafe magnitude, and negative values fail.
8. Dates, identifiers, addresses, transaction hashes, source URIs, rule versions, and category names are bounded and exact-key validated.
9. Unknown keys, accessors, custom prototypes, cycles, symbols, sparse arrays, throwing getters, and revoked proxies fail through one bounded safe error without leaking private text.
10. Caller inputs cannot mutate the returned activity, totals, categories, receipts, reconciliation, or missing-data arrays; the result is deeply frozen and deterministic.
11. The module contains no network, provider SDK, secret, wallet, claim, transfer, payment, persistence, property, legal activation, React, CSS, public-page, geometry, 3D, renderer, or animation dependency.

**Step 2: Prove RED**

Run:

```powershell
npx playwright test --config=playwright.hm02.config.ts
```

Expected: FAIL because `communityDashboard.ts` does not exist.

**Step 3: Define the smallest public types**

Expose only:

- `HOMES_COMMUNITY_DASHBOARD_VERSION`;
- the bounded evidence-bundle and dashboard result types;
- `HomesDashboardError` with a bounded `invalid-evidence` code;
- `buildHomesCommunityDashboard(evidence: unknown)`;
- `currentHomesCommunityDashboard()`.

Do not add a data fetcher, indexer, RPC client, wallet, transaction builder, claim path, treasury action, persistence adapter, React component, route, style, or public-page change.

## Task 4: Implement hostile-safe evidence validation and reconciliation

**Files:**
- Modify: `app/lib/homes/communityDashboard.ts`
- Modify: `app/tests-hm02/community-dashboard.contract.ts`

**Step 1: Copy untrusted evidence through a safe data-property boundary**

Recursively inspect only own enumerable data descriptors. Reject accessors, proxies that throw, custom prototypes, cycles, sparse arrays, symbols, non-JSON metadata, unknown keys, and over-bounded structures before business validation.

**Step 2: Validate exact evidence rows**

Validate bundle identity and chronology, canonical USD-micros strings, bounded identifiers, explicit receipt provenance, and exact schemas for fees, claims, transfers, use-of-funds, and reported balances. Preserve honest evidence classification: attached receipts are structurally present but are not authenticated by HM02.

**Step 3: Reconcile the complete money path**

Derive gross/provider/Aura totals, unclaimed Aura share, claimed Aura balance, transferred treasury inflow, treasury spend, expected balances, reported-balance deltas, and stable use-of-funds totals. Fail on any over-claim, over-transfer, over-spend, broken split, conflicting balance, duplicate identity, or receipt reuse.

**Step 4: Build explicit missing-data states**

Use the HM01 registry to expose unknown `fees.claimReceipts` and `treasury.address` facts. Add missing states for absent fee sources, claims, balances, transfers, and spend evidence without rewriting absence as a verified monetary zero.

**Step 5: Detach and freeze**

Return a newly allocated canonical result with no input aliases, stable ordering, and recursive freezing. Normalize all failures to the bounded public error without preserving raw thrown objects, messages, stacks, causes, URLs, or private values.

**Step 6: Run GREEN and typecheck**

```powershell
npx playwright test --config=playwright.hm02.config.ts
npm run typecheck
```

Expected: every HM02 contract test passes and TypeScript remains clean.

## Task 5: Verify without crossing live write ownership

The HM02 proof lives outside `app/tests/*.spec.ts` behind `app/playwright.hm02.config.ts`. This avoids modifying shared package, count, README, submission, or gate-coverage surfaces still owned by verification-pending UX08.

Run:

```powershell
npx playwright test --config=playwright.hm02.config.ts
npm test
npm run test:graph-v2
npm run test:graph-position
git diff --check
```

Expected: focused proof, unchanged deterministic suite, graph authority, graph-position contracts, and whitespace all pass. No served UI suite is required because HM02 changes no browser surface.

## Task 6: Commit, preflight, close, and independently verify HM02

**Step 1: Commit the implementation candidate**

Confirm the complete node-base-to-candidate diff is exactly the declared five paths and contains no protected path.

```powershell
git add app/lib/homes/communityDashboard.ts app/tests-hm02/community-dashboard.contract.ts app/playwright.hm02.config.ts docs/plans/2026-08-29-hm02-community-treasury-dashboard-plan.md
git commit -m "feat(homes): add community treasury dashboard contract"
```

**Step 2: Invoke G05 preflight**

Use the pre-plan node base, completed implementation candidate, every manifest verification command as fresh evidence, and request `movement: remain`.

**Step 3: Close the node**

Set HM02 to `verification-pending`, record immutable lineage, exact write-set and gate receipts, then commit only the manifest.

```powershell
git add docs/plans/execution/v2/HM02-community-treasury-dashboard.json
git commit -m "docs(graph): close HM02 for verification"
```

**Step 4: Require independent fresh-context verification**

The verifier works read-only and probes authority, HM01 lineage, exact writes, freeze compliance, missing-state honesty, receipt and amount isolation, all conservation rules, hostile input, deterministic deep freeze, no side effects, and every declared gate. On PASS, record the verdict and set `verified`. On FAIL, use at most one bounded repair inside the declared write set; after repair is exhausted, mark HM02 blocked and move laterally.

## Stop conditions

- HM01 loses independently verified status.
- Any live manifest overlaps the HM02 write set.
- Any undeclared, public-page, CSS, design, 3D, rendering, animation, engine, scene, model, texture, shader, camera, lighting, motion, or quality-tier path enters the diff.
- Any network, provider, secret, wallet, claim, transfer, payment, persistence, custody, legal activation, property action, or external side effect enters HM02.
- Missing evidence renders as verified zero or attached provenance renders as authenticated proof.
- Gross, provider, Aura, treasury, claim, transfer, balance, or use-of-funds amounts are combined or cannot reconcile.
- Raw hostile values, accessors, proxy errors, causes, stacks, URLs, receipt content, or private details escape the error boundary.
- A second repair would be required.

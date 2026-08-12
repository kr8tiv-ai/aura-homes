# Aura Homes Submission READMEs Implementation Plan

> Implementation record: execute task-by-task and verify every published claim before release.

**Goal:** Publish one visually strong, evidence-backed BuildX submission README and one concise portfolio README without creating competing technical truth.

**Architecture:** The `kr8tiv-ai` repository remains canonical. Its README is organized for a cold hackathon judge and derives every status claim from current product behavior, tests, or X Layer read-back. The `kr8tiv-io` README becomes a visual synopsis and points to the canonical proof.

**Tech Stack:** GitHub-flavored Markdown, Mermaid, existing Aura raster assets, X Layer JSON-RPC evidence, Next.js/Playwright/Hardhat verification.

---

### Task 1: Verify the proof surface

**Files:**
- Modify: `docs/DEPLOYMENTS.md`
- Modify: `contracts/README.md`

1. Read current application and contract network configuration.
2. Read bytecode and public getters for the configured escrow, registry, and USDC contracts from X Layer testnet.
3. Run the Hardhat suite.
4. Replace retired testnet token/address prose with the verified current deployment while preserving the legacy deployment record.
5. Confirm every linked explorer address matches executable configuration.

### Task 2: Rewrite the canonical submission README

**Files:**
- Modify: `README.md`
- Reuse: `app/public/social/aura-homes-social-v2.jpg`
- Reuse: `assets/pipeline.png`
- Reuse: `assets/budget-bands.png`
- Reuse: `assets/escrow-flow.png`

1. Replace the old crypto-first hero with the approved all-in-one unique-stay promise.
2. Add the 60-second judge path.
3. Add the three customer journeys and status matrix.
4. Explain the durable project/editor/marketplace/AI architecture.
5. Publish the current X Layer testnet proof.
6. Explain HOMES and the owner launchpad as planned concepts with verified zero state.
7. Add verification commands, project setup, documentation index, and claim boundaries.
8. Check every internal and external link.

### Task 3: Refresh the portfolio synopsis

**Files:**
- Modify: `C:/Users/lucid/Desktop/aurahomes-site/README.md`
- Create: `C:/Users/lucid/Desktop/aurahomes-site/assets/aura-homes-social-v2.jpg`

1. Confirm the portfolio worktree is clean or preserve unrelated changes.
2. Copy the approved Aura social artwork.
3. Rewrite the README as a short visual case study.
4. Link every technical proof claim to the canonical submission repository.
5. Keep its setup instructions scoped to the portfolio repository.

### Task 4: Cold-read and verify

**Files:**
- Verify: `README.md`
- Verify: `C:/Users/lucid/Desktop/aurahomes-site/README.md`

1. Read both documents top to bottom as a first-time judge.
2. Answer the six reader-test questions in the design record.
3. Remove repeated manifesto copy and unsupported claims.
4. Verify Markdown image/link targets and GitHub rendering-safe Mermaid syntax.
5. Re-run TypeScript, application tests, UI tests, Hardhat tests, and the production build.

### Task 5: Back up and publish

**Files:**
- Archive current source/deployment refs and production output before mutation.
- Commit only as `Matt-Aurora-Ventures <lucidbloks@gmail.com>`.

1. Record remote `main` and `gh-pages` commit IDs, GitHub Pages settings, DNS answers, live response headers, and production static output.
2. Create timestamped backup refs/archives without changing production.
3. Commit verified vertical slices.
4. Reconcile with remote `main`, push source, generate the `GH_PAGES=1` export, preserve `CNAME` and `.nojekyll`, and update `gh-pages`.
5. Smoke-test the live routes, social image, mobile landing, project intake, builder, and HOMES zero-state ledger.
6. Commit and push the portfolio README separately in its own repository.

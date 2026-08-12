# Plain-language Aura Journeys Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace internal architecture language with the approved eco-property and blockchain journeys, remove customer-facing escrow positioning, and make card/Stripe and X Layer USDC equal future payment paths.

**Architecture:** Keep the existing dual-audience story components and shared 3D scene. Change their copy contracts and public route information architecture rather than duplicating pages. Preserve testnet contract code, but remove its route from customer navigation and stop presenting escrow as a core stage.

**Tech Stack:** Next.js 14, React 18, TypeScript, Playwright, static GitHub Pages export.

---

### Task 1: Lock the entrance language

**Files:**
- Modify: `app/tests/visual-system-ui.spec.ts`
- Modify: `app/components/story/StoryChrome.tsx`
- Modify: `app/components/story/copy.ts`

**Step 1:** Update the landing UI test to expect the approved kicker, headline, introduction and two equal card labels.

**Step 2:** Run `npm run test:ui -- --grep "landing offers"` from `app`; expect failure on the old copy.

**Step 3:** Replace the entrance and hero copy. Remove the persona-selection explainer while retaining the independent sound control.

**Step 4:** Run the focused test; expect pass.

### Task 2: Replace escrow with payments in the story

**Files:**
- Modify: `app/components/story/copy.ts`
- Modify: `app/components/story/Story.tsx`
- Modify: `app/tests/visual-system-ui.spec.ts`

**Step 1:** Add assertions that the public story says `Payments`, mentions card and X Layer USDC, and does not show an Escrow story stage.

**Step 2:** Run the focused test; expect failure.

**Step 3:** Replace the escrow beats and specialist proof language with provider-aware payment copy. Keep links to official OKX/X Layer information in the blockchain journey.

**Step 4:** Run the focused test; expect pass.

### Task 3: Remove escrow from public information architecture

**Files:**
- Modify: `app/components/SiteShell.tsx`
- Modify: `app/app/overview/page.tsx`
- Modify: `app/app/faq/page.tsx`
- Modify: `app/app/layout.tsx`
- Modify: `app/components/SocialShareLinks.tsx`
- Modify: `app/scripts/build-social-card.mjs`
- Modify: `app/tests/visual-system-ui.spec.ts`

**Step 1:** Add assertions for the new metadata headline and the absence of Escrow in public navigation.

**Step 2:** Run the focused tests; expect failure.

**Step 3:** Update metadata, social copy, overview and FAQ. Remove the `/escrow` link from public navigation without deleting the isolated demo route or contracts.

**Step 4:** Regenerate the social card with `npm run social:card`.

**Step 5:** Run TypeScript and focused UI tests; expect pass.

### Task 4: Verify and commit the slice

**Files:**
- Verify all modified source and test files.

**Step 1:** Run `npx tsc --noEmit`.

**Step 2:** Run `npm test`.

**Step 3:** Run the landing, mobile and navigation UI tests against the static production export.

**Step 4:** Inspect desktop and mobile screenshots for hierarchy, card parity, wrapping and overflow.

**Step 5:** Commit only as `Matt-Aurora-Ventures <lucidbloks@gmail.com>` with no co-author attribution.


import { expect, test } from "playwright/test";

/* Renegotiated Aug 13, 2026: the founder launched HOMES on XLaunch (X Layer
   mainnet 196). The status aside flips to live WITH receipts; every other
   ledger value stays a declared zero until its own receipt exists. */
test("HOMES dashboard shows the live token with receipts and declared zeros everywhere else", async ({ page }) => {
  await page.goto("/homes");
  await expect(page.getByRole("heading", { name: "HOMES on X Layer" })).toBeVisible();
  await expect(page.getByText("Live · X Layer mainnet 196", { exact: true })).toBeVisible();
  await expect(page.getByText("$0.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Property fund", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("60%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Token supply · 100%", { exact: true })).toBeVisible();
  await expect(page.getByText("Public market", { exact: true })).toBeVisible();
  await expect(page.getByText("Burn reserve", { exact: true })).toBeVisible();
  await expect(page.getByText("Top 200 · snapshot block not set", { exact: true })).toBeVisible();
  await expect(page.getByText("OpenRouter", { exact: false })).toBeVisible();
  await expect(page.getByText("$200,000", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the HOMES FAQ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unused purchase funds have a path home." })).toBeVisible();
  await expect(page.getByText("top 50 eligible community holders", { exact: false })).toBeVisible();
});

test("the live token ships its receipts, buy path, and risk labels together", async ({ page }) => {
  await page.goto("/homes");
  // Receipts: the full address is never truncated away from the buyer.
  await expect(page.getByText("0x6428…c0de", { exact: false }).first()).toBeVisible();
  const buyLink = page.getByRole("link", { name: "Buy HOMES on XLaunch ↗" });
  await expect(buyLink).toBeVisible();
  await expect(buyLink).toHaveAttribute(
    "href",
    "https://xlaunch.fun/token/0x642855d557ada1eba8a66014aaff902e6394c0de",
  );
  await expect(page.getByRole("link", { name: "GeckoTerminal pool ↗" })).toBeVisible();
  // The buy guide and its plain risk band are inseparable.
  await expect(page.getByRole("heading", { name: "How to buy HOMES." })).toBeVisible();
  await expect(page.getByText("Read this before buying.", { exact: true })).toBeVisible();
  await expect(page.getByText("tokens like this routinely go to zero", { exact: false })).toBeVisible();
  // What is NOT live keeps saying so, next to the live thing.
  await expect(page.getByText("Property-fund vault", { exact: true })).toBeVisible();
  await expect(page.getByText("Not formed; no legal title held", { exact: true })).toBeVisible();
  await expect(page.getByText("a DEX pool is not an exchange listing", { exact: false })).toBeVisible();
});

/* Renegotiated Aug 12: the founder's two-journey rewrite replaced the old
   "One home can prove a wider model." beat by DESIGN — the eco journey now
   mentions HOMES exactly once, at the very end, as the long-term framing.
   This pins that contract instead of the retired copy. */
test("the eco journey mentions HOMES once, at the end, never as live", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const paths = page.locator(".story-gate-paths");
  await expect(paths).toBeVisible({ timeout: 30_000 });
  await paths.locator("button").first().click();

  // The sentence shares its <p> with the link, so exact-match can never hit;
  // substring + the link's accessible name pin the same contract.
  await expect(
    page.getByText("a user-owned Airbnb for eco stays", { exact: false }).first(),
  ).toBeAttached({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: /Learn about \$HOMES on X Layer/ })).toBeAttached();
});

test("the FAQ explains the HOMES funding and payout proposal", async ({ page }) => {
  await page.goto("/faq#homes-token");
  await expect(page.getByRole("heading", { name: "What is the HOMES token?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How would HOMES payouts work?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What happens if the first-property program does not proceed?" })).toBeVisible();
});

test("the RWA launchpad is clearly a later owner-led rollout", async ({ page }) => {
  await page.goto("/homes#launchpad-heading");
  await expect(page.getByRole("heading", { name: "A launchpad for owner-led eco homes and unique stays." })).toBeVisible();
  await expect(page.getByText("Later rollout · not live", { exact: true })).toBeVisible();
  await expect(page.getByText("it would not silently publish a raise", { exact: false })).toBeVisible();
});

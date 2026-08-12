import { expect, test } from "playwright/test";

test("HOMES dashboard shows verified zeroes, allocation rules, and planned eligibility", async ({ page }) => {
  await page.goto("/homes");
  await expect(page.getByRole("heading", { name: "HOMES on X Layer" })).toBeVisible();
  await expect(page.getByText("Planned · no token contract", { exact: true })).toBeVisible();
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

test("the scroll story includes a later HOMES beat without claiming a live launch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("One home can prove a wider model.", { exact: true })).toBeAttached();
  await expect(
    page.locator('a.story-cta[href="/homes"], a.story-cta[href="/homes/"]', { hasText: "Open the HOMES ledger" }),
  ).toBeAttached();
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

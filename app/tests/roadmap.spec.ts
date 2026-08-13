import { expect, test } from "playwright/test";

/* The roadmap page's contract: three arcs, honest labels, working links —
   and the standing rule sentence itself, because that sentence is the page's
   whole reason to exist. Runs in the UI config (needs the served export). */

test("the roadmap renders three labelled arcs and its links resolve", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { name: "Three arcs, honestly labelled." })).toBeVisible();
  await expect(page.getByText("nothing unbuilt is written in the present tense", { exact: false }).first()).toBeVisible();

  await expect(page.getByRole("heading", { name: "The project workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The locality hub" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The HOMES ecosystem" })).toBeVisible();

  // One chip per arc, in the taught vocabulary.
  await expect(page.getByText("Now", { exact: true })).toBeVisible();
  await expect(page.getByText("Next", { exact: true })).toBeVisible();
  await expect(page.getByText("Future", { exact: true })).toBeVisible();

  // The internal links land on real routes (no redirects, no dead ends).
  await page.getByRole("link", { name: /Read the HOMES ledger/ }).click();
  await expect(page).toHaveURL(/\/homes/);
});

test("the roadmap distinguishes pilots from live services and keeps HOMES structure tentative", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page.getByText("demonstration land-fit pilot", { exact: false })).toBeVisible();
  await expect(page.getByText("evidence-backed, checkable contractor bench", { exact: false })).toBeVisible();

  const copy = await page.locator("main").innerText();
  expect(copy).not.toContain("vetted contractor bench");
  expect(copy).not.toContain("decentralized property trust");
});

test("external financing research is dated, qualified, and linked to official details", async ({ page }) => {
  await page.goto("/how-crypto-works");

  await expect(page.getByRole("heading", { name: "External financing research" })).toBeVisible();
  await expect(page.getByText("Checked August 12, 2026", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the Aave X Layer market" })).toHaveAttribute(
    "href",
    "https://app.aave.com/?marketName=proto_xlayer_v3",
  );
  await expect(page.getByRole("link", { name: "Check Ledn eligibility" })).toHaveAttribute(
    "href",
    "https://help.ledn.io/hc/en-us/p/eligibility",
  );
  await expect(page.getByRole("link", { name: "Read Wealthsimple’s USD and USDC fee details" })).toHaveAttribute(
    "href",
    "https://help.wealthsimple.com/hc/en-ca/articles/39491215024539-Trading-USD-with-your-Crypto-account",
  );

  const copy = await page.locator("main").innerText();
  expect(copy).not.toContain("$85M");
  expect(copy).not.toContain("Borrow USDC against crypto collateral on the same chain");
  expect(copy).not.toContain("disbursed in USDC or CAD");
  expect(copy).not.toContain("0%-fee USDC on-ramp");
});

test("the roadmap is reachable from the More menu", async ({ page }) => {
  await page.goto("/how-it-works");
  await page.getByText("More", { exact: true }).click();
  await page.getByRole("link", { name: "Roadmap" }).click();
  await expect(page).toHaveURL(/\/roadmap/);
  await expect(page.getByRole("heading", { name: "Three arcs, honestly labelled." })).toBeVisible();
});

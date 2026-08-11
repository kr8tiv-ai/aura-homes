import { expect, test } from "playwright/test";

test("land discovery states the feed boundary and never overflows on mobile", async ({ page }) => {
  await page.goto("/land");
  await expect(page.getByRole("heading", { name: "Find land for the home you actually designed" })).toBeVisible();
  await expect(page.getByText("Live MLS not connected")).toBeVisible();
  await expect(page.getByText("Demonstration only · not an active listing")).toHaveCount(4);

  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
});

test("the builder hands exact durable geometry to land matching", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("button", { name: /^Export / }).click();
  await page.getByRole("button", { name: "Find land for this design" }).click();
  await expect(page).toHaveURL(/\/land\?project=project-/);
  await expect(page.getByText(/Builder snapshot 0x/)).toBeVisible();
  await expect(page.getByLabel("Floor area · sqft")).toHaveValue("799");
  await expect(page.getByLabel("Footprint · sqft")).toHaveValue("799");
  await expect(page.getByLabel("Max height · ft")).toHaveValue("21.4");
  await expect(page.getByText("The manual controls remain available; no design was replaced.")).toHaveCount(0);
});

test("contractor evidence filters and legal-name verification stay explicit", async ({ page }) => {
  await page.goto("/contractors");
  await expect(page.getByText("Fictional demonstration · not a referral")).toHaveCount(3);
  await page.getByLabel("Trade").selectOption("off-grid-systems");
  await expect(page.getByText("Fictional demonstration · not a referral")).toHaveCount(1);
  await page.getByLabel("Exact legal name to verify").fill("Example Build Co. Ltd.");
  await expect(page.getByText("Verify “Example Build Co. Ltd.” as an exact legal name")).toBeVisible();
  await expect(page.getByText("Current WCB clearance is not confirmed.")).toHaveCount(0);
  await expect(page.getByText("Active Alberta residential builder licence is not confirmed.")).toBeVisible();
});

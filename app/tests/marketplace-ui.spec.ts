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
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("tab", { name: /^Export / }).click();
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
  await expect(page.getByRole("heading", { name: "No contractor case files yet." })).toBeVisible();
  await page.getByRole("button", { name: "Open demonstration profiles" }).click();
  await expect(page.getByText("Fictional demonstration · not a referral")).toHaveCount(3);
  await page.getByLabel("Trade").selectOption("off-grid-systems");
  await expect(page.getByText("Fictional demonstration · not a referral")).toHaveCount(1);
  await page.getByLabel("Exact legal name to verify").fill("Example Build Co. Ltd.");
  await expect(page.getByText("Verify “Example Build Co. Ltd.” as an exact legal name")).toBeVisible();
  await expect(page.getByText("Current WCB clearance is not confirmed.")).toHaveCount(0);
  await expect(page.getByText("Active Alberta residential builder licence is not confirmed.")).toBeVisible();
});

test("project land and contractor choices become a hash-bound RFQ", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Project name").fill("RFQ field house");
  await page.getByRole("button", { name: "Create my project" }).click();
  await page.goto("/land");
  await expect(page.getByLabel("Map of demonstration parcel fit results")).toBeVisible();
  await page.getByRole("button", { name: "Save demo comparison" }).first().click();
  await expect(page.getByRole("button", { name: "Saved to project" })).toBeVisible();

  await page.goto("/contractors");
  await page.getByRole("button", { name: "+ Add contractor" }).click();
  await page.getByLabel("Exact legal name", { exact: true }).fill("Prairie Field Build Ltd.");
  await page.getByLabel("Service region").fill("Foothills County");
  await page.getByLabel("Exact legal name appears in the Alberta builder registry").check();
  await page.getByLabel("Current WCB clearance recorded").check();
  await page.getByLabel("Liability insurance certificate recorded").check();
  await page.getByLabel("Comparable projects and references recorded").check();
  await page.getByRole("button", { name: "Save case file" }).click();
  await expect(page.getByText("User-supplied project case file")).toBeVisible();
  await page.getByRole("button", { name: "Add to project shortlist" }).click();
  await expect(page.getByRole("button", { name: "Saved to project shortlist" })).toBeVisible();

  await page.getByLabel("Scope").selectOption("shell-envelope");
  await page.getByRole("button", { name: "Prepare RFQ package" }).click();
  await expect(page.locator(".rfq-card").getByText("Shell + envelope", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON package" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Download JSON package" })).toBeVisible();
});

test("the global buy guide filters evidence and blocks an unconnected ChangeNOW path", async ({ page }) => {
  await page.goto("/buy");
  await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("europe");
  await page.getByRole("combobox", { name: "What you want to buy", exact: true }).selectOption("existing-property");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Crypto Emporium", exact: true })).toBeVisible();
  await expect(page.getByText("ChangeNOW partner path")).toBeVisible();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(page.getByText("0xB6CEceAB302E2E4948951eE7843FC24E92933061")).toBeVisible();
  await expect(page.getByText("The conversion quote is missing or expired.")).toBeVisible();
  await expect(page.getByRole("button", { name: /send|swap|pay/i })).toHaveCount(0);
  await page.getByRole("link", { name: "Walk through with Aura" }).click();
  await expect(page).toHaveURL(/\/concierge\/?\?ask=/);
  await expect(page.getByText(/For a third-party manufacturer purchase, I guide rather than transact/)).toBeVisible();
});

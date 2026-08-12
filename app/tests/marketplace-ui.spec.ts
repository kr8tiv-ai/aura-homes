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

test("the buy catalog renders the honest card hierarchy with no ranking and no routing detail", async ({ page }) => {
  await page.goto("/buy");
  await expect(page.getByRole("heading", { name: "Choose a finished eco home" })).toBeVisible();
  await expect(page.locator("[data-slot='home-identity']")).toHaveCount(3);
  await expect(page.getByText("Reliable pricing not found — request a quote.")).toHaveCount(3);
  await expect(page.getByText("Aura illustrative visual — not a product photo")).toHaveCount(3);
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(/readiness|\/100|purchase evidence|ChangeNOW/i);

  await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("japan");
  await expect(page.locator("[data-slot='home-identity']")).toHaveCount(1);
  await expect(page.getByText("Lib Earth House model B")).toBeVisible();
  await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("any");

  // compare fills to its cap of three
  await page.getByRole("button", { name: "Compare", exact: true }).first().click();
  await page.getByRole("button", { name: "Compare", exact: true }).first().click();
  await page.getByRole("button", { name: "Compare", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "3 of 3 homes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear comparison" }).click();
  await expect(page.getByRole("heading", { name: "3 of 3 homes" })).toHaveCount(0);

  // the "published price" filter has nothing to show, and says so honestly
  await page.getByRole("combobox", { name: "Price", exact: true }).selectOption("published");
  await expect(page.getByText("No homes match, and that is the finding")).toBeVisible();
});

test("a finished-home project saves a home, requests a quote, and gates payment on a real quote", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Buy a finished home" }).click();
  await page.getByLabel("Project name").fill("Finished cabin search");
  await page.getByRole("button", { name: "Create my project" }).click();
  await expect(page).toHaveURL(/\/buy/);

  const casita = page.locator("article", { hasText: "BOXABL" });
  // no quote exists, so no payment methods exist — only the waiting sentence
  await expect(casita.getByText(/Payment options appear beside a written quote/)).toBeVisible();
  await expect(casita.getByText("Cash or card")).toHaveCount(0);
  await expect(casita.getByText("X Layer USDC")).toHaveCount(0);

  await casita.getByRole("button", { name: "Save", exact: true }).click();
  await expect(casita.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await casita.getByRole("button", { name: "Request quote" }).click();
  await expect(casita.getByRole("button", { name: "Quote request prepared" })).toBeVisible();
  await expect(casita.getByText(/bound to design 0x/i)).toBeVisible();
  await expect(casita.getByRole("button", { name: "Download request" })).toBeVisible();
  // still no payment methods: a prepared request is not a real quote
  await expect(casita.getByText("Cash or card")).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator("article", { hasText: "BOXABL" }).getByRole("button", { name: "Quote request prepared" }),
  ).toBeVisible();
});

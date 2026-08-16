import { expect, test } from "playwright/test";

const BADGE = "Demonstration only · not an active listing";

/** Is the real surface ahead of the fixture, in the document the browser built?
 *  `compareDocumentPosition` rather than a source index: a mount moved inside a
 *  conditional keeps its position in the file and loses it on the page. */
const realPrecedesFixture = (page: import("playwright/test").Page) =>
  page.evaluate(() => {
    const real = document.querySelector('[data-slot="land-real-surface"]');
    const fixture = document.querySelector('[data-slot="land-demonstration"]');
    if (!real || !fixture) return null;
    return (real.compareDocumentPosition(fixture) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });

const noOverflow = async (page: import("playwright/test").Page, at: string) => {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, `/land overflows a 390 px phone ${at}`).toBe(widths.client);
};

test("land discovery leads with published rules and keeps invented parcels behind a press", async ({ page }) => {
  /* THIS TEST CHANGED WITH THE RESTRUCTURE, DELIBERATELY. It used to assert
     four demonstration badges on a cold visit, which was true and was the
     problem: a person arriving at /land met four invented parcels before any
     published data. The fixture is now behind an explicit toggle, so the same
     four badges are asserted — after the press that asks for them. Deleting the
     assertion instead would have quietly ended all coverage of the demo path. */
  await page.goto("/land");
  await expect(page.getByRole("heading", { name: "Find land for the home you actually designed" })).toBeVisible();
  await expect(page.getByText("Live MLS not connected")).toBeVisible();

  /* THE DETECTOR for the ordering check below, built from a detached pair in
     the wrong order. Without it, a renamed data-slot would return null and the
     ordering assertion would report nothing at all. */
  const detector = await page.evaluate(() => {
    const host = document.createElement("div");
    host.innerHTML = '<i data-role="fixture"></i><i data-role="real"></i>';
    const real = host.querySelector('[data-role="real"]')!;
    const fixture = host.querySelector('[data-role="fixture"]')!;
    return (real.compareDocumentPosition(fixture) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(detector, "the ordering detector does not detect the ordering it exists to detect").toBe(false);

  expect(
    await realPrecedesFixture(page),
    "published City of Edmonton data must reach a reader before the invented records do",
  ).toBe(true);

  /* COLD: no invented parcel, no fit map, and a control that says what it does. */
  await expect(page.getByText(BADGE)).toHaveCount(0);
  await expect(page.getByLabel("Map of demonstration parcel fit results")).toHaveCount(0);
  /* `exact` is load-bearing: the listing-access heading ends with "Aura holds no
     land inventory of its own", so a substring match resolves to two headings
     and Playwright refuses it under strict mode. */
  await expect(page.getByRole("heading", { name: "Aura holds no land inventory", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, "in its cold state");

  /* PRESSED: the fixture arrives, all four of it. This is also the detector for
     the two zero-counts above — the same locators find four records here, so
     finding none there is a decision and not a broken query. */
  await page.getByRole("button", { name: "Open demonstration parcels" }).click();
  await expect(page.getByText(BADGE)).toHaveCount(4);
  await expect(page.getByLabel("Map of demonstration parcel fit results")).toBeVisible();
  await noOverflow(page, "with the demonstration records open");

  /* AND BACK. A toggle that only goes one way strands a reader in the fixture. */
  await page.getByRole("button", { name: "Return to your own land" }).click();
  await expect(page.getByText(BADGE)).toHaveCount(0);
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
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("RFQ field house");
  await page.getByRole("button", { name: "Create my project" }).click();
  await page.goto("/land");
  /* The demonstration comparison is still saveable, and still saves as
     demonstration evidence — it is just asked for now rather than assumed. The
     press is the only line that changed here. */
  await page.getByRole("button", { name: "Open demonstration parcels" }).click();
  await expect(page.getByLabel("Map of demonstration parcel fit results")).toBeVisible();
  await page.getByRole("button", { name: "Save demo comparison" }).first().click();
  await expect(page.getByRole("button", { name: "Saved to project" })).toBeVisible();

  await page.goto("/contractors");
  await page.getByRole("button", { name: "+ Add contractor" }).click();
  await page.getByLabel("Exact legal name", { exact: true }).fill("Prairie Field Build Ltd.");
  await page.getByLabel("Service region").fill("Foothills County");
  await page.getByLabel("Exact legal name appears in the Alberta builder registry").check();
  await page.getByLabel("Exact registry result URL").fill("https://residentialprotection.alberta.ca/public-registry/Builder/example");
  await page.getByLabel("Current WCB clearance recorded").check();
  await page.getByLabel("WCB evidence URL").fill("https://www.wcb.ab.ca/clearance/example");
  await page.getByLabel("WCB expiry").fill("2027-01-01");
  await page.getByLabel("Liability insurance certificate recorded").check();
  await page.getByLabel("Insurance evidence URL").fill("https://example.test/insurance-certificate");
  await page.getByLabel("Insurance expiry").fill("2027-01-01");
  await page.getByLabel("Comparable projects and references recorded").check();
  await page.getByLabel("Comparable work evidence URL").fill("https://example.test/comparable-projects");
  await page.getByRole("button", { name: "Save case file" }).click();
  await expect(page.getByText("User-supplied project case file")).toBeVisible();
  await page.getByRole("button", { name: "Add to project shortlist" }).click();
  await expect(page.getByRole("button", { name: "Saved to project shortlist" })).toBeVisible();

  await page.getByLabel("Scope").selectOption("shell-envelope");
  await page.getByRole("button", { name: "Prepare RFQ package" }).click();
  await expect(page.locator(".rfq-card").getByText("Shell + envelope", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON package" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Build complete package" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.aura-rfq-package\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const downloaded = JSON.parse(await (await import("node:fs/promises")).readFile(path!, "utf8"));
  expect(downloaded.format).toBe("aura-project-rfq-package");
  expect(downloaded.artifacts.map((artifact: { id: string }) => artifact.id)).toEqual([
    "rfq-json",
    "quantities-json",
    "drawing-pdf",
  ]);
  const pdf = downloaded.artifacts.find((artifact: { id: string }) => artifact.id === "drawing-pdf");
  expect(Buffer.from(pdf.content, "base64").subarray(0, 5).toString("ascii")).toBe("%PDF-");
  await expect(page.getByText("Complete package verified locally")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Download JSON package" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Build complete package" })).toBeVisible();

  await page.goto("/budget");
  await page.getByLabel("Vendor or contractor").fill("Prairie Field Build Ltd.");
  await page.getByLabel("Description").fill("Shell package response");
  await page.getByLabel("Amount CAD").fill("82000");
  await page.getByLabel("Aura scope").selectOption("shell");
  await page.getByLabel("RFQ basis").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save and reconcile" }).click();
  await expect(page.getByText("Matches prepared RFQ", { exact: true })).toBeVisible();
});

test("the buy catalog renders the honest card hierarchy with no ranking and no routing detail", async ({ page }) => {
  await page.goto("/buy");
  await expect(page.getByRole("heading", { name: "Explore eco-home models and concepts" })).toBeVisible();
  await expect(page.locator("[data-slot='home-identity']")).toHaveCount(2);
  await expect(page.getByText("Reliable pricing not found — request a quote.")).toHaveCount(2);
  await expect(page.getByText("Aura illustrative visual — not a product photo")).toHaveCount(2);
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(/readiness|\/100|purchase evidence|ChangeNOW/i);

  await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("japan");
  await expect(page.locator("[data-slot='home-identity']")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Lib Earth House model B", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Destination", exact: true }).selectOption("any");

  // The current research catalog has two defensible entries; the compare
  // mechanism still retains its three-item cap for later permissioned data.
  await page.getByRole("button", { name: "Compare", exact: true }).first().click();
  await page.getByRole("button", { name: "Compare", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "2 of 3 homes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear comparison" }).click();
  await expect(page.getByRole("heading", { name: "2 of 3 homes" })).toHaveCount(0);

  // the "published price" filter has nothing to show, and says so honestly
  await page.getByRole("combobox", { name: "Price", exact: true }).selectOption("published");
  await expect(page.getByText("No homes match, and that is the finding")).toBeVisible();
});

test("a finished-home project saves a home, requests a quote, and gates payment on a real quote", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Buy a finished home" }).click();
  await page.getByLabel("Project purpose").selectOption("primary-home");
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

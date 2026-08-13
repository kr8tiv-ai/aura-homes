import { expect, test } from "playwright/test";

test("the budget follows the active project and changes real system lines", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("Budget-ready cabin");
  await page.getByLabel("Municipality or region").fill("Foothills County");
  await page.getByLabel("Maximum working budget").fill("500000");
  await page.getByRole("button", { name: "Create my project" }).click();
  await page.goto("/budget");

  await expect(page.getByRole("heading", { name: "A range that moves with the design." })).toBeVisible();
  const basis = page.getByLabel("Budget design basis");
  await expect(basis.getByText("Budget-ready cabin", { exact: true })).toBeVisible();
  await expect(basis.getByText(/^0x[a-f0-9]{8}$/)).toBeVisible();
  await expect(basis.getByText("799 sq ft", { exact: true })).toBeVisible();
  await expect(page.getByText(/Site slope, soil, access/)).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByText(/Solar array/)).toBeVisible();

  await page.getByLabel("Utility strategy").selectOption("serviced");
  await expect(table.getByText("Municipal utility connections", { exact: true })).toBeVisible();
  await expect(table.getByText(/Solar array/)).toHaveCount(0);
  await expect(page.getByText("Saved to this project", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Utility strategy")).toHaveValue("serviced");
  await expect(table.getByText("Municipal utility connections", { exact: true })).toBeVisible();

  await page.getByLabel("Vendor or contractor").fill("Prairie Shell Co.");
  await page.getByLabel("Description").fill("Shell package");
  await page.getByLabel("Amount CAD").fill("52000");
  await page.getByLabel("Aura scope").selectOption("shell");
  await page.getByRole("button", { name: "Save and reconcile" }).click();
  await expect(page.getByRole("heading", { name: "Prairie Shell Co." })).toBeVisible();
  await expect(page.getByText("Matches current design", { exact: true })).toBeVisible();

  const savedQuote = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolveDb, rejectDb) => {
      const open = indexedDB.open("aura-projects", 1);
      open.onsuccess = () => resolveDb(open.result);
      open.onerror = () => rejectDb(open.error);
    });
    const projects = await new Promise<Array<Record<string, unknown>>>((resolveGet, rejectGet) => {
      const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
      request.onsuccess = () => resolveGet(request.result as Array<Record<string, unknown>>);
      request.onerror = () => rejectGet(request.error);
    });
    db.close();
    const delivery = projects[0].delivery as { quotes: Array<Record<string, unknown>> };
    return {
      quote: delivery.quotes[0],
      scenario: (projects[0].budgetBasis as { scenario: Record<string, unknown> }).scenario,
    };
  });
  expect(savedQuote).toMatchObject({
    scenario: expect.objectContaining({ utilities: "serviced" }),
    quote: {
      version: 2,
      budgetHash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
      budgetBasis: {
        region: "Alberta",
        municipality: "Foothills County",
        scenario: expect.objectContaining({ utilities: "serviced" }),
        budgetCapCad: 500000,
      },
    },
  });

  await page.getByLabel("Utility strategy").selectOption("off-grid");
  await expect(page.getByText("Planning basis changed after quote", { exact: true })).toBeVisible();
  await expect(page.getByText("The utility strategy changed.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Prairie Shell Co." })).toBeVisible();
});

test("the project budget is composed for a phone without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/budget");
  await expect(page.getByText("Planning range — not a quote", { exact: true })).toBeVisible();
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
});

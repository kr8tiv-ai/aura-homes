import { expect, test } from "playwright/test";

test("the budget follows the active project and changes real system lines", async ({ page }) => {
  await page.goto("/start");
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

  await page.getByLabel("Vendor or contractor").fill("Prairie Shell Co.");
  await page.getByLabel("Description").fill("Shell package");
  await page.getByLabel("Amount CAD").fill("52000");
  await page.getByLabel("Aura scope").selectOption("shell");
  await page.getByRole("button", { name: "Save and reconcile" }).click();
  await expect(page.getByRole("heading", { name: "Prairie Shell Co." })).toBeVisible();
  await expect(page.getByText("Matches current design", { exact: true })).toBeVisible();
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

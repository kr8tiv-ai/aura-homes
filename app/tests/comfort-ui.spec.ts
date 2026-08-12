import { expect, test } from "playwright/test";

test("comfort room rows can be selected from the keyboard", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("tab", { name: "Comfort" }).click();

  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();

  const row = rows.nth(1);
  await expect(row).toHaveAttribute("role", "row");
  await expect(row).toHaveAttribute("tabindex", "0");

  await row.focus();
  await page.keyboard.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
});

test("durable comfort assumptions participate in builder undo", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("tab", { name: "Comfort" }).click();

  const winterTemperature = page.getByLabel("Winter indoor air temperature");
  await expect(winterTemperature).toHaveValue("21");
  await winterTemperature.fill("22");
  await expect(winterTemperature).toHaveValue("22");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(winterTemperature).toHaveValue("21");
});

test("builder design handoff reaches a hash-bound quote without losing the project", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("tab", { name: /^Export/ }).click();
  await page.getByRole("button", { name: "Continue to quote" }).click();

  await page.waitForURL(/\/concierge\?project=project-/, { timeout: 30_000 });
  await expect(page.getByText("Continue to quote is ready", { exact: false })).toBeVisible();
  await expect(page.getByText("Builder design:", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Try 37 Aspen Road" }).click();
  await page.getByRole("button", { name: "Quote it" }).click();

  await expect(page.getByText("Immutable quote snapshot saved locally", { exact: false })).toBeVisible();
  await expect(page.getByText("Full documents stay off-chain", { exact: false })).toBeVisible();
  await expect(page.getByText("quoted", { exact: true })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("aura-order-handoffs", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<number>((resolve, reject) => {
      const request = db.transaction("snapshots", "readonly").objectStore("snapshots").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(stored).toBe(2);
});

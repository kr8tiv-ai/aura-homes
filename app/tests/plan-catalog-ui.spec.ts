import { expect, test } from "playwright/test";

test("the builder opens on a filterable, source-aware plan library", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");

  await expect(page.getByRole("heading", { name: "Start from a plan, then make it yours." })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".plan-card")).toHaveCount(12);
  await expect(page.getByText("12 editable concepts", { exact: true })).toBeVisible();
  await expect(page.getByText("3 licensed sources", { exact: true })).toBeVisible();

  await page.getByLabel("Source").selectOption("open");
  await expect(page.locator(".plan-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Liber’Tiny Study/ })).toBeVisible();

  await page.getByLabel("Source").selectOption("all");
  await page.getByRole("button", { name: /Meadow One/ }).click();
  await expect(page.getByRole("button", { name: "Use Meadow One" })).toBeVisible();
  await expect(page.getByText(/excludes land, permits/)).toBeVisible();
});

test("choosing a plan loads the same undoable editor document", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: "Start from a plan, then make it yours." })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: /Meadow One/ }).click();
  await page.getByRole("button", { name: "Use Meadow One" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Meadow One is open as a complete editable project" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Shell" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Meadow One");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("My Aura home");
});

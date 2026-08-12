import { expect, test } from "playwright/test";

import { PLAN_TEMPLATES } from "@/lib/builder/planCatalog";

/* The counts assert against the catalog itself rather than a number typed the
   day the library held twelve — the library grows by provenance sweep, and
   this spec's job is that the page COUNTS honestly, not that growth stopped. */
const TOTAL = PLAN_TEMPLATES.length;
const OPEN = PLAN_TEMPLATES.filter((plan) => plan.source.kind !== "aura-authored").length;

test("the builder opens on a filterable, source-aware plan library", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");

  await expect(page.getByRole("heading", { name: "Start from a plan, then make it yours." })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".plan-card")).toHaveCount(TOTAL);
  await expect(page.getByText(`${TOTAL} editable concepts`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${OPEN} sourced adaptations`, { exact: true })).toBeVisible();

  await page.getByLabel("Source").selectOption("open");
  await expect(page.locator(".plan-card")).toHaveCount(OPEN);
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

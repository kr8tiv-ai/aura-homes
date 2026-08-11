import { expect, test } from "playwright/test";

test("the app header keeps the customer journey concise and moves tools into More", async ({ page }) => {
  await page.goto("/build");

  const journey = page.getByRole("navigation", { name: "Customer journey" });
  await expect(journey.getByRole("link")).toHaveCount(5);
  await expect(journey.getByRole("link", { name: "Design a home" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);

  await page.getByText("More", { exact: true }).click();
  await expect(page.getByRole("navigation", { name: "More Aura tools" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});

test("the builder opens canvas-first with a persistent model and plan switch", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: "Shape the home. Keep every decision." })).toBeVisible();
  await expect(page.locator(".builder-viewport canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
  await expect(page.getByText("Design intent only—not structural", { exact: false })).toBeVisible();
});

test("mobile uses the safe scene tier and a complete menu without horizontal overflow", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-scene-quality=balanced]")).toBeAttached({ timeout: 30_000 });
  await page.goto("/overview");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Find land" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
});

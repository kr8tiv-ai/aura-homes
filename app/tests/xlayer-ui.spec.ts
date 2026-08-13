import { expect, test } from "playwright/test";

test("legacy concierge redirects to the project and operator writes stay unlisted", async ({ page }) => {
  await page.goto("/concierge");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "No active project yet." })).toBeVisible();

  await page.goto("/operator/registry");
  await expect(page.getByRole("heading", { name: "Build registry operator" })).toBeVisible();
  await expect(page.getByRole("button", { name: /create designed build record/i })).toHaveCount(0);
  await expect(page.getByText(/no operator transaction controls are exposed/i)).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

import { expect, test } from "playwright/test";

test("operator writes stay out of the buyer journey and behind an on-chain owner gate", async ({ page }) => {
  await page.goto("/concierge");
  await expect(page.getByRole("heading", { name: "Concierge" })).toBeVisible();
  await expect(page.getByRole("link", { name: /operator/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /create designed build record/i })).toHaveCount(0);

  await page.goto("/operator/registry");
  await expect(page.getByRole("heading", { name: "Build registry operator" })).toBeVisible();
  await expect(page.getByRole("button", { name: /create designed build record/i })).toHaveCount(0);
  await expect(page.getByText(/no operator transaction controls are exposed/i)).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

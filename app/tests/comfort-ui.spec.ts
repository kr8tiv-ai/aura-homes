import { expect, test } from "playwright/test";

test("comfort room rows can be selected from the keyboard", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Comfort" }).click();

  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();

  const row = rows.nth(1);
  await expect(row).toHaveAttribute("role", "row");
  await expect(row).toHaveAttribute("tabindex", "0");

  await row.focus();
  await page.keyboard.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
});

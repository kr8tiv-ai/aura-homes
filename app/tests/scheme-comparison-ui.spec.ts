import { expect, test } from "playwright/test";

test("saved schemes are keyboard-comparable without changing the open design", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/build?mode=pro");
  await expect(page.locator(".builder-viewport canvas").first()).toBeAttached({ timeout: 90_000 });

  const root = page.locator("[data-active-design-hash]");
  const originalHash = await root.getAttribute("data-active-design-hash");
  const originalUndo = await page.getByRole("button", { name: /^Undo/ }).first().isDisabled();

  await page.getByRole("tab", { name: /Library/ }).click();
  const comparison = page.getByRole("region", { name: "Compare saved schemes" });
  await expect(comparison).toContainText("Save at least two distinct schemes");

  // Make three real saved versions through the ordinary UI. This exercises
  // the same validated document writes visitors use, with no test-only store
  // back door and no invented record shape.
  const name = page.getByLabel("Name this design");
  await name.fill("Reference cabin");
  await page.getByRole("button", { name: "Save to this browser" }).click();
  await expect(comparison.getByRole("checkbox")).toHaveCount(1);

  await page.getByRole("tab", { name: /Plans/ }).click();
  await page.locator(".variation-apply").nth(0).click();
  await page.getByRole("tab", { name: /Library/ }).click();
  await name.fill("Glazing study");
  await page.getByRole("button", { name: "Save to this browser" }).click();
  await expect(comparison.getByRole("checkbox")).toHaveCount(2);

  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await page.getByRole("tab", { name: /Plans/ }).click();
  await page.locator(".variation-apply").nth(1).click();
  await page.getByRole("tab", { name: /Library/ }).click();
  await name.fill("Orientation study");
  await page.getByRole("button", { name: "Save to this browser" }).click();
  await expect(comparison.getByRole("checkbox")).toHaveCount(3);

  const boxes = comparison.getByRole("checkbox");
  await boxes.nth(0).focus();
  await page.keyboard.press("Space");
  await boxes.nth(1).focus();
  await page.keyboard.press("Space");
  await comparison.getByRole("button", { name: "Compare 2 schemes" }).click();

  const table = comparison.getByRole("table", { name: "Scheme facts" });
  await expect(table).toBeVisible();
  await expect(table).toContainText(/0x[a-f0-9]{64}/);
  await expect(table).toContainText("Modelled floor area");
  await expect(table).toContainText("Planning range");
  await expect(table).toContainText("Blocking items");
  await expect(table).toContainText("Complete project");
  await expect(comparison).not.toContainText(/\bbest\b|recommended|optimal/i);

  await comparison.getByRole("radio").nth(1).check();
  await comparison.getByRole("button", { name: "Clear comparison" }).click();
  await expect(table).toHaveCount(0);
  await expect(root).toHaveAttribute("data-active-design-hash", originalHash ?? "");
  expect(await page.getByRole("button", { name: /^Undo/ }).first().isDisabled()).toBe(originalUndo);
});

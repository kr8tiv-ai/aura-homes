import { expect, test } from "playwright/test";

test("planar conversion drives the visible plan, 3D model and honest exports", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");

  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toBeVisible();
  await expect(page.getByText("Graph geometry · exact faces")).toBeVisible();

  const plan = page.getByRole("img", { name: "Editable building graph plan, north is up" });
  const firstVertex = plan.locator("circle").first();
  const box = await firstVertex.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 18, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByText("Nothing changed yet.", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Model" }).click();
  await expect(page.locator("#main canvas")).toBeVisible();

  await page.getByRole("button", { name: /^Export/ }).click();
  await expect(page.getByText("This project uses planar graph geometry", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download .dxf" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download .ifc", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download .aura.json" })).toBeEnabled();
});

test("undo restores the untouched legacy project after graph conversion", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Convert to planar editing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toHaveCount(0);
});

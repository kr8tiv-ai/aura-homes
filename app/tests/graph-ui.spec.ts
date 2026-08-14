import { expect, test } from "playwright/test";

test("planar conversion drives the visible plan, 3D model and honest exports", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/build");
  await page.getByRole("button", { name: "Pro", exact: true }).click();

  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toBeVisible();
  await expect(page.getByText("Graph geometry · exact faces")).toBeVisible();

  const plan = page.getByRole("img", { name: "Editable building graph plan, north is up" });
  const firstVertex = plan.locator("circle").first();
  await firstVertex.scrollIntoViewIfNeeded();
  const box = await firstVertex.boundingBox();
  const initialCx = await firstVertex.getAttribute("cx");
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 18, { steps: 5 });
  expect(errors).toEqual([]);
  await expect(firstVertex).not.toHaveAttribute("cx", initialCx ?? "");
  await page.mouse.up();

  await expect(page.getByText("Nothing changed yet.", { exact: false })).toHaveCount(0);
  await expect(page.getByText("799 sq ft", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Model" }).click();
  /* The plan catalog's live 3D preview adds a second canvas inside #main;
     the assertion targets the actual builder viewport. */
  await expect(page.locator(".builder-viewport canvas")).toBeVisible();

  await page.getByRole("tab", { name: /^Export/ }).click();
  await expect(page.getByText("This project uses planar graph geometry", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download .dxf" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download .ifc", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download .aura.json" })).toBeEnabled();
});

test("undo restores the untouched legacy project after graph conversion", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Convert to planar editing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toHaveCount(0);
});

test("an aligned upper floor and explicit stair are edited from the same graph plan", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/build");
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await page.getByRole("button", { name: "Duplicate aligned" }).click();

  expect(errors).toEqual([]);
  await expect(page.getByRole("button", { name: "Storey 2" })).toBeVisible();
  await expect(page.getByText("2 aligned storeys", { exact: false })).toBeVisible();
  const graphSummary = page.getByText("Graph geometry · exact faces").locator("..");
  const storeyCard = graphSummary.getByText("Storeys", { exact: true }).locator("..");
  await expect(storeyCard.getByText("2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add stair core" }).click();
  await expect(page.getByText("1 explicit stair core", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Add service shaft" }).click();
  await expect(page.getByText("1 service shaft", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Model" }).click();
  await expect(page.locator(".builder-viewport canvas")).toBeVisible();
});

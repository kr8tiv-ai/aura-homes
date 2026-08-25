import { expect, test } from "playwright/test";

test("collapsed evidence stays honest, mounts secondary modules on demand, and reopens at the requested proof", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/build?mode=guided");
  await expect(page.locator(".builder-viewport canvas").first()).toBeAttached({ timeout: 90_000 });

  const root = page.locator("[data-active-design-hash]");
  const designHash = await root.getAttribute("data-active-design-hash");
  const drawer = page.getByRole("complementary", { name: "Project evidence" });

  await expect(drawer).toHaveAttribute("data-evidence-open", "false");
  await expect(drawer).toHaveAttribute("data-claim-state", "design-intent");
  const collapsedBlockers = await drawer.getAttribute("data-blocking-count");
  expect(Number(collapsedBlockers)).toBeGreaterThan(0);
  await expect(drawer).toContainText(/open blockers?/i);
  await expect(drawer).toContainText(/drawing set not generated/i);

  /* Cost derivation and co-pilot analysis are secondary evidence. A collapsed
     drawer removes them from the tree instead of hiding already-mounted work. */
  await expect(drawer.getByRole("region", { name: "Live cost and constraint read-out" })).toHaveCount(0);
  await expect(drawer.getByRole("region", { name: "Design co-pilot" })).toHaveCount(0);

  await drawer.getByRole("button", { name: /Open \d+ blockers?/i }).click();
  await expect(drawer).toHaveAttribute("data-evidence-open", "true");
  await expect(drawer.getByRole("region", { name: "Blocking evidence" })).toBeFocused();
  await expect(drawer.getByRole("region", { name: "Live cost and constraint read-out" })).toBeVisible();
  await expect(drawer.getByRole("region", { name: "Design co-pilot" })).toBeVisible();
  await expect(drawer).toHaveAttribute("data-claim-state", "design-intent");
  await expect(drawer).toHaveAttribute("data-blocking-count", collapsedBlockers ?? "");

  await drawer.getByRole("button", { name: "Project provenance" }).click();
  await expect(drawer.getByRole("region", { name: "Project provenance" })).toBeFocused();
  await drawer.getByRole("button", { name: "Technical status" }).click();
  await expect(drawer.getByRole("region", { name: "Technical status" })).toBeFocused();
  await drawer.getByRole("button", { name: "Export readiness" }).click();
  await expect(drawer.getByRole("region", { name: "Export readiness" })).toBeFocused();

  await drawer.getByRole("button", { name: "Collapse evidence" }).click();
  await expect(drawer).toHaveAttribute("data-evidence-open", "false");
  await expect(drawer.getByRole("region", { name: "Live cost and constraint read-out" })).toHaveCount(0);
  await expect(drawer.getByRole("region", { name: "Design co-pilot" })).toHaveCount(0);
  await expect(drawer).toHaveAttribute("data-claim-state", "design-intent");
  await expect(drawer).toHaveAttribute("data-blocking-count", collapsedBlockers ?? "");
  await expect(root).toHaveAttribute("data-active-design-hash", designHash ?? "");
});

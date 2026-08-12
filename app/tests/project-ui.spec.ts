import { expect, test } from "playwright/test";

test("the primary navigation carries the approved journey and moves utilities behind More", async ({ page }) => {
  await page.goto("/build");
  const journey = page.getByRole("navigation", { name: "Primary" });
  await expect(journey.getByRole("link", { name: "Explore homes" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "Design a home" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "How it works" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "My projects" })).toBeVisible();
  await expect(journey.getByRole("link")).toHaveCount(4);

  await page.getByText("More", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Land fit pilot" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check a contractor" })).toBeVisible();
});

test("a non-technical intake creates and restores one local project", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("heading", { name: "Start with the life you want to live." })).toBeVisible();
  await page.getByRole("button", { name: "Find land + build" }).click();
  await page.getByLabel("Project name").fill("Foothills family home");
  await page.getByLabel("Municipality or region").fill("Foothills County");
  await page.getByLabel("Maximum working budget").fill("550000");
  await page.getByLabel("People in the home").fill("3");
  await page.getByRole("button", { name: "Create my project" }).click();

  await expect(page).toHaveURL(/\/build/);
  await expect(page.getByText("Foothills family home", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project journey" })).toBeVisible();
  // The intake completes the requirements step, and this journey's own copy is
  // "Design first, then find parcels" — so the spine recommends design next.
  await expect(page.getByText("Next · Shape your home", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Foothills family home", { exact: true })).toBeVisible();
});

test("the editor defaults to Guided mode and keeps the precision workspace in Pro", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await expect(page.getByRole("group", { name: "Editor mode" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Guided" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("navigation", { name: "Guided design steps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Plans" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review" })).toBeVisible();

  await page.getByRole("button", { name: "Pro" }).click();
  await expect(page.getByRole("tablist", { name: "Builder workspaces" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Plans" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Shape" })).toBeVisible();
  await page.getByRole("button", { name: "Commands" }).click();
  await expect(page.getByRole("dialog", { name: "Builder commands" })).toBeVisible();
  const palette = page.getByPlaceholder(/Search tools/);
  await expect(palette).toBeFocused();

  // The salsita-inspired phrase layer: typed edit → previewed → one undo step.
  await palette.fill("width 24");
  await expect(page.getByRole("button", { name: /Apply · .*width → 24 ft/ })).toBeVisible();
  await palette.press("Enter");
  await expect(page.getByText(/✓ .*width → 24 ft/)).toBeVisible();
  await expect(palette).toHaveValue("");
});

test("?mode=pro is honoured — the promise the /design redirect makes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build?mode=pro");
  await expect(page.getByRole("group", { name: "Editor mode" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Pro", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Pro never opens on the plans tab, so an addressed arrival starts on Shape.
  await expect(page.getByRole("tablist", { name: "Builder workspaces" })).toBeVisible();
});

test("guided mode walks: Back, a live count, Next by name, and graduation to Pro", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/build?mode=guided");
  await expect(page.getByRole("group", { name: "Editor mode" })).toBeVisible({ timeout: 60_000 });
  const flow = page.locator(".guided-step-flow");
  await expect(flow.getByText("Step 1 of 8", { exact: true })).toBeVisible();
  await expect(flow.getByRole("button", { name: "Back" })).toBeDisabled();

  await flow.getByRole("button", { name: "Next · Shell" }).click();
  await expect(flow.getByText("Step 2 of 8", { exact: true })).toBeVisible();
  await flow.getByRole("button", { name: "Back" }).click();
  await expect(flow.getByText("Step 1 of 8", { exact: true })).toBeVisible();

  // Jump to the last step; the walk ends by graduating into Pro, same document.
  await page.getByRole("navigation", { name: "Guided design steps" }).getByRole("button", { name: /Review/ }).click();
  await expect(flow.getByText("Step 8 of 8", { exact: true })).toBeVisible();
  await flow.getByRole("button", { name: "Continue in Pro" }).click();
  await expect(page.getByRole("button", { name: "Pro", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tablist", { name: "Builder workspaces" })).toBeVisible();
});

test("the project centre exposes local recovery and portable backups", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Project name").fill("Recovery test home");
  await page.getByRole("button", { name: "Create my project" }).click();
  await page.goto("/projects");

  await expect(page.getByRole("heading", { name: "Your Aura projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recovery test home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Duplicate project" })).toBeVisible();
  await expect(page.getByLabel("Import an Aura project file")).toBeVisible();
});

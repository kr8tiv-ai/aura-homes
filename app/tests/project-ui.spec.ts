import { expect, test } from "playwright/test";

test("the primary navigation starts a project and moves route utilities behind More", async ({ page }) => {
  await page.goto("/build");
  const journey = page.getByRole("navigation", { name: "Primary" });
  await expect(journey.getByRole("link", { name: "Start a project" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "Explore homes" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "How Aura works" })).toBeVisible();
  await expect(journey.getByRole("link")).toHaveCount(3);

  await page.getByText("More", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Find land" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contractors" })).toBeVisible();
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
  await expect(page.getByText("Next · Find suitable land", { exact: true })).toBeVisible();

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
  await expect(page.getByPlaceholder("Search tools and views")).toBeFocused();
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

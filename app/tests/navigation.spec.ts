import { expect, test } from "playwright/test";

/* The approved global navigation and its compatibility contract:
   · Five entries: Explore homes · Design a home · How it works ·
     My projects · More (Land fit pilot, Check a contractor, FAQ, About).
   · Legacy routes redirect CLIENT-SIDE (static export — no server 301s).
   · The journey spine is workspace chrome: absent without a project, and
     its Funding step routes to /budget, never the legacy concierge. */

test("the primary navigation carries the five approved entries", async ({ page }) => {
  await page.goto("/how-it-works");
  const journey = page.getByRole("navigation", { name: "Primary" });
  await expect(journey.getByRole("link", { name: "Explore homes" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "Design a home" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "How it works" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "My projects" })).toBeVisible();
  await expect(journey.getByRole("link")).toHaveCount(4);

  await page.getByText("More", { exact: true }).click();
  const more = page.getByRole("navigation", { name: "More Aura tools" });
  await expect(more.getByRole("link", { name: "Land fit pilot" })).toBeVisible();
  await expect(more.getByRole("link", { name: "Check a contractor" })).toBeVisible();
  await expect(more.getByRole("link", { name: "FAQ" })).toBeVisible();
  await expect(more.getByRole("link", { name: "About" })).toBeVisible();
  await expect(more.getByRole("link")).toHaveCount(4);

  // HOMES and onchain records left the ordinary utility menu on purpose.
  await expect(more.getByRole("link", { name: /HOMES/ })).toHaveCount(0);
  await expect(more.getByRole("link", { name: /escrow/i })).toHaveCount(0);
});

test("legacy routes land on their replacements client-side", async ({ page }) => {
  await page.goto("/overview");
  await page.waitForURL(/\/how-it-works\/?$/);
  await expect(page.getByRole("heading", { name: "One project, six honest stages." })).toBeVisible();

  await page.goto("/design");
  await page.waitForURL(/\/build\/?\?mode=guided$/);

  await page.goto("/escrow");
  await page.waitForURL(/\/labs\/xlayer-proof\/?$/);
  await expect(page.getByRole("heading", { name: "Proof of lifecycle" })).toBeVisible();
});

test("the X Layer lab keeps the testnet content reachable but unindexed", async ({ page }) => {
  await page.goto("/labs/xlayer-proof");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Aura Labs · X Layer testnet", { exact: true })).toBeVisible();
  await expect(page.getByText("not a product feature", { exact: false }).first()).toBeVisible();
});

test("the education pages explain the lifecycle and label every crypto plan", async ({ page }) => {
  await page.goto("/how-it-works");
  await expect(page.getByRole("heading", { name: "One project, six honest stages." })).toBeVisible();
  await expect(page.getByText("Aura facilitates. It is not a party to your project.")).toBeVisible();
  await expect(page.getByText("NOT FOR CONSTRUCTION", { exact: false }).first()).toBeVisible();

  await page.goto("/how-crypto-works");
  await expect(page.getByRole("heading", { name: "The crypto side, one plain idea at a time." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What hashes do not prove" })).toBeVisible();
  // Every plan carries an honest status chip: HOMES + trust are Next, the
  // stay network + launchpad are Future. Nothing may read as live.
  await expect(page.getByText(/Next · planned, being designed/)).toHaveCount(2);
  await expect(page.getByText(/Future · a later idea that may change/)).toHaveCount(2);
});

test("the journey spine stays out of pages without an active project", async ({ page }) => {
  await page.goto("/build");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project journey" })).toHaveCount(0);
  await expect(page.locator(".project-spine")).toHaveCount(0);
  await expect(page.locator(".project-empty-rail")).toHaveCount(0);

  // Education pages never carry workspace chrome, project or not.
  await page.goto("/how-it-works");
  await expect(page.locator(".project-spine")).toHaveCount(0);
});

test("with an active project the spine appears and Funding routes to /budget", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Project name").fill("Navigation check home");
  await page.getByRole("button", { name: "Create my project" }).click();
  await expect(page).toHaveURL(/\/build/);

  const spine = page.getByRole("navigation", { name: "Project journey" });
  await expect(spine).toBeVisible();
  // trailingSlash export renders internal hrefs with a trailing slash.
  await expect(spine.getByRole("link", { name: /Funding/ })).toHaveAttribute("href", /^\/budget\/?$/);
});

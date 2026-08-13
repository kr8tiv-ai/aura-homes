import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "playwright/test";

/* /dashboard is the real project overview: it renders the ACTIVE AuraProject
   v2 document and nothing else. These tests pin the four honesty guarantees:
   an empty state that invites rather than mocks, a real-project state built
   from stored facts (with honest zeros), a module graph that never touches
   lib/fixtures.ts, and blocked journey steps rendered with their reason. */

const APP_ROOT = resolve(__dirname, "..");

/** Static-import walker over the dashboard's real module graph. Follows `@/`
 *  and relative specifiers into .ts/.tsx files under the app root — the same
 *  resolution the bundler performs — so a fixture import ANYWHERE in the
 *  dashboard's dependency tree fails this test, not just one in page.tsx. */
function walkModuleGraph(entry: string): Set<string> {
  const visited = new Set<string>();
  const queue = [entry];
  const importPattern = /(?:from|import)\s*\(?\s*["']([^"']+)["']\s*\)?/g;
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    importPattern.lastIndex = 0;
    for (let match = importPattern.exec(source); match !== null; match = importPattern.exec(source)) {
      const spec = match[1];
      let base: string | null = null;
      if (spec.startsWith("@/")) base = join(APP_ROOT, spec.slice(2));
      else if (spec.startsWith(".")) base = resolve(dirname(file), spec);
      if (!base) continue;
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
      for (const candidate of candidates) {
        if (!/\.tsx?$/.test(candidate)) continue;
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          queue.push(candidate);
          break;
        }
      }
    }
  }
  return visited;
}

test("the dashboard module graph never imports the fixture module", () => {
  const entry = join(APP_ROOT, "app", "dashboard", "page.tsx");
  // This was the removed preview-data module. Its absence is intentional, so
  // the graph assertion must not require the deleted file to exist first.
  const forbidden = join(APP_ROOT, "lib", "fixtures.ts");
  expect(existsSync(entry)).toBe(true);

  const graph = walkModuleGraph(entry);
  expect(graph.size).toBeGreaterThan(2); // the walker actually walked
  expect(graph.has(forbidden)).toBe(false);

  // Belt and braces: the page and its overview component never even name it.
  for (const file of [entry, join(APP_ROOT, "components", "project", "ProjectOverview.tsx")]) {
    expect(readFileSync(file, "utf8")).not.toContain("lib/fixtures");
  }
});

test("without a project the dashboard invites into /start instead of mocking one", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "No active project yet." })).toBeVisible();

  const start = page.getByRole("link", { name: "Start with your goals" });
  await expect(start).toBeVisible();
  await expect(start).toHaveAttribute("href", /\/start\/?$/);
  await expect(page.getByRole("link", { name: "Import a saved project" })).toBeVisible();

  // No fixture theatre: no preview labels, no invented dollar figures.
  await expect(page.getByText("Preview data", { exact: false })).toHaveCount(0);
  expect(await page.locator("#main").innerText()).not.toMatch(/\$\d/);
});

test("a real project renders stored facts, honest zeros, and THE next action", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Find land + build" }).click();
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("Dashboard record home");
  await page.getByLabel("Municipality or region").fill("Foothills County");
  await page.getByLabel("Maximum working budget").fill("550000");
  await page.getByRole("button", { name: "Create my project" }).click();
  await expect(page).toHaveURL(/\/build/);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard record home" })).toBeVisible();
  await expect(page.getByText(/Foothills County, Alberta/)).toBeVisible();
  await expect(page.getByText(/Working budget up to \$550,000/)).toBeVisible();

  // The one recommended next action is the page's most prominent card.
  await expect(page.getByText("Recommended next step")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Complete your project brief" })).toBeVisible();

  // Journey steps come from stepStates only: creating a partial brief records
  // work in progress, but does not confirm completion or advance the journey.
  const journey = page.getByRole("region", { name: "Journey" });
  const requirementsStep = journey.getByText("Requirements", { exact: true }).locator("..");
  await expect(requirementsStep).toContainText("In progress");
  await expect(requirementsStep).toContainText("Next");
  const designStep = journey.getByText("Design", { exact: true }).locator("..");
  await expect(designStep).toContainText("Design");
  await expect(designStep).toContainText("Not started");

  // Real design facts with the bound fingerprint.
  await expect(page.getByText("My Aura home", { exact: true })).toBeVisible();
  await expect(page.getByText("Design fingerprint")).toBeVisible();
  await expect(page.getByText(/^0x[0-9a-f]{12}…$/).first()).toBeVisible();
  await expect(page.getByText("799 sq ft").first()).toBeVisible();
  await expect(page.getByText("Searching for land")).toBeVisible();

  // Honest zeros — nothing invents progress.
  await expect(page.getByText("No cost basis yet.")).toBeVisible();
  await expect(page.getByText("No vendor quotes captured yet.")).toBeVisible();
  await expect(page.getByText("No open blockers recorded.")).toBeVisible();
  const artifactTile = page.locator("div.rounded-lg").filter({ hasText: "Home book artifacts" });
  await expect(artifactTile).toContainText("0");
  const quotesTile = page.locator("div.rounded-lg").filter({ hasText: "Vendor quotes" });
  await expect(quotesTile).toContainText("0");

  // The approved boundary: no payment-mechanics language on this page.
  expect(await page.locator("#main").innerText()).not.toMatch(/escrow|deposit|refund/i);
});

test("a blocked journey step renders with its typed reason", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("Blocked step home");
  await page.getByRole("button", { name: "Create my project" }).click();
  await expect(page).toHaveURL(/\/build/);

  // Mark the land step blocked with a typed blocker, exactly as the v2
  // document stores it — the dashboard must render state, not infer it.
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolveDb, rejectDb) => {
      const open = indexedDB.open("aura-projects", 1);
      open.onsuccess = () => resolveDb(open.result);
      open.onerror = () => rejectDb(open.error);
    });
    const project = await new Promise<Record<string, unknown>>((resolveGet, rejectGet) => {
      const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
      request.onsuccess = () => resolveGet(request.result[0] as Record<string, unknown>);
      request.onerror = () => rejectGet(request.error);
    });
    const stepStates = project.stepStates as Record<string, { status: string }>;
    stepStates.land.status = "blocked";
    project.blockers = [{
      id: "blocker-road-access",
      stepId: "land",
      summary: "Access easement unresolved",
      detail: "The shortlisted parcel has no registered road access; the seller is negotiating an easement.",
      source: "user",
      createdAtISO: new Date().toISOString(),
      resolvedAtISO: null,
    }];
    await new Promise((resolvePut, rejectPut) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(project);
      tx.oncomplete = () => resolvePut(null);
      tx.onerror = () => rejectPut(tx.error);
    });
    db.close();
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Blocked step home" })).toBeVisible();

  // The journey cell shows the blocked state WITH its reason.
  const landStep = page.locator("div.rounded-lg").filter({ hasText: "Access easement unresolved" });
  await expect(landStep).toHaveCount(1);
  await expect(landStep).toContainText("Land");
  await expect(landStep).toContainText("Blocked");

  // The typed blocker is listed in full with source and step.
  const blockerCard = page.locator("article").filter({ hasText: "Access easement unresolved" });
  await expect(blockerCard).toBeVisible();
  await expect(blockerCard).toContainText("The shortlisted parcel has no registered road access");
  await expect(blockerCard).toContainText("Noted by you");
});

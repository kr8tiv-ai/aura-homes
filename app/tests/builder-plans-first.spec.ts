import { expect, test } from "playwright/test";

import {
  GUIDED_STUDIO_TASKS,
  canonicalEdit,
  evidenceSummary,
  invalidExactInput,
  studioHistoryLabel,
  type StudioEditIntent,
} from "@/lib/builder/guidedStudio";

/* WHY THIS FILE EXISTS.

   The founder opened his own builder and asked why he could not see the plan
   library: "the selection for the house should be visible above the plans so
   it's one of the first things a person can do — if they don't scroll down
   they don't see the feature."

   He was right, and the cause was layout rather than ordering. The plans step
   is already step one of the guided walk, and PlanCatalog already renders in
   `.builder-stage__controls`. But the stage stacks the MODEL above the
   CONTROLS on a phone — a deliberate decision, spec-pinned by
   builder-viewer.spec — so someone landing on /build met an empty reference
   house and had to scroll past it to learn that fifty-five editable plans
   exist. A feature the person who commissioned it cannot find is not shipped.

   The fix is CSS `order` scoped to `[data-stage="browse"]`, never DOM order.
   That distinction is the whole reason this file measures rather than greps:
   moving the canvas in the markup would re-parent it, drop its WebGL context
   and break every model export, which is why two other specs pin the canvas
   element's identity and its unconditional mounting. `order` re-paints without
   re-parenting.

   So this asserts the OUTCOME — the picker is above the model, in pixels, at
   the widths a person actually arrives on — and asserts that the canvas is
   still there while it happens. */

const STAGE = `
  <main>
    <div class="builder-stage" data-stage="browse">
      <div class="builder-stage__view">
        <div class="builder-viewport">
          <div class="builder-viewport__stage"><canvas width="10" height="10"></canvas></div>
        </div>
      </div>
      <div class="builder-stage__controls">
        <section id="picker" style="min-block-size: 12rem">the plan library</section>
      </div>
    </div>
  </main>`;

/* The same stage in the state every other step is in, so the assertion below
   cannot pass by the rule applying everywhere — which would put the model
   under the controls for the whole walk and quietly undo a decision
   builder-viewer.spec makes on purpose. */
const EDIT_STAGE = STAGE.replace('data-stage="browse"', 'data-stage="edit"');

const boxes = async (page: import("playwright/test").Page) =>
  page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? element.getBoundingClientRect() : null;
    };
    return {
      view: rect(".builder-stage__view"),
      controls: rect(".builder-stage__controls"),
      canvas: document.querySelectorAll(".builder-viewport__stage canvas").length,
    };
  });

test("on the plans step the picker sits above the model, at every arrival width", async ({ page }) => {
  const css = require("node:fs").readFileSync(
    require("node:path").join(require("node:path").resolve(__dirname, ".."), "app/globals.css"),
    "utf8",
  ) as string;

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(STAGE);
    await page.addStyleTag({ content: css });
    const seen = await boxes(page);

    expect(seen.view, `no viewport at ${width}px`).not.toBeNull();
    expect(seen.controls, `no controls at ${width}px`).not.toBeNull();

    /* Above OR beside — at desktop widths the two sit in one row, and demanding
       "higher on the page" there would be asking for a worse layout, not a
       better one. What must never happen is the picker starting BELOW where the
       model ends, which is the phone case the founder hit. */
    const stacked = seen.controls!.top >= seen.view!.bottom - 1;
    expect(
      `${width}px: picker starts below the model — ${stacked}`,
      "the plan picker is pushed under the model, so arriving on /build shows an empty reference house and hides the library",
    ).toBe(`${width}px: picker starts below the model — false`);

    /* And the canvas is still mounted while all of that is true. If this ever
       goes to 0 the fix has been "solved" by unmounting the export root. */
    expect(seen.canvas, `the canvas left the tree at ${width}px`).toBe(1);
  }
});

test("every other step keeps the model first, so the rule is scoped and not global", async ({ page }) => {
  const css = require("node:fs").readFileSync(
    require("node:path").join(require("node:path").resolve(__dirname, ".."), "app/globals.css"),
    "utf8",
  ) as string;

  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(EDIT_STAGE);
  await page.addStyleTag({ content: css });
  const seen = await boxes(page);

  /* On a phone in the edit stage the model leads — builder-viewer.spec asserts
     the same thing against the real builder, and this is the guard that stops
     the browse rule leaking into every other step. */
  expect(
    `edit stage: model above controls — ${seen.view!.bottom <= seen.controls!.top + 1}`,
  ).toBe("edit stage: model above controls — true");
});

test("the Guided Studio task contract keeps one short, stable path around the canvas", () => {
  expect(GUIDED_STUDIO_TASKS.map((task) => task.id)).toEqual([
    "plans",
    "shell",
    "rooms",
    "openings",
    "site",
    "performance",
    "materials",
    "review",
  ]);
  expect(GUIDED_STUDIO_TASKS.every((task) => task.label.length > 0 && task.nextAction.length > 0)).toBe(true);
});

test("pointer, keyboard, exact value, and accepted AI resolve to one canonical edit and history label", () => {
  const base = {
    target: { kind: "wall" as const, id: "wall-north" },
    operation: "set" as const,
    field: "lengthFt",
    value: 24,
  };
  const inputs: StudioEditIntent["input"][] = ["pointer", "keyboard", "exact", "ai-accepted"];
  const edits = inputs.map((input) => ({ ...base, input }) satisfies StudioEditIntent);

  expect(edits.map(canonicalEdit)).toEqual(Array(4).fill(canonicalEdit(edits[0])));
  expect(edits.map(studioHistoryLabel)).toEqual(Array(4).fill("Set wall lengthFt"));
});

test("collapsing evidence cannot hide blockers or promote the project claim", () => {
  const evidence = [
    { id: "permit", severity: "blocking" as const, label: "Local permit review is still required" },
    { id: "cost", severity: "warning" as const, label: "Supplier quote is older than 30 days" },
    { id: "source", severity: "info" as const, label: "Plan source recorded" },
  ];
  const open = evidenceSummary(evidence, "design-intent", true);
  const collapsed = evidenceSummary(evidence, "design-intent", false);

  expect(collapsed.claimState).toBe(open.claimState);
  expect(collapsed.blockingCount).toBe(1);
  expect(collapsed.visibleBlockingIds).toEqual(["permit"]);
  expect(collapsed.canAdvanceClaim).toBe(false);
  expect(collapsed.compactText).toContain("1 blocker");
});

test("invalid exact input remains editable and names the violated constraint", () => {
  expect(invalidExactInput("2'-3\"", "Wall length must be at least 6 ft")).toEqual({
    accepted: false,
    raw: "2'-3\"",
    constraint: "Wall length must be at least 6 ft",
    recoverable: true,
  });
});

test("a guided 2D task exposes the canvas and first-edit tools in the first 1280 by 720 viewport", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.use.baseURL, "served UX02 viewport proof runs with the manifest's local base URL");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/build?mode=guided");

  const rendererCanvas = page.locator(".builder-viewport canvas").first();
  await expect(rendererCanvas).toBeAttached({ timeout: 90_000 });
  await rendererCanvas.evaluate((element) => element.setAttribute("data-ux02-renderer-identity", "preserved"));

  await page
    .getByRole("navigation", { name: "Guided design steps" })
    .getByRole("button", { name: "Rooms", exact: true })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.getByRole("region", { name: "Project controls" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Guided design steps" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Primary design canvas" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Contextual inspector" })).toBeAttached();
  await expect(page.getByRole("complementary", { name: "Project evidence" })).toBeAttached();

  const plan = page.getByRole("region", { name: "Primary design canvas" }).locator("svg").first();
  const tools = page.getByRole("group", { name: "Tool" }).first();
  await expect(plan).toBeVisible();
  await expect(tools).toBeVisible();

  const [planBox, toolsBox, scrollY] = await Promise.all([
    plan.boundingBox(),
    tools.boundingBox(),
    page.evaluate(() => window.scrollY),
  ]);
  expect(scrollY).toBe(0);
  expect(planBox, "the editable plan has a rendered box").not.toBeNull();
  expect(toolsBox, "the first-edit tool group has a rendered box").not.toBeNull();
  expect(planBox!.y).toBeLessThan(720);
  expect(planBox!.y + planBox!.height).toBeGreaterThan(0);
  expect(toolsBox!.y).toBeLessThan(720);
  expect(toolsBox!.y + toolsBox!.height).toBeGreaterThan(0);

  await expect(rendererCanvas).toHaveAttribute("data-ux02-renderer-identity", "preserved");
});

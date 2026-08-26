import { expect, test } from "playwright/test";

import {
  GUIDED_STUDIO_TASKS,
  canonicalEdit,
  contextualInspectorState,
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

test("the contextual inspector distinguishes empty and active-tool states", () => {
  const task = GUIDED_STUDIO_TASKS.find((candidate) => candidate.id === "rooms")!;
  const empty = contextualInspectorState({ task });
  const tool = contextualInspectorState({
    task,
    tool: {
      label: "Shape tool",
      guidance: "Select a corner, wall, opening, or room.",
      actions: ["Select an object", "Use arrow keys for a measured nudge"],
    },
  });

  expect(empty).toMatchObject({ state: "empty", heading: "Nothing selected" });
  expect(empty.description).toBe(task.nextAction);
  expect(tool).toMatchObject({ state: "tool", heading: "Shape tool" });
  expect(tool.actions).toEqual(["Select an object", "Use arrow keys for a measured nudge"]);
});

test("a selected object projects identity, dimensions, placement, and canonical actions", () => {
  const task = GUIDED_STUDIO_TASKS.find((candidate) => candidate.id === "rooms")!;
  const state = contextualInspectorState({
    task,
    tool: { label: "Shape tool", guidance: "Shape the plan.", actions: [] },
    selection: {
      kind: "wall",
      id: "wall-north",
      identity: "North wall",
      dimensions: [
        { label: "Length", value: "24 ft" },
        { label: "Thickness", value: "0.5 ft" },
      ],
      placement: "Between vertex-1 and vertex-2",
      actions: ["Drag", "Arrow keys", "Type an exact value"],
    },
  });

  expect(state).toMatchObject({
    state: "selection",
    heading: "North wall",
    selectionKind: "wall",
    selectionId: "wall-north",
    placement: "Between vertex-1 and vertex-2",
  });
  expect(state.dimensions).toEqual([
    { label: "Length", value: "24 ft" },
    { label: "Thickness", value: "0.5 ft" },
  ]);
  expect(state.actions).toContain("Type an exact value");
});

test("an invalid exact value outranks selection and preserves the raw value and constraint", () => {
  const task = GUIDED_STUDIO_TASKS.find((candidate) => candidate.id === "rooms")!;
  const state = contextualInspectorState({
    task,
    tool: { label: "Shape tool", guidance: "Shape the plan.", actions: [] },
    selection: {
      kind: "wall",
      id: "wall-north",
      identity: "North wall",
      dimensions: [{ label: "Length", value: "24 ft" }],
      placement: "Between vertex-1 and vertex-2",
      actions: ["Type an exact value"],
    },
    invalid: invalidExactInput("-1", "Wall wall-north must be longer than zero feet."),
  });

  expect(state).toMatchObject({
    state: "invalid",
    heading: "Check North wall",
    raw: "-1",
    constraint: "Wall wall-north must be longer than zero feet.",
    recoverable: true,
  });
});

test("a guided 2D task exposes the canvas and first-edit tools in the first 1280 by 720 viewport", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.PLAYWRIGHT_TEST_BASE_URL && !testInfo.project.use.baseURL,
    "served UX02 viewport proof runs with the manifest's local base URL",
  );
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/build?mode=guided");

  const rendererCanvas = page.locator(".builder-viewport canvas").first();
  await expect(rendererCanvas).toBeAttached({ timeout: 90_000 });
  await rendererCanvas.evaluate((element) => element.setAttribute("data-ux02-renderer-identity", "preserved"));

  const steps = page.getByRole("navigation", { name: "Guided design steps" });
  await steps.getByRole("button", { name: "Rooms", exact: true }).click();
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

test("the served contextual inspector exposes tool, selection, and invalid states without moving the document hash", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.PLAYWRIGHT_TEST_BASE_URL && !testInfo.project.use.baseURL,
    "served UX03 inspector proof runs with the manifest's local base URL",
  );
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/build?mode=guided");
  await expect(page.locator(".builder-viewport canvas").first()).toBeAttached({ timeout: 90_000 });

  /* The default project is intentionally legacy geometry. Enter the graph
     editor through the same explicit, undoable conversion a person uses, then
     return to Guided Rooms; the proof must not inject a graph-only fixture. */
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toBeVisible();
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  const steps = page.getByRole("navigation", { name: "Guided design steps" });
  await steps.getByRole("button", { name: "Rooms", exact: true }).click();

  const root = page.locator("[data-active-design-hash]");
  const before = await root.getAttribute("data-active-design-hash");

  const inspector = page.getByRole("region", { name: "Selection inspector" });
  await expect(inspector).toHaveAttribute("data-inspector-state", "tool");

  const wall = page.getByRole("button", { name: /^Wall .* feet long, .* feet thick$/ }).first();
  await wall.click();
  await expect(inspector).toHaveAttribute("data-inspector-state", "selection");
  await expect(inspector).toContainText("Type an exact value");

  await steps.getByRole("button", { name: "Shell", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspector-state", "tool");
  await expect(inspector).not.toHaveAttribute("data-selection-kind", /.+/);
  await expect(inspector).toContainText("Shell tools");
  await steps.getByRole("button", { name: "Rooms", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspector-state", "selection");

  const length = page.getByLabel(/Wall .* · length \(feet\)/).first();
  await length.fill("-1");
  await length.press("Enter");
  await expect(inspector).toHaveAttribute("data-inspector-state", "invalid");
  await expect(inspector).toContainText("-1");
  await expect(inspector).toContainText(/must be longer than zero feet/i);

  await steps.getByRole("button", { name: "Shell", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspector-state", "tool");
  await expect(inspector).not.toContainText(/must be longer than zero feet/i);
  await steps.getByRole("button", { name: "Rooms", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspector-state", "invalid");
  await expect(inspector).toContainText("-1");
  await expect(root).toHaveAttribute("data-active-design-hash", before ?? "");
});

test("a served graph edit stays canonical when the visible model is selected", async ({ page }, testInfo) => {
  test.skip(
    !process.env.PLAYWRIGHT_TEST_BASE_URL && !testInfo.project.use.baseURL,
    "served UX03 graph-selection proof runs with the manifest's local base URL",
  );
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/build?mode=guided");
  const canvas = page.locator(".builder-viewport canvas").first();
  await expect(canvas).toBeAttached({ timeout: 90_000 });

  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("button", { name: "Convert to planar editing" }).click();
  await expect(page.getByRole("heading", { name: "Planar building graph" })).toBeVisible();
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  const steps = page.getByRole("navigation", { name: "Guided design steps" });
  await steps.getByRole("button", { name: "Rooms", exact: true }).click();

  const inspector = page.getByRole("region", { name: "Selection inspector" });
  const wall = page.getByRole("button", { name: /^Wall .* feet long, .* feet thick$/ }).first();
  await wall.click();
  const length = page.getByLabel(/Wall .* · length \(feet\)/).first();
  await length.fill("40");
  await length.press("Enter");
  await expect(inspector).toContainText("40 ft");

  await steps.getByRole("button", { name: "Shell", exact: true }).click();
  await expect(inspector).toHaveAttribute("data-inspector-state", "tool");
  const box = await canvas.boundingBox();
  expect(box, "the graph model canvas has a rendered box").not.toBeNull();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height * 0.58 } });

  await expect(inspector).toHaveAttribute("data-inspector-state", "selection");
  await expect(inspector).toContainText("Ground floor");
  await expect(inspector).toContainText("40 ft");
  await expect(inspector).not.toContainText("Legacy massing volume");
  await expect(inspector).not.toContainText("Main house");
});

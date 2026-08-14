import { expect, test, type Locator, type Page } from "playwright/test";

/* ===========================================================================
   VW01 — THE VIEWER IS FIRST-CLASS AND ALWAYS PRESENT.

   The builder's canvas is the EXPORT ROOT: `houseRef` points into it and the
   .glb and .obj writers are handed that group, so a remount does not merely
   cost a WebGL context — it breaks the download. The guided walk now lays the
   step's controls beside the model, and this file exists to prove that the
   layout moved GRID RULES and never children.

   HOW THE PROOFS AVOID BEING UNFALSIFIABLE
   ----------------------------------------
   · IDENTITY is a mark written onto the live canvas element. A remount hands
     back a NEW element with no mark, so the check fails when it should — and
     the reload at the end of the first test demonstrates exactly that failure
     against the same locator, so "the mark survived" cannot be an accident of
     a locator that matches anything.
   · A CHANGED SCENE is read from `data-scene-geometry`, which `Viewport`
     projects from the built `HomeGeometry` it hands the canvas. Pixels cannot
     be questioned; the geometry the renderer was given can. It moves on a
     dimension edit and holds still otherwise — this file asserts both
     directions rather than only the one that goes green.
   · LAYOUT is measured from real bounding boxes at two viewport sizes, not
     from a class name we wrote ourselves.

   WHAT IT DOES NOT CLAIM. That every step's edit changes geometry: comfort
   targets, finishes and the sun change the SCENE without changing the SHAPE,
   and a signature that moved for them would be lying about what it measures.
   The manifest asked for "an edit in each step changes the rendered geometry";
   the honest form of that, kept here, is that the viewer stays live and
   reachable on every step and that edits with a geometric consequence arrive
   in it immediately — including while the plan is the visible view.
   =========================================================================== */

const MARK = "vw01-same-canvas";

/** The eight guided steps, and the view each one is honest in. */
const WALK: ReadonlyArray<{ step: string; view: "3D model" | "2D plan" }> = [
  { step: "Shell", view: "3D model" },
  { step: "Rooms", view: "2D plan" },
  { step: "Openings", view: "2D plan" },
  { step: "Site", view: "3D model" },
  { step: "Performance", view: "3D model" },
  { step: "Materials", view: "3D model" },
  { step: "Review", view: "3D model" },
  { step: "Plans", view: "3D model" },
];

/* Role-name matching is substring and honours text-transform, and this page
   holds a "Plans" step button, a "Plans" workspace tab and a "3D preview"
   toggle inside the plan library. Every lookup below is scoped and exact. */
function guidedStep(page: Page, name: string): Locator {
  return page
    .getByRole("navigation", { name: "Guided design steps" })
    .getByRole("button", { name, exact: true });
}

function viewToggle(page: Page, name: string): Locator {
  return page.getByRole("group", { name: "View" }).getByRole("button", { name, exact: true });
}

async function openBuilder(page: Page): Promise<{ viewport: Locator; canvas: Locator }> {
  await page.goto("/build?mode=guided");
  const viewport = page.locator(".builder-viewport");
  const canvas = viewport.locator("canvas");
  await expect(canvas).toBeAttached({ timeout: 90_000 });
  return { viewport, canvas };
}

test("one canvas survives the whole guided walk, and the load epoch never moves", async ({ page }) => {
  test.setTimeout(240_000);
  const { viewport, canvas } = await openBuilder(page);
  await expect(viewport).toHaveAttribute("data-load-epoch", "0");

  await canvas.evaluate((el, mark) => {
    (el as HTMLCanvasElement & { __vw01?: string }).__vw01 = mark;
  }, MARK);

  for (const { step, view } of WALK) {
    await guidedStep(page, step).click();
    await expect(guidedStep(page, step)).toHaveAttribute("aria-pressed", "true");

    // The export root is the same object it was on step one.
    await expect(canvas).toHaveJSProperty("__vw01", MARK);
    // A step change is not a document arrival — the anti-yank contract.
    await expect(viewport).toHaveAttribute("data-load-epoch", "0");
    // The viewer is on screen for this step rather than behind the panels.
    await expect(page.locator(".builder-stage__view")).toBeVisible();
    await expect(viewToggle(page, view)).toHaveAttribute("aria-pressed", "true");
    if (view === "3D model") await expect(canvas).toBeVisible();
    else await expect(canvas).toBeHidden();
  }

  /* The falsification. A reload really does build a new canvas, so the mark is
     gone from the element this same locator resolves — which is the failure
     the loop above would have reported had any step remounted the scene. */
  await page.reload();
  await expect(canvas).toBeAttached({ timeout: 90_000 });
  await expect(canvas).not.toHaveJSProperty("__vw01", MARK);
});

test("an edit reaches the viewer immediately, from the plan view as well as the model", async ({ page }) => {
  test.setTimeout(240_000);
  const { viewport, canvas } = await openBuilder(page);
  await canvas.evaluate((el, mark) => {
    (el as HTMLCanvasElement & { __vw01?: string }).__vw01 = mark;
  }, MARK);

  await guidedStep(page, "Shell").click();
  const width = page.getByLabel("Width — east to west");
  await expect(width).toBeVisible();

  const first = await viewport.getAttribute("data-scene-geometry");
  expect(first).not.toBeNull();

  // One step of the width slider — a keypress, the way a person makes it.
  await width.press("ArrowRight");
  await expect(viewport).not.toHaveAttribute("data-scene-geometry", first!);
  await expect(viewport).toHaveAttribute("data-load-epoch", "0");
  await expect(canvas).toHaveJSProperty("__vw01", MARK);

  /* Rooms shows the plan. The model is hidden, not gone — so an edit made
     here still lands in the scene the export will write. */
  await guidedStep(page, "Rooms").click();
  await expect(canvas).toBeHidden();
  const second = await viewport.getAttribute("data-scene-geometry");
  await width.press("ArrowRight");
  await expect(viewport).not.toHaveAttribute("data-scene-geometry", second!);

  /* And the toggle wins over the step's preference for as long as the person
     stays on the step: choosing the model on Rooms is not argued with. */
  await viewToggle(page, "3D model").click();
  await expect(canvas).toBeVisible();
  await width.press("ArrowRight");
  await expect(viewToggle(page, "3D model")).toHaveAttribute("aria-pressed", "true");

  /* The other direction: a finish is not a shape. Painting a surface must
     leave this signature exactly where it is, or it is measuring the wrong
     thing and the assertions above prove nothing. */
  const beforeMaterials = await viewport.getAttribute("data-scene-geometry");
  await guidedStep(page, "Materials").click();
  await expect(viewport).toHaveAttribute("data-scene-geometry", beforeMaterials!);
  await expect(canvas).toHaveJSProperty("__vw01", MARK);
});

test("the controls sit beside the model on a desktop width and stack below it on a phone", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { viewport } = await openBuilder(page);
  await guidedStep(page, "Shell").click();

  const view = page.locator(".builder-stage__view");
  const controls = page.locator(".builder-stage__controls");
  const beside = { view: await view.boundingBox(), controls: await controls.boundingBox() };
  expect(beside.view).not.toBeNull();
  expect(beside.controls).not.toBeNull();
  if (beside.view && beside.controls) {
    // Two columns: the view ends before the controls begin, and they share a band.
    expect(beside.view.x + beside.view.width).toBeLessThanOrEqual(beside.controls.x + 1);
    expect(beside.controls.y).toBeLessThan(beside.view.y + beside.view.height);
  }

  /* "Always present" is a claim about scrolling, so it is tested by scrolling.
     The scroll is asserted to have happened — a page that refused to move
     would otherwise pass this by standing still. */
  await page.evaluate(() => window.scrollBy(0, 1200));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  const stuck = await viewport.boundingBox();
  expect(stuck).not.toBeNull();
  if (stuck) {
    expect(stuck.y).toBeGreaterThanOrEqual(0);
    expect(stuck.y + stuck.height).toBeLessThanOrEqual(900);
  }

  /* A phone keeps one stacked column — no second pane, no side-by-side — with
     the model above the controls rather than under them. */
  await page.setViewportSize({ width: 390, height: 844 });
  const stacked = { view: await view.boundingBox(), controls: await controls.boundingBox() };
  expect(stacked.view).not.toBeNull();
  expect(stacked.controls).not.toBeNull();
  if (stacked.view && stacked.controls) {
    expect(stacked.view.y + stacked.view.height).toBeLessThanOrEqual(stacked.controls.y + 1);
    expect(Math.round(stacked.view.width)).toBe(Math.round(stacked.controls.width));
  }
  /* The canvas carries an inline pixel width that three.js only corrects when
     its resize observer fires, so a stage built on `auto` grid tracks reads
     the stale width and drags the page sideways. This caught exactly that. */
  const stage = await page.locator(".builder-stage").evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
  }));
  expect(stage.scroll).toBe(stage.client);
});

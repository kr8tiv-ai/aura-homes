import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "playwright/test";

import {
  deviceCapabilities,
  failedProposalRecovery,
} from "@/lib/builder/guidedStudio";

/* ===========================================================================
   VW03 — THE PLAN A PERSON CAN REACH, ON THE DEVICE THEY HAVE ON SITE.

   WHAT THIS FILE IS ACTUALLY ABOUT, because it is not what its name suggests.
   The dimensioned drawing already existed before this node started: sheet A3
   FLOOR PLAN, dimensioned inside and out, produced by `lib/builder/drawings/`
   and rendered by the `drawings` workspace. What did not exist was a way to
   REACH it from guided mode — the workspace tab strip renders only in Pro, no
   GUIDED_STEPS entry maps to `drawings`, and guided is the mode a phone lands
   in. So the assertions below are about reachability, read-only-ness and cost,
   and there is deliberately no assertion here about how a wall is drawn: that
   belongs to `export-pdf.spec.ts` and the drawing modules' own tests, and a
   second opinion about the same lines is how two renderers get born.

   WHY A NEW FILE RATHER THAN MORE OF `builder-viewer.spec.ts`. That file is
   VW01's, and its phone case — the view stacked above the controls, both the
   same width, `.builder-stage` not scrolling sideways — is the thing this node
   must keep passing rather than edit. Extending it would let a regression in
   this work be hidden by a loosened pin over there. It is not modified.

   HOW EACH PROOF AVOIDS BEING UNFALSIFIABLE
   -----------------------------------------
   · THE SHEET THAT ARRIVES is asserted BOTH ways: A3 pressed and A0 not. A
     check that only looks for A3 would pass against a set that showed all
     eight at once, or against a locator that matches the index button rather
     than the sheet.
   · NO ANIMATION is measured as real WebGL draw calls, counted by a patch
     installed before any page script runs — not read off an attribute this
     repo wrote itself. The same counter is first PROVEN LIVE by orbiting the
     model and watching it climb; only then is it asserted to stand still.
   · READ-ONLY is `hashBuilderDocument` — published on the builder root as
     `data-active-design-hash` via `documentSignature`, which is that function
     (store.ts:442) — sampled after pressing every control the route leaves on
     screen. And the same attribute is then MOVED, on the same page, by one
     keypress on a real editor, so "the hash held still" cannot be an accident
     of an attribute that never changes.
   =========================================================================== */

/* The phone the manifest names. Set at file scope so the FIRST paint is a
   phone paint: a desktop-first load that is resized afterwards can pass a
   layout assertion that a real phone would fail, because the grid was solved
   once at 1280 and the second solve inherited its measurements. */
test.use({ viewport: { width: 390, height: 844 } });

const PHONE = { width: 390, height: 844 } as const;

test("the phone contract reviews the canonical plan without pretending to be full CAD", () => {
  const phone = deviceCapabilities("phone");
  const desktop = deviceCapabilities("desktop");

  expect(phone.artifact).toBe("canonical-plan");
  expect(phone.actions).toEqual(["review", "measure", "comment", "light-correction"]);
  expect(phone.actions).not.toContain("structural-edit");
  expect(phone.fullCadParity).toBe(false);
  expect(desktop.fullCadParity).toBe(true);
  expect(desktop.artifact).toBe(phone.artifact);
});

test("a failed model proposal preserves the current project and offers useful recovery", () => {
  expect(failedProposalRecovery("sha256:current-project", "The image did not contain a readable plan")).toEqual({
    accepted: false,
    preservedProjectHash: "sha256:current-project",
    message: "The image did not contain a readable plan",
    actions: ["retry", "manual-start"],
  });
});

test("the compact Guided Studio shell fits a phone without widening the page", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/build?mode=guided");
  await expect(page.locator(".builder-viewport canvas").first()).toBeAttached({ timeout: 90_000 });
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.getByRole("region", { name: "Project controls" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Guided design steps" })).toBeVisible();

  for (const selector of ["html", ".builder-page", ".builder-mode-shell", ".builder-project-bar"]) {
    const box = await page.locator(selector).first().evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(box.client, `${selector} is rendered`).toBeGreaterThan(0);
    expect(box.scroll, `${selector} has no horizontal overflow`).toBe(box.client);
  }
});

/** Role-name matching is substring and honours text-transform, and this page
 *  holds a "Plans" step button, a "Plans" workspace tab and a "3D preview"
 *  toggle inside the plan library. Scoped and exact, the same way VW01 does. */
function guidedStep(page: Page, name: string): Locator {
  return page
    .getByRole("navigation", { name: "Guided design steps" })
    .getByRole("button", { name, exact: true });
}

/** The route control in the guided shell — the one thing this node added to
 *  the walk. `data-plan-route` carries open/closed so the state is readable
 *  without depending on the button's wording. */
const routeStrip = (page: Page): Locator => page.locator("[data-plan-route]").first();

/** The builder root publishes the canonical document hash. */
const designHash = (page: Page): Promise<string> =>
  page
    .locator("[data-active-design-hash]")
    .first()
    .evaluate((el) => el.getAttribute("data-active-design-hash") ?? "");

async function openBuilder(page: Page): Promise<Locator> {
  await page.goto("/build?mode=guided");
  const canvas = page.locator(".builder-viewport canvas");
  await expect(canvas).toBeAttached({ timeout: 90_000 });
  return canvas;
}

async function openPlanRoute(page: Page): Promise<void> {
  await expect(routeStrip(page)).toHaveAttribute("data-plan-route", "closed");
  await routeStrip(page).getByRole("button", { name: "Open the drawings" }).click();
  await expect(routeStrip(page)).toHaveAttribute("data-plan-route", "open");
}

/** The sheet index inside the drawing set panel: eight buttons, one per sheet. */
const sheetButton = (page: Page, number: string): Locator =>
  page.getByRole("button", { name: new RegExp(`^${number}\\b`) }).first();

/* ------------------------------------------------------------------ 1. reach */

test("the dimensioned plan is reachable from guided mode on a phone, and A3 is the sheet that arrives", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await openBuilder(page);

  /* THE DEFECT, STATED AS AN ASSERTION. Guided is what a phone lands in, and
     guided has no workspace tab strip — so if the route below is ever gated
     back to Pro, this is where it is noticed. */
  await expect(page.getByRole("tablist", { name: "Builder workspaces" })).toHaveCount(0);
  await openPlanRoute(page);

  /* The set generated itself on arrival: nobody standing in a field wants to
     be met by a button called "Generate the drawing". */
  await expect(page.getByText(/The drawing set — \d+ sheets/)).toBeVisible({ timeout: 60_000 });

  // The sheet on screen is the dimensioned one, and the cover is not.
  await expect(sheetButton(page, "A3")).toHaveAttribute("aria-pressed", "true");
  await expect(sheetButton(page, "A0")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("A3 · FLOOR PLAN").first()).toBeVisible();
  const sheet = page.locator('img[alt^="Sheet A3"]');
  await expect(sheet).toBeVisible();
  /* A drawing without a stated scale is a picture. The alt text carries the
     one the sheet was actually drawn at, so this fails if A3 ever arrives as
     an unscaled illustration. */
  await expect(sheet).toHaveAttribute("alt", /^Sheet A3, FLOOR PLAN, at .+\. /);

  /* Both doors out are on the phone: the one sheet, and the whole set as the
     PDF a person can hand to somebody on site. */
  await expect(page.getByRole("link", { name: "Download A3" })).toHaveAttribute(
    "download",
    /^aura-.*-A3\.svg$/,
  );
  await expect(page.getByRole("button", { name: "Download the set (.pdf)" })).toBeEnabled();
});

/* ------------------------------------------------- 2. it fits, without lying */

test("nothing the plan route puts on a 390px screen pushes the page sideways", async ({ page }) => {
  test.setTimeout(240_000);
  await openBuilder(page);
  await openPlanRoute(page);
  await expect(page.getByText(/The drawing set — \d+ sheets/)).toBeVisible({ timeout: 60_000 });

  /* Per surface, not once. A single measurement on <html> passes while a panel
     three levels down clips its own overflow and hides the defect from the
     page but not from the thumb trying to read it. */
  const surfaces: ReadonlyArray<{ what: string; locator: Locator }> = [
    { what: "the document", locator: page.locator("html") },
    { what: "the stage", locator: page.locator(".builder-stage") },
    { what: "the view column", locator: page.locator(".builder-stage__view") },
    { what: "the controls column", locator: page.locator(".builder-stage__controls") },
    { what: "the route strip", locator: routeStrip(page) },
    { what: "the viewer tool row", locator: page.locator(".builder-tool-row") },
    { what: "the guided shell", locator: page.locator(".builder-mode-shell") },
  ];
  for (const { what, locator } of surfaces) {
    const box = await locator.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(box.client, `${what} is on screen`).toBeGreaterThan(0);
    expect(box.scroll, `${what} overflows its own width at ${PHONE.width}px`).toBe(box.client);
  }

  /* THE ONE DELIBERATE SCROLLER, asserted as such rather than exempted. The
     sheet is a drawing at a stated scale; shrinking it to 390px would make the
     dimensions unreadable, so it pans inside its own frame. The claim is that
     the FRAME fits the phone and the DRAWING does not fit the frame — which is
     a different thing from the page dragging sideways, and would fail if the
     frame ever stopped clipping. */
  const frame = page
    .locator("div.overflow-x-auto")
    .filter({ has: page.locator('img[alt^="Sheet"]') })
    .first();
  const framed = await frame.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(framed.client).toBeLessThanOrEqual(PHONE.width);
  expect(framed.scroll).toBeGreaterThan(framed.client);
});

/* ------------------------------------------------------ 3. the phone's 3D bill */

test("the phone canvas is live but never animates: it draws when asked and not otherwise", async ({
  page,
}) => {
  test.setTimeout(240_000);

  /* A REAL MEASUREMENT, not a self-written attribute. Every WebGL context the
     page creates gets its draw entry points wrapped before three.js sees it,
     so what is counted is frames the GPU was actually asked to draw. */
  await page.addInitScript(() => {
    type Tally = { canvas: HTMLCanvasElement; draws: number };
    const w = window as unknown as { __vw03?: Tally[] };
    const tallies: Tally[] = [];
    w.__vw03 = tallies;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) {
      const context = (original as (...a: unknown[]) => unknown).apply(this, args) as
        | (Record<string, unknown> & { __vw03seen?: boolean })
        | null;
      const kind = String(args[0] ?? "");
      if (context && kind.includes("webgl") && context.__vw03seen !== true) {
        context.__vw03seen = true;
        /* PER CANVAS, not one global number. A page can hold more than one
           WebGL context — the plan catalog carries a preview canvas of its
           own — and "something drew" is not a finding anybody can act on. */
        const tally: Tally = { canvas: this, draws: 0 };
        tallies.push(tally);
        for (const name of [
          "drawArrays",
          "drawElements",
          "drawArraysInstanced",
          "drawElementsInstanced",
        ]) {
          const fn = context[name];
          if (typeof fn === "function") {
            context[name] = function counted(this: unknown, ...callArgs: unknown[]) {
              tally.draws += 1;
              return (fn as (...a: unknown[]) => unknown).apply(this, callArgs);
            };
          }
        }
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  const canvas = await openBuilder(page);
  await openPlanRoute(page);
  await expect(canvas).toBeVisible();

  /** Every WebGL context on the page, named by where it is mounted. */
  const tally = (): Promise<Array<{ where: string; draws: number; onScreen: boolean }>> =>
    page.evaluate(() =>
      (
        (window as unknown as {
          __vw03?: Array<{ canvas: HTMLCanvasElement; draws: number }>;
        }).__vw03 ?? []
      ).map((t) => ({
        where: t.canvas.closest("[class]")?.className.slice(0, 60) ?? "unparented canvas",
        draws: t.draws,
        onScreen: t.canvas.getClientRects().length > 0,
      })),
    );
  /** The BUILDER's own canvas, named rather than summed. A page-wide total
   *  would let a silent model hide behind a busy preview canvas somewhere
   *  else, and would blame this node for a canvas it does not own. */
  const draws = async (): Promise<number> => {
    const rows = await tally();
    const builder = rows.find((t) => t.where.includes("builder-viewport__stage"));
    expect(builder, `no builder canvas among: ${rows.map((r) => r.where).join(" | ")}`).toBeTruthy();
    return builder?.draws ?? -1;
  };

  /* THE PROBE IS PROVEN LIVE FIRST. Orbiting is a view action — it is the one
     thing a thumb is supposed to be able to do here — and it must make the
     counter climb. Without this half, "the counter did not move" is equally
     consistent with a patch that never attached to anything. */
  /* SCROLLED INTO VIEW FIRST, and the first run is why: `boundingBox()` is
     viewport-relative, the plan route puts the guided shell above the stage,
     and a mouse press at y > 844 lands on nothing at all. The counter sat at
     exactly 532 through the whole drag — a probe that was attached and working
     being handed an interaction that never reached the canvas. */
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("the canvas has no box to orbit");
  expect(box.y, "the model must be on screen to be orbited").toBeLessThan(PHONE.height);
  const cx = box.x + box.width / 2;
  const cy = Math.min(box.y + box.height / 2, PHONE.height - 40);
  const before = await draws();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 70, cy + 25, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(draws, { timeout: 20_000, message: "orbiting the model must draw frames" })
    .toBeGreaterThan(before);

  /* --------------------------------------------------------- the idle bill

     THE ASSERTION IS "IT STOPS", NOT "IT IS SLOW", and the measurements are
     the reason. A rate ceiling was the obvious shape and it is worthless here:
     this scene renders at about 87 draw calls per frame and, under the
     software GL a headless browser uses, manages only 7–8 frames a second — so
     a `frameloop="always"` canvas and a demand canvas mid-damping produce the
     SAME ~700 calls per second, and any threshold between them would be
     measuring the GPU rather than the render loop.

     What an animation loop can never do is stop. A demand canvas goes to
     EXACTLY ZERO and stays there; an `always` canvas cannot produce a single
     idle second with no draws in it, at any frame rate, on any machine. So
     that is the property, and the sampling budget is generous because React
     re-renders on this page legitimately poke a frame or two out at
     unpredictable moments (measured: bursts of 2–3 frames seconds apart, with
     long stretches of zero between them — see the report's open findings). */
  await page.waitForTimeout(4_000);
  const windows: number[] = [];
  let quiet = 0;
  for (let i = 0; i < 20 && quiet < 3; i++) {
    const a = await draws();
    await page.waitForTimeout(1_000);
    const drawn = (await draws()) - a;
    windows.push(drawn);
    if (drawn === 0) quiet += 1;
  }
  expect(
    quiet,
    `the phone's canvas never went quiet — one-second windows drew ${windows.join(", ")} calls. A demand canvas reaches exactly zero and stays there; an animation loop cannot.`,
  ).toBeGreaterThanOrEqual(3);

  /* HOW THIS TEST ACTUALLY FAILS, written down so the next reader does not
     think it is broken. Flipping `frameloop` to "always" in Viewport.tsx was
     run against this file: the red did NOT arrive at the line above. It
     arrived 240 seconds earlier, as `locator.scrollIntoViewIfNeeded` timing
     out while the page was still navigating — a builder canvas rendering this
     scene continuously (about 87 draw calls a frame, through the software GL a
     headless browser has) starves the main thread badly enough that /build
     never finishes loading at a phone viewport. The gate goes red on the
     counterexample either way; it is worth knowing that the symptom is a page
     that will not load rather than a counter that ticks. */

  /* The canvas that went quiet is the one on screen — not a torn-down context
     that stopped drawing because it stopped existing. That is the failure mode
     a "no canvas on mobile" implementation would have passed this test with. */
  const last = await tally();
  const builderCanvas = last.find((t) => t.where.includes("builder-viewport__stage"));
  expect(builderCanvas?.onScreen, "the model is still mounted and visible").toBe(true);
  expect(builderCanvas?.draws ?? 0, "the model was drawn at least once").toBeGreaterThan(0);
});

/* ---------------------------------------------------------- 4. read-only means it */

test("nothing on the read-only plan route can move the document hash", async ({ page }) => {
  test.setTimeout(300_000);
  await openBuilder(page);
  await openPlanRoute(page);
  await expect(page.getByText(/The drawing set — \d+ sheets/)).toBeVisible({ timeout: 60_000 });

  const start = await designHash(page);
  expect(start).toMatch(/^0x[0-9a-f]{64}$/);

  /* FIRST: the editors are GONE, not merely awkward. A read-only claim made
     about a screen that still carries "Start over" is not a claim. */
  await expect(page.getByRole("button", { name: "Start over" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Redo" })).toHaveCount(0);
  /* `exact` matters here and the first run proved it: role-name matching is
     substring and case-insensitive, so an unqualified {name:"View"} also
     matches the axonometric's "Point of view" group, which is a read-only
     control this route deliberately keeps. */
  await expect(page.getByRole("group", { name: "View", exact: true })).toHaveCount(0);
  await expect(page.getByText("Click any surface in the view above")).toHaveCount(0);
  // The plan editor is a drag-to-move-a-wall surface. It must not be reachable.
  await expect(page.getByRole("application", { name: /Floor plan editor/ })).toBeHidden();

  /* THEN: press everything that is left. The list is the pane, read top to
     bottom — if a control is added to this route later and not added here,
     the honest failure is that this test stops being complete, which is why
     the count of index buttons is asserted rather than assumed. */
  await expect(page.getByText("The drawing set — 8 sheets")).toBeVisible();
  const sheets = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"];
  for (const number of sheets) {
    await sheetButton(page, number).click();
    await expect(sheetButton(page, number)).toHaveAttribute("aria-pressed", "true");
    expect(await designHash(page), `reading sheet ${number} changed the design`).toBe(start);
  }

  // The generator itself: a redraw is a new PICTURE of the same document.
  await page.getByRole("button", { name: /Draw it again|Redraw from the current model/ }).click();
  expect(await designHash(page), "regenerating the sheets changed the design").toBe(start);

  // The viewer tools — a cut and a floor isolation are ways of LOOKING.
  const toolRow = page.locator(".builder-tool-row");
  await toolRow.getByRole("button", { name: "Off", exact: true }).click();
  await expect(toolRow).toHaveAttribute("data-section-cut", "on");
  expect(await designHash(page), "the section cut changed the design").toBe(start);
  await toolRow.getByRole("button", { name: "Flip the kept side" }).click();
  expect(await designHash(page), "flipping the cut changed the design").toBe(start);
  await toolRow.getByRole("button", { name: "On", exact: true }).click();
  await expect(toolRow).toHaveAttribute("data-section-cut", "off");
  expect(await designHash(page), "closing the cut changed the design").toBe(start);

  /* The one writer that used to live in this row now states why it is closed,
     rather than sitting there greyed out. */
  await expect(page.locator('[data-tool-finishes="unavailable"]')).toBeVisible();

  // The axonometric's own controls, which are all local view state.
  await page.getByRole("checkbox", { name: /Show the removed lines/ }).check();
  expect(await designHash(page), "showing hidden lines changed the design").toBe(start);

  // Tapping the model picks a surface. Picking is not painting.
  const canvas = page.locator(".builder-viewport canvas");
  const box = await canvas.boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await designHash(page), "tapping the model changed the design").toBe(start);

  /* Both downloads, pressed rather than admired. The PDF is the artifact this
     node exists to put in somebody's hand, and a button that throws is the
     failure people report as "the site is broken". */
  const [svg] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("link", { name: /^Download A\d$/ }).click(),
  ]);
  expect(svg.suggestedFilename()).toMatch(/^aura-.*-A\d\.svg$/);
  const [pdf] = await Promise.all([
    page.waitForEvent("download", { timeout: 180_000 }),
    page.getByRole("button", { name: "Download the set (.pdf)" }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await designHash(page), "downloading the set changed the design").toBe(start);

  /* THE FALSIFIER. Everything above would also be satisfied by an attribute
     that never changes. Leave the route, stand on a step that really does edit
     the home, and press one arrow key: the same attribute, read the same way,
     must move. */
  await routeStrip(page).getByRole("button", { name: /^Back to / }).click();
  await expect(routeStrip(page)).toHaveAttribute("data-plan-route", "closed");
  await guidedStep(page, "Shell").click();
  const width = page.getByLabel("Width — east to west");
  await expect(width).toBeVisible();
  await width.press("ArrowRight");
  await expect
    .poll(() => designHash(page), { timeout: 20_000 })
    .not.toBe(start);
});

/* ------------------------------------------------------- 5. one drawing, one engine */

test("the plan the phone reaches is the artifact Pro produces — one drawingSet call, not a mobile redraw", () => {
  const builder = readFileSync(
    join(__dirname, "..", "components", "builder", "BuilderApp.tsx"),
    "utf8",
  );

  /* COMMENTS ARE STRIPPED FIRST, and finding that out cost this test its first
     run: the header comment written for this very node says "the same
     `drawingSet()` call", which the raw matcher counted as a second call site
     and reported the defect it was written to catch. A guard that fires on
     prose is a guard nobody keeps. Same treatment `export-pdf.spec.ts` gives
     its import-shape scan, for the same reason. */
  const strip = (source: string): string =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "")
      .replace(/[ \t]+\/\/.*$/gm, "");
  const callSites = (source: string): number => (strip(source).match(/\bdrawingSet\(/g) ?? []).length;
  const code = strip(builder);

  /* The divergence class this repo has been bitten by twice is TWO RENDERERS
     for one drawing. Counted at the call site rather than trusted: the import
     names `drawingSet` without a paren, so this matches invocations only, and
     a second engine — a phone-sized redraw, a "simple plan" fallback — would
     make it two. */
  expect(callSites(builder), "the builder must build the drawing set in exactly one place").toBe(1);

  // And the pane hands the component that ONE set, rather than rebuilding it.
  expect(code).toContain("set={drawn.set}");

  /* The guard is only worth having if it can go red. A second call site, of
     the shape a mobile branch would actually take, is counted as two — and a
     comment mentioning one still is not. */
  expect(callSites(`${builder}\nconst mobile = drawingSet({ document, dateISO });\n`)).toBe(2);
  expect(callSites(`${builder}\n/* another drawingSet() call, in prose */\n`)).toBe(1);
});

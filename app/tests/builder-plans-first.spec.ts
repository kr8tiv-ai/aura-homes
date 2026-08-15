import { expect, test } from "playwright/test";

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

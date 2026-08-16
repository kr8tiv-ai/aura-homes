import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "playwright/test";

import VariationStrip from "@/components/builder/VariationStrip";
import { FDWR_MAX } from "@/lib/design/materials";
import {
  canonicalBuilderDocumentJson,
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import { wallRunFt, wallThicknessFt } from "@/lib/builder/geometry";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
} from "@/lib/builder/projectBudget";
import { glazedAreaSqFt, totalFloorAreaSqFt, type HomeSpec } from "@/lib/builder/spec";
import { modelledGraphGlazingRatio } from "@/lib/builder/graphGeometry";
import { modelledGlazingRatio } from "@/lib/builder/toPlan";
import {
  AXIS_LABELS,
  COST_MODEL_UNMOVED,
  NOT_MODELLED_ENERGY,
  ROOF_FORM_UNPRICED,
  VARIATION_ENGINE,
  WINDOW_UNIT_PRICING,
  applyVariation,
  comparablePercents,
  glazingDisclosure,
  variationApplyLabel,
  variationSet,
  type VariationSet,
} from "@/lib/builder/variations";

/* ═══════════════════════════════════════════════════════════════════════
   VAR01 — the gates on exploring several versions of one design.

   THE CLAIM THIS FILE EXISTS TO POLICE. Chaos sells Veras, which asks a
   diffusion model for design iterations and returns pictures. This product
   does something else and must never be described as doing that: the
   variation engine is PARAMETRIC and DETERMINISTIC, it moves numbers through
   the same validated geometry pipeline the editor uses, and everything it
   emits is a real document that opens, hashes and costs.

   That is a checkable claim, so it is checked rather than written down. Every
   test below either recomputes a figure from the engines that own it and
   compares it with what the reader sees, or measures the rendered page in a
   real layout engine. Nothing here trusts a comment, including the comments
   in this file.

   WHY IT RENDERS RATHER THAN READS. A source-level assertion ("the component
   mentions the cost caveat") stays green the moment that sentence moves into
   a <details>, to the bottom of the card, or below the Apply button. Two
   recent waves in this repo shipped claims written in comments that nothing
   checked and both were false. So the component is rendered to real markup,
   attached to the real stylesheet, and measured.

   WHY IT IS STILL A PURE SPEC. renderToStaticMarkup + setContent needs no dev
   server and no export build.

   WHAT THIS FILE CANNOT SEE, SAID OUT LOUD. A static render has no event
   handlers attached, so the CLICK on Apply is not exercised here. The three
   halves of that path are pinned separately instead: `applyVariation` is
   asserted directly (it returns the variant's own spec, a unique label and an
   announcement), the label discipline is asserted against a restatement of
   the editor's coalescing rule, and the live region is asserted to exist and
   to be EMPTY on first render — so an always-on decorative label cannot pass
   for an announcement. The wiring between the button and those three is the
   one link this gate does not hold.
   ═══════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const css = readFileSync(path.join(appRoot, "app/globals.css"), "utf8");

/* ---------------------------------------------------------------------
   THE JSX HARNESS.

   Playwright's babel transform rewrites JSX in project files into its own
   component-test envelope — `{ __pw_type: "jsx", type, props, key }` — not
   into React elements. Handing one of those to renderToStaticMarkup throws.
   So the tree is converted back: every envelope becomes a real createElement
   call, and every function component defined in a transformed file is wrapped
   so its return value is converted too. The component's own code runs, its
   own hooks run, its own props flow. The detector test proves the translation
   on a known nested structure so a future Playwright that changes the
   envelope fails loudly here instead of quietly rendering nothing.

   (The same harness margin-stack.spec.ts uses, for the same reason.)
--------------------------------------------------------------------- */
interface PwJsx {
  __pw_type: "jsx";
  type: unknown;
  props?: Record<string, unknown>;
  key?: unknown;
}

const isPwJsx = (value: unknown): value is PwJsx =>
  typeof value === "object" && value !== null && (value as PwJsx).__pw_type === "jsx";

const wrappedComponents = new Map<unknown, unknown>();

function asReact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(asReact);
  if (!isPwJsx(node)) return node;
  const { children, ...rest } = node.props ?? {};
  const props: Record<string, unknown> = { ...rest };
  if (node.key !== undefined && node.key !== null) props.key = node.key;
  const type = typeof node.type === "function" ? wrapComponent(node.type) : node.type;
  if (children === undefined) return createElement(type as never, props);
  const kids = (Array.isArray(children) ? children : [children]).map(asReact);
  return createElement(type as never, props, ...(kids as never[]));
}

function wrapComponent(component: unknown): unknown {
  const cached = wrappedComponents.get(component);
  if (cached !== undefined) return cached;
  const wrapper = (props: Record<string, unknown>) =>
    asReact((component as (p: Record<string, unknown>) => unknown)(props));
  Object.defineProperty(wrapper, "name", {
    value: (component as { name?: string }).name ?? "Anonymous",
  });
  wrappedComponents.set(component, wrapper);
  return wrapper;
}

const noop = () => {};

function markupFor(document: BuilderDocument): string {
  return renderToStaticMarkup(
    asReact({
      __pw_type: "jsx",
      type: VariationStrip,
      props: { document, onApply: noop },
    }) as never,
  );
}

/* --------------------------------------------------------------- fixtures */

const SCENARIO = defaultProjectBudgetScenario();
const REGION = "Alberta";
const MUNICIPALITY = "";

const DOC = defaultBuilderDocument();
const SET = variationSet({ document: DOC });
const MARKUP = markupFor(DOC);

/** Two-storey home whose upper window cannot survive losing a storey. The
 *  storeys axis MUST refuse it by name rather than quietly offering eight
 *  cards where it tried nine. */
function twoStoreyFixture(): BuilderDocument {
  const base = defaultBuilderDocument();
  const spec: HomeSpec = {
    ...base.spec,
    volumes: [
      {
        id: "main",
        name: "Main house",
        widthFt: 30,
        depthFt: 20,
        x: 0,
        z: 0,
        rotationDeg: 0,
        storeys: 2,
        wallHeightFt: 9.5,
        roof: { form: "gable", pitchDeg: 35, overhangFt: 1.5 },
        openings: [
          { id: "o1", wall: "s", kind: "window", widthFt: 5, heightFt: 4, offsetFt: 3, sillFt: 3 },
          // same metres of wall, ten feet higher — legal, and doomed at one storey
          { id: "o2", wall: "s", kind: "window", widthFt: 5, heightFt: 4, offsetFt: 3, sillFt: 12 },
        ],
      },
    ],
    deck: null,
  };
  const checked = validateBuilderDocument({ ...base, spec });
  if (!checked.ok) throw new Error(`fixture is invalid: ${checked.problem}`);
  return checked.document;
}

/** Presentation, restated. If the component ever changes how it prints money
 *  every figure assertion below stops matching, which is correct: the figures
 *  are the product. */
const cad = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

/** Currency-shaped strings as a reader reads them off the page. Anchored to
 *  end on a DIGIT so prose punctuation is not swallowed into the number. */
const dollarsIn = (text: string): string[] => text.match(/\$[\d,]*\d/g) ?? [];

/** The window count `buildBom` is handed — doors excluded. Recomputed here
 *  rather than imported, because this is the fact the blind-spot rule turns
 *  on and a shared helper would make the check circular. */
const windowsIn = (spec: HomeSpec): number =>
  spec.volumes.reduce(
    (sum, volume) => sum + volume.openings.filter((opening) => opening.kind !== "door").length,
    0,
  );

/**
 * Every geometric rule `plan-catalog.spec.ts` asserts on a published plan,
 * restated here and run over the variants. Deliberately NOT a call into
 * `openingProblems` — a checker that shares code with the thing it checks
 * proves only that the code is self-consistent.
 */
function geometryProblems(spec: HomeSpec): string[] {
  const found: string[] = [];
  const thickness = wallThicknessFt(spec.material);
  for (const volume of spec.volumes) {
    const head = volume.wallHeightFt * volume.storeys;
    for (const opening of volume.openings) {
      const run = wallRunFt(volume, opening.wall, thickness);
      if (opening.widthFt <= 0 || opening.heightFt <= 0) {
        found.push(`${volume.id}/${opening.id} has a non-positive dimension`);
      }
      if (opening.offsetFt < -1e-9 || opening.offsetFt + opening.widthFt > run + 1e-9) {
        found.push(`${volume.id}/${opening.id} leaves its ${opening.wall} wall`);
      }
      if (opening.sillFt < -1e-9 || opening.sillFt + opening.heightFt > head + 1e-9) {
        found.push(`${volume.id}/${opening.id} rises past the wall head`);
      }
    }
    for (let i = 0; i < volume.openings.length; i += 1) {
      for (let j = i + 1; j < volume.openings.length; j += 1) {
        const a = volume.openings[i];
        const b = volume.openings[j];
        if (a.wall !== b.wall) continue;
        const overlapX =
          Math.min(a.offsetFt + a.widthFt, b.offsetFt + b.widthFt) -
          Math.max(a.offsetFt, b.offsetFt);
        const overlapY =
          Math.min(a.sillFt + a.heightFt, b.sillFt + b.heightFt) - Math.max(a.sillFt, b.sillFt);
        if (overlapX > 1e-9 && overlapY > 1e-9) {
          found.push(`${volume.id}/${a.wall} ${a.id}+${b.id} overlap`);
        }
      }
    }
  }
  return found;
}

/** Mounts a static render with the real stylesheet at a desktop viewport. */
async function mount(page: import("playwright/test").Page, markup = MARKUP) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.setContent(`<main style="margin:0;padding:0">${markup}</main>`);
  await page.addStyleTag({ content: css });
  return page.locator(".variation-strip");
}

/* ═════════════════════════════════ 0 · THE DETECTORS ══════════════════ */

test("the JSX harness translates rather than invents", () => {
  const Inner = (props: { label: string }) => ({
    __pw_type: "jsx",
    type: "em",
    props: { children: props.label },
  });
  const tree = {
    __pw_type: "jsx",
    type: "div",
    props: {
      className: "probe",
      children: [
        { __pw_type: "jsx", type: "b", props: { children: "one" }, key: "a" },
        { __pw_type: "jsx", type: Inner, props: { label: "two" }, key: "b" },
      ],
    },
  };
  expect(renderToStaticMarkup(asReact(tree) as never)).toBe(
    '<div class="probe"><b>one</b><em>two</em></div>',
  );
  expect(() =>
    renderToStaticMarkup({ __pw_type: "jsx", type: "div", props: {} } as never),
  ).toThrow();
});

test("every scanner in this file discriminates, and the render is real", async ({ page }) => {
  /* A gate that cannot go red converts "unverified" into "verified" without
     doing the work, so each mechanism is proved before anything trusts it. */

  // The render is a real, populated strip and not an empty shell.
  expect(MARKUP.length, "the strip rendered essentially nothing").toBeGreaterThan(4_000);
  expect(MARKUP).toContain("variation-strip");
  expect(SET.variations.length, "no variants to check").toBeGreaterThanOrEqual(6);

  // The currency scanner finds figures, and finds none where there are none.
  expect(dollarsIn("a band of $187,400 to $457,450")).toEqual(["$187,400", "$457,450"]);
  expect(dollarsIn("no money in this sentence")).toEqual([]);
  expect(dollarsIn("the band tops out at $443,900, near the floor")).toEqual(["$443,900"]);

  // The geometry checker finds a defect, and clears a clean spec.
  expect(geometryProblems(DOC.spec)).toEqual([]);
  const broken: HomeSpec = {
    ...DOC.spec,
    volumes: DOC.spec.volumes.map((volume) => ({
      ...volume,
      openings: [
        { id: "bad", wall: "s" as const, kind: "window" as const, widthFt: 900, heightFt: 4, offsetFt: 0, sillFt: 3 },
        { id: "bad2", wall: "s" as const, kind: "window" as const, widthFt: 4, heightFt: 4, offsetFt: 1, sillFt: 3 },
      ],
    })),
  };
  expect(geometryProblems(broken).length).toBeGreaterThanOrEqual(2);

  // The window counter counts, and the validator refuses.
  expect(windowsIn(DOC.spec)).toBe(3);
  expect(validateBuilderDocument({ ...DOC, spec: { ...DOC.spec, version: 99 } }).ok).toBe(false);

  // The mounted page is a real layout, not a blank document.
  const strip = await mount(page);
  await expect(strip).toBeVisible();
  const box = await strip.boundingBox();
  expect(box, "the strip has no box — the stylesheet did not attach").not.toBeNull();
  expect(box!.height).toBeGreaterThan(500);

  /* And the overflow check can see an overflow — otherwise the mobile test
     below would pass on a page that has none for the wrong reason. */
  const overflows = async () =>
    page.evaluate(() => window.document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await overflows()).toBe(false);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.evaluate(() => {
    const wide = window.document.createElement("div");
    wide.id = "overflow-probe";
    wide.style.width = "3000px";
    wide.style.height = "1px";
    window.document.body.append(wide);
  });
  expect(await overflows(), "the overflow probe cannot see an overflow").toBe(true);
});

/* ═════════════════════════ 1 · IT IS NOT A MODEL ══════════════════════ */

test("the same design produces the same versions, every time", () => {
  const again = variationSet({ document: defaultBuilderDocument() });
  expect(again.variations.map((v) => v.id)).toEqual(SET.variations.map((v) => v.id));
  expect(again.variations.map((v) => v.designHash)).toEqual(
    SET.variations.map((v) => v.designHash),
  );
  expect(JSON.stringify(again)).toBe(JSON.stringify(SET));
  expect(again.engine).toBe(VARIATION_ENGINE);

  /* …and the comparison is not vacuous: a different design produces
     different documents under the same ids. */
  const other = twoStoreyFixture();
  const otherSet = variationSet({ document: other });
  const shared = otherSet.variations
    .map((v) => v.id)
    .filter((id) => SET.variations.some((v) => v.id === id));
  expect(shared.length).toBeGreaterThan(0);
  for (const id of shared) {
    const a = SET.variations.find((v) => v.id === id)!;
    const b = otherSet.variations.find((v) => v.id === id)!;
    expect(a.designHash).not.toBe(b.designHash);
  }
});

test("the strip never claims to be a model, and says what it is", async ({ page }) => {
  await mount(page);
  const text = await page.locator(".variation-strip").innerText();

  const FORBIDDEN =
    /\bai\b|artificial intelligence|diffusion|generative|neural|machine learning|\bprompt\w*\b|\bgenerat\w*\b|\brender\w*\b|\bimagin\w*\b|photoreal/i;

  // The scanner discriminates before it is trusted.
  expect(FORBIDDEN.test("AI-generated renderings of your home")).toBe(true);
  expect(FORBIDDEN.test("an ai model imagines the facade")).toBe(true);
  expect(FORBIDDEN.test("a deterministic, parametric variation of the document")).toBe(false);
  expect(FORBIDDEN.test("this is a comparison, not a code check")).toBe(false);

  const hit = text.match(FORBIDDEN);
  expect(
    hit === null ? "clean" : `the strip says ${JSON.stringify(hit[0])}`,
    "the variation strip must never describe itself as a model or a picture engine",
  ).toBe("clean");

  // And it says positively what it IS, in the reader's own words.
  expect(text.toLowerCase()).toContain("parametric");
  expect(text.toLowerCase()).toContain("deterministic");
  expect(text.toLowerCase()).toContain(
    "the same design always produces the same versions, in the same order",
  );
  expect(MARKUP).toContain(`data-variation-engine="${VARIATION_ENGINE}"`);
});

/* ═══════════════ 2 · EVERY VARIANT IS A REAL DOCUMENT ═════════════════ */

test("every variant validates, hashes, reopens and is distinct", () => {
  const hashes = new Set<string>([SET.basis!.designHash]);
  for (const variation of SET.variations) {
    const checked = validateBuilderDocument(variation.document);
    expect(checked.ok, `${variation.id} does not validate`).toBe(true);
    expect(hashBuilderDocument(variation.document)).toBe(variation.designHash);

    // Openable: through the canonical serialization a saved file would take.
    const reopened = validateBuilderDocument(
      JSON.parse(canonicalBuilderDocumentJson(variation.document)),
    );
    expect(reopened.ok, `${variation.id} does not reopen`).toBe(true);
    expect(hashBuilderDocument((reopened as { document: BuilderDocument }).document)).toBe(
      variation.designHash,
    );

    expect(hashes.has(variation.designHash), `${variation.id} duplicates another design`).toBe(false);
    hashes.add(variation.designHash);
  }
  expect(hashes.size).toBe(SET.variations.length + 1);
});

test("no variant puts an opening outside its wall or into another opening", () => {
  for (const variation of SET.variations) {
    expect(geometryProblems(variation.document.spec), variation.id).toEqual([]);
  }
  for (const variation of variationSet({ document: twoStoreyFixture() }).variations) {
    expect(geometryProblems(variation.document.spec), variation.id).toEqual([]);
  }
});

/* ══════════════ 3 · EVERY VARIANT CARRIES WHAT IT COSTS ═══════════════ */

test("the band on every card is createProjectBudget's band for that card's document", async ({
  page,
}) => {
  await mount(page);

  for (const variation of SET.variations) {
    /* Recomputed from the engine that owns the fact, against the document the
       card actually carries. A component that formatted its own estimate, or
       a card that showed a neighbour's band, fails here. */
    const budget = createProjectBudget({
      document: variation.document,
      scenario: SCENARIO,
      region: REGION,
      municipality: MUNICIPALITY,
      budgetCapCad: null,
    });
    expect(variation.cost.total, variation.id).toEqual(budget.total);
    expect(variation.cost.budgetHash, variation.id).toBe(budget.budgetHash);
    expect(variation.cost.midDeltaCad, variation.id).toBe(budget.total.mid - SET.basis!.total.mid);

    const card = page.locator(`.variation-card[data-variation-id="${variation.id}"]`);
    await expect(card).toBeVisible();
    const figure = await card.locator(".variation-cost-figure").innerText();
    expect(dollarsIn(figure), `${variation.id} prints a band that is not its own`).toEqual([
      cad(budget.total.low),
      cad(budget.total.high),
    ]);

    // Area and glazed area are the spec's, not a second arithmetic.
    expect(variation.areaSqFt).toBe(totalFloorAreaSqFt(variation.document.spec));
    expect(variation.glazedAreaSqFt).toBe(glazedAreaSqFt(variation.document.spec));
  }

  // Every currency figure anywhere on the strip is a band endpoint of some
  // document the strip is showing — nothing decorative, nothing invented.
  const allowed = new Set<string>([cad(SET.basis!.total.low), cad(SET.basis!.total.high)]);
  for (const variation of SET.variations) {
    allowed.add(cad(variation.cost.total.low));
    allowed.add(cad(variation.cost.total.high));
    allowed.add(cad(Math.abs(variation.cost.midDeltaCad)));
  }
  // The window-unit sentence quotes the cost model's own per-unit price.
  allowed.add("$900");
  const text = await page.locator(".variation-strip").innerText();
  const unexplained = dollarsIn(text).filter((value) => !allowed.has(value));
  expect(unexplained, "these figures appear on the strip and come from no engine").toEqual([]);
});

test("the cost model's limits are emitted by measurement, not typed beside a card", () => {
  for (const variation of SET.variations) {
    const notes = variation.cost.blindSpots;
    const basisTotal = SET.basis!.total;
    const unmoved =
      variation.cost.total.low === basisTotal.low &&
      variation.cost.total.mid === basisTotal.mid &&
      variation.cost.total.high === basisTotal.high;
    const glazingMovedWithoutCount =
      Math.abs(glazedAreaSqFt(variation.document.spec) - glazedAreaSqFt(DOC.spec)) > 1e-6 &&
      windowsIn(variation.document.spec) === windowsIn(DOC.spec);

    expect(notes.includes(COST_MODEL_UNMOVED), `${variation.id} unmoved-band note`).toBe(unmoved);
    expect(notes.includes(ROOF_FORM_UNPRICED), `${variation.id} roof note`).toBe(
      variation.axis === "roof",
    );
    expect(notes.includes(NOT_MODELLED_ENERGY), `${variation.id} energy note`).toBe(
      variation.axis === "orientation",
    );
    expect(notes.includes(WINDOW_UNIT_PRICING), `${variation.id} window-unit note`).toBe(
      glazingMovedWithoutCount,
    );
  }

  /* The conditions are not all-or-nothing: this set genuinely exercises both
     sides of every branch, so none of the four assertions above is vacuous. */
  const withUnmoved = SET.variations.filter((v) => v.cost.blindSpots.includes(COST_MODEL_UNMOVED));
  expect(withUnmoved.length).toBeGreaterThan(0);
  expect(withUnmoved.length).toBeLessThan(SET.variations.length);
  expect(SET.variations.some((v) => v.cost.blindSpots.length === 0)).toBe(true);
  expect(SET.variations.some((v) => v.axis === "roof")).toBe(true);
  expect(SET.variations.some((v) => v.axis === "orientation")).toBe(true);
});

test("a card's cost caveat sits in the cost block and above the button", async ({ page }) => {
  await mount(page);
  let checked = 0;
  for (const variation of SET.variations) {
    if (variation.cost.blindSpots.length === 0) continue;
    const card = page.locator(`.variation-card[data-variation-id="${variation.id}"]`);
    const costBox = (await card.locator(".variation-cost").boundingBox())!;
    const buttonBox = (await card.locator(".variation-apply").boundingBox())!;
    const notes = card.locator(".variation-blindspot");
    expect(await notes.count()).toBe(variation.cost.blindSpots.length);

    for (let index = 0; index < variation.cost.blindSpots.length; index += 1) {
      const note = notes.nth(index);
      await expect(note).toBeVisible();
      const noteBox = (await note.boundingBox())!;
      // Same block as the figure: contained by .variation-cost.
      expect(noteBox.y, `${variation.id} caveat escaped the cost block`).toBeGreaterThanOrEqual(
        costBox.y - 0.5,
      );
      expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(costBox.y + costBox.height + 0.5);
      // Read before you commit.
      expect(noteBox.y + noteBox.height, `${variation.id} caveat sits under the button`)
        .toBeLessThanOrEqual(buttonBox.y + 0.5);
      checked += 1;
    }
  }
  expect(checked, "no caveat was measured — the loop found nothing to check").toBeGreaterThan(3);
});

/* ═════════════════ 4 · GLASS, AND THE 22% CEILING ════════════════════ */

test("the glazing verdict is modelledGlazingRatio against FDWR_MAX, and it discloses", async ({
  page,
}) => {
  await mount(page);

  for (const variation of SET.variations) {
    const ratio = modelledGlazingRatio(variation.document.spec);
    expect(variation.glazingRatio, variation.id).toBe(ratio);
    expect(variation.overCeiling, variation.id).toBe(ratio > FDWR_MAX);

    const card = page.locator(`.variation-card[data-variation-id="${variation.id}"]`);
    const glazing = await card.locator(".variation-glazing").innerText();
    expect(glazing).toContain("NBC 9.36 prescriptive ceiling");
    expect(glazing).toContain("A comparison, not a code check.");
    expect(glazing.includes("above the"), `${variation.id} disclosure direction`).toBe(
      variation.overCeiling,
    );
    expect(glazing.includes("under the"), `${variation.id} disclosure direction`).toBe(
      !variation.overCeiling,
    );
    if (variation.overCeiling) {
      expect(glazing).toContain("trade-off path or a full performance model");
      expect(glazing).toContain("winter heat loss");
      expect(glazing).toContain("solar gain");
    }
    // The card carries the verdict as data too, so the CSS can mark it.
    await expect(card).toHaveAttribute(
      "data-variation-over-ceiling",
      variation.overCeiling ? "yes" : "no",
    );
  }

  /* BOTH BRANCHES ARE EXERCISED. Without this the direction assertions above
     could be green on a set where every card fell the same way. */
  expect(SET.variations.some((v) => v.overCeiling), "no over-ceiling variant").toBe(true);
  expect(SET.variations.some((v) => !v.overCeiling), "no under-ceiling variant").toBe(true);
});

test("the ceiling in the sentence is FDWR_MAX, printed so it can never read as a tie", () => {
  // The percent in the sentence is derived, not typed.
  expect(glazingDisclosure(0.24).sentence).toContain(`${(FDWR_MAX * 100).toFixed(0)}%`);
  expect(glazingDisclosure(0.24).over).toBe(true);
  expect(glazingDisclosure(0.18).over).toBe(false);
  expect(glazingDisclosure(FDWR_MAX).over, "the ceiling itself is not over it").toBe(false);

  // The everyday case reads exactly like the catalogue's eight over-ceiling plans.
  expect(comparablePercents(0.24, FDWR_MAX)).toEqual({ ratioText: "24%", ceilingText: "22%" });

  /* THE BOUNDARY. A ratio a hundredth of a point over the ceiling is genuinely
     over it, and a one-decimal format would print "22.0% — above the 22.0%
     ceiling". The formatter widens until the two numbers differ. */
  const hair = FDWR_MAX + 0.0003;
  expect(hair > FDWR_MAX).toBe(true);
  const printed = comparablePercents(hair, FDWR_MAX);
  expect(printed.ratioText).not.toBe(printed.ceilingText);
  expect(glazingDisclosure(hair).sentence).toContain(
    `${printed.ratioText} of the modelled wall area — above the ${printed.ceilingText}`,
  );
});

/* ════════════ 5 · APPLYING IS ONE UNDO STEP, AND NEVER SILENT ═════════ */

/** The editor's rule, restated: `commit` coalesces an edit into the previous
 *  history entry when the two carry the SAME label. That rule lives in
 *  BuilderApp and is not re-implemented in variations.ts; this is the model
 *  the label discipline has to satisfy. */
function historyStepsFor(labels: readonly string[]): number {
  let steps = 0;
  let previous: string | null = null;
  for (const label of labels) {
    if (label !== previous) steps += 1;
    previous = label;
  }
  return steps;
}

test("applying hands over the variant's own spec, with a label that opens a new step", () => {
  // The model of the editor's rule discriminates.
  expect(historyStepsFor(["a", "a", "a"])).toBe(1);
  expect(historyStepsFor(["a", "b"])).toBe(2);

  const first = applyVariation(SET, SET.variations[0].id, 1);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  // Identity, not a copy: the editor receives the exact spec that was priced,
  // hashed and shown. A rebuilt spec here is how a card's band stops matching
  // the design it applied.
  expect(first.spec).toBe(SET.variations[0].document.spec);

  const second = applyVariation(SET, SET.variations[1].id, 2);
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(historyStepsFor([first.label, second.label])).toBe(2);

  // The same variation twice is still two steps — the sequence is what moves.
  const again = applyVariation(SET, SET.variations[0].id, 3);
  expect(again.ok).toBe(true);
  if (!again.ok) return;
  expect(again.label).not.toBe(first.label);
  expect(historyStepsFor([first.label, again.label])).toBe(2);

  // And labels never collide across the whole grid.
  const labels = SET.variations.flatMap((variation, index) => [
    variationApplyLabel(variation.id, index + 1),
    variationApplyLabel(variation.id, index + 2),
  ]);
  expect(new Set(labels).size).toBe(labels.length);

  // A variation that is not on offer is refused with a reason, not applied.
  const missing = applyVariation(SET, "no-such-variation", 9);
  expect(missing.ok).toBe(false);
  if (missing.ok) return;
  expect(missing.problem).toContain("no-such-variation");
});

test("applying announces itself, and the strip is silent until it does", async ({ page }) => {
  const variation = SET.variations[0];
  const applied = applyVariation(SET, variation.id, 1);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  expect(applied.announcement).toContain(variation.title);
  expect(applied.announcement).toContain(AXIS_LABELS[variation.axis].toLowerCase());
  expect(applied.announcement).toContain(variation.designHash.slice(0, 10));
  expect(applied.announcement).toContain("One undo step");

  await mount(page);
  const region = page.locator(".variation-announce");
  await expect(region).toHaveAttribute("role", "status");
  await expect(region).toHaveAttribute("aria-live", "polite");
  /* EMPTY on first render. An always-on sentence here would make "applying is
     never silent" unfalsifiable — the region would say something whether or
     not anything was ever applied. */
  expect((await region.innerText()).trim()).toBe("");

  // The promise is made where a reader will see it before committing.
  const head = await page.locator(".variation-head").innerText();
  expect(head.toLowerCase()).toContain("single undo step");
});

/* ═════════════════ 6 · WHAT IT REFUSES, AND WHY ═══════════════════════ */

test("an axis that cannot produce a legal design is named, not dropped", () => {
  const set = variationSet({ document: twoStoreyFixture() });
  expect(set.unavailable).toBeNull();
  expect(set.variations.some((v) => v.id === "storeys-one")).toBe(false);

  const refusal = set.refusals.find((entry) => entry.axis === "storeys");
  expect(refusal, "losing a storey was silently dropped").toBeDefined();
  expect(refusal!.reason).toContain("Single storey");
  expect(refusal!.reason).toContain("o2");
  expect(refusal!.reason.toLowerCase()).toContain("wall head");

  /* Not vacuous: the same axis succeeds on a home that can take it, so this
     is a refusal of an illegal state rather than an axis that never works. */
  expect(SET.variations.some((v) => v.axis === "storeys")).toBe(true);
});

test("a planar-graph project offers graph glazing and names the axes that still write spec", async ({
  page,
}) => {
  const converted = convertBuilderDocumentToGraph(DOC, 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok) return;
  expect(converted.document.geometry.kind).toBe("building-graph");
  if (converted.document.geometry.kind !== "building-graph") return;

  const set: VariationSet = variationSet({ document: converted.document });
  expect(set.unavailable).toBeNull();
  expect(set.basis).not.toBeNull();
  expect(set.variations.some((variation) => variation.axis === "glazing")).toBe(true);
  expect(set.variations.some((variation) => variation.axis === "orientation")).toBe(true);
  expect(set.variations.some((variation) => variation.id === "storeys-two")).toBe(true);
  expect(set.variations.some((variation) => variation.axis === "roof")).toBe(true);
  expect(set.variations.length).toBeGreaterThan(4);
  expect(set.refusals.map((entry) => entry.axis)).toEqual(["proportion"]);
  expect(set.refusals.every((entry) => entry.reason.toLowerCase().includes("graph"))).toBe(true);

  const less = set.variations.find((variation) => variation.id === "glazing-less");
  expect(less, "less glass was not offered on the graph").toBeDefined();
  if (!less) return;
  expect(less.document.geometry.kind).toBe("building-graph");
  if (less.document.geometry.kind !== "building-graph") return;
  expect(modelledGraphGlazingRatio(less.document.geometry.graph)).toBeLessThan(
    modelledGraphGlazingRatio(converted.document.geometry.graph),
  );
  expect(less.document.spec).toEqual(converted.document.spec);

  const applied = applyVariation(set, less.id, 1);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  expect(applied.graph).toBeDefined();
  if (!applied.graph) return;
  expect(modelledGraphGlazingRatio(applied.graph)).toBe(less.glazingRatio);
  expect(glazedAreaSqFt(applied.spec)).toBe(glazedAreaSqFt(converted.document.spec));

  await mount(page, markupFor(converted.document));
  const strip = page.locator(".variation-strip");
  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute("data-variation-count", String(set.variations.length));
  expect(await page.locator(".variation-card").count()).toBe(set.variations.length);
});

/* ═══════════════════════ 7 · IT FITS ON A PHONE ═══════════════════════ */

test("the strip does not push the page sideways at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.setContent(`<main style="margin:0;padding:0">${MARKUP}</main>`);
  await page.addStyleTag({ content: css });
  await expect(page.locator(".variation-strip")).toBeVisible();

  const overflow = await page.evaluate(
    () => window.document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "the variation strip overflows a 375px viewport").toBeLessThanOrEqual(1);

  // Every card is still inside the viewport, not merely clipped by the body.
  const cards = page.locator(".variation-card");
  const count = await cards.count();
  expect(count).toBe(SET.variations.length);
  for (let index = 0; index < count; index += 1) {
    const box = (await cards.nth(index).boundingBox())!;
    expect(box.x + box.width, `card ${index} runs off the phone`).toBeLessThanOrEqual(376);
  }
});

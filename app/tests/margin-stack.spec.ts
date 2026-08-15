import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "playwright/test";

import costModelJson from "@data/alberta/cost-model.json";
import { ESTIMATE_LABEL } from "@/lib/builder/regionalCost";
import MarginStack, {
  MARGIN_ESTIMATE_LABEL,
  labourMonthsFromBasis,
  marginStackModel,
  type MarginCostModel,
} from "@/components/budget/MarginStack";

/* ═══════════════════════════════════════════════════════════════════════
   MARGIN01 — the gates on the cost story.

   WHY THIS SPEC RENDERS RATHER THAN READS. A source-level assertion
   ("the component mentions the labour") passes the moment the sentence
   moves into a <details> or to the bottom of the page while the string
   stays put. The claims this piece makes are about what a reader SEES and
   WHERE, so the component is rendered to real markup, attached to the real
   stylesheet, and measured in a real layout engine.

   WHY IT IS STILL A PURE SPEC. renderToStaticMarkup + setContent needs no
   dev server and no export build, so this runs in the fast gate alongside
   regional-cost.spec.ts. It also means the render under test is the
   NO-EFFECT, NO-ANIMATION render: zero useEffect has fired, no
   IntersectionObserver has armed, no transform has been applied. That is
   precisely the floor a prefers-reduced-motion reader is entitled to, so
   "the whole argument survives with motion stripped" is not asserted by
   proxy here — it is the only thing this file can see.

   FOUR CLAIMS, and each one has a way to go red:
     1. Every figure on screen is read from data/alberta/cost-model.json.
     2. The published ex-land triplet arrives unchanged, and the one band
        this component derives reconciles against the file's own rule.
     3. The labour trade is present, and is in the SAME BLOCK and the SAME
        SCREEN as the saving — not a footnote, not behind a disclosure.
     4. No animation library was added to express any of it.
   ═══════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const read = (...segments: string[]) => readFileSync(path.join(appRoot, ...segments), "utf8");

const componentSource = read("components/budget/MarginStack.tsx");
const budgetPageSource = read("app/budget/page.tsx");
const css = read("app/globals.css");
const packageJson = read("package.json");

const COST_MODEL = costModelJson as unknown as MarginCostModel;
const MODEL = marginStackModel(COST_MODEL);

/* ---------------------------------------------------------------------
   THE ONE PIECE OF HARNESS IN THIS FILE, and why it is here.

   Playwright's own babel transform rewrites JSX in project files into its
   component-test envelope — `{ __pw_type: "jsx", type, props, key }` — not
   into React elements. Handing one of those to renderToStaticMarkup throws
   "Objects are not valid as a React child". So the tree is converted back:
   every envelope becomes a real createElement call, and every function
   component defined in a transformed file is wrapped so its return value is
   converted too. Files under node_modules are NOT transformed, so motion's
   `m.div` (an exotic forwardRef object, never a plain function) is passed
   through untouched and renders itself.

   This is a translation, not a re-implementation: the component's own code
   runs, its own props flow, its own structure comes out. The detector test
   below proves the translation on a known nested structure INCLUDING a
   function component, so a future Playwright that changes the envelope
   fails loudly here instead of quietly rendering nothing.
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
  /* Spread rather than pass the array as one child: JSX marks its own child
     arrays as validated, a hand-built createElement call cannot, and React
     would emit a spurious "unique key prop" warning for markup that is
     perfectly keyed in the source. */
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

const MARKUP = renderToStaticMarkup(
  asReact({ __pw_type: "jsx", type: MarginStack, props: {} }) as never,
);

/** The component's own formatter, restated. If the component ever changes how
 *  it prints money, every figure assertion below stops matching — which is the
 *  correct outcome, not a nuisance: the figures are the product. */
const cad = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

/** Line items the ex-land totals actually count — the file excludes land. */
const COUNTED = COST_MODEL.lineItems.filter((item) => item.key !== "land");

/** Mounts the static render with the real stylesheet, at a desktop viewport. */
async function mount(page: import("playwright/test").Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setContent(`<main style="margin:0;padding:0">${MARKUP}</main>`);
  await page.addStyleTag({ content: css });
  return page.locator(".margin-stack");
}

/** Currency-shaped strings, as a reader would read them off the page.
 *  Anchored to end on a DIGIT: prose puts commas after figures, and
 *  `/\$[\d,]+/` swallowed the sentence's punctuation into the number. */
const dollarsIn = (text: string): string[] => text.match(/\$[\d,]*\d/g) ?? [];

/* --------------------------------------------------- 0 · THE DETECTORS */

test("the JSX harness translates rather than invents", () => {
  /* If Playwright's envelope ever changes shape, `asReact` would start
     returning the raw object and every render below would come out empty —
     which would read as a passing suite full of vacuous assertions. So the
     translation is proved on a structure that exercises all three cases: a
     host element, a nested child array, and a function component whose own
     return value needs converting. */
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

  // And a raw envelope really would break React, which is why this exists.
  expect(() =>
    renderToStaticMarkup({ __pw_type: "jsx", type: "div", props: {} } as never),
  ).toThrow();
});

test("the render under test is real and every scanner discriminates", async ({ page }) => {
  /* A gate that cannot fail converts "unverified" into "verified" without
     doing the work, so prove each mechanism before trusting anything below. */
  expect(MARKUP.length, "the component rendered essentially nothing").toBeGreaterThan(2_000);
  expect(MARKUP).toContain("margin-stack");
  expect(COUNTED.length, "the cost model has no countable lines").toBeGreaterThan(8);

  // The currency scanner finds figures, and finds none where there are none.
  expect(dollarsIn("owner $301,280 against $450,000")).toEqual(["$301,280", "$450,000"]);
  expect(dollarsIn("no money here at all")).toEqual([]);
  // …and does not eat the sentence's punctuation, which is what it used to do.
  expect(dollarsIn("the band tops out at $443,900, near the builder floor")).toEqual(["$443,900"]);

  // The source scanners match what they claim to match.
  expect(/\d{4,}/.test("const total = 301280;")).toBe(true);
  expect(/\d{4,}/.test(componentSource.replace(/\d{4,}/g, "")), "self-check").toBe(false);

  // And the mounted page is a real layout, not a blank document.
  const stack = await mount(page);
  await expect(stack).toBeVisible();
  const box = await stack.boundingBox();
  expect(box, "the stack has no box — the stylesheet did not attach").not.toBeNull();
  expect(box!.height).toBeGreaterThan(400);
});

/* ------------------------------------------- 1 · EVERY FIGURE IS SOURCED */

test("every dollar figure on screen is read from cost-model.json", async ({ page }) => {
  await mount(page);
  const rendered = await page.locator(".margin-stack").innerText();

  /* The comparison's own basis sentence is printed VERBATIM from the file and
     carries its own currency strings ("$250-450/sqft", "($150-250K)"). It is
     removed here and asserted separately below, so this scan measures the
     figures the component itself chose to print. */
  expect(rendered, "the basis is not rendered verbatim").toContain(COST_MODEL.builderComparison.basis);
  const authored = rendered.split(COST_MODEL.builderComparison.basis).join(" ");

  const allowed = new Set<string>();
  for (const line of COUNTED) {
    for (const value of [line.low, line.mid, line.high]) allowed.add(cad(value));
  }
  for (const value of [
    COST_MODEL.totalsExLand.low,
    COST_MODEL.totalsExLand.mid,
    COST_MODEL.totalsExLand.high,
    COST_MODEL.builderComparison.low,
    COST_MODEL.builderComparison.high,
    /* The two bands this component derives. They are not free-floating: the
       next test reconciles both against the file's own totalsRule. */
    MODEL.subtotal.mid,
    MODEL.contingency.mid,
  ]) {
    allowed.add(cad(value));
  }

  const printed = dollarsIn(authored);
  expect(printed.length, "no figures were found on the page at all").toBeGreaterThan(12);
  const strays = printed.filter((figure) => !allowed.has(figure));
  expect(
    strays,
    "these figures are on screen but are not any value data/alberta/cost-model.json publishes:\n" +
      strays.join("\n"),
  ).toEqual([]);
});

test("no dollar amount is typed into the component source", () => {
  /* The failure this guards is a number pasted in during a later "polish"
     pass, which then drifts away from the model in silence. Both halves of
     the scanner are proved in the detector test above. */
  const bigLiterals = componentSource.match(/\b\d{4,}\b/g) ?? [];
  expect(
    bigLiterals,
    "these numeric literals are typed into MarginStack.tsx — read them from the cost model instead:\n" +
      bigLiterals.join("\n"),
  ).toEqual([]);

  const currencyLiterals = componentSource.match(/\$\s*\d/g) ?? [];
  expect(currencyLiterals, "a currency-shaped literal is typed into MarginStack.tsx").toEqual([]);
});

/* ------------------------------------------------- 2 · THE MONEY ANCHOR */

test("the published ex-land triplet reaches the page unchanged", async ({ page }) => {
  // Direction 1: against the file's own totals — read, never recomputed.
  expect(MODEL.total).toEqual({
    low: COST_MODEL.totalsExLand.low,
    mid: COST_MODEL.totalsExLand.mid,
    high: COST_MODEL.totalsExLand.high,
  });

  /* Direction 2: against the anchored triplet named in graph v1.2 §1.2 and
     reconciled to the dollar by `agent/ npm run demo`. Written out once, here,
     exactly as regional-cost.spec.ts does it, so that an edit to the file
     cannot quietly redefine what "the anchor" means. */
  expect(MODEL.total).toEqual({ low: 199_100, mid: 301_280, high: 443_900 });

  await mount(page);
  const rendered = await page.locator(".margin-stack").innerText();
  for (const value of [MODEL.total.low, MODEL.total.mid, MODEL.total.high]) {
    expect(rendered, `${cad(value)} is missing from the page`).toContain(cad(value));
  }
});

test("the one band this component derives reconciles with the model's own rule", () => {
  /* MarginStack READS the total and SUBTRACTS the summed lines to get the
     contingency. The file's totalsRule says the contingency is the subtotal
     times contingencyPct. Those two roads have to arrive at the same place;
     if a line item is ever edited without recomputing the published totals,
     they will not, and this is where that shows up. */
  for (const column of ["low", "mid", "high"] as const) {
    expect(
      MODEL.contingency[column],
      `the ${column} contingency derived from totalsExLand disagrees with contingencyPct — ` +
        "a line item has changed without the published totals being recomputed",
    ).toBe(Math.round(MODEL.subtotal[column] * COST_MODEL.contingencyPct[column]));
  }

  /* The reconciliation has a way to fail. Push one line off by a thousand
     dollars and the two roads part company — proved here rather than assumed,
     because a tolerance-free equality between two expressions of the same
     arithmetic is exactly the kind of check that can be accidentally trivial. */
  const drifted = marginStackModel({
    ...COST_MODEL,
    lineItems: COST_MODEL.lineItems.map((item) =>
      item.key === "sipShell" ? { ...item, mid: item.mid + 1_000 } : item,
    ),
  });
  expect(drifted.contingency.mid).not.toBe(
    Math.round(drifted.subtotal.mid * COST_MODEL.contingencyPct.mid),
  );
});

test("the stack accumulates out of the real lines, land excluded, in file order", () => {
  expect(MODEL.lines.map((line) => line.key)).toEqual(COUNTED.map((item) => item.key));
  expect(MODEL.lines.map((line) => line.key)).not.toContain("land");

  MODEL.lines.forEach((line, index) => {
    const source = COUNTED[index];
    expect({ low: line.low, mid: line.mid, high: line.high }).toEqual({
      low: source.low,
      mid: source.mid,
      high: source.high,
    });
    expect(line.label).toBe(source.label);
    expect(line.ownerBuildable).toBe(source.ownerBuildable);
  });

  // The accumulation lands exactly on the subtotal — the stack IS the total.
  expect(MODEL.lines[MODEL.lines.length - 1].runningMid).toBe(MODEL.subtotal.mid);
  expect(MODEL.subtotal.mid + MODEL.contingency.mid).toBe(COST_MODEL.totalsExLand.mid);
});

test("which lines the owner's own labour covers is read from the model, not decided here", async ({
  page,
}) => {
  await mount(page);
  const owned = COUNTED.filter((item) => item.ownerBuildable);
  expect(owned.length, "no line is owner-buildable — the tag would be decoration").toBeGreaterThan(2);
  expect(owned.length, "every line is owner-buildable — the tag would say nothing").toBeLessThan(
    COUNTED.length,
  );

  await expect(page.locator('[data-margin-owner-buildable="yes"]')).toHaveCount(owned.length);
  await expect(page.locator('[data-margin-owner-buildable="no"]')).toHaveCount(
    COUNTED.length - owned.length,
  );
});

/* ------------------------------------------------- 3 · THE LABOUR TRADE */

test("the labour months are parsed from the sourced basis, never retyped", () => {
  expect(MODEL.labourMonths, "builderComparison.basis no longer names the months of labour").toBe(
    "12 to 24 months",
  );
  expect(labourMonthsFromBasis(COST_MODEL.builderComparison.basis)).toBe(MODEL.labourMonths);

  // The parser discriminates rather than always answering.
  expect(labourMonthsFromBasis("a basis that mentions no labour at all")).toBeNull();
  expect(labourMonthsFromBasis("owner-builder saves 30-40% for 6-9 months of labour")).toBe(
    "6 to 9 months",
  );
});

test("the labour trade sits in the same block AND the same screen as the saving", async ({
  page,
}) => {
  await mount(page);

  const trade = page.locator("[data-margin-trade]");
  const ownerFigure = page.locator("[data-margin-owner-mid]");
  const builderFigure = page.locator("[data-margin-builder-range]");
  await expect(trade).toBeVisible();
  await expect(ownerFigure).toBeVisible();
  await expect(builderFigure).toBeVisible();

  // It says what the money costs, in the words the file's basis supports.
  await expect(trade).toContainText(MODEL.labourMonths ?? COST_MODEL.builderComparison.basis);
  await expect(trade).toContainText("labour");

  /* SAME BLOCK: one ancestor holds the owner figure, the builder range and
     the trade. Moving the trade to its own section further down the page
     breaks this, which is the entire point of asserting it. */
  const together = await page.evaluate(() => {
    const trade = document.querySelector("[data-margin-trade]");
    const owner = document.querySelector("[data-margin-owner-mid]");
    const builder = document.querySelector("[data-margin-builder-range]");
    if (!trade || !owner || !builder) return { block: false, disclosed: true, hidden: true };
    const block = trade.closest(".margin-verdict");
    return {
      block: block !== null && block.contains(owner) && block.contains(builder),
      // Not tucked into a <details>, and not hidden from anyone.
      disclosed: trade.closest("details") !== null,
      hidden:
        trade.closest("[hidden]") !== null || trade.closest('[aria-hidden="true"]') !== null,
    };
  });
  expect(together.block, "the trade is not in the same block as the two figures").toBe(true);
  expect(together.disclosed, "the trade is behind a disclosure").toBe(false);
  expect(together.hidden, "the trade is hidden from some readers").toBe(false);

  /* SAME SCREEN: at 1280x900 the two figures and the trade are all inside the
     first viewport, with the trade within a short distance of the saving. A
     "tightening" that pushes it below the fold fails here even if the DOM
     nesting survives. */
  const tradeBox = (await trade.boundingBox())!;
  const ownerBox = (await ownerFigure.boundingBox())!;
  const builderBox = (await builderFigure.boundingBox())!;
  expect(ownerBox.y + ownerBox.height).toBeLessThan(900);
  expect(builderBox.y + builderBox.height).toBeLessThan(900);
  expect(
    tradeBox.y + tradeBox.height,
    "the labour trade does not fit on the same screen as the figures it explains",
  ).toBeLessThan(900);
  expect(
    tradeBox.y - (ownerBox.y + ownerBox.height),
    "the labour trade has drifted away from the saving it pays for",
  ).toBeLessThan(320);
});

/* --------------------------------------------- 4 · THE SOURCED COMPARISON */

test("the builder comparison is a range with its basis, never a single number", async ({ page }) => {
  await mount(page);
  const rendered = await page.locator(".margin-stack").innerText();

  expect(rendered).toContain(`${cad(COST_MODEL.builderComparison.low)} to ${cad(COST_MODEL.builderComparison.high)}`);
  expect(rendered).toContain(COST_MODEL.builderComparison.basis);

  /* BRAND-VOICE-GUIDE.md:250 banned both of these by name: the open-ended
     "$450,000+" and the unsourced percentage that preceded it. */
  expect(rendered).not.toContain(`${cad(COST_MODEL.builderComparison.low)}+`);
  expect(rendered.toLowerCase()).not.toContain("up to 40%");
  expect(rendered.toLowerCase()).not.toContain("coordination margins");
});

test("the estimate label travels with the figures, in the site's canonical words", async ({
  page,
}) => {
  /* regionalCost.ts owns the canonical string. MarginStack restates it rather
     than importing it — that module's top-level import would drag a 70 KB
     index set onto /budget for nothing — so the two are pinned equal here. */
  expect(MARGIN_ESTIMATE_LABEL).toBe(ESTIMATE_LABEL);

  await mount(page);
  await expect(page.locator("[data-margin-estimate-label]")).toContainText(ESTIMATE_LABEL);
});

test("the reference build is named, because a comparison of unlike homes is worthless", async ({
  page,
}) => {
  await mount(page);
  const rendered = await page.locator(".margin-stack").innerText();
  expect(rendered).toContain(`${COST_MODEL.referenceHome.sqft} sq ft`);
  expect(rendered).toContain(COST_MODEL.referenceHome.type);
});

/* ------------------------------------- 5 · STATIC IS A FIRST-CLASS RENDER */

test("with no effect fired and no animation running, the whole argument is present", async ({
  page,
}) => {
  /* This markup came out of renderToStaticMarkup: no useEffect, no
     IntersectionObserver, no transform, no counter tick. It is the floor a
     prefers-reduced-motion reader gets, and it has to carry everything. */
  await mount(page);
  const rendered = await page.locator(".margin-stack").innerText();

  for (const line of COUNTED) {
    expect(rendered, `the "${line.label}" line is missing with motion stripped`).toContain(line.label);
    expect(rendered, `${cad(line.mid)} is missing with motion stripped`).toContain(cad(line.mid));
  }
  expect(rendered).toContain(cad(MODEL.subtotal.mid));
  expect(rendered).toContain(cad(MODEL.contingency.mid));
  expect(rendered).toContain(cad(MODEL.total.mid));
  expect(rendered).toContain(cad(COST_MODEL.builderComparison.low));
  expect(rendered).toContain(MODEL.labourMonths!);
  expect(rendered).toContain(ESTIMATE_LABEL);

  /* AND IT IS ACTUALLY LEGIBLE, not merely in the DOM.
     This assertion exists because its absence hid a real defect. The first
     version of this component wrapped every block in <Reveal>, whose
     `initial={{ opacity: 0 }}` React writes into the server markup as a
     literal style="opacity:0". Every assertion above still passed —
     innerText reads text at zero opacity and Playwright's toBeVisible()
     ignores opacity — while a screenshot of the same render came out
     completely blank. "The content is present" was true and worthless.
     Opacity is what the motion vocabulary manipulates, so opacity is what
     this measures. */
  const invisible = await page.evaluate(() => {
    const offenders: string[] = [];
    document.querySelectorAll(".margin-stack, .margin-stack *").forEach((element) => {
      const text = (element.textContent ?? "").trim();
      if (text.length === 0) return;
      if (Number(getComputedStyle(element).opacity) === 0) {
        offenders.push(`${element.className || element.tagName} :: ${text.slice(0, 48)}`);
      }
    });
    return offenders;
  });
  expect(
    invisible,
    "these elements carry text a reader cannot see before JavaScript animates them:\n" +
      invisible.join("\n"),
  ).toEqual([]);

  /* And the content is not branched on the media query — one rendering, read
     by everyone. A component that swapped in a different (shorter) story
     under reduced motion would satisfy every assertion above.

     RENEGOTIATED, and the reason belongs next to it: this first read
     `not.toContain("prefers-reduced-motion")`, which went red on the header
     comment EXPLAINING how reduced motion is honoured. Banning the words made
     the file less legible without making it more honest. What actually
     constitutes a content branch is a runtime query, so that is what is
     banned — matchMedia, and motion's own reduced-motion hook. The written
     explanation stays. */
  expect(componentSource).not.toContain("matchMedia");
  expect(componentSource).not.toContain("useReducedMotion");
});

test("on a phone the stack composes without pushing the page sideways", async ({ page }) => {
  /* /budget already carries a gate that its document never scrolls
     horizontally at 390px (budget-ui.spec.ts). This block is now the first
     thing on that page, so the constraint is inherited and belongs here too,
     where it can fail in seconds instead of after a four-minute export build.

     The first phone layout failed differently and worse: the full-width track
     claimed grid row 2, auto-placement pushed the figure to row 3 column 1,
     and every dollar amount right-aligned inside the LABEL column — a stray
     number floating mid-row with no bar beside it. Rows are placed
     explicitly now, so label and figure share row one. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<main style="margin:0;padding:0">${MARKUP}</main>`);
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ content: "body{margin:0}" });

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBe(widths.client);

  const firstRow = page.locator(".margin-line").first();
  const label = await firstRow.locator(".margin-line-label").boundingBox();
  const figure = await firstRow.locator(".margin-line-figure").boundingBox();
  const track = await firstRow.locator(".margin-line-track").boundingBox();
  expect(label).not.toBeNull();
  expect(figure).not.toBeNull();
  expect(track).not.toBeNull();
  // Label and figure share a row; the figure is to the RIGHT of the label.
  expect(figure!.y).toBeLessThan(label!.y + label!.height);
  expect(figure!.x).toBeGreaterThan(label!.x + label!.width - 1);
  // The figure reaches the right edge rather than stopping mid-row.
  expect(figure!.x + figure!.width).toBeGreaterThan(widths.client - 4);
  // The track sits below both, spanning the row.
  expect(track!.y).toBeGreaterThanOrEqual(label!.y + label!.height - 1);
});

/* ------------------------------------------- 6 · THE REJECTED DEPENDENCIES */

test("the piece is expressed with the motion system already here", () => {
  /* The review that proposed this surface asked for GSAP and Lenis in the
     same breath as asking to strip 77 KB of wallet code off every route.
     Those two asks contradict each other and the byte-stripping one wins. */
  /* The check is on DEPENDENCIES and IMPORTS, not on mentions: this file and
     MarginStack.tsx both name the two rejected libraries in prose, because a
     rejection nobody can read is a rejection that gets re-proposed. Only the
     import graph is the claim. */
  const importsOf = (source: string) => source.match(/^import[\s\S]*?from\s+"[^"]+";$/gm) ?? [];
  const imports = importsOf(componentSource);
  expect(imports.length, "no import statements were found — the scanner has drifted").toBeGreaterThan(1);

  /* Control. Adding gsap to this project would fail at module resolution long
     before an assertion ran, so the way to prove this gate discriminates is to
     run the same scan over a source that DOES import the rejected libraries
     and watch it find them. Without this, "no import mentions gsap" could be
     true because the scanner stopped matching import statements at all. */
  const wouldOffend = importsOf(
    'import { gsap } from "gsap";\nimport Lenis from "lenis";\nimport React from "react";',
  );
  expect(wouldOffend.length).toBe(3);
  expect(wouldOffend.filter((line) => /gsap|lenis/i.test(line))).toHaveLength(2);
  for (const rejected of ["gsap", "lenis", "@studio-freight", "locomotive-scroll"]) {
    expect(packageJson.toLowerCase(), `${rejected} was added as a dependency`).not.toContain(
      rejected,
    );
    for (const statement of imports) {
      expect(statement.toLowerCase(), `MarginStack imports ${rejected}`).not.toContain(rejected);
    }
  }

  /* Motion comes from the shared vocabulary, not from a second opinion.
     RENEGOTIATED, with the reason beside it: this first required all five
     Reveal primitives to appear. Reveal / Stagger / StaggerItem were then
     removed from the component on purpose — they open at opacity 0, which
     server-renders as style="opacity:0" and made the whole piece blank
     before hydration (see the legibility gate above, which caught it). The
     claim this test actually needs to make is "the motion here comes from
     the house vocabulary and the timing from the house token", so that is
     what it now checks. */
  expect(componentSource).toContain('from "@/components/Reveal"');
  for (const primitive of ["GrowBar", "Counter"]) {
    expect(componentSource, `${primitive} is imported but unused`).toContain(`<${primitive}`);
  }
  expect(componentSource).toContain("DOCUMENT_STAGGER_SECONDS");
  expect(componentSource).not.toMatch(/from "motion/);
});

test("nothing in the cost story animates layout", async ({ page }) => {
  /* CLS <= 0.08 is a pinned gate for this site. The defence is structural
     rather than measured: the track reserves its height in CSS, every bar's
     real width is a plain percentage, and the only animated properties in the
     whole block are the opacity and transform the Reveal primitives use. */
  const block = css.slice(css.indexOf(".margin-stack {"), css.indexOf("@media (max-width: 860px)"));
  expect(block.length, "the .margin-* block was not found in globals.css").toBeGreaterThan(1_000);
  expect(block).toContain("height: var(--margin-track-height)");
  expect(block).not.toContain("@keyframes");
  expect(block).not.toMatch(/transition[^;]*(width|height|top|left|margin|padding)/);
  expect(componentSource).not.toContain("animate={{");

  // The reserved track really does hold height before anything animates.
  await mount(page);
  const trackHeight = await page
    .locator(".margin-line-track")
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(trackHeight).toBeGreaterThan(4);
});

/* ------------------------------------------------------- 7 · IT IS WIRED */

test("the cost story is mounted on /budget above the project's own range", () => {
  /* A component nobody renders is the same silent nothing as an unwired spec
     file. Order matters too: the argument leads, the project's live range
     follows. */
  expect(budgetPageSource).toContain('import MarginStack from "@/components/budget/MarginStack"');
  const mountedAt = budgetPageSource.indexOf("<MarginStack />");
  const projectRangeAt = budgetPageSource.indexOf('className="budget-range"');
  expect(mountedAt, "MarginStack is imported but never rendered").toBeGreaterThan(-1);
  expect(projectRangeAt).toBeGreaterThan(-1);
  expect(mountedAt).toBeLessThan(projectRangeAt);
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "playwright/test";

import Readout from "@/components/builder/Readout";
import LiveReadout from "@/components/builder/LiveReadout";
import { AuraProjectProvider } from "@/components/project/ProjectContext";
import { feetInches, sqft } from "@/components/design/ecoSpec";
import { FDWR_MAX } from "@/lib/design";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { summarizeHome } from "@/lib/builder/geometry";
import { checkSpecAgainstParcel, modelledGlazingRatio, type ParcelLot } from "@/lib/builder/toPlan";

/* ═══════════════════════════════════════════════════════════════════════
   ED01 — THE BUILDER READ-OUTS, MEASURED.

   The founder's note was "make the editors stunning", and the failure it
   named was not ugliness — it was that the builder read as capable rather
   than considered. The concrete defect underneath: the two read-out panels
   printed a figure at 14 px and its own footnote at 12 px, so the number a
   person came for had no more presence than the sentence explaining it, and
   six emerald labels competed for an accent that is supposed to mean "look
   here".

   WHY THIS FILE MEASURES INSTEAD OF READING. The wave before this one shipped
   two defects of exactly one kind: a claim written in a CSS comment that
   nothing checked. One said a figure was the largest type in its panel, and
   it was false on every phone because a clamp resolved to its floor. So every
   hierarchy claim below is resolved by a real engine, on the REAL components
   (renderToStaticMarkup, the same idiom margin-stack.spec.ts uses) against
   the REAL stylesheet, at 390, 768 and 1280 CSS px, in both themes. A comment
   claiming a size is worth nothing here; only the number the browser computes
   counts.

   WHAT THIS FILE CANNOT SEE, said plainly. It attaches app/globals.css only.
   Tailwind's utilities are generated at build time and this spec deliberately
   does not depend on a build, so an element whose type came from a utility
   class would measure as the browser default rather than as it ships. That
   is why the hierarchy tests FIRST prove that no element inside a read-out
   cell carries a type utility at all — every size in a cell comes from this
   stylesheet, which is the only condition under which the measurement below
   describes the shipped page.

   THAT SENTENCE WAS ONCE FALSE OF THIS FILE, and the correction is the most
   useful thing in it. The check read the nearest builder-classed ANCESTOR's
   classes, never the measured element's own, so a size utility on a bare leaf
   — exactly the shape Readout.tsx ships at line 61 — passed unseen; and the
   paired size check could not fire either, because a utility resolves to
   nothing without a build, so parent and child measured identically. A
   fresh-context review changed one word to `text-sm`, watched all nine tests
   stay green, and then measured what actually ships: a 14px figure over a 12px
   note. That is the defect this file names in its own header, reintroduced
   underneath its own guard. The probe now carries `ownClasses`, and the
   precondition above is true rather than aspirational.

   The eight claims, each with a way to go red:
     1. the harness translates rather than invents, and every scanner
        discriminates;
     2. the figure is strictly the largest type in its cell, at three widths,
        in both themes, and no utility hides inside a cell;
     3. the largest type anywhere in either panel is a figure;
     4. all four tiers clear 4.5:1 on both surfaces they can sit on, in both
        themes, and no tier reaches its colour through alpha;
     5. not one literal colour in the builder region or in either component;
     6. motion runs on the tokens and reduced motion stills it, and this
        node restyled no focus ring;
     7. every figure the panels printed before they were touched is still
        printed, and each is the owning helper's own value;
     8. every provenance line names a symbol that actually exists.
   ═══════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const read = (...segments: string[]) => readFileSync(path.join(appRoot, ...segments), "utf8");

const css = read("app/globals.css");
const readoutSource = read("components/builder/Readout.tsx");
const liveSource = read("components/builder/LiveReadout.tsx");

/* ---------------------------------------------------------------------
   THE HARNESS. Playwright's babel transform rewrites JSX in project files
   into its component-test envelope — `{ __pw_type: "jsx", type, props, key }`
   — not into React elements, so the tree is converted back. This is
   margin-stack.spec.ts's helper with ONE addition it did not need: a
   fragment is encoded as `type: { __pw_jsx_fragment: true }`, an object,
   and handing that to createElement throws "Element type is invalid".
   LiveReadout renders a fragment, so the conversion has to know.
--------------------------------------------------------------------- */
interface PwJsx {
  __pw_type: "jsx";
  type: unknown;
  props?: Record<string, unknown>;
  key?: unknown;
}

const isPwJsx = (value: unknown): value is PwJsx =>
  typeof value === "object" && value !== null && (value as PwJsx).__pw_type === "jsx";

const isPwFragment = (value: unknown): boolean =>
  typeof value === "object" && value !== null && "__pw_jsx_fragment" in (value as object);

const wrappedComponents = new Map<unknown, unknown>();

function asReact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(asReact);
  if (!isPwJsx(node)) return node;
  const { children, ...rest } = node.props ?? {};
  const props: Record<string, unknown> = { ...rest };
  if (node.key !== undefined && node.key !== null) props.key = node.key;
  const resolved = isPwFragment(node.type) ? Fragment : node.type;
  const type = typeof resolved === "function" ? wrapComponent(resolved) : resolved;
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

const jsx = (type: unknown, props: Record<string, unknown>): PwJsx => ({
  __pw_type: "jsx",
  type,
  props,
});

/* ---------------------------------------------------------------- fixtures */

/** Big enough that the reference home fits, so the strip reports findings
 *  rather than refusals — the same roomy lot builder-readout.spec.ts uses. */
const ROOMY_LOT: ParcelLot = {
  lotWidthFt: 200,
  lotDepthFt: 250,
  frontSetbackFt: 25,
  sideSetbackFt: 15,
  rearSetbackFt: 25,
};

const DOCUMENT = defaultBuilderDocument();
const SUMMARY = summarizeHome(DOCUMENT.spec);
const WARNINGS = ["A window on the north wall of the main volume was trimmed to fit its wall."];

const MODEL_MARKUP = renderToStaticMarkup(
  asReact(jsx(Readout, { spec: DOCUMENT.spec, summary: SUMMARY, warnings: WARNINGS })) as never,
);

const STRIP_MARKUP = renderToStaticMarkup(
  asReact(
    jsx(AuraProjectProvider, {
      children: jsx(LiveReadout, {
        document: DOCUMENT,
        parcelCheck: checkSpecAgainstParcel(DOCUMENT.spec, ROOMY_LOT),
      }),
    }),
  ) as never,
);

/** The two panels as the builder stacks them, with an explicit surface so
 *  contrast has a real ground to be measured against. */
const PAGE = `<main id="stage"><div id="strip">${STRIP_MARKUP}</div><div id="model">${MODEL_MARKUP}</div></main>`;

type Surface = "base" | "raised";

async function mount(
  page: import("playwright/test").Page,
  width: number,
  theme: "light" | "dark",
) {
  /* MOTION IS STILLED BEFORE ANYTHING IS MEASURED, and this is not caution —
     it is a bug this file already had. `data-theme` has to be set after
     setContent (setContent replaces the document), and the moment it flips,
     `.builder-figure__value` starts a 150 ms colour transition and <body> a
     500 ms crossfade. getComputedStyle during a running transition returns
     the INTERPOLATED value, so the contrast test read a dark-theme figure
     while it was still most of the way to its light-theme ink and reported
     1.01:1 — a red gate on correct CSS, roughly one run in three. Reduced
     motion zeroes the duration tokens at their source (interface-motion.spec
     pins that), so the flip is instantaneous and the reading is the shipped
     colour. graph-keyboard.spec.ts stills motion first for the same reason. */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: 2400 });
  await page.setContent(PAGE);
  await page.addStyleTag({ content: css });
  await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
}

/* -------------------------------------------------------------- measuring */

interface TextProbe {
  /** the design-system class the measured type belongs to — the element's
   *  own, or the nearest ancestor's when the text sits in a bare wrapper */
  classes: string;
  /** the measured element's OWN classes, which `classes` above is not when the
   *  text sits in a bare wrapper. Checking only the ancestor's let a size
   *  utility on a leaf through the guard entirely — see the probe. */
  ownClasses: string;
  text: string;
  fontPx: number;
  /** the size that owning class resolves to; a difference means something
   *  between them changed the type, which is what makes a probe "foreign" */
  ownerFontPx: number;
  color: string;
  cellIndex: number;
}

/** Every element carrying TEXT OF ITS OWN, with the size and colour a browser
 *  resolved for it — not the size a stylesheet was hoped to give it.
 *
 *  Text is attributed to the class that OWNS it rather than to the element
 *  that happens to hold it: `.builder-figure__value` wraps its number in a
 *  bare <span> so the comparator can sit beside it on the baseline, and an
 *  earlier draft of this probe skipped every figure in the product because
 *  the classed element had no direct text node. It scored a page with no
 *  figures on it as passing, which is exactly the failure this file exists
 *  to make impossible. */
const probeText = (page: import("playwright/test").Page, selector: string): Promise<TextProbe[]> =>
  page.$eval(selector, (root: Element): TextProbe[] => {
    const cells = Array.from(root.querySelectorAll(".builder-figure"));
    const classesOf = (element: Element): string =>
      typeof element.className === "string" ? element.className : "";
    const ownerOf = (element: Element): Element | null => {
      let node: Element | null = element;
      while (node && node !== root) {
        if (/(^|\s)builder-/.test(classesOf(node))) return node;
        node = node.parentElement;
      }
      return null;
    };
    const out: TextProbe[] = [];
    root.querySelectorAll("*").forEach((element) => {
      const own = Array.from(element.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (own.length === 0) return;
      const style = getComputedStyle(element);
      const owner = ownerOf(element);
      const cell = element.closest(".builder-figure");
      out.push({
        classes: owner ? classesOf(owner) : "",
        /* THE ELEMENT'S OWN CLASSES, which `classes` above is not — it is the
           nearest builder-classed ANCESTOR's. That distinction let the whole
           guard through: `<span class="text-sm">` inside a
           `.builder-figure__value` reported its parent's class, passed, and
           put a 14px figure over a 12px note — word for word the defect this
           file exists to prevent, and a shape Readout.tsx already ships at
           line 61 as a bare `<span>`. The second guard could not save it
           either, because Tailwind is deliberately not attached at measure
           time, so the utility resolves to nothing here and parent and child
           measure identically. Found by a fresh-context review that changed
           one word and watched nine tests stay green. */
        ownClasses: classesOf(element),
        text: own.slice(0, 60),
        fontPx: parseFloat(style.fontSize),
        ownerFontPx: owner ? parseFloat(getComputedStyle(owner).fontSize) : Number.NaN,
        color: style.color,
        cellIndex: cell ? cells.indexOf(cell) : -1,
      });
    });
    return out;
  });

/** WCAG 2.x relative luminance and contrast, on the two integers a browser
 *  hands back. Proved against published pairs in the detector test. */
const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (rgb: readonly [number, number, number]): number =>
  0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

const contrast = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** `rgb(23, 26, 24)` → [23, 26, 24]. Returns null for anything carrying an
 *  alpha channel, which is the point: a text colour reached through alpha is
 *  exactly how the old read-out arrived at 2.6:1 without anyone noticing. */
const opaqueRgb = (value: string): [number, number, number] | null => {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const surfaceRgb = async (
  page: import("playwright/test").Page,
): Promise<Record<Surface, [number, number, number]>> => {
  const raw = await page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const readOne = (token: string) => {
      probe.style.backgroundColor = `rgb(var(${token}))`;
      return getComputedStyle(probe).backgroundColor;
    };
    const result = { base: readOne("--tone-base"), raised: readOne("--tone-raised") };
    probe.remove();
    return result;
  });
  const base = opaqueRgb(raw.base);
  const raised = opaqueRgb(raw.raised);
  if (!base || !raised) throw new Error(`surface tokens did not resolve: ${JSON.stringify(raw)}`);
  return { base, raised };
};

/* ---------------------------------------------------- the builder CSS region */

/** Every rule whose selector names a `.builder-` class, wherever it sits —
 *  top level or inside a media query. */
const builderRules = (source: string): string[] =>
  source.match(/[^{}@]*\.builder-[^{}]*\{[^{}]*\}/g) ?? [];

/** Colours written as values rather than reached through the ladder. A
 *  `rgb(var(--tone-…) / …)` is the system; `rgb(8 10 9 / …)` and `#0a0a0a`
 *  are not. */
const literalColours = (declarations: string): string[] =>
  declarations.match(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\(\s*[\d.]/g) ?? [];

/* The one literal in the builder region, recorded rather than removed.
   `.builder-command-backdrop` is a scrim: it must stay dark in BOTH themes,
   and the tonal ladder has no invariantly-dark step — every surface token
   flips with the theme, so `rgb(var(--tone-ink) / 0.54)` would paint a WHITE
   veil over the command palette at night. The system-correct repair is a new
   scrim token in the ladder, and this node's contract explicitly excludes the
   token blocks. So it is exempted here, by name, with the reason, instead of
   being quietly deleted from the sweep or silently "fixed" into a bug. */
const RECORDED_LITERAL = ".builder-command-backdrop";

/** This node's own block, sliced by its own headings. */
const ED01_BLOCK = css.slice(
  css.indexOf("ED01 — THE BUILDER READ-OUTS"),
  css.indexOf("THE ZONING LOOKUP  ·  .zoning-*"),
);

/* ═════════════════════════════════════════════ 1 · THE DETECTORS ═════════ */

test("the harness translates rather than invents, and every scanner discriminates", () => {
  /* If Playwright's envelope changes shape, `asReact` would hand back raw
     objects, every render would come out empty, and this whole file would
     pass vacuously. Proved on a structure with a host element, a child
     array, a function component AND a fragment — the fragment is the case
     margin-stack.spec.ts never had to handle. */
  const Inner = (props: { label: string }) => jsx("em", { children: props.label });
  const tree = jsx("div", {
    className: "probe",
    children: [
      jsx("b", { children: "one" }),
      jsx(Inner, { label: "two" }),
      jsx({ __pw_jsx_fragment: true }, { children: [jsx("i", { children: "three" })] }),
    ],
  });
  expect(renderToStaticMarkup(asReact(tree) as never)).toBe(
    '<div class="probe"><b>one</b><em>two</em><i>three</i></div>',
  );
  expect(() =>
    renderToStaticMarkup({ __pw_type: "jsx", type: "div", props: {} } as never),
  ).toThrow();

  /* Both panels really rendered, at a realistic size. */
  expect(MODEL_MARKUP.length).toBeGreaterThan(1_500);
  expect(STRIP_MARKUP.length).toBeGreaterThan(1_500);
  expect(MODEL_MARKUP).toContain("builder-figure__value");
  expect(STRIP_MARKUP).toContain("builder-figure__value");

  /* The contrast maths, against published pairs. Black on white is 21:1 and
     mid grey #767676 on white is the canonical 4.54 boundary case. */
  expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  expect(contrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  expect(contrast([118, 118, 118], [255, 255, 255])).toBeGreaterThan(4.5);
  expect(contrast([119, 119, 119], [255, 255, 255])).toBeLessThan(4.5);

  /* The alpha guard really rejects an alpha colour and really accepts a
     solid one, so "no tier reaches its colour through alpha" is a check. */
  expect(opaqueRgb("rgb(23, 26, 24)")).toEqual([23, 26, 24]);
  expect(opaqueRgb("rgba(23, 26, 24, 0.55)")).toBeNull();

  /* The CSS scanners. Each is shown finding something and shown NOT finding
     the system's own idiom, so silence below is a result rather than a typo. */
  expect(builderRules(".builder-x { color: red; }\n.other { color: blue; }")).toEqual([
    ".builder-x { color: red; }",
  ]);
  expect(builderRules(css).length).toBeGreaterThan(30);
  expect(literalColours("background: rgb(8 10 9 / 0.54);")).toEqual(["rgb(8"]);
  expect(literalColours("color: #0a0a0a;")).toEqual(["#0a0a0a"]);
  expect(literalColours("background: rgb(var(--tone-ink) / var(--hair-alpha));")).toEqual([]);
  expect(literalColours("color: var(--st-ink-dim);")).toEqual([]);

  /* And the block slice really is this node's block. */
  expect(ED01_BLOCK.length).toBeGreaterThan(2_000);
  expect(ED01_BLOCK).toContain(".builder-figure__value");
});

/* ═══════════════════════════════════ 2 · THE FIGURE OUTRANKS ITS CELL ════ */

test("the figure is the largest type in its cell at 390, 768 and 1280, in both themes", async ({
  page,
}) => {
  /* THE claim the founder's note is about, and the exact claim the last wave
     got wrong by writing it in a comment. `--builder-figure` type is a clamp;
     at 390 it resolves at its FLOOR, which is the width where a hierarchy
     written for a desk monitor quietly inverts. All three widths, therefore,
     and the floor is reported so a future change to the clamp shows up here
     as a number rather than as an opinion. */
  const observed: Array<{
    width: number;
    theme: string;
    panel: string;
    cells: number;
    valuePx: number;
    largestOtherPx: number;
  }> = [];

  for (const width of [390, 768, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      await mount(page, width, theme);

      for (const panel of ["#strip", "#model"]) {
        const probes = await probeText(page, panel);
        const cells = probes.filter((probe) => probe.cellIndex >= 0);
        expect(cells.length, `${panel} rendered no read-out cells`).toBeGreaterThan(2);

        /* FIRST: nothing inside a cell takes its type from anywhere but this
           stylesheet. Without this the measurement below would be describing
           a page that does not ship — a Tailwind size utility would measure
           as the browser default here and as something else in the product.
           Two ways to fail: text under no builder class at all, or text whose
           size differs from the class that is supposed to own it. */
        const onLadderToken = (token: string) =>
          /^builder-figure__(label|value|qualifier|note|source)$/.test(token);

        const foreign = cells.filter((probe) => {
          const owned = probe.classes.split(/\s+/).filter(Boolean);
          const onLadder = owned.length > 0 && owned.every(onLadderToken);

          /* THE ELEMENT'S OWN CLASSES ARE CHECKED SEPARATELY, and this is the
             half that was missing. A bare descendant with no class of its own
             is fine — it inherits from the cell. A descendant carrying ANY
             class that is not on the ladder is not: that is where a Tailwind
             size utility hides, invisible to the owner-based check above
             because the owner is its parent. */
          const own = probe.ownClasses.split(/\s+/).filter(Boolean);
          const smuggled = own.length > 0 && !own.every(onLadderToken);

          return !onLadder || smuggled || probe.fontPx !== probe.ownerFontPx;
        });
        expect(
          foreign.map((probe) => `${probe.classes || "(no class)"} @${probe.fontPx}px — "${probe.text}"`),
          `these elements sit inside a read-out cell and are not on the builder type ladder, so their size is not this stylesheet's to promise`,
        ).toEqual([]);

        const byCell = new Map<number, TextProbe[]>();
        for (const probe of cells) {
          const list = byCell.get(probe.cellIndex) ?? [];
          list.push(probe);
          byCell.set(probe.cellIndex, list);
        }

        for (const [index, members] of Array.from(byCell.entries())) {
          const value = members.find((probe) => probe.classes.includes("builder-figure__value"));
          expect(value, `cell ${index} of ${panel} prints no figure`).toBeTruthy();
          if (!value) continue;
          const others = members.filter((probe) => probe !== value);
          expect(others.length, `cell ${index} of ${panel} has a figure and nothing else`).toBeGreaterThan(1);
          const largestOther = Math.max(...others.map((probe) => probe.fontPx));
          expect(
            value.fontPx,
            `at ${width}px in ${theme}, ${panel} cell ${index} ("${value.text}") is ${value.fontPx}px while something beside it is ${largestOther}px`,
          ).toBeGreaterThan(largestOther);
          observed.push({
            width,
            theme,
            panel,
            cells: byCell.size,
            valuePx: value.fontPx,
            largestOtherPx: largestOther,
          });
        }
      }
    }
  }

  /* The measurement really did run at three different widths — a clamp that
     silently stopped varying would otherwise satisfy every line above. */
  const sizes = Array.from(new Set(observed.map((row) => row.valuePx))).sort((a, b) => a - b);
  expect(sizes.length, `the figure measured the same at every width: ${sizes.join(", ")}`).toBeGreaterThan(1);
  /* The floor, which is what a phone gets, is the load-bearing number. */
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(20);
});

/* ══════════════════════════════ 3 · THE FIGURE OUTRANKS ITS PANEL ════════ */

test("the largest type in either read-out is a figure, not a label or a footnote", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      await mount(page, width, theme);
      for (const panel of ["#strip", "#model"]) {
        const probes = await probeText(page, panel);
        /* Restricted, honestly, to the type this stylesheet owns: an element
           whose size came from a build-time utility would measure as the
           browser default here, and including it would be measuring a
           fiction. Test 2 already proves the CELLS contain nothing else. */
        const owned = probes.filter((probe) => /(^|\s)builder-/.test(probe.classes));
        expect(owned.length).toBeGreaterThan(6);
        const largest = Math.max(...owned.map((probe) => probe.fontPx));
        const usurpers = owned
          .filter((probe) => probe.fontPx === largest)
          .filter((probe) => !probe.classes.includes("builder-figure__value"));
        expect(
          usurpers.map((probe) => `${probe.classes} @${probe.fontPx}px — "${probe.text}"`),
          `at ${width}px in ${theme}, something in ${panel} is set as large as the figures (${largest}px)`,
        ).toEqual([]);
      }
    }
  }
});

/* ═══════════════════════════════ 3b · THE COLUMN COUNTS SURVIVED ════════ */

test("the three read-out grids keep the column counts they were given", async ({ page }) => {
  /* NAME WHAT YOU REPLACE. Moving these grids from Tailwind's `sm:`/`lg:`
     utilities into one stylesheet rule is exactly the kind of tidy-up that
     silently flattens a decision, and one of the three is a decision: the
     live strip's findings are ONE column at every width because that panel
     renders in a `minmax(22rem, …)` controls track while a breakpoint
     measures the viewport — a two-across grid would be narrowest precisely
     where those sentences are longest. LiveReadout.tsx says so in prose;
     this is the part that fails if someone stops believing it. */
  const tracks = async (selector: string) =>
    page.$eval(selector, (node) =>
      getComputedStyle(node as Element).gridTemplateColumns.trim().split(/\s+/).length,
    );

  const expected = [
    { width: 390, findings: 1, model: 1, bands: 1 },
    { width: 768, findings: 1, model: 2, bands: 3 },
    { width: 1280, findings: 1, model: 3, bands: 3 },
  ];

  const observed = [];
  for (const row of expected) {
    await mount(page, row.width, "light");
    observed.push({
      width: row.width,
      findings: await tracks('#strip .builder-figures[data-columns="1"]'),
      model: await tracks('#model .builder-figures[data-columns="3"]'),
      bands: await tracks('#strip .builder-figures[data-columns="3-early"]'),
    });
  }
  expect(observed).toEqual(expected);
});

/* ═══════════════════════════════════════════ 4 · EVERY TIER IS READABLE ══ */

test("all four tiers clear 4.5:1 on both surfaces and in both themes, with no alpha", async ({
  page,
}) => {
  /* The old read-out reached its footnote colour through `text-aura-text/55`
     and its provenance line through `/40` — ink at 40% over white is about
     2.1:1, which is decoration wearing a sentence's clothes. The new ladder
     recedes by SIZE and FACE and keeps every tier on a solid ink token, so
     this is the assertion that stops the next "make it subtler" pass. */
  const worst: Array<{ theme: string; classes: string; ratio: number }> = [];
  const grounds: Record<string, [number, number, number]> = {};
  const inks: Record<string, string> = {};

  for (const theme of ["light", "dark"] as const) {
    await mount(page, 1280, theme);
    const surfaces = await surfaceRgb(page);
    grounds[theme] = surfaces.base;
    const probes = [...(await probeText(page, "#strip")), ...(await probeText(page, "#model"))];
    const tiers = probes.filter((probe) => /(^|\s)builder-figure__/.test(probe.classes));
    expect(tiers.length, "no tier elements were found to measure").toBeGreaterThan(20);

    for (const tier of tiers) {
      const rgb = opaqueRgb(tier.color);
      expect(
        rgb,
        `${tier.classes} reaches its colour through alpha (${tier.color}) — a tier that fades toward the background cannot be checked, and is how the old panel got to 2.6:1`,
      ).not.toBeNull();
      if (!rgb) continue;
      const ratio = Math.min(contrast(rgb, surfaces.base), contrast(rgb, surfaces.raised));
      expect(
        ratio,
        `${theme}: ${tier.classes} ("${tier.text}") is ${ratio.toFixed(2)}:1 against the surface it sits on`,
      ).toBeGreaterThanOrEqual(4.5);
      worst.push({ theme, classes: tier.classes, ratio });
    }

    /* All four tiers were actually present in what was measured — a ladder
       missing its quietest rung would otherwise pass by absence. */
    for (const tier of ["label", "value", "note", "source"]) {
      expect(
        tiers.some((probe) => probe.classes.includes(`builder-figure__${tier}`)),
        `no builder-figure__${tier} was on screen to measure`,
      ).toBe(true);
    }

    const figure = tiers.find((probe) => probe.classes.includes("builder-figure__value"));
    inks[theme] = figure?.color ?? "none";
  }

  /* THE CONTROL THAT MATTERS: the second pass really was the OTHER theme.
     Without this, a `data-theme` flip that silently failed would measure the
     light palette twice — light ink on a light ground, comfortably over
     4.5:1 — and this test would report "both themes pass" having checked
     one. Both the ground and the ink have to have moved. */
  expect(grounds.light).not.toEqual(grounds.dark);
  expect(inks.light).not.toBe(inks.dark);
  expect(luminance(grounds.light)).toBeGreaterThan(luminance(grounds.dark));

  /* And the ratios really do vary, so a pass is not coming from a contrast
     function that returns the same number for everything. */
  const ratios = Array.from(new Set(worst.map((row) => Math.round(row.ratio * 10))));
  expect(ratios.length).toBeGreaterThan(1);
});

/* ═════════════════════════════════════════════ 5 · COLOUR IS THE LADDER ══ */

test("not one literal colour in the builder region or in either read-out component", () => {
  /* css-tokens.spec.ts catches an UNDEFINED variable. Nothing in the suite
     catches a hardcoded colour, which is the quieter failure: it renders
     perfectly and then stays a pale card at 2 a.m. because it never learned
     the theme exists. */
  const offenders: string[] = [];
  for (const rule of builderRules(css)) {
    if (rule.includes(RECORDED_LITERAL)) continue;
    const found = literalColours(rule.slice(rule.indexOf("{")));
    if (found.length > 0) offenders.push(`${rule.slice(0, rule.indexOf("{")).trim()} → ${found.join(", ")}`);
  }
  expect(
    offenders,
    `these builder rules write a colour instead of reaching one through the tonal ladder:\n${offenders.join("\n")}`,
  ).toEqual([]);

  /* The exemption is REAL, not a spelling that never matched: the rule it
     names still carries the literal it was exempted for. If somebody gives
     the scrim a token, this line fails and the exemption comes out. */
  const backdrop = builderRules(css).find((rule) => rule.includes(RECORDED_LITERAL));
  expect(backdrop, "the recorded exemption no longer matches any rule").toBeTruthy();
  expect(literalColours(backdrop ?? "").length).toBeGreaterThan(0);

  for (const [name, source] of [
    ["Readout.tsx", readoutSource],
    ["LiveReadout.tsx", liveSource],
  ] as const) {
    expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], `${name} writes a hex colour`).toEqual([]);
    expect(source.match(/(?:rgba?|hsla?)\(\s*[\d.]/g) ?? [], `${name} writes a literal colour`).toEqual([]);
  }

  /* And the same discipline for RHYTHM. The block's own header says every gap
     and pad in it is a --space-* step; that sentence is only worth having if
     something checks it, which is the whole lesson of the last wave. Radii and
     type metrics are deliberately outside the claim and outside this scan. */
  const spacings = (source: string): string[] =>
    (source.match(/^\s*(?:gap|padding(?:-block-start|-inline-start)?):[^;]+;/gm) ?? []).map((line) =>
      line.trim(),
    );
  const offScale = (declaration: string): boolean =>
    declaration
      .slice(declaration.indexOf(":") + 1)
      .replace(/;$/, "")
      .trim()
      .split(/\s+/)
      .some((value) => !/^var\(--space-\d\)$/.test(value));

  /* Proved both ways before it is trusted. */
  expect(spacings("  gap: var(--space-4) var(--space-5);").length).toBe(1);
  expect(spacings("  border-radius: 999px;")).toEqual([]);
  expect(offScale("gap: var(--space-4) var(--space-5);")).toBe(false);
  expect(offScale("padding: 0.3rem 0.7rem;")).toBe(true);
  expect(offScale("gap: 0.4rem;")).toBe(true);

  const found = spacings(ED01_BLOCK);
  expect(found.length, "the rhythm scan found nothing to check").toBeGreaterThan(8);
  expect(
    found.filter(offScale),
    `these read-out lengths are picked by hand instead of taken from the modular scale:\n${found.filter(offScale).join("\n")}`,
  ).toEqual([]);
});

/* ═══════════════════════════════════════════════════ 6 · MOTION & FOCUS ══ */

test("the read-out answers on the motion tokens, stills completely, and restyles no focus ring", async ({
  page,
}) => {
  await mount(page, 1280, "light");

  const durations = () =>
    page.evaluate(() => {
      const of = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).transitionDuration : "missing";
      };
      return {
        cell: of(".builder-figure"),
        figure: of(".builder-figure__value"),
        state: of(".builder-readout__state"),
      };
    });

  /* The control: the read-out really is transitioning, so "0s" below cannot
     come from a stylesheet that failed to attach. 0.15s is --motion-echo.
     Media emulation re-evaluates live, so the two readings are the SAME
     mounted page under the two preferences — no remount in between. */
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const moving = await durations();
  expect(moving).toEqual({ cell: "0.15s", figure: "0.15s", state: "0.15s" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await durations();
  expect(still).toEqual({ cell: "0s", figure: "0s", state: "0s" });

  /* No per-rule opt-in: the block contains no reduced-motion escape hatch of
     its own, because the tokens are zeroed at their source. */
  expect(ED01_BLOCK).not.toContain("prefers-reduced-motion");
  expect(ED01_BLOCK).not.toContain("transition: none");

  /* THE FOCUS RING IS DECIDED, and this node did not touch it. Written as a
     scan of this node's own block rather than of the whole file, and the
     scanner is shown to work on the file it is silent about. */
  expect(css).toContain("outline: var(--focus-ring-width) solid var(--focus-ring-color)");
  expect(ED01_BLOCK).not.toContain("outline");
  expect(ED01_BLOCK).not.toContain(":focus");
  expect(ED01_BLOCK).not.toContain("box-shadow");
});

/* ════════════════════════════════════ 7 · NO NUMBER GOT HARDER TO FIND ═══ */

test("every figure the model read-out printed is still printed, and is its helper's own value", async ({
  page,
}) => {
  /* The founder's constraint, as a gate: "if a change makes a number harder
     to find, it is wrong". The strongest version of that a spec can hold is
     that the SAME six figures are on screen and each still equals what the
     helper that owns it returns — a craft pass that dropped a figure, or
     rounded one on the way past, fails here rather than in a screenshot
     nobody compares. */
  await mount(page, 1280, "light");
  /* The figure itself, not the figure plus its comparator: they are separate
     tiers and a flex gap puts no whitespace between them in `textContent`. */
  const figures = await page.$$eval("#model .builder-figure__value > span:first-child", (nodes) =>
    nodes.map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
  );

  const pct = (r: number) => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
  expect(figures).toEqual([
    sqft(SUMMARY.totalFloorAreaSqFt),
    sqft(SUMMARY.groundFootprintSqFt),
    feetInches(SUMMARY.maxRidgeHeightFt),
    sqft(SUMMARY.glazedAreaSqFt),
    pct(modelledGlazingRatio(DOCUMENT.spec)),
    `${feetInches(SUMMARY.boundsWithRoof.widthFt)} × ${feetInches(SUMMARY.boundsWithRoof.depthFt)}`,
  ]);

  /* The ceiling the ratio is measured against travels WITH it — moved to its
     own tier, not dropped. The founder's rule for this node was that nothing
     may get harder to find, so the comparator is asserted too. */
  const qualifiers = await page.$$eval("#model .builder-figure__qualifier", (nodes) =>
    nodes.map((node) => (node.textContent ?? "").trim()),
  );
  expect(qualifiers).toEqual([`of ${pct(FDWR_MAX)}`]);

  /* The control: these are real, varied figures rather than six empty
     strings that would make any two lists equal. */
  expect(new Set(figures).size).toBe(5); // floor area and footprint agree at one storey
  expect(figures.every((text) => /\d/.test(text))).toBe(true);

  /* And every cell still names where its number came from. A figure without
     a provenance line is the one kind of number this product does not print. */
  const sources = await page.$$eval("#model .builder-figure__source", (nodes) => nodes.length);
  expect(sources).toBe(figures.length);
});

/* ════════════════════════════════════════ 8 · THE PROVENANCE IS NOT PROSE ═ */

test("every provenance line names a symbol that actually exists", () => {
  /* The source line is the panel's "show your working". If a helper is
     renamed and the string is not, the working becomes a confident lie —
     and it is a lie no reader could check, which is the worst kind. */
  const declared = ["geometry", "toPlan", "projectBudget", "exportSpec", "spec"]
    .map((name) => read("lib/builder", `${name}.ts`))
    .concat(read("lib/design/materials.ts"), read("lib/design/parcel.ts"))
    .join("\n");

  const cited = [readoutSource, liveSource]
    .flatMap((source) => Array.from(source.matchAll(/source="([^"]+)"/g)).map((match) => match[1]))
    .flatMap((line) => line.split("·").map((part) => part.trim()))
    /* An identifier, not a word: one token carrying an interior capital
       (camelCase) or an underscored shout (SCREAMING_CASE). Prose segments
       have spaces; a plain capitalised word like a region name does not
       qualify, which is why this does not chase "Alberta". */
    .filter((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part))
    .filter((part) => /[a-z][A-Z]/.test(part) || /^[A-Z0-9_]+$/.test(part) === true);

  /* The extractor found real work to do, and it discriminates. */
  expect(cited.length).toBeGreaterThanOrEqual(8);
  expect(cited).toContain("totalFloorAreaSqFt");
  expect(cited).toContain("FDWR_MAX");
  expect(cited).not.toContain("Alberta");

  const missing = Array.from(new Set(cited)).filter(
    (name) => !new RegExp(`(export (?:function|const|interface|type) ${name}\\b)|(^\\s+${name}\\??:)`, "m").test(declared),
  );
  expect(
    missing,
    `these read-out provenance lines name something the libraries do not declare:\n${missing.join("\n")}`,
  ).toEqual([]);

  /* The control: a helper that does not exist really is reported, so the
     empty list above is a finding rather than a regex that matches nothing. */
  const invented = ["totalFloorAreaSqFt", "thisHelperDoesNotExist"].filter(
    (name) => !new RegExp(`(export (?:function|const|interface|type) ${name}\\b)|(^\\s+${name}\\??:)`, "m").test(declared),
  );
  expect(invented).toEqual(["thisHelperDoesNotExist"]);
});

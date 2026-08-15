import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "playwright/test";

import ScenarioCompare from "@/components/builder/ScenarioCompare";
import { FDWR_MAX } from "@/lib/design/materials";
import { comfortReport, SEASON_LABEL, type Season } from "@/lib/builder/comfort";
import {
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import { instantiatePlanTemplate, PLAN_TEMPLATES } from "@/lib/builder/planCatalog";
import { createProjectBudget } from "@/lib/builder/projectBudget";
import {
  applyScenarioMove,
  compareScenarios,
  defaultScenarioCostBasis,
  NOT_MODELLED,
  readScenario,
  SCENARIO_MOVES,
  type ScenarioFigureId,
  type ScenarioMoveId,
} from "@/lib/builder/scenarios";
import type { Volume } from "@/lib/builder/spec";
import { modelledGlazingRatio } from "@/lib/builder/toPlan";

/* ═══════════════════════════════════════════════════════════════════════
   SCEN01 — TWO DESIGN SCENARIOS, AGAINST A TARGET.

   The most dangerous thing this node could ship is a comparison that implies
   more modelling than exists. Two columns, a delta and a target is the shape
   sustainability tools use for DAYLIGHT AUTONOMY, ENERGY USE INTENSITY and
   HEATING LOAD, and this codebase models none of the three. So half of this
   file is about the figures being real and the other half is about the absent
   ones being unmissable.

   WHY IT MEASURES INSTEAD OF READING. Two recent waves shipped claims written
   in comments that nothing checked, and both were false: one said a figure was
   the largest type in its panel and it was the smallest on every phone;
   another said every figure drawn was printed beside it and thirteen of
   fourteen rows disagreed. Both passed review by reading. So every claim below
   is resolved by a real engine — the comfort model, the glazing ratio, the
   budget, or a browser laying out the real component against the real
   stylesheet — and every detector is proved able to discriminate before it is
   trusted.

   The claims, each with a way to go red:
     1. every detector in this file discriminates, including the render harness;
     2. every figure on screen is the OWNING function's own value, recomputed
        here from comfortReport / modelledGlazingRatio / createProjectBudget;
     3. each move moves exactly the quantities it declares — measured against
        the engines, not read out of the field;
     4. every scenario is a real document with a real hash, and building the
        comparison leaves the base byte-identical;
     5. a scenario never puts an opening off its wall, into a neighbour, or a
        volume through another volume — across all 55 catalogue plans;
     6. the glazing row is FDWR_MAX, is labelled a comparison rather than a code
        check, and the ceiling is really crossable;
     7. daylight is genuinely not modelled: the stated lux target changes
        nothing the comfort engine returns;
     8. graph-geometry projects are refused rather than compared;
     9. no rendered sentence claims a code or energy-rating outcome;
    10. the not-modelled labels are LARGER and HIGHER-CONTRAST than the figure
        labels beside them, at three widths in both themes;
    11. every tier in the panel clears 4.5:1 on both surfaces it can sit on;
    12. the figure out-ranks the delta, and A and B stay side by side at 390 px
        with no horizontal overflow.
   ═══════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const read = (...segments: string[]) => readFileSync(path.join(appRoot, ...segments), "utf8");

const css = read("app/globals.css");

const BASIS = defaultScenarioCostBasis();
const SEASON: Season = "winter";

/* EVERY SEASON THE PANEL CAN BE IN, derived rather than typed out. `Season` is
   a closed union and `SEASON_LABEL` is a `Record<Season, string>`, so a third
   season could not be added to the type without adding a key here — which is
   what stops this list from quietly falling behind the control in
   `ScenarioCompare.tsx`. A hard-coded pair would keep passing while an
   unchecked season shipped. */
const SEASONS = Object.keys(SEASON_LABEL) as Season[];

const MOVE_IDS = SCENARIO_MOVES.map((move) => move.id);

/* ---------------------------------------------------------------------
   THE RENDER HARNESS. Playwright's babel transform rewrites JSX in project
   files into its component-test envelope — `{ __pw_type: "jsx", type, props,
   key }` — not into React elements, so the tree is converted back. This is
   builder-craft.spec.ts's helper verbatim, including its fragment case.
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

/* ------------------------------------------------------------- fixtures */

const DOCUMENT = defaultBuilderDocument();

/** A = the design on screen, B = more glass. Chosen because it is the pairing
 *  that puts a real design OVER the NBC 9.36 prescriptive ceiling — measured
 *  in the glazing test below, not assumed here — so the alert branch is on
 *  screen and can be measured rather than reasoned about. */
const COMPARISON = compareScenarios(DOCUMENT, {
  a: "as-designed",
  b: "more-glass",
  season: SEASON,
  costBasis: BASIS,
});

const MARKUP = renderToStaticMarkup(
  asReact(
    jsx(ScenarioCompare, {
      document: DOCUMENT,
      costBasis: BASIS,
      initialA: "as-designed",
      initialB: "more-glass",
    }),
  ) as never,
);

const PAGE = `<main id="stage">${MARKUP}</main>`;

async function mount(
  page: import("playwright/test").Page,
  width: number,
  theme: "light" | "dark",
) {
  /* Motion is stilled BEFORE anything is measured. `data-theme` has to be set
     after setContent, and the moment it flips every colour token in the panel
     starts a 150 ms transition — getComputedStyle during a running transition
     returns the INTERPOLATED value, which is how builder-craft.spec.ts once
     read 1.01:1 on correct CSS about one run in three. */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: 2600 });
  await page.setContent(PAGE);
  await page.addStyleTag({ content: css });
  await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
}

interface Probe {
  selector: string;
  text: string;
  fontPx: number;
  color: string;
  top: number;
  left: number;
  width: number;
}

const probe = (page: import("playwright/test").Page, selector: string): Promise<Probe[]> =>
  page.evaluate((sel: string): Probe[] => {
    const out: Probe[] = [];
    document.querySelectorAll(sel).forEach((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      out.push({
        selector: sel,
        text: (element.textContent ?? "").trim().slice(0, 80),
        fontPx: parseFloat(style.fontSize),
        color: style.color,
        top: Math.round(box.top),
        left: Math.round(box.left),
        width: Math.round(box.width),
      });
    });
    return out;
  }, selector);

/* WCAG 2.x contrast on the two integers a browser hands back — the same
   helpers builder-craft.spec.ts uses, proved against published pairs below. */
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

/** `rgb(23, 26, 24)` → [23, 26, 24]. Null for anything carrying alpha, which
 *  is the point: a text colour reached through alpha is exactly how a read-out
 *  arrives at 2.6:1 without anybody noticing. */
const opaqueRgb = (value: string): [number, number, number] | null => {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const surfaces = async (
  page: import("playwright/test").Page,
): Promise<{ base: [number, number, number]; raised: [number, number, number] }> => {
  const raw = await page.evaluate(() => {
    const swatch = document.createElement("div");
    document.body.appendChild(swatch);
    const one = (token: string) => {
      swatch.style.backgroundColor = `rgb(var(${token}))`;
      return getComputedStyle(swatch).backgroundColor;
    };
    const result = { base: one("--tone-base"), raised: one("--tone-raised") };
    swatch.remove();
    return result;
  });
  const base = opaqueRgb(raw.base);
  const raised = opaqueRgb(raw.raised);
  if (!base || !raised) throw new Error(`surface tokens did not resolve: ${JSON.stringify(raw)}`);
  return { base, raised };
};

/* --------------------------------------------------- geometry detectors */

/** The four corners of a volume in the site plane, rotation applied. */
const cornersOf = (volume: Volume): [number, number][] => {
  const radians = (volume.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const hw = volume.widthFt / 2;
  const hd = volume.depthFt / 2;
  return ([
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as [number, number][]).map(
    ([x, z]) => [volume.x + x * cos - z * sin, volume.z + x * sin + z * cos] as [number, number],
  );
};

/** Separating-axis overlap for two rotated rectangles. Touching is not
 *  overlapping — two masses meeting on a shared wall is a building. */
function volumesOverlap(a: Volume, b: Volume): boolean {
  const A = cornersOf(a);
  const B = cornersOf(b);
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % 4];
      const ax = -(y1 - y0);
      const ay = x1 - x0;
      const project = (points: [number, number][]) => points.map(([x, y]) => x * ax + y * ay);
      const pa = project(A);
      const pb = project(B);
      if (
        Math.max(...pa) <= Math.min(...pb) + 1e-9 ||
        Math.max(...pb) <= Math.min(...pa) + 1e-9
      ) {
        return false;
      }
    }
  }
  return true;
}

const overlappingVolumePairs = (document: BuilderDocument): number => {
  let pairs = 0;
  const volumes = document.spec.volumes;
  for (let i = 0; i < volumes.length; i++) {
    for (let j = i + 1; j < volumes.length; j++) {
      if (volumesOverlap(volumes[i], volumes[j])) pairs += 1;
    }
  }
  return pairs;
};

/** The two invariants plan-catalog.spec.ts pins for every catalogue opening,
 *  quoted rather than re-derived: inside its wall, and clear of its
 *  neighbours in BOTH axes. Returns the problems it found. */
function openingProblems(document: BuilderDocument, label: string): string[] {
  const problems: string[] = [];
  for (const volume of document.spec.volumes) {
    for (const opening of volume.openings) {
      const run = opening.wall === "n" || opening.wall === "s" ? volume.widthFt : volume.depthFt;
      if (opening.widthFt <= 0 || opening.heightFt <= 0) {
        problems.push(`${label}/${volume.id}/${opening.id}: non-positive dimension`);
      }
      if (opening.offsetFt + opening.widthFt > run + 1e-9) {
        problems.push(`${label}/${volume.id}/${opening.id}: runs past the end of its wall`);
      }
      if (opening.sillFt + opening.heightFt > volume.wallHeightFt * volume.storeys + 0.01) {
        problems.push(`${label}/${volume.id}/${opening.id}: runs past the wall head`);
      }
    }
    const byWall = new Map<string, { id: string; x0: number; x1: number; y0: number; y1: number }[]>();
    for (const opening of volume.openings) {
      byWall.set(opening.wall, [
        ...(byWall.get(opening.wall) ?? []),
        {
          id: opening.id,
          x0: opening.offsetFt,
          x1: opening.offsetFt + opening.widthFt,
          y0: opening.sillFt,
          y1: opening.sillFt + opening.heightFt,
        },
      ]);
    }
    byWall.forEach((boxes, wall) => {
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (overlapX > 1e-9 && overlapY > 1e-9) {
            problems.push(`${label}/${volume.id}/${wall}: ${a.id} and ${b.id} interpenetrate`);
          }
        }
      }
    });
  }
  return problems;
}

/* ------------------------------------------------- what actually moved */

const GROUP_OF: Readonly<Record<ScenarioFigureId, "glazing" | "comfort" | "cost">> = {
  "glazing-ratio": "glazing",
  "comfort-meeting": "comfort",
  "comfort-modelled": "comfort",
  "comfort-unmodelled": "comfort",
  "comfort-mean-deviation": "comfort",
  "floor-area": "cost",
  "cost-mid": "cost",
};

/** Which of the three modelled quantities a move ACTUALLY moves, read off the
 *  engines rather than off the move's own `moves` field.
 *
 *  SEASON IS A PARAMETER, not a constant, and that is the whole point of this
 *  helper's second argument: the comfort figures on the panel are the SEASON'S
 *  figures, so a move can move comfort under one season setting and nothing at
 *  all under the other. Read at one season only, this function will report a
 *  declared dimension as moving on a panel where both sides come back
 *  identical. */
function movedGroups(id: ScenarioMoveId, season: Season = SEASON): string[] {
  const comparison = compareScenarios(DOCUMENT, {
    a: "as-designed",
    b: id,
    season,
    costBasis: BASIS,
  });
  const moved: string[] = [];
  for (const row of comparison.rows) {
    if (row.changed && moved.indexOf(GROUP_OF[row.id]) === -1) moved.push(GROUP_OF[row.id]);
  }
  return moved.sort();
}

/* ═══════════════════════════════════════════════════════ 1. the detectors */

test("every detector in this file can actually fail", () => {
  /* Contrast, against published pairs. */
  expect(Math.round(contrast([0, 0, 0], [255, 255, 255]))).toBe(21);
  expect(Math.round(contrast([255, 255, 255], [255, 255, 255]))).toBe(1);
  expect(opaqueRgb("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
  expect(opaqueRgb("rgba(1, 2, 3, 0.5)")).toBeNull();

  /* The volume overlap detector: two coincident squares overlap, two squares
     a mile apart do not, and two squares sharing an edge do NOT — touching is
     a building, and a detector that called it a defect would fire on half the
     catalogue and be switched off. */
  const square = (x: number, z: number, rotationDeg = 0): Volume => ({
    id: `v${x}-${z}`,
    name: "probe",
    widthFt: 10,
    depthFt: 10,
    x,
    z,
    rotationDeg,
    storeys: 1,
    wallHeightFt: 9,
    roof: { form: "gable", pitchDeg: 30, overhangFt: 1 },
    openings: [],
  });
  expect(volumesOverlap(square(0, 0), square(0, 0))).toBe(true);
  expect(volumesOverlap(square(0, 0), square(5, 0))).toBe(true);
  expect(volumesOverlap(square(0, 0), square(10, 0))).toBe(false);
  expect(volumesOverlap(square(0, 0), square(500, 0))).toBe(false);
  /* Rotation is really applied: a 45° square reaches further along x than an
     axis-aligned one, so a gap that is clear at 0° is an overlap at 45°. */
  expect(volumesOverlap(square(0, 0), square(12, 0))).toBe(false);
  expect(volumesOverlap(square(0, 0, 45), square(12, 0, 45))).toBe(true);

  /* The opening detector: a clean document reports nothing, and each of the
     three faults it looks for is really found. */
  expect(openingProblems(DOCUMENT, "clean")).toEqual([]);
  const offWall = structuredClone(DOCUMENT);
  offWall.spec.volumes[0].openings[0].offsetFt = 900;
  expect(openingProblems(offWall, "x").join(" ")).toContain("past the end of its wall");
  const throughHead = structuredClone(DOCUMENT);
  throughHead.spec.volumes[0].openings[0].heightFt = 900;
  expect(openingProblems(throughHead, "x").join(" ")).toContain("past the wall head");
  const collided = structuredClone(DOCUMENT);
  collided.spec.volumes[0].openings[1].offsetFt =
    collided.spec.volumes[0].openings[0].offsetFt;
  collided.spec.volumes[0].openings[1].wall = collided.spec.volumes[0].openings[0].wall;
  expect(openingProblems(collided, "x").join(" ")).toContain("interpenetrate");

  /* The moved-groups detector discriminates rather than returning a constant.
     If it did return a constant, claim 3 would pass for every move. */
  expect(movedGroups("as-designed")).toEqual([]);
  expect(movedGroups("bigger-footprint")).toEqual(["comfort", "cost", "glazing"]);

  /* AND ITS SEASON ARGUMENT REACHES THE ENGINE. Claim 3 is now measured once
     per season, and that is worth nothing if the season is being dropped on
     the way down — two identical readings would look like agreement rather
     than like a parameter going nowhere. So the panel is asked for the same
     move under both settings and required to answer differently. */
  expect(SEASONS.length).toBeGreaterThan(1);
  expect(SEASONS).toContain("winter");
  expect(SEASONS).toContain("summer");
  const deviationAt = (season: Season): number =>
    readScenario(DOCUMENT, "as-designed", { season, costBasis: BASIS }).figures.find(
      (figure) => figure.id === "comfort-mean-deviation",
    )!.value;
  expect(
    deviationAt("winter"),
    "winter and summer return the same mean |sPMV|, so the season argument is not reaching comfortReport and every per-season check below is one check run twice",
  ).not.toBe(deviationAt("summer"));

  /* The render harness translated a real component rather than inventing a
     string: the panel, a control, an engine name and a real figure are all in
     the markup it produced. */
  expect(MARKUP).toContain('class="scenario"');
  expect(MARKUP).toContain("modelledGlazingRatio");
  expect(MARKUP).toContain("scenario-absent__label");
  expect(MARKUP.length).toBeGreaterThan(3000);
});

/* ══════════════════════════════════ 2. one engine, two calls — every figure */

test("every figure is the owning engine's own value, recomputed here", () => {
  /* THE GATE THIS NODE EXISTS UNDER. A second calculation of one fact is
     forbidden, and the only way to prove there is not one is to ask the
     owning function directly and demand the same number. */
  for (const id of MOVE_IDS) {
    const reading = readScenario(DOCUMENT, id, { season: SEASON, costBasis: BASIS });
    expect(reading.available, `${id} should be readable`).toBe(true);

    const scenarioDoc = applyScenarioMove(DOCUMENT, id);
    const ownRatio = modelledGlazingRatio(scenarioDoc.spec);
    const ownComfort = comfortReport(scenarioDoc.spec, scenarioDoc.comfort);
    const ownKpi = SEASON === "winter" ? ownComfort.winter : ownComfort.summer;
    const ownBudget = createProjectBudget({
      document: scenarioDoc,
      scenario: BASIS.scenario,
      region: BASIS.region,
      municipality: BASIS.municipality,
      budgetCapCad: BASIS.budgetCapCad,
    });

    const expected: Record<ScenarioFigureId, number> = {
      "glazing-ratio": ownRatio,
      "comfort-meeting": ownKpi.roomsMeeting,
      "comfort-modelled": ownKpi.roomsModelled,
      "comfort-unmodelled": ownKpi.roomsUnmodelled,
      "comfort-mean-deviation": ownKpi.meanAbsDeviation,
      "floor-area": ownBudget.measures.areaSqFt,
      "cost-mid": ownBudget.total.mid,
    };

    /* Every figure the reading offers, and every figure the engines own —
       neither list may be shorter than the other, because a panel that
       silently dropped a row would pass a one-directional check. */
    expect(reading.figures.map((figure) => figure.id).sort()).toEqual(
      (Object.keys(expected) as ScenarioFigureId[]).sort(),
    );

    for (const figure of reading.figures) {
      expect(figure.value, `${id}/${figure.id} is not the engine's own value`).toBe(
        expected[figure.id],
      );
      /* And the provenance line names the function that really owns it. */
      const owner =
        figure.id === "glazing-ratio"
          ? "modelledGlazingRatio"
          : figure.id === "floor-area" || figure.id === "cost-mid"
            ? "createProjectBudget"
            : "comfortReport";
      expect(figure.source, `${id}/${figure.id} names the wrong engine`).toBe(owner);
    }
  }
});

/* ═════════════════════════════════════ 3. each move moves what it declares */

test("each move moves exactly the modelled quantities it declares", () => {
  /* The `moves` field is a claim written in a data structure, which is the
     same class of thing as a claim written in a comment. Measured against the
     engines instead.

     IN EVERY SEASON THE PANEL CAN BE IN, and that clause is the fix for a real
     defect rather than thoroughness for its own sake. `ask-warmer` declared
     "comfort" and, read at one season only, appeared to keep the claim; under
     the other season setting it changed nothing at all, and the panel printed
     comfort as an affected dimension over two columns that came back
     identical. A comparison panel naming a dimension that did not move is the
     one failure this whole node exists to prevent, so the check runs per
     season and names the season it failed in.

     EQUALITY, NOT CONTAINMENT, in both directions: a declared dimension that
     stays still is a false claim, and an undeclared dimension that moves is a
     surprise the reader was not warned about. */
  const wrong: string[] = [];
  for (const move of SCENARIO_MOVES) {
    const declared = [...move.moves].sort();
    for (const season of SEASONS) {
      const actually = movedGroups(move.id, season);
      if (JSON.stringify(actually) !== JSON.stringify(declared)) {
        wrong.push(
          `${move.id} in ${season}: declares [${declared.join(", ")}] and actually moves [${actually.join(", ")}]`,
        );
      }
    }
  }
  expect(
    wrong,
    `a move's \`moves\` list is what the panel prints as the affected dimensions. Every entry below is a dimension the panel names over two columns that come back equal, or a dimension it moves without saying so:\n${wrong.join("\n")}`,
  ).toEqual([]);

  /* And the three specific movements the panel's whole argument rests on. */
  const glass = compareScenarios(DOCUMENT, {
    a: "less-glass",
    b: "more-glass",
    season: SEASON,
    costBasis: BASIS,
  });
  const glazing = glass.rows.find((row) => row.id === "glazing-ratio");
  expect(glazing?.a.value).toBeLessThan(glazing?.b.value ?? 0);

  const warmer = compareScenarios(DOCUMENT, {
    a: "as-designed",
    b: "ask-warmer",
    season: SEASON,
    costBasis: BASIS,
  });
  const meeting = warmer.rows.find((row) => row.id === "comfort-meeting");
  expect(meeting?.changed, "asking for a warmer house must move the comfort verdict").toBe(true);
  expect(warmer.rows.find((row) => row.id === "cost-mid")?.changed).toBe(false);
});

/* ══════════════════════════════ 4. real documents, real hashes, no writing */

test("every scenario is a real document with a real hash, and the base is untouched", () => {
  const before = JSON.stringify(DOCUMENT);
  const beforeHash = hashBuilderDocument(DOCUMENT);

  const hashes = new Map<ScenarioMoveId, string>();
  for (const id of MOVE_IDS) {
    const reading = readScenario(DOCUMENT, id, { season: SEASON, costBasis: BASIS });
    expect(reading.valid, `${id}: ${reading.validationProblem}`).toBe(true);
    expect(reading.hash, `${id} has no hash`).not.toBeNull();
    expect(validateBuilderDocument(reading.document).ok).toBe(true);
    hashes.set(id, reading.hash as string);
  }

  /* THE BASELINE IS THE PROJECT. "As designed" is not a copy that happens to
     look the same — it is the same document, and its hash proves it. */
  expect(hashes.get("as-designed")).toBe(beforeHash);

  /* Every other move produces a DIFFERENT document. A move that silently did
     nothing would still be a valid document with a real hash, and this is the
     only assertion that would notice. */
  for (const id of MOVE_IDS) {
    if (id === "as-designed") continue;
    expect(hashes.get(id), `${id} produced the base document unchanged`).not.toBe(beforeHash);
  }
  expect(new Set(hashes.values()).size).toBe(MOVE_IDS.length);

  /* SWITCHING BETWEEN THEM CHANGES NOTHING ON DISK, which here means: the
     document handed in is byte-identical afterwards. */
  expect(JSON.stringify(DOCUMENT)).toBe(before);
  expect(hashBuilderDocument(DOCUMENT)).toBe(beforeHash);

  /* And two identical moves compare as identical rather than as a delta of
     zero that a reader might mistake for a finding. */
  const same = compareScenarios(DOCUMENT, {
    a: "less-glass",
    b: "less-glass",
    season: SEASON,
    costBasis: BASIS,
  });
  expect(same.identical).toBe(true);
  expect(same.rows.every((row) => !row.changed)).toBe(true);
});

/* ═══════════════════════ 5. a scenario is still a buildable document — all 55 */

test("no move puts an opening off its wall, into a neighbour, or a volume through a volume", () => {
  expect(PLAN_TEMPLATES.length).toBeGreaterThan(50);

  const problems: string[] = [];
  for (const plan of PLAN_TEMPLATES) {
    const base = instantiatePlanTemplate(plan.id);
    /* Some catalogue plans deliberately overlap masses — an L-plan wing
       meeting the main house is summed rather than unioned and the estimate
       publishes the error. So the claim is CONSERVATION, not perfection: a
       move may not ADD an overlapping pair. */
    const baseOverlaps = overlappingVolumePairs(base);

    for (const id of MOVE_IDS) {
      const moved = applyScenarioMove(base, id);
      const checked = validateBuilderDocument(moved);
      if (!checked.ok) {
        problems.push(`${plan.id}/${id}: did not validate — ${checked.problem}`);
        continue;
      }
      problems.push(...openingProblems(moved, `${plan.id}/${id}`));
      const movedOverlaps = overlappingVolumePairs(moved);
      if (movedOverlaps > baseOverlaps) {
        problems.push(
          `${plan.id}/${id}: created ${movedOverlaps - baseOverlaps} new overlapping volume pair(s)`,
        );
      }
    }
  }

  expect(
    problems.slice(0, 20),
    `a scenario must be a real, buildable document — these are not:\n${problems.join("\n")}`,
  ).toEqual([]);
});

/* ══════════════════════════════════════════ 6. the ceiling, and its label */

test("the glazing row is FDWR_MAX, labelled a comparison rather than a code check", () => {
  const row = COMPARISON.rows.find((entry) => entry.id === "glazing-ratio");
  expect(row).toBeDefined();
  expect(row?.a.target?.value).toBe(FDWR_MAX);
  expect(row?.b.target?.value).toBe(FDWR_MAX);
  /* The live read-out's exact label, sentence-cased here because it opens the
     sentence. The words are what travel, not the capital. */
  expect(row?.a.note).toContain("comparison, not a code check");
  expect(row?.a.target?.label).toContain("NBC 9.36");

  /* THE CEILING IS REALLY CROSSABLE. A target nothing can ever miss is
     decoration — so this asserts a real design that is inside it and a real
     design, produced by a real move, that is over it. */
  expect(row?.a.value).toBeLessThanOrEqual(FDWR_MAX);
  expect(row?.a.target?.met).toBe(true);
  expect(row?.b.value).toBeGreaterThan(FDWR_MAX);
  expect(row?.b.target?.met).toBe(false);
});

/* ═══════════════════════════ 7. daylight really is not modelled */

test("the stated lux target changes nothing the comfort engine returns", () => {
  /* NOT MODELLED has to be true, not merely printed. Every room carries an
     illuminanceMinLux target that is editable and is written into the IFC
     export — so the honest question is whether anything ever reads it back.
     Move it by a factor of twenty and demand the comfort answer is identical.
     If a daylight check were ever added without this file being updated, this
     goes red, which is the correct outcome for a sentence that would then be
     false. */
  const rooms = comfortReport(DOCUMENT.spec, DOCUMENT.comfort).rooms;
  expect(rooms.length).toBeGreaterThan(0);

  const relit: BuilderDocument = {
    ...DOCUMENT,
    comfort: {
      ...DOCUMENT.comfort,
      targets: Object.fromEntries(
        rooms.map((room) => [room.room.id, { ...room.target, illuminanceMinLux: 4000 }]),
      ),
    },
  };

  const before = comfortReport(DOCUMENT.spec, DOCUMENT.comfort);
  const after = comfortReport(relit.spec, relit.comfort);

  /* TWO DETECTORS BEFORE THE CLAIM, because "identical" is exactly the kind
     of result that is also what a broken comparison returns.

     First: the edit really did land, so the identity below is not identity
     between two copies of the same input. */
  expect(after.rooms[0].target.illuminanceMinLux).toBe(4000);
  expect(before.rooms[0].target.illuminanceMinLux).not.toBe(4000);

  /* Second, and this is the one that makes the claim falsifiable: the same
     comparison DOES go red for an input the comfort model really reads. If
     `toEqual` on a ComfortKpi could not discriminate, every assertion under
     it would pass on a daylight model that had quietly been added. */
  const warmer = comfortReport(DOCUMENT.spec, {
    ...DOCUMENT.comfort,
    conditions: { ...DOCUMENT.comfort.conditions, winterIndoorC: 24 },
  });
  expect(warmer.winter).not.toEqual(before.winter);
  expect(warmer.rooms[0].winter).not.toEqual(before.rooms[0].winter);

  expect(after.winter).toEqual(before.winter);
  expect(after.summer).toEqual(before.summer);
  after.rooms.forEach((room, index) => {
    expect(room.winter).toEqual(before.rooms[index].winter);
    expect(room.summer).toEqual(before.rooms[index].summer);
  });
  const everyMiss = after.rooms.flatMap((room) => [...room.winter.misses, ...room.summer.misses]);
  for (const miss of everyMiss) {
    expect(miss.toLowerCase()).not.toContain("lux");
    expect(miss.toLowerCase()).not.toContain("daylight");
    expect(miss.toLowerCase()).not.toContain("illumin");
  }

  /* And the panel says so, with the reason and what an answer would need. */
  expect(NOT_MODELLED.length).toBe(4);
  const ids = NOT_MODELLED.map((entry) => entry.id).sort();
  expect(ids).toEqual(["daylight-autonomy", "energy-use-intensity", "heating-load", "solar-gain"]);
  for (const entry of NOT_MODELLED) {
    expect(entry.why.length, `${entry.id} has no real reason`).toBeGreaterThan(120);
    expect(entry.needs.length, `${entry.id} does not say what an answer needs`).toBeGreaterThan(80);
  }
  expect(COMPARISON.notModelled).toEqual(NOT_MODELLED);
});

/* ══════════════════════════════════ 8. graph projects are refused, not faked */

test("a planar-graph project is refused rather than compared from a frozen spec", () => {
  const converted = convertBuilderDocumentToGraph(DOCUMENT, 0.5);
  expect(converted.ok, "the conversion fixture itself failed").toBe(true);
  if (!converted.ok) return;

  const comparison = compareScenarios(converted.document, {
    a: "as-designed",
    b: "more-glass",
    season: SEASON,
    costBasis: BASIS,
  });
  expect(comparison.available).toBe(false);
  expect(comparison.rows).toEqual([]);
  expect(comparison.reason).toContain("frozen recovery copy");
  /* The not-modelled block still shows: what this build cannot answer does
     not depend on which geometry the project happens to use. */
  expect(comparison.notModelled.length).toBe(4);
});

/* ═════════════════════════ 9. nothing on screen claims a code or rating outcome */

test("no rendered sentence claims a code, certification or energy-rating outcome", async ({ page }) => {
  await mount(page, 1280, "light");
  const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();

  /* The detector: the scan really is looking at the panel's prose. */
  expect(text).toContain("a comparison, not a code check");
  expect(text.length).toBeGreaterThan(1500);

  const forbidden = [
    "code compliant",
    "code-compliant",
    "meets code",
    "meets the code",
    "complies with",
    "energy rating",
    "energuide",
    "net zero",
    "net-zero",
    "certified",
    "guaranteed",
    "will save",
    "kwh/m",
  ];
  const found = forbidden.filter((phrase) => text.includes(phrase));
  expect(
    found,
    `this panel compares a MODEL. These phrases turn a comparison into a claim about a code, a certification or an energy rating, none of which this build performs:\n${found.join("\n")}`,
  ).toEqual([]);

  /* And the four absent quantities are named in the prose, not merely in a
     data structure nobody renders. */
  for (const entry of NOT_MODELLED) {
    expect(text, `${entry.label} is not on screen`).toContain(entry.label.toLowerCase());
  }
  expect(text).toContain("not modelled");

  /* ───── THE SCAN ABOVE READ ONLY WHAT TWO SELECTED MOVES RENDER ─────

     Two holes, both found by a fresh-context review that wrote the offending
     sentence and watched all twelve tests stay green.

     ONE: only the two moves on screen were scanned, so three of the five
     `change` strings were never read by any gate. A reviewer put "This version
     is code compliant, is certified net zero, and will save you 40 kWh/m2 a
     year" into `less-glass.change` and nothing fired.

     TWO, and this is the one that matters: the NOT_MODELLED rows were checked
     for LENGTH and never for CONTENT. They exist precisely to prevent the claim
     this node's contract calls the most dangerous in the product — and they
     were the one place in the panel where that claim was unchecked. A reviewer
     wrote "Aura models daylight autonomy internally and this design achieves
     62% sDA" into the daylight row's `why`, and twelve tests passed. It renders
     at full strength under a heading reading "Not modelled", which is the exact
     context that would make a reader believe it. */
  const everyMoveString = SCENARIO_MOVES.flatMap((move) => [move.change, move.label]);
  const absentProse = NOT_MODELLED.flatMap((entry) => [entry.why, entry.needs, entry.label]);
  const everyString = [...everyMoveString, ...absentProse].join(" \n ").toLowerCase();

  const foundAnywhere = forbidden.filter((phrase) => everyString.includes(phrase));
  expect(
    foundAnywhere,
    `these phrases appear in a move or in an absent-quantity row. Every one of the five moves is scanned now, not just the two on screen:\n${foundAnywhere.join("\n")}`,
  ).toEqual([]);

  /* A ROW THAT SAYS "NOT MODELLED" MAY NOT CARRY A RESULT-SHAPED FIGURE.
     This is the rule that kills the counterexample above by shape rather than
     by vocabulary, so it does not depend on anybody guessing the next word a
     future writer reaches for. A percentage, a kWh figure or an sDA score in a
     row headed "not modelled" is a modelled result wearing a disclaimer. */
  for (const entry of NOT_MODELLED) {
    const prose = `${entry.why} ${entry.needs}`;
    const resultShaped = prose.match(/\d+(\.\d+)?\s*(%|percent|kwh|kw\/h|sda|ase|ach\b)/gi) ?? [];
    expect(
      resultShaped,
      `${entry.label} is listed as NOT MODELLED and its own text states a figure that reads as a result: ${resultShaped.join(", ")}. A quantity this build does not compute must not appear to have been computed.`,
    ).toEqual([]);
  }
});

/* ═══════════ 10. the absent quantities read as an answer, not an empty state */

/* ONE DECLARATION, LOOPING INSIDE — deliberately, and the reason is
   gate-coverage.spec.ts. That gate counts declarations with a REGEX over the
   source and pins the total against a number observed from the runner. Six
   cases generated from one declaration in a loop would make the counter
   disagree with the runner by five, and the disagreement would look like the
   pin being stale rather than the counter being wrong. builder-craft.spec.ts
   loops inside one case for the same reason; this file follows it.

   THIS COMMENT DELIBERATELY DOES NOT SPELL THE TOKEN IT IS ABOUT. An earlier
   draft did, in backticks, and the counter matched the prose: 13 declarations
   counted against 12 the runner declared. That is gate-coverage's own third
   correction — "a literal spelling necessarily contains the very text it
   searches for" — reintroduced one file over. Caught by running the gate's
   regex over this file rather than by reading it. */
test("not-modelled reads louder than the figure labels, at three widths in both themes", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      const where = `${width}px ${theme}`;
      await mount(page, width, theme);

      const absent = await probe(page, ".scenario-absent__label");
      const labels = await probe(page, ".builder-figure__label");
      expect(absent.length, `${where}: no absent-quantity labels rendered`).toBe(4);
      expect(labels.length, `${where}: no figure labels rendered`).toBeGreaterThan(4);

      const smallestAbsent = Math.min(...absent.map((item) => item.fontPx));
      const largestLabel = Math.max(...labels.map((item) => item.fontPx));

      /* SIZE. The claim is strict, and it is the claim a clamp resolving to
         its floor would break — which is exactly how the last wave's
         hierarchy claim was false on every phone. */
      expect(
        smallestAbsent,
        `${where}: the smallest not-modelled label is ${smallestAbsent}px and the largest figure label is ${largestLabel}px. "Not modelled is a first-class answer" is a claim about type, and at this width it is false.`,
      ).toBeGreaterThan(largestLabel);

      /* CONTRAST. Not dimmed toward disabled: strictly higher contrast than
         the figure labels beside them, on the surface they share. */
      const { base } = await surfaces(page);
      const absentRgb = absent.map((item) => opaqueRgb(item.color));
      const labelRgb = labels.map((item) => opaqueRgb(item.color));
      expect(
        absentRgb.every((rgb) => rgb !== null),
        `${where}: a not-modelled label reaches its colour through alpha, which is how a read-out arrives at 2.6:1 unnoticed`,
      ).toBe(true);

      const worstAbsent = Math.min(
        ...absentRgb.map((rgb) => contrast(rgb as [number, number, number], base)),
      );
      const bestLabel = Math.max(
        ...labelRgb
          .filter((rgb): rgb is [number, number, number] => rgb !== null)
          .map((rgb) => contrast(rgb, base)),
      );
      expect(worstAbsent, `${where}: dimmer than the figure labels beside it`).toBeGreaterThan(
        bestLabel,
      );
      expect(worstAbsent, `${where}: below 4.5:1`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

/* ═══════════════════════════════ 11. every tier clears 4.5:1 on both surfaces */

test("every tier in the scenario panel clears 4.5:1 on both surfaces, in both themes", async ({
  page,
}) => {
  const tiers = [
    ".scenario-eyebrow",
    ".scenario-lede",
    ".scenario-column__name",
    ".scenario-delta__value",
    ".scenario-delta__target",
    ".scenario-absent__title",
    ".scenario-absent__label",
    ".scenario-absent__why",
    ".scenario-absent__needs",
    ".scenario-foot",
  ];

  const failures: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await mount(page, 1280, theme);
    const { base, raised } = await surfaces(page);

    for (const selector of tiers) {
      const found = await probe(page, selector);
      expect(found.length, `${theme}: ${selector} rendered nothing to measure`).toBeGreaterThan(0);
      for (const item of found) {
        const rgb = opaqueRgb(item.color);
        if (!rgb) {
          failures.push(`${selector} reaches its colour through alpha (${item.color})`);
          continue;
        }
        const onBase = contrast(rgb, base);
        const onRaised = contrast(rgb, raised);
        if (Math.min(onBase, onRaised) < 4.5) {
          failures.push(
            `${theme}: ${selector} is ${onBase.toFixed(2)}:1 on base and ${onRaised.toFixed(2)}:1 on raised`,
          );
        }
      }
    }
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

/* ══════════════════════ 12. the figure out-ranks the delta, and A stays beside B */

test("the figure out-ranks the delta, and A stays beside B at 390 with no overflow", async ({
  page,
}) => {
  await mount(page, 390, "light");

  const values = await probe(page, ".scenario-cell .builder-figure__value");
  const deltas = await probe(page, ".scenario-delta__value");
  expect(values.length).toBe(COMPARISON.rows.length * 2);
  expect(deltas.length).toBe(COMPARISON.rows.length);

  /* No utility class hides inside a measured cell, which is the precondition
     under which this measurement describes the shipped page: Tailwind is
     deliberately not attached here, so a size utility would resolve to
     nothing and parent and child would measure identically. */
  const utilities = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".scenario-cell *, .scenario-delta *"))
      .map((element) => (typeof element.className === "string" ? element.className : ""))
      .filter((names) => /\btext-(xs|sm|base|lg|xl)\b|\bfont-(mono|sans|display)\b/.test(names)),
  );
  expect(utilities, "a type utility inside a measured cell resolves to nothing here").toEqual([]);

  const smallestValue = Math.min(...values.map((item) => item.fontPx));
  const largestDelta = Math.max(...deltas.map((item) => item.fontPx));
  expect(
    smallestValue,
    `the smallest figure is ${smallestValue}px and the largest delta is ${largestDelta}px — the delta is the second thing a reader looks at, never the first`,
  ).toBeGreaterThan(largestDelta);

  /* A COMPARISON HAS TO BE ADJACENT. Collapsed to one column, A and B stop
     being comparable and the reader has to hold a number in their head. So on
     a phone the two cells of a row share a top edge and sit at different x. */
  const pairs = COMPARISON.rows.length;
  for (let index = 0; index < pairs; index += 1) {
    const a = values[index * 2];
    const b = values[index * 2 + 1];
    expect(Math.abs(a.top - b.top), `row ${index}: A and B are not on the same line`).toBeLessThanOrEqual(2);
    expect(b.left, `row ${index}: B is not beside A`).toBeGreaterThan(a.left);
  }

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll, "the panel overflows a 390px page horizontally").toBeLessThanOrEqual(
    overflow.client,
  );
});

/* ===========================================================================
   SCENARIO COMPARISON — two design scenarios, side by side, against a target.

   WHAT THIS IS, IN ONE SENTENCE. Two real builder documents, each read by the
   SAME engines the editor's read-out already runs, printed beside each other
   with the delta and — where a target exists in this codebase — whether each
   side is inside it.

   WHAT THIS IS NOT, AND THE LIST IS THE WHOLE POINT
   ------------------------------------------------
   A scenario comparison is the single most dangerous surface this product
   could ship, because the shape of it — two columns, a delta, a target — is
   the shape sustainability tools use to report DAYLIGHT AUTONOMY, ENERGY USE
   INTENSITY and HEATING LOAD. None of those three is modelled anywhere in this
   repository. Not approximated, not estimated: absent. There is no weather
   file, no sky model, no illuminance calculation, no heat-loss calculation and
   no energy model in this codebase, and a comparison that let a reader infer
   otherwise would be worse than no comparison at all.

   So `NOT_MODELLED` below is a FIRST-CLASS RESULT. It is not a disclaimer at
   the foot of the panel; it is rows in the same table as the figures, each
   naming the quantity, why it is absent, and what a build would need in order
   to answer it honestly. `ScenarioCompare.tsx` prints every one of them.

   ONE ENGINE, TWO CALLS
   ---------------------
   Every number here comes from a function that already owns it:

     · `comfortReport`          — lib/builder/comfort.ts
     · `modelledGlazingRatio`   — lib/builder/toPlan.ts
     · `createProjectBudget`    — lib/builder/projectBudget.ts

   Nothing in this file recomputes any of those quantities, and `figure.source`
   names the owning function on screen so a reader can check. That constraint
   is not stylistic: this repo has shipped a second opinion about one fact four
   times, and each time the two answers agreed on the day they were written and
   disagreed by the time anybody noticed.

   WHY A COMPARISON IS NOT A CODE CHECK
   ------------------------------------
   The glazing row is measured against `FDWR_MAX`, the NBC 9.36 PRESCRIPTIVE
   fenestration ceiling. The live read-out already labels that figure "a
   comparison, not a code check" and the label travels here unchanged. A design
   over the prescriptive ceiling is not illegal — it is off the prescriptive
   path, and the compliance path it then needs is a conversation with a
   designer, not a verdict this file is entitled to give.

   PURE AND DETERMINISTIC. No clock, no randomness, no DOM, no network, and no
   mutation of the document it is handed. Four of the five moves build a new
   document and the fifth — "as designed" — returns the SAME object, which is
   the point of it: the baseline is the project, not a copy that resembles it,
   and its hash proves that. Either way the base is left byte-identical, which
   `tests/scenarios.spec.ts` asserts by hash. Comparing scenarios changes
   nothing on disk because comparing scenarios writes nothing at all.
   =========================================================================== */

import { FDWR_MAX } from "@/lib/design/materials";
import {
  comfortReport,
  type ComfortKpi,
  type ComfortReport,
  type DesignConditions,
  type Season,
} from "./comfort";
import {
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudget,
  type ProjectBudgetScenario,
} from "./projectBudget";
import { parcelCheckApplies } from "./readiness";
import type { HomeSpec, Opening, Volume } from "./spec";
import { modelledGlazingRatio } from "./toPlan";

/* ===========================================================================
   THE MOVES — what makes scenario B different from scenario A
   =========================================================================== */

export type ScenarioMoveId =
  /** the design on screen, untouched — the baseline both columns start from */
  | "as-designed"
  /** every glazed opening shrunk; the cold-climate "spend less on glass" case */
  | "less-glass"
  /** every glazed opening grown as far as its wall and its neighbours allow */
  | "more-glass"
  /** the whole cluster scaled up: more floor, more wall, the same glass */
  | "bigger-footprint"
  /** a change to the STATED indoor assumption — not a change to the building */
  | "ask-warmer";

/** Glass at three fifths of its modelled size. */
export const LESS_GLASS_FACTOR = 0.6;
/** Glass at one and a half times its modelled size, WHERE THE WALL ALLOWS.
 *  The clamp is the honest half of this constant: an opening never leaves its
 *  wall and never grows into a neighbour, so the achieved ratio is usually
 *  below 1.5× and is always measured from the resulting document rather than
 *  predicted from this number. */
export const MORE_GLASS_FACTOR = 1.5;
/** Every volume 20% larger in each plan dimension — 44% more floor area. */
export const BIGGER_FOOTPRINT_FACTOR = 1.2;
/** Degrees added to the stated indoor air temperature — BOTH seasons, not just
 *  winter, and the reason is the season control at the top of the panel.
 *
 *  Every comfort figure on screen is the SELECTED season's figure, so a move
 *  that raised only `winterIndoorC` declared it moved comfort and then moved
 *  nothing whatever with the control set to summer: the panel named comfort as
 *  an affected dimension over two columns that came back identical. A declared
 *  dimension that does not move is the one claim a comparison panel may never
 *  make, so the move now raises the assumption the reader is actually looking
 *  at, whichever one that is. `tests/scenarios.spec.ts` measures every move
 *  against every season rather than against the default one. */
export const ASK_WARMER_DELTA_C = 3;

/** Buildable resolution for a dimension this file writes, feet. Openings and
 *  volumes elsewhere in the repo land on half- and quarter-foot steps, and a
 *  scenario that produced 24.8571 ft of glazing would read as false precision
 *  in a tool whose whole argument is that its numbers are checkable. */
const STEP_FT = 0.25;

/** Down to the step. DOWN rather than nearest is load-bearing in both
 *  directions: growing, it keeps the result inside the clamp that proves the
 *  opening stays on its wall; shrinking, it keeps the result at or under the
 *  original, so a "less glass" move can never accidentally add glass. */
const stepDown = (value: number): number => Math.floor(value / STEP_FT) * STEP_FT;

/** The wall run an opening sits on, feet. North and south walls run the
 *  volume's width; east and west run its depth. This is the same definition
 *  `tests/plan-catalog.spec.ts` uses to assert every catalogue opening sits
 *  inside its wall, quoted rather than re-derived. */
const runOf = (volume: Volume, opening: Opening): number =>
  opening.wall === "n" || opening.wall === "s" ? volume.widthFt : volume.depthFt;

/** Head height of a wall — floor to the underside of the eave, all storeys. */
const headOf = (volume: Volume): number => volume.wallHeightFt * volume.storeys;

const spansOverlap = (a0: number, a1: number, b0: number, b1: number): boolean =>
  Math.min(a1, b1) - Math.max(a0, b0) > 1e-9;

/**
 * Every glazed opening scaled, with two clamps that make the result provable.
 *
 * DOORS ARE NEVER SCALED — `glazedAreaSqFt` excludes them, so growing a door
 * would move nothing the glazing ratio measures while quietly changing the
 * elevation. They still take part as OBSTACLES, because a window may not grow
 * into a door any more than into another window.
 *
 * TWO PASSES, AND THE ORDER IS THE PROOF.
 *
 *   Pass 1 grows HEIGHT only, clamped to the wall head and to the sill of the
 *   nearest opening directly above that shares horizontal span. Nothing moves
 *   sideways, so the horizontal relationships pass 1 reasons about are the
 *   input's.
 *
 *   Pass 2 grows WIDTH only, clamped to the end of the wall and to the near
 *   edge of the nearest opening to the right that overlaps VERTICALLY — using
 *   the heights pass 1 has already fixed, so both spans are settled before any
 *   width moves.
 *
 * Given an input in which no two openings on a wall interpenetrate — the
 * invariant `plan-catalog.spec.ts` pins for all 55 catalogue plans — the
 * output has the same property, because every opening only ever grows up and
 * right, and is clamped short of the first thing in that direction. Each
 * opening also only ever grows, so `offset + width <= run` and
 * `sill + height <= head` survive unchanged. `tests/scenarios.spec.ts`
 * measures both invariants over the whole catalogue rather than trusting this
 * paragraph.
 */
function scaleGlass(spec: HomeSpec, factor: number): HomeSpec {
  const grow = factor > 1;
  return {
    ...spec,
    volumes: spec.volumes.map((volume) => {
      const head = headOf(volume);

      /* ---- pass 1: heights ------------------------------------------- */
      const heights = volume.openings.map((opening) => {
        if (opening.kind === "door") return opening.heightFt;
        if (!grow) {
          return Math.min(
            opening.heightFt,
            Math.max(STEP_FT, stepDown(opening.heightFt * factor)),
          );
        }
        let ceiling = head;
        for (const other of volume.openings) {
          if (other === opening || other.wall !== opening.wall) continue;
          const above = other.sillFt >= opening.sillFt + opening.heightFt - 1e-9;
          if (!above) continue;
          if (
            spansOverlap(
              opening.offsetFt,
              opening.offsetFt + opening.widthFt,
              other.offsetFt,
              other.offsetFt + other.widthFt,
            )
          ) {
            ceiling = Math.min(ceiling, other.sillFt);
          }
        }
        const room = ceiling - opening.sillFt;
        return Math.max(opening.heightFt, Math.min(stepDown(opening.heightFt * factor), room));
      });

      /* ---- pass 2: widths, against the heights pass 1 settled ---------- */
      const widths = volume.openings.map((opening, index) => {
        if (opening.kind === "door") return opening.widthFt;
        if (!grow) {
          return Math.min(
            opening.widthFt,
            Math.max(STEP_FT, stepDown(opening.widthFt * factor)),
          );
        }
        const run = runOf(volume, opening);
        const y0 = opening.sillFt;
        const y1 = opening.sillFt + heights[index];
        let edge = run;
        volume.openings.forEach((other, otherIndex) => {
          if (otherIndex === index || other.wall !== opening.wall) return;
          const right = other.offsetFt >= opening.offsetFt + opening.widthFt - 1e-9;
          if (!right) return;
          const oy0 = other.sillFt;
          const oy1 = other.sillFt + heights[otherIndex];
          if (spansOverlap(y0, y1, oy0, oy1)) edge = Math.min(edge, other.offsetFt);
        });
        const room = edge - opening.offsetFt;
        return Math.max(opening.widthFt, Math.min(stepDown(opening.widthFt * factor), room));
      });

      return {
        ...volume,
        openings: volume.openings.map((opening, index) => ({
          ...opening,
          widthFt: widths[index],
          heightFt: heights[index],
        })),
      };
    }),
  };
}

/**
 * The whole cluster scaled about the site origin.
 *
 * A SIMILARITY TRANSFORM, not a per-volume resize, and the difference is the
 * only reason this move is safe. Scaling each volume in place would close the
 * gaps between the masses of an L-plan or a main-house-plus-annexe cluster and
 * could drive two volumes through each other — a modelling mistake nothing in
 * `validateHomeSpec` catches, because that function checks the contract rather
 * than the building. Scaling the CENTRES by the same factor maps the whole
 * arrangement through a similarity, and a similarity cannot turn a
 * non-overlapping arrangement into an overlapping one.
 *
 * The dimensions are then stepped DOWN to the buildable resolution, which puts
 * every volume at or inside its exact scaled rectangle — so the guarantee
 * survives the rounding — and floored at the original size, so no opening can
 * be left hanging off the end of a wall that shrank.
 *
 * Openings are untouched. Every run and every head only grows, so containment
 * is preserved by construction; the glass stays exactly the glass you drew,
 * which is what makes this move a clean read on the glazing ratio's
 * denominator.
 */
function scaleFootprint(spec: HomeSpec, factor: number): HomeSpec {
  return {
    ...spec,
    volumes: spec.volumes.map((volume) => ({
      ...volume,
      widthFt: Math.max(volume.widthFt, stepDown(volume.widthFt * factor)),
      depthFt: Math.max(volume.depthFt, stepDown(volume.depthFt * factor)),
      x: volume.x * factor,
      z: volume.z * factor,
    })),
  };
}

export interface ScenarioMove {
  id: ScenarioMoveId;
  /** the name on the control */
  label: string;
  /** WHAT CHANGED, in words, printed beside the column. A scenario whose
   *  difference from the baseline is only visible in the numbers is a magic
   *  trick, not a comparison. */
  change: string;
  /** which of the modelled quantities this move can move, and which it cannot
   *  — stated here and CHECKED against the engines in tests/scenarios.spec.ts,
   *  because "changes comfort" written in a field nothing verifies is exactly
   *  the class of claim this repo keeps paying for */
  moves: ReadonlyArray<"glazing" | "comfort" | "cost">;
  apply: (document: BuilderDocument) => BuilderDocument;
}

const withSpec = (document: BuilderDocument, spec: HomeSpec): BuilderDocument => ({
  ...document,
  spec,
});

/* Annotated rather than inferred: the annotation is what gives every `apply`
   its parameter type, and without it each arrow would take an implicit `any`
   under `strict` and every move would silently stop being type-checked. */
const MOVES: ScenarioMove[] = [
  {
    id: "as-designed",
    label: "As designed",
    change:
      "The design on screen, untouched. This column is the baseline the other one is measured against, and its hash is the hash of your project.",
    moves: [],
    apply: (document) => document,
  },
  {
    id: "less-glass",
    label: "Less glass",
    change:
      `Every glazed opening at ${Math.round(LESS_GLASS_FACTOR * 100)}% of its modelled width and height, ` +
      "anchored where it already sits. Doors are left alone — the glazing ratio does not count them. " +
      "In a zone 7A winter glass is the weakest part of the envelope, so this is the cheapest-to-heat " +
      "version of the same house and the darkest.",
    moves: ["glazing", "cost"],
    apply: (document) => withSpec(document, scaleGlass(document.spec, LESS_GLASS_FACTOR)),
  },
  {
    id: "more-glass",
    label: "More glass",
    change:
      `Every glazed opening grown towards ${MORE_GLASS_FACTOR}× its modelled width and height, and stopped ` +
      "wherever the wall ends or another opening begins. Because of that clamp the achieved increase is " +
      "usually less than half again, which is why the ratio below is measured from the result rather than " +
      "predicted from the factor.",
    moves: ["glazing", "cost"],
    apply: (document) => withSpec(document, scaleGlass(document.spec, MORE_GLASS_FACTOR)),
  },
  {
    id: "bigger-footprint",
    label: "Bigger footprint",
    change:
      `Every volume ${Math.round(BIGGER_FOOTPRINT_FACTOR * 100) - 100}% larger in each plan dimension — about ` +
      `${Math.round((BIGGER_FOOTPRINT_FACTOR * BIGGER_FOOTPRINT_FACTOR - 1) * 100)}% more floor area — with the ` +
      "cluster scaled about the site origin so the masses keep their spacing. The glass is not touched, so the " +
      "same windows now sit in more wall: this is the move that shows what floor area costs and what it does to " +
      "the glazing ratio's denominator.",
    moves: ["glazing", "comfort", "cost"],
    apply: (document) =>
      withSpec(document, scaleFootprint(document.spec, BIGGER_FOOTPRINT_FACTOR)),
  },
  {
    id: "ask-warmer",
    label: `Ask for ${ASK_WARMER_DELTA_C} °C warmer`,
    change:
      `Both stated indoor air temperatures — winter and summer — raised by ${ASK_WARMER_DELTA_C} °C. THIS DOES NOT ` +
      "CHANGE THE BUILDING. The comfort model's temperature is a number you state, not a temperature this home has " +
      "been shown to reach — so this column shows what asking for a warmer house does to the comfort index, and says " +
      "nothing whatever about whether the house can hold it. Both seasons move because the season control decides " +
      "which figures you are reading, and the two directions are not the same news: warmer in winter walks the index " +
      "towards neutral, warmer in summer walks it away. Nothing here calculates a heat loss.",
    moves: ["comfort"],
    apply: (document) => ({
      ...document,
      comfort: {
        ...document.comfort,
        conditions: {
          ...document.comfort.conditions,
          winterIndoorC: document.comfort.conditions.winterIndoorC + ASK_WARMER_DELTA_C,
          summerIndoorC: document.comfort.conditions.summerIndoorC + ASK_WARMER_DELTA_C,
        },
      },
    }),
  },
];

export const SCENARIO_MOVES: readonly ScenarioMove[] = Object.freeze(MOVES);

export const scenarioMove = (id: ScenarioMoveId): ScenarioMove => {
  const found = SCENARIO_MOVES.find((move) => move.id === id);
  if (!found) throw new Error(`Unknown scenario move ${JSON.stringify(id)}`);
  return found;
};

/** Apply a move and get a real document back. Never mutates its input. */
export const applyScenarioMove = (
  document: BuilderDocument,
  id: ScenarioMoveId,
): BuilderDocument => scenarioMove(id).apply(document);

/* ===========================================================================
   THE COST BASIS — the same for both columns, or the comparison is confounded
   =========================================================================== */

export interface ScenarioCostBasis {
  scenario: ProjectBudgetScenario;
  region: string;
  municipality: string;
  /** the owner's stated cap, when there is one; the only cost TARGET this
   *  product has. `null` means there is no cap and the cost row therefore
   *  carries no target rather than a made-up one. */
  budgetCapCad: number | null;
}

export const defaultScenarioCostBasis = (): ScenarioCostBasis => ({
  scenario: defaultProjectBudgetScenario(),
  region: "Alberta",
  municipality: "",
  budgetCapCad: null,
});

/* ===========================================================================
   THE FIGURES
   =========================================================================== */

/** The function that owns a figure. A closed union rather than a free string:
 *  a new source would have to be added here, which is the moment somebody has
 *  to justify a second engine. */
export type ScenarioFigureSource =
  | "comfortReport"
  | "modelledGlazingRatio"
  | "createProjectBudget";

export type ScenarioFigureId =
  | "floor-area"
  | "glazing-ratio"
  | "comfort-meeting"
  | "comfort-modelled"
  | "comfort-unmodelled"
  | "comfort-mean-deviation"
  | "cost-mid";

export interface ScenarioTargetReading {
  /** what the target IS, in the words it should be read in */
  label: string;
  value: number;
  formatted: string;
  /** is this scenario inside it? */
  met: boolean;
}

export interface ScenarioFigure {
  id: ScenarioFigureId;
  label: string;
  /** the engine's own number, unrounded */
  value: number;
  /** the same number as it reads on screen */
  formatted: string;
  /** the function that owns it — printed, so a reader can go and check */
  source: ScenarioFigureSource;
  /** what it measures, in a sentence */
  note: string;
  /** the limit it is measured against, or null when this codebase has none */
  target: ScenarioTargetReading | null;
}

/* ---------------------------------------------------------- formatting

   Local and deliberately not `toLocaleString`. These strings are read beside
   an exported budget and a quoted document, and a figure inside a quoted
   document must not drift with the reader's ICU data. Same rule, same reason,
   same shape as `comfort.ts` and `toPlan.ts`. */

const thousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const scenarioCad = (value: number): string =>
  `CA$${thousands(Math.round(value))}`;

export const scenarioPct = (ratio: number): string =>
  `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;

const sqft = (value: number): string => `${thousands(Math.round(value))} sq ft`;

const dev2 = (value: number): string => (Math.round(value * 100) / 100).toFixed(2);

const signed = (value: number, format: (n: number) => string): string =>
  value === 0 ? "no change" : `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;

/* ===========================================================================
   READING ONE SCENARIO
   =========================================================================== */

export interface ScenarioReading {
  move: ScenarioMove;
  /** a real builder document — openable, hashable, costable */
  document: BuilderDocument;
  /** `hashBuilderDocument` of it, the same hash a save or a share would carry.
   *  `null` only when the document did not validate, because there is no
   *  honest hash of a document this build refuses to serialise. */
  hash: `0x${string}` | null;
  /** did it survive `validateBuilderDocument`? A scenario that did not is
   *  reported as such rather than quietly priced. */
  valid: boolean;
  validationProblem: string | null;
  /** false when the modelled figures do not describe the design on screen */
  available: boolean;
  unavailableReason: string | null;
  season: Season;
  /** the assumed conditions every comfort figure was computed from, carried
   *  rather than implied — `comfort.ts`'s rule, not a new one */
  conditions: DesignConditions;
  figures: ScenarioFigure[];
  /** why the cost figures are missing, when they are */
  costProblem: string | null;
}

const GRAPH_REASON =
  "This project uses planar graph geometry. The comfort and glazing readings are " +
  "derived from the legacy spec, which became a frozen recovery copy at conversion — " +
  "so a scenario comparison built from it would describe a home that is no longer on " +
  "screen. Undo returns through the conversion, where these readings run again.";

const kpiFor = (report: ComfortReport, season: Season): ComfortKpi =>
  season === "winter" ? report.winter : report.summer;

const conditionsFor = (
  conditions: DesignConditions,
  season: Season,
): { tempC: number; rhPct: number } =>
  season === "winter"
    ? { tempC: conditions.winterIndoorC, rhPct: conditions.winterRhPct }
    : { tempC: conditions.summerIndoorC, rhPct: conditions.summerRhPct };

/**
 * One scenario, read by the engines that own its figures.
 *
 * `comfortReport` runs a full deterministic plan solve, and `createProjectBudget`
 * builds a bill of materials, so this is not free. Call it twice per comparison
 * and memoise on the document — `ScenarioCompare.tsx` does exactly that.
 */
export function readScenario(
  base: BuilderDocument,
  id: ScenarioMoveId,
  options: { season: Season; costBasis: ScenarioCostBasis },
): ScenarioReading {
  const move = scenarioMove(id);
  const document = move.apply(base);
  const checked = validateBuilderDocument(document);
  const conditions = document.comfort.conditions;

  const shell: Omit<ScenarioReading, "figures" | "available" | "unavailableReason" | "costProblem"> = {
    move,
    document,
    hash: checked.ok ? hashBuilderDocument(checked.document) : null,
    valid: checked.ok,
    validationProblem: checked.ok ? null : checked.problem,
    season: options.season,
    conditions,
  };

  if (!checked.ok) {
    return {
      ...shell,
      available: false,
      unavailableReason: `This scenario did not survive validateBuilderDocument: ${checked.problem}`,
      figures: [],
      costProblem: null,
    };
  }

  if (!parcelCheckApplies(document)) {
    return {
      ...shell,
      available: false,
      unavailableReason: GRAPH_REASON,
      figures: [],
      costProblem: null,
    };
  }

  const figures: ScenarioFigure[] = [];

  /* ---- the budget, first, because floor area is read off it ------------- */
  let budget: ProjectBudget | null = null;
  let costProblem: string | null = null;
  try {
    budget = createProjectBudget({
      document,
      scenario: options.costBasis.scenario,
      region: options.costBasis.region,
      municipality: options.costBasis.municipality,
      budgetCapCad: options.costBasis.budgetCapCad,
    });
  } catch (error) {
    costProblem = error instanceof Error ? error.message : String(error);
  }

  if (budget) {
    figures.push({
      id: "floor-area",
      label: "Floor area",
      value: budget.measures.areaSqFt,
      formatted: sqft(budget.measures.areaSqFt),
      source: "createProjectBudget",
      note: "Conditioned floor area, the measure the bill of materials is built from.",
      target: null,
    });
  }

  /* ---- glazing ---------------------------------------------------------- */
  const ratio = modelledGlazingRatio(document.spec);
  figures.push({
    id: "glazing-ratio",
    label: "Glazing",
    value: ratio,
    formatted: scenarioPct(ratio),
    source: "modelledGlazingRatio",
    note:
      "Your glass over modelled wall area, compared with the NBC 9.36 prescriptive ceiling. " +
      "A comparison, not a code check.",
    target: {
      label: "NBC 9.36 prescriptive ceiling",
      value: FDWR_MAX,
      formatted: scenarioPct(FDWR_MAX),
      met: ratio <= FDWR_MAX,
    },
  });

  /* ---- comfort ---------------------------------------------------------- */
  const report = comfortReport(document.spec, document.comfort);
  const kpi = kpiFor(report, options.season);
  const stated = conditionsFor(conditions, options.season);
  const basis =
    `Under an assumed ${(Math.round(stated.tempC * 10) / 10).toFixed(1)} °C and ` +
    `${Math.round(stated.rhPct)} %RH, which are values you stated and not values this home has ` +
    "been shown to reach.";

  figures.push({
    id: "comfort-meeting",
    label: "Rooms meeting their target",
    value: kpi.roomsMeeting,
    formatted: `${kpi.roomsMeeting} of ${kpi.roomsModelled}`,
    source: "comfortReport",
    note: `${basis} Temperature band, humidity band and the sPMV index, all three.`,
    target: {
      label: "every modelled room",
      value: kpi.roomsModelled,
      formatted: `${kpi.roomsModelled}`,
      met: kpi.roomsModelled > 0 && kpi.roomsMeeting === kpi.roomsModelled,
    },
  });
  figures.push({
    id: "comfort-modelled",
    label: "Rooms modelled",
    value: kpi.roomsModelled,
    formatted: `${kpi.roomsModelled}`,
    source: "comfortReport",
    note: "Rooms the simplified-PMV coefficients apply to.",
    target: null,
  });
  figures.push({
    id: "comfort-unmodelled",
    label: "Rooms UNMODELLED",
    value: kpi.roomsUnmodelled,
    formatted: `${kpi.roomsUnmodelled}`,
    source: "comfortReport",
    note:
      "Sleeping rooms. A resting, duvet-covered clothing case needs its own coefficient set and " +
      "none could be verified for this build, so those rooms are unmodelled rather than guessed.",
    target: null,
  });
  figures.push({
    id: "comfort-mean-deviation",
    label: "Mean |sPMV|",
    value: kpi.meanAbsDeviation,
    formatted: dev2(kpi.meanAbsDeviation),
    source: "comfortReport",
    note: `${basis} Zero is the index's own neutral; the band this tool calls acceptable is 0.5.`,
    target: null,
  });

  /* ---- cost ------------------------------------------------------------- */
  if (budget) {
    const cap = options.costBasis.budgetCapCad;
    figures.push({
      id: "cost-mid",
      label: "Working midpoint",
      value: budget.total.mid,
      formatted: scenarioCad(budget.total.mid),
      source: "createProjectBudget",
      note:
        `Range ${scenarioCad(budget.total.low)} to ${scenarioCad(budget.total.high)}, including the ` +
        `${budget.scenario.contingencyPct}% contingency. A planning range, not a quote.`,
      target:
        cap === null
          ? null
          : {
              label: "your stated budget cap",
              value: cap,
              formatted: scenarioCad(cap),
              met: budget.total.mid <= cap,
            },
    });
  }

  return {
    ...shell,
    available: true,
    unavailableReason: null,
    figures,
    costProblem,
  };
}

/* ===========================================================================
   WHAT IS NOT MODELLED — rows, not a footnote
   =========================================================================== */

export interface NotModelledEntry {
  id: string;
  /** the quantity a reader came looking for */
  label: string;
  /** why this codebase cannot answer it */
  why: string;
  /** what an honest answer would need, so the absence reads as a boundary
   *  rather than as an oversight */
  needs: string;
}

/**
 * The four quantities a scenario comparison is expected to carry and this
 * build does not have.
 *
 * Each sentence is checkable against the repository rather than asserted:
 * there is no weather file, no sky model, no illuminance calculation and no
 * heat-loss calculation in this codebase. `lib/design/parcel.ts` already says
 * "Aura has not modelled the kWh either way" about orientation, and
 * `components/builder/sun.ts` says in its own header that it moves a light and
 * is not a solar-gain calculation. This list is those refusals collected in
 * one place so a comparison cannot imply what they deny.
 */
export const NOT_MODELLED: readonly NotModelledEntry[] = Object.freeze([
  {
    id: "daylight-autonomy",
    label: "Daylight autonomy",
    why:
      "Nothing in Aura computes an illuminance. Every room carries a minimum-lux TARGET you can " +
      "state and edit, and it is written into the IFC export — but no function in this build ever " +
      "reads it back to check it. There is no sky model, no window transmittance and no hourly run.",
    needs:
      "A climate file for the site, glazing transmittance per opening, and an annual hourly " +
      "daylight simulation — sDA and ASE, the two figures a daylight claim is normally made in.",
  },
  {
    id: "energy-use-intensity",
    label: "Energy use intensity",
    why:
      "There is no energy model here. Nothing sums an annual load, and the kWh figures elsewhere in " +
      "the product are appliance nameplates and battery capacities, not a building's consumption.",
    needs:
      "Assembly R-values, an airtightness figure measured on the built house, a mechanical system " +
      "definition, occupancy schedules and a weather file.",
  },
  {
    id: "heating-load",
    label: "Heating and cooling load",
    why:
      "No heat loss is calculated anywhere in this repository. The comfort panel says so in its own " +
      "header, and it is the reason its air temperature is a value you enter rather than one it " +
      "predicts. Sizing a heating system from anything on this page would be a mistake.",
    needs:
      "A room-by-room heat-loss and heat-gain calculation — CSA F280 in Canada — done by a designer " +
      "against the built assemblies and the local design temperatures.",
  },
  {
    id: "solar-gain",
    label: "Solar heat gain and shading",
    why:
      "The sun in the 3D view is real solar geometry for latitude 53.5° and nothing more: it moves a " +
      "light so the passive-solar argument can be seen. It calculates no gain, and the overhang is " +
      "drawn rather than evaluated.",
    needs:
      "Glazing SHGC per opening, a shading study against the real overhang and neighbouring terrain, " +
      "and the same hourly weather file the two rows above want.",
  },
] as const);

/* ===========================================================================
   THE COMPARISON
   =========================================================================== */

export interface ScenarioRow {
  id: ScenarioFigureId;
  label: string;
  note: string;
  source: ScenarioFigureSource;
  a: ScenarioFigure;
  b: ScenarioFigure;
  /** b − a, in the figure's own units */
  delta: number;
  /** the same delta as it reads on screen, or "no change" */
  deltaFormatted: string;
  /** did this quantity move at all between the two scenarios? */
  changed: boolean;
}

export interface ScenarioComparison {
  season: Season;
  a: ScenarioReading;
  b: ScenarioReading;
  /** rows exist only for figures BOTH scenarios produced — a half-populated
   *  row would print a delta against a number that is not there */
  rows: ScenarioRow[];
  /** true when the two scenarios are the same document, by hash */
  identical: boolean;
  /** false when either side could not be read; `reason` says which and why */
  available: boolean;
  reason: string | null;
  notModelled: readonly NotModelledEntry[];
  disclaimer: string;
}

/** The sentence that must accompany any scenario comparison this repo emits. */
export const SCENARIO_DISCLAIMER =
  "A comparison of what Aura MODELS, and nothing else. Comfort is evaluated against conditions you " +
  "stated, not conditions this home has been shown to reach. The glazing ratio is measured against " +
  "the NBC 9.36 prescriptive ceiling as a comparison, not as a code check. The cost bands are a " +
  "planning range, not a quote. Daylight autonomy, energy use intensity, heating load and solar gain " +
  /* "listed below" was wrong and the screenshot caught it: this sentence is
     rendered LAST, under the block it was pointing at. A positional claim in
     a string that any caller may place anywhere is unverifiable by
     construction, so it is gone rather than corrected to "above". */
  "are NOT MODELLED anywhere in this build — each is named on this panel rather than estimated, " +
  "because an estimate with no physics behind it is the most convincing wrong answer this tool " +
  "could give.";

const formatterFor = (id: ScenarioFigureId): ((n: number) => string) => {
  switch (id) {
    case "floor-area":
      return sqft;
    case "glazing-ratio":
      return scenarioPct;
    case "cost-mid":
      return scenarioCad;
    case "comfort-mean-deviation":
      return dev2;
    default:
      return (n: number) => `${Math.round(n)}`;
  }
};

/** Two scenarios read by the same engines, under the same season and the same
 *  cost basis, with the delta between them. Pure; writes nothing. */
export function compareScenarios(
  base: BuilderDocument,
  options: {
    a: ScenarioMoveId;
    b: ScenarioMoveId;
    season: Season;
    costBasis?: ScenarioCostBasis;
  },
): ScenarioComparison {
  const costBasis = options.costBasis ?? defaultScenarioCostBasis();
  const a = readScenario(base, options.a, { season: options.season, costBasis });
  const b = readScenario(base, options.b, { season: options.season, costBasis });

  const rows: ScenarioRow[] = [];
  if (a.available && b.available) {
    for (const figure of a.figures) {
      const other = b.figures.find((candidate) => candidate.id === figure.id);
      if (!other) continue;
      const delta = other.value - figure.value;
      rows.push({
        id: figure.id,
        label: figure.label,
        note: figure.note,
        source: figure.source,
        a: figure,
        b: other,
        delta,
        deltaFormatted: signed(delta, formatterFor(figure.id)),
        /* An exact comparison, not a tolerance. Every quantity here is either
           a count or a value derived from stepped feet, so "did it move" has
           an exact answer and a tolerance would only hide a real move. */
        changed: delta !== 0,
      });
    }
  }

  const reason = a.available
    ? b.available
      ? null
      : b.unavailableReason
    : a.unavailableReason;

  return {
    season: options.season,
    a,
    b,
    rows,
    identical: a.hash !== null && a.hash === b.hash,
    available: a.available && b.available,
    reason,
    notModelled: NOT_MODELLED,
    disclaimer: SCENARIO_DISCLAIMER,
  };
}

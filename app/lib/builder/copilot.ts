/* ===========================================================================
   THE CO-PILOT — a bounded advisor over the deterministic brain.

   WHAT THIS IS, IN ONE SENTENCE. It reads the builder document and the numbers
   this repository already computes, and it hands back a short list of changes
   worth considering — each one carrying the figures it read, the function that
   owns each figure, what the change costs you, and a PREPARED ACTION that is
   not applied.

   WHAT THIS IS NOT, AND THE LIST IS THE POINT
   -------------------------------------------
   There is NO MODEL HERE. No inference, no sampling, no prompt, no key, no
   network call, no clock and no randomness. This product ships as a static
   export to GitHub Pages: there is no server to hold a key and no request a
   page could make that would not be a lie about where the answer came from.
   A "co-pilot" that quietly needed one would be dishonest in the most
   trust-sensitive surface the product has, which is the one that tells you to
   change your house.

   So every sentence below is assembled from arithmetic that already exists,
   and `readCoPilot` cannot say anything the engines cannot back:

     · `modelledGlazingRatio`   — lib/builder/toPlan.ts
     · `FDWR_MAX`               — lib/design/materials.ts
     · `checkSpecAgainstParcel` — lib/builder/toPlan.ts, over `analyseParcel`
     · `createProjectBudget`    — lib/builder/projectBudget.ts
     · `checkOpening`           — components/builder/openingEdit.ts

   Nothing in this file recomputes any of those. `evidence[].source` names the
   owning function on the card so a reader can go and check, and the union of
   sources is CLOSED — a new one has to be added here, which is the moment
   somebody has to justify a second engine.

   IT PROPOSES ONLY EDITS THIS REPOSITORY CAN ALREADY MAKE
   -------------------------------------------------------
   A prepared action is a request to one of three EXISTING edit functions, and
   there is no fourth path and no new edit primitive in this module:

     · `applyPhrase`      — components/builder/phrases.ts, the Ctrl-K grammar.
                            A footprint suggestion is literally two phrases a
                            person could have typed, applied through the same
                            parser, with the same LIMITS clamps and the same
                            "width → 80 ft (limit)" admission when a value is
                            clamped.
     · `applyOpeningEdit` — components/builder/openingEdit.ts, the one function
                            every window and door move goes through, from a 3D
                            grip, a plan handle or a typed field.
     · `applyScenarioMove`— lib/builder/scenarios.ts, the Impact panel's own
                            moves, already pinned by tests/scenarios.spec.ts.

   That bound is a feature and it is stated on the cards: the co-pilot cannot
   propose anything those three cannot express. Importing two of them from
   `components/` follows `lib/builder/walls.ts`, which has imported
   `components/builder/edits.ts` since it shipped — the edit machinery lives
   there and a second copy of it here would be the divergence this repo has
   already paid for three times.

   MEASURED, NEVER PREDICTED. Every `outcome` sentence is read off the
   CANDIDATE document by the same engine that raised the finding — the glazing
   ratio after the move, the fit check after the resize, the legality check
   after the refit. `scenarios.ts` keeps this rule for `more-glass` because a
   clamp makes the achieved figure smaller than the factor; the same reasoning
   applies to every card here.

   NOTHING IS APPLIED. `readCoPilot` returns no `HomeSpec` anywhere in its
   result, and neither does `previewPreparedAction`. The ONLY function in this
   module that can turn a suggestion into a spec is `applyPreparedAction`, and
   it refuses any `Confirmation` that does not name the exact suggestion and
   quote the exact words that were on the control. `tests/copilot.spec.ts`
   pins both halves: that no other export leaks a spec, and that the refusal
   fires.

   PURE AND TOTAL. No React, no DOM, no storage, no network, no clock, no
   randomness, no locale-dependent formatting. The same inputs always produce
   a deeply equal result and the inputs are never mutated.
   =========================================================================== */

import { FDWR_MAX } from "@/lib/design/materials";
import { envelopeFor } from "@/lib/design/layout";
import { LIMITS, clamp, snap } from "@/components/builder/edits";
import {
  applyOpeningEdit,
  checkOpening,
  openingBox,
  openingRunFt,
  wallHeadFt,
  type OpeningBox,
} from "@/components/builder/openingEdit";
import { applyPhrase } from "@/components/builder/phrases";

import type { BuilderDocument } from "./document";
import {
  NOT_MODELLED,
  applyScenarioMove,
  scenarioCad,
  scenarioPct,
  type NotModelledEntry,
  type ScenarioMoveId,
} from "./scenarios";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudget,
  type ProjectBudgetScenario,
} from "./projectBudget";
import { parcelCheckApplies } from "./readiness";
import { glazedAreaSqFt, totalFloorAreaSqFt, type HomeSpec, type Volume } from "./spec";
import {
  checkSpecAgainstParcel,
  modelledGlazingRatio,
  modelledWallAreaSqFt,
  storeysOf,
  type SpecParcelCheck,
} from "./toPlan";

/** What this advisor is, in one machine-readable token. Printed by the sidebar
 *  and asserted by the spec, so the word can never quietly become "ai". */
export const COPILOT_ENGINE = "deterministic-advisor" as const;

/* ===========================================================================
   EVIDENCE
   =========================================================================== */

/**
 * The function that owns a figure a card prints.
 *
 * A CLOSED union rather than a free string, for the same reason
 * `ScenarioFigureSource` is one: a new source cannot be typed into a card in
 * passing. It has to be added to this list, and `tests/copilot.spec.ts`
 * asserts that every member names a function this module actually imports —
 * so a source line can never credit an engine the co-pilot never called.
 */
export type CoPilotSource =
  | "modelledGlazingRatio · lib/builder/toPlan.ts"
  | "modelledWallAreaSqFt · lib/builder/toPlan.ts"
  | "glazedAreaSqFt · lib/builder/spec.ts"
  | "FDWR_MAX · lib/design/materials.ts"
  | "checkSpecAgainstParcel · lib/builder/toPlan.ts"
  | "totalFloorAreaSqFt · lib/builder/spec.ts"
  | "envelopeFor · lib/design/layout.ts"
  | "createProjectBudget · lib/builder/projectBudget.ts"
  | "checkOpening · components/builder/openingEdit.ts"
  | "openingRunFt · components/builder/openingEdit.ts"
  | "wallHeadFt · components/builder/openingEdit.ts";

export interface CoPilotEvidence {
  /** What was measured, in the words it should be read in. */
  label: string;
  /** The engine's own number, unrounded — so a caller can compare rather than
   *  parse the string beside it. */
  value: number;
  /** The same number as it reads on the card. */
  formatted: string;
  source: CoPilotSource;
}

/* ===========================================================================
   THE PREPARED ACTION — a request, unapplied
   =========================================================================== */

/**
 * Which existing edit function would do the work, and with what.
 *
 * INERT DATA. There is no function in this union and no closure: a prepared
 * action can be held, printed, compared and thrown away, and holding one has
 * never changed a document. `applyPreparedAction` is what turns one into a
 * spec, and only with a matching `Confirmation`.
 */
export type PreparedActionPayload =
  /** one or more Ctrl-K phrases, folded in order into ONE new spec */
  | { via: "phrases"; volumeId: string; phrases: readonly string[] }
  /** an Impact-panel move, applied to the whole document */
  | { via: "scenario-move"; move: ScenarioMoveId }
  /** an opening re-asked for its own box, so the editor's clamps pull it legal */
  | { via: "refit-opening"; volumeId: string; openingId: string };

export interface PreparedAction {
  /** The suggestion this belongs to. A confirmation must name it. */
  suggestionId: string;
  /**
   * The exact words on the control that applies it.
   *
   * A confirmation must quote them back, which is what makes a confirmation
   * impossible to synthesise for a card nobody was shown: the text is
   * generated from the finding, so it differs per suggestion and per document.
   */
  confirmText: string;
  /** The history label the editor files this under — one undo step. */
  label: string;
  payload: PreparedActionPayload;
  /** The module and function that does the work, printed on the card. */
  routedThrough: string;
}

/**
 * A person's decision, as data.
 *
 * Both fields are required and both are checked. The id alone would let a
 * caller confirm any card by looping over the list; quoting the confirm text
 * as well means the confirmation carries what was actually on screen.
 */
export interface Confirmation {
  confirmedId: string;
  confirmedText: string;
}

export type ApplyResult =
  | {
      ok: true;
      /** The new spec — one whole edit, ready for ONE history entry. The SPEC
       *  crosses back rather than a document, because `BuilderApp`'s own edit
       *  path already reconciles partitions, finishes, fixtures and comfort
       *  targets inside one commit. Same convention as `VariationStrip`. */
      spec: HomeSpec;
      label: string;
      /** What actually happened, clamps included, in sentences. */
      announcement: string;
    }
  | { ok: false; problem: string };

/* ===========================================================================
   THE SUGGESTION
   =========================================================================== */

export type CoPilotSuggestionKind =
  | "glazing-over-prescriptive"
  | "footprint-over-buildable-envelope"
  | "budget-over-stated-cap"
  | "opening-off-its-wall";

export interface CoPilotSuggestion {
  /** Stable and derived only from the finding — never a counter, so the same
   *  document always produces the same ids and a dismissal survives a
   *  re-render. */
  id: string;
  kind: CoPilotSuggestionKind;
  /** What it proposes, in plain words. */
  proposal: string;
  /** Why, said from the numbers rather than from a feeling. */
  because: string;
  evidence: CoPilotEvidence[];
  /**
   * What gets WORSE. Never empty, and a spec asserts that: a change with no
   * cost is a change nobody needed an advisor for, and a card that lists only
   * upside is an advertisement.
   */
  tradeOffs: string[];
  /**
   * The reasons a person might want this that Aura DOES NOT MODEL, quoted
   * from `scenarios.ts` rather than restated here. Empty is a real answer —
   * a budget card's reason is cost, and cost IS modelled, as a range.
   */
  notModelled: NotModelledEntry[];
  /** Read off the candidate by the engine that raised the finding. */
  outcome: string;
  /** Unapplied. */
  action: PreparedAction;
}

/** Something considered and NOT offered, with the reason in full. A sidebar
 *  that shows two cards when it looked at five lies by omission — the same
 *  rule `variations.ts` keeps with its `refusals`. */
export interface CoPilotRefusal {
  id: string;
  topic: string;
  reason: string;
}

export interface CoPilotReport {
  engine: typeof COPILOT_ENGINE;
  suggestions: CoPilotSuggestion[];
  refusals: CoPilotRefusal[];
  /** Why nothing could be read at all, when that is the case. */
  unavailable: string | null;
  disclaimer: string;
}

export const COPILOT_DISCLAIMER =
  "Every card is arithmetic over the design on screen, done by the engines named on it. Nothing " +
  "here is a model's opinion, nothing here reaches a network, and nothing here is applied until " +
  "you confirm it. The glazing figure is measured against the NBC 9.36 prescriptive reference as " +
  "a comparison, not a code check. The cost bands are a planning range, not a quote. Daylight, " +
  "energy use, heating load and solar gain are not modelled anywhere in this build, so where one " +
  "of them is the real reason to make a change the card says so instead of implying an answer.";

/* ===========================================================================
   FORMATTING — presentation, never a second calculation
   =========================================================================== */

/* `scenarioPct` and `scenarioCad` are imported rather than rewritten: they are
   already the strings the Impact panel prints, and two roundings of one number
   is the smallest possible way to look wrong. Area has no exported formatter
   anywhere in the repo — `scenarios.ts` and `guidance.ts` each keep a private
   one — so this is a third copy of the same hand-grouping rule, kept local for
   the same reason both of those are: `toLocaleString` depends on the reader's
   ICU data, and these strings are read beside a quoted document. */
const grouped = (value: number): string =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const sqFt = (value: number): string => `${grouped(value)} sq ft`;

const ft = (value: number): string => `${Math.round(value * 10) / 10} ft`;

/* Float noise only — the same convention `toPlan.ts` and `guidance.ts` keep
   beside their own FDWR comparisons. It is not a tolerance on the reference. */
const RATIO_EPS = 1e-9;

/* ===========================================================================
   NOT MODELLED — quoted, never restated
   =========================================================================== */

type NotModelledId = "daylight-autonomy" | "energy-use-intensity" | "heating-load" | "solar-gain";

/** The entries by id, from `scenarios.ts`. Throws on an unknown id the same
 *  way `scenarioMove` does, because an advisor citing a limitation this repo
 *  does not actually record is the exact failure the list exists to prevent. */
function notModelled(...ids: readonly NotModelledId[]): NotModelledEntry[] {
  return ids.map((id) => {
    const found = NOT_MODELLED.find((entry) => entry.id === id);
    if (!found) throw new Error(`No NOT_MODELLED entry with id ${JSON.stringify(id)}`);
    return found;
  });
}

/* ===========================================================================
   BUILDING A CANDIDATE — internal, and it never leaves this module
   =========================================================================== */

interface Candidate {
  /** null when the payload produced no change, or could not be applied */
  spec: HomeSpec | null;
  /** what actually happened, clamps and refusals included */
  say: string[];
  /** why nothing came back, when nothing did */
  problem: string | null;
}

/**
 * Run a prepared action's payload through the edit function that owns it.
 *
 * PRIVATE ON PURPOSE. This is the only place in the module that holds a
 * candidate `HomeSpec`, and the only two callers are `readCoPilot` — which
 * reads figures off it and throws it away — and `applyPreparedAction`, which
 * has already checked a confirmation. Exporting it would put a second door
 * beside the confirmed one.
 */
function candidateFor(document: BuilderDocument, action: PreparedAction): Candidate {
  const payload = action.payload;

  if (payload.via === "phrases") {
    let spec = document.spec;
    const say: string[] = [];
    for (const phrase of payload.phrases) {
      const edit = applyPhrase(spec, payload.volumeId, phrase);
      /* `applyPhrase` returns null both for a phrase it cannot parse and for
         one that would change nothing. Neither is an error here: a leg that
         lands nowhere is simply not reported, and if EVERY leg lands nowhere
         the caller sees a null spec and refuses rather than offering a button
         that does nothing. */
      if (edit === null) continue;
      spec = edit.spec;
      say.push(edit.say);
    }
    if (spec === document.spec) {
      return {
        spec: null,
        say,
        problem: `None of these phrases changes this home: ${payload.phrases.join(" · ")}.`,
      };
    }
    return { spec, say, problem: null };
  }

  if (payload.via === "scenario-move") {
    const moved = applyScenarioMove(document, payload.move);
    if (moved.spec === document.spec) {
      return {
        spec: null,
        say: [],
        problem: `The ${payload.move} move leaves this home exactly as it is.`,
      };
    }
    return { spec: moved.spec, say: [], problem: null };
  }

  const refit = applyOpeningEdit(
    document.spec,
    payload.volumeId,
    payload.openingId,
    /* Its OWN box, re-asked. `applyOpeningEdit` clamps every ask to the wall
       run, the wall head and its neighbours, so asking for exactly where the
       opening already claims to be is what pulls an illegal one back inside
       the wall. Nothing is invented: the ask is the opening's own numbers. */
    boxOf(document.spec, payload.volumeId, payload.openingId),
  );
  if (!refit.changed) {
    return {
      spec: null,
      say: refit.refusals,
      problem: `Re-asking for this opening's own box moves nothing, so there is nothing to apply.`,
    };
  }
  return { spec: refit.spec, say: refit.refusals, problem: null };
}

/** The opening's own box, or a zero box when it has gone. `applyOpeningEdit`
 *  reports the missing opening itself, in its own words, so this does not. */
function boxOf(spec: HomeSpec, volumeId: string, openingId: string): OpeningBox {
  const volume = spec.volumes.find((candidate) => candidate.id === volumeId);
  const opening = volume?.openings.find((candidate) => candidate.id === openingId);
  return opening
    ? openingBox(opening)
    : { offsetFt: 0, widthFt: 0, sillFt: 0, heightFt: 0 };
}

/* ===========================================================================
   PREVIEW — what a card can show, and deliberately not a spec
   =========================================================================== */

export interface PreparedActionPreview {
  /** false when the action would leave the design exactly as it is */
  changes: boolean;
  /** what would actually happen, clamps and refusals included */
  say: string[];
  problem: string | null;
}

/**
 * What a prepared action would do, WITHOUT the document it would produce.
 *
 * The absence of a spec here is the whole design. If this returned one, a
 * caller could preview an action and hand the result straight to the editor,
 * and the confirmation would be decoration. `tests/copilot.spec.ts` asserts
 * that nothing this module returns outside `applyPreparedAction` carries a
 * spec, by serialising it and looking for the key.
 */
export function previewPreparedAction(
  document: BuilderDocument,
  action: PreparedAction,
): PreparedActionPreview {
  const candidate = candidateFor(document, action);
  return {
    changes: candidate.spec !== null,
    say: candidate.say,
    problem: candidate.problem,
  };
}

/* ===========================================================================
   APPLY — the one door, and it is locked
   =========================================================================== */

/**
 * Turn a prepared action into a spec, given a person's confirmation.
 *
 * THE ONLY FUNCTION IN THIS MODULE THAT PRODUCES A `HomeSpec`. It refuses:
 *
 *   · a confirmation naming a different suggestion, and
 *   · a confirmation quoting different words than the control carried.
 *
 * Both refusals return `ok: false` with the mismatch named, rather than
 * throwing — a co-pilot that could take the editor down by being wired wrong
 * would be worse than one that says what happened.
 *
 * This is a GUARD, not a security boundary: any caller can construct a
 * matching `Confirmation`. What it buys is that no code path applies a
 * suggestion by accident — an auto-apply, a loop over the list, a stale
 * closure, a "safe ones only" shortcut — because each of those would have to
 * write out the confirm text of a card a person never saw, which is a thing a
 * reviewer can see in a diff. The interface half of the same rule is in
 * `CoPilot.tsx`, where the control that calls this exists only inside the
 * armed card, and `tests/copilot.spec.ts` pins both.
 */
export function applyPreparedAction(
  document: BuilderDocument,
  action: PreparedAction,
  confirmation: Confirmation,
): ApplyResult {
  if (confirmation.confirmedId !== action.suggestionId) {
    return {
      ok: false,
      problem:
        `This confirmation names ${JSON.stringify(confirmation.confirmedId)} and the prepared ` +
        `action belongs to ${JSON.stringify(action.suggestionId)}. Nothing was applied.`,
    };
  }
  if (confirmation.confirmedText !== action.confirmText) {
    return {
      ok: false,
      problem:
        `This confirmation quotes ${JSON.stringify(confirmation.confirmedText)} and the control ` +
        `carried ${JSON.stringify(action.confirmText)}. Nothing was applied.`,
    };
  }

  const candidate = candidateFor(document, action);
  if (candidate.spec === null) {
    return {
      ok: false,
      problem: candidate.problem ?? "This suggestion no longer changes the design on screen.",
    };
  }

  return {
    ok: true,
    spec: candidate.spec,
    label: action.label,
    announcement:
      candidate.say.length > 0
        ? `${action.confirmText} — ${candidate.say.join(" · ")}`
        : `${action.confirmText} — applied in one step, and Ctrl+Z takes it back.`,
  };
}

/* ===========================================================================
   READING THE DESIGN
   =========================================================================== */

export interface CoPilotBasis {
  scenario: ProjectBudgetScenario;
  region: string;
  municipality: string;
  /** The owner's stated cap, when there is one. `null` means there is no cap
   *  and the budget card therefore does not exist, rather than being measured
   *  against a made-up ceiling. */
  budgetCapCad: number | null;
}

export const defaultCoPilotBasis = (): CoPilotBasis => ({
  scenario: defaultProjectBudgetScenario(),
  region: "Alberta",
  municipality: "",
  budgetCapCad: null,
});

export interface CoPilotInput {
  document: BuilderDocument;
  /** The builder's own `checkSpecAgainstParcel` result — the same value the
   *  live read-out is handed. `null` when no parcel is attached. */
  parcelCheck: SpecParcelCheck | null;
  basis?: CoPilotBasis;
}

const GRAPH_REFUSAL =
  "This project uses planar graph geometry. Every reading the co-pilot has is derived from " +
  "`document.spec`, which became a frozen recovery copy at conversion — so advice built from it " +
  "would be about a home that is no longer on screen. Undo returns through the conversion, where " +
  "these readings run again.";

/** Deterministic change detector over two specs. Not a canonical hash: both
 *  sides are built by spreading the same shapes, so key order is stable, and
 *  `hashBuilderDocument` would need a whole valid document to answer a
 *  question about one field. */
const sameSpec = (a: HomeSpec, b: HomeSpec): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** The one volume this build can name as the one to resize, or null. A
 *  multi-volume home has no such answer and the refusal says so rather than
 *  picking the biggest and calling it obvious. */
const soleVolume = (spec: HomeSpec): Volume | null =>
  spec.volumes.length === 1 ? spec.volumes[0] : null;

/** Feet on the editor's own step and inside its own limits, so a phrase this
 *  module writes can never be the thing that trips the clamp admission. */
const boundedFt = (value: number, limit: { min: number; max: number; step: number }): number =>
  snap(clamp(value, limit.min, limit.max), limit.step);

/**
 * Read the design and return what is worth considering.
 *
 * Deterministic and pure: same document, same basis, same cards in the same
 * order, forever. It writes nothing and mutates nothing.
 *
 * COST. `createProjectBudget` builds a bill of materials, and the budget card
 * walks a ladder of at most eight smaller homes to find the largest one that
 * lands inside a stated cap — so this is not free, and it only walks that
 * ladder when there IS a cap and the design is over it. `CoPilot.tsx` memoises
 * on the document and the basis, which is the same bargain `ScenarioCompare`
 * makes for its two readings.
 */
export function readCoPilot(input: CoPilotInput): CoPilotReport {
  const document = input.document;
  const basis = input.basis ?? defaultCoPilotBasis();
  const suggestions: CoPilotSuggestion[] = [];
  const refusals: CoPilotRefusal[] = [];

  if (!parcelCheckApplies(document)) {
    return {
      engine: COPILOT_ENGINE,
      suggestions: [],
      refusals: [],
      unavailable: GRAPH_REFUSAL,
      disclaimer: COPILOT_DISCLAIMER,
    };
  }

  const spec = document.spec;

  glazing(document, suggestions, refusals);
  footprint(document, input.parcelCheck, suggestions, refusals);
  budget(document, basis, suggestions, refusals);
  openings(document, suggestions, refusals);

  /* Clearance clashes are DELIBERATELY not a card. `resolveFixtures` finds
     them and the builder already prints every one under the model, so the
     finding is not being hidden — what is missing is an edit. Nothing in this
     build knows where else a wood stove should stand, and moving somebody's
     appliance to a place chosen by arithmetic that models neither the room
     nor the flue is not advice. Named here rather than silently skipped. */
  refusals.push({
    id: "clearance-clashes",
    topic: "Clearance clashes",
    reason:
      "Blocked clearances are reported under the model by `resolveFixtures`, and the co-pilot " +
      "proposes no fix for one. There is no edit in this build that resolves a clearance — " +
      "moving a wood stove to a spot chosen by arithmetic that models neither the room nor the " +
      "flue would be a guess wearing the clothes of advice. A WETT inspector signs that off on " +
      "the day.",
  });

  if (spec.volumes.length === 0) {
    refusals.push({
      id: "no-volumes",
      topic: "An empty model",
      reason:
        "This design has no volumes, so there is no glazing ratio, no footprint and no opening " +
        "to read. Every card the co-pilot can produce needs one.",
    });
  }

  return {
    engine: COPILOT_ENGINE,
    suggestions,
    refusals,
    unavailable: null,
    disclaimer: COPILOT_DISCLAIMER,
  };
}

/* ---------------------------------------------------------------- glazing */

function glazing(
  document: BuilderDocument,
  suggestions: CoPilotSuggestion[],
  refusals: CoPilotRefusal[],
): void {
  const spec = document.spec;
  const wallSqFt = modelledWallAreaSqFt(spec);
  if (wallSqFt <= 0) return;

  const ratio = modelledGlazingRatio(spec);
  if (ratio <= FDWR_MAX + RATIO_EPS) return;

  const action: PreparedAction = {
    suggestionId: "glazing-over-prescriptive",
    confirmText: `Shrink every glazed opening to bring ${scenarioPct(ratio)} down`,
    label: "co-pilot: less glass",
    payload: { via: "scenario-move", move: "less-glass" },
    routedThrough: "applyScenarioMove(\"less-glass\") · lib/builder/scenarios.ts",
  };

  const candidate = candidateFor(document, action);
  if (candidate.spec === null) {
    refusals.push({
      id: "glazing-over-prescriptive",
      topic: "Glazing over the prescriptive reference",
      reason:
        `Your glass is ${scenarioPct(ratio)} of this home's modelled wall area, over the ` +
        `${scenarioPct(FDWR_MAX)} NBC 9.36 prescriptive reference — but ` +
        `${candidate.problem ?? "the move changes nothing"}, so there is no card here rather ` +
        "than a button that would do nothing.",
    });
    return;
  }

  const after = modelledGlazingRatio(candidate.spec);
  const lands = after <= FDWR_MAX + RATIO_EPS;

  suggestions.push({
    id: "glazing-over-prescriptive",
    kind: "glazing-over-prescriptive",
    proposal:
      "Shrink every glazed opening towards 60% of its modelled width and height, anchored where " +
      "it already sits. Doors are left alone, because the glazing ratio does not count them.",
    because:
      `Your glass is ${scenarioPct(ratio)} of this home's modelled wall area, over the ` +
      `${scenarioPct(FDWR_MAX)} NBC 9.36 prescriptive fenestration reference. That is a ` +
      "comparison against your own walls, not a code check: a home over the reference is not " +
      "illegal, it is off the prescriptive path, and the compliance path it then needs is a " +
      "conversation with a designer.",
    evidence: [
      {
        label: "Glazing ratio now",
        value: ratio,
        formatted: scenarioPct(ratio),
        source: "modelledGlazingRatio · lib/builder/toPlan.ts",
      },
      {
        label: "NBC 9.36 prescriptive reference",
        value: FDWR_MAX,
        formatted: scenarioPct(FDWR_MAX),
        source: "FDWR_MAX · lib/design/materials.ts",
      },
      {
        label: "Glazed area",
        value: glazedAreaSqFt(spec),
        formatted: sqFt(glazedAreaSqFt(spec)),
        source: "glazedAreaSqFt · lib/builder/spec.ts",
      },
      {
        label: "Modelled wall area",
        value: wallSqFt,
        formatted: sqFt(wallSqFt),
        source: "modelledWallAreaSqFt · lib/builder/toPlan.ts",
      },
    ],
    tradeOffs: [
      "Less glass is a darker house. In a zone 7A winter glass is the weakest part of the " +
        "envelope, so this is the cheapest-to-heat version of the same home and the dimmest.",
      "It touches EVERY glazed opening, not the one you would have chosen. If the south glazing " +
        "wall is the point of the house, shrink a different window by hand instead.",
      "The modelled wall area it is measured against is deliberately rough — perimeter × wall " +
        "height × storeys, with no deduction where two volumes meet. It exists to put your glass " +
        "over a plausible denominator, not to be a survey.",
    ],
    notModelled: notModelled("daylight-autonomy", "solar-gain"),
    outcome: lands
      ? `Measured on the result: ${scenarioPct(after)}, at or under the ` +
        `${scenarioPct(FDWR_MAX)} reference.`
      : `Measured on the result: ${scenarioPct(after)} — still over the ` +
        `${scenarioPct(FDWR_MAX)} reference. This is a step, not a fix, because each opening is ` +
        "clamped to its own wall and cannot shrink below a quarter foot.",
    action,
  });
}

/* -------------------------------------------------------------- footprint */

function footprint(
  document: BuilderDocument,
  parcelCheck: SpecParcelCheck | null,
  suggestions: CoPilotSuggestion[],
  refusals: CoPilotRefusal[],
): void {
  if (parcelCheck === null) {
    refusals.push({
      id: "footprint-over-buildable-envelope",
      topic: "Fitting the land",
      reason:
        "No parcel is attached, so `checkSpecAgainstParcel` has nothing to run against and the " +
        "co-pilot has no fit to advise on. Describe the lot in the Site step.",
    });
    return;
  }

  const report = parcelCheck.report;
  if (report === null || report.fits) return;

  const spec = document.spec;
  const volume = soleVolume(spec);
  if (volume === null) {
    refusals.push({
      id: "footprint-over-buildable-envelope",
      topic: "Fitting the land",
      reason:
        `This home does not fit its buildable envelope — ${ft(report.buildableWidthFt)} × ` +
        `${ft(report.buildableDepthFt)} against a ${sqFt(report.footprintSqFt)} footprint — but ` +
        `it has ${spec.volumes.length} volumes, and the fit check measures the plan engine's ` +
        "solved rectangle for the whole floor area rather than any one mass. There is no volume " +
        "this build can name as the one to shrink, and picking the biggest would be a guess " +
        "about your design rather than a reading of it.",
    });
    return;
  }

  if (report.suggestedTotalSqFt === null) {
    refusals.push({
      id: "footprint-over-buildable-envelope",
      topic: "Fitting the land",
      reason:
        `This home does not fit its buildable envelope — ${ft(report.buildableWidthFt)} × ` +
        `${ft(report.buildableDepthFt)} against a ${sqFt(report.footprintSqFt)} footprint — and ` +
        "`analyseParcel` found no floor area in the design service's own range that solves small " +
        "enough for it. The setbacks or the lot are the conversation, not the house.",
    });
    return;
  }

  const storeys = storeysOf(spec);
  const [widthFt, depthFt] = envelopeFor(report.suggestedTotalSqFt, storeys);
  const wantWidth = boundedFt(widthFt, LIMITS.widthFt);
  const wantDepth = boundedFt(depthFt, LIMITS.depthFt);

  const action: PreparedAction = {
    suggestionId: "footprint-over-buildable-envelope",
    confirmText: `Resize ${volume.name} to ${ft(wantWidth)} × ${ft(wantDepth)}`,
    label: "co-pilot: fit the parcel",
    payload: {
      via: "phrases",
      volumeId: volume.id,
      phrases: [`width ${wantWidth}`, `depth ${wantDepth}`],
    },
    routedThrough: "applyPhrase · components/builder/phrases.ts",
  };

  const candidate = candidateFor(document, action);
  if (candidate.spec === null) {
    refusals.push({
      id: "footprint-over-buildable-envelope",
      topic: "Fitting the land",
      reason:
        `This home does not fit its buildable envelope, and the size that would fit — ` +
        `${ft(wantWidth)} × ${ft(wantDepth)} — is the size it already is. ` +
        `${candidate.problem ?? ""} The fit check measures the plan engine's solved rectangle, ` +
        "so the shortfall is in the setbacks or the lot rather than in this volume.",
    });
    return;
  }

  const after = checkSpecAgainstParcel(candidate.spec, parcelCheck.facts);
  const fitsAfter = after.report?.fits === true;

  suggestions.push({
    id: "footprint-over-buildable-envelope",
    kind: "footprint-over-buildable-envelope",
    proposal:
      `Resize ${volume.name} from ${ft(volume.widthFt)} × ${ft(volume.depthFt)} to ` +
      `${ft(wantWidth)} × ${ft(wantDepth)}. That is two phrases — “width ${wantWidth}” and ` +
      `“depth ${wantDepth}” — applied through the same command palette you can type them into, ` +
      "as one undo step.",
    because:
      `Your buildable envelope is ${ft(report.buildableWidthFt)} across the frontage by ` +
      `${ft(report.buildableDepthFt)} front to back, and this design needs a ` +
      `${sqFt(report.footprintSqFt)} footprint that does not fit it either way round. ` +
      `\`analyseParcel\` names ${sqFt(report.suggestedTotalSqFt)} of floor area as an area that ` +
      "does fit — verified by re-running the envelope rule, not estimated — and the width and " +
      "depth above are that area through the plan engine's own 1.45 proportion.",
    evidence: [
      {
        label: "Buildable envelope, across the frontage",
        value: report.buildableWidthFt,
        formatted: ft(report.buildableWidthFt),
        source: "checkSpecAgainstParcel · lib/builder/toPlan.ts",
      },
      {
        label: "Buildable envelope, front to back",
        value: report.buildableDepthFt,
        formatted: ft(report.buildableDepthFt),
        source: "checkSpecAgainstParcel · lib/builder/toPlan.ts",
      },
      {
        label: "Footprint measured",
        value: report.footprintSqFt,
        formatted: sqFt(report.footprintSqFt),
        source: "checkSpecAgainstParcel · lib/builder/toPlan.ts",
      },
      {
        label: "Floor area now",
        value: totalFloorAreaSqFt(spec),
        formatted: sqFt(totalFloorAreaSqFt(spec)),
        source: "totalFloorAreaSqFt · lib/builder/spec.ts",
      },
      {
        label: "Floor area that fits",
        value: report.suggestedTotalSqFt,
        formatted: sqFt(report.suggestedTotalSqFt),
        source: "envelopeFor · lib/design/layout.ts",
      },
    ],
    tradeOffs: [
      `This is a smaller home: ${sqFt(totalFloorAreaSqFt(spec))} becomes about ` +
        `${sqFt(report.suggestedTotalSqFt)}, and the plan engine packs its rooms out of whatever ` +
        "area it is given, so the room list on the drawing will change with it.",
      "The proportion is the plan engine's rule rather than your massing. If you drew a long, " +
        "narrow house on purpose, this squares it up.",
      "The fit check measures the engine's solved rectangle, not your volumes. It is exact " +
        "arithmetic on the rectangle it was handed; the rectangle is a translation of your home.",
      "Openings keep their positions and their sizes. A wall that becomes shorter than the glass " +
        "on it leaves that opening hanging off the end — the co-pilot's own opening check raises " +
        "it as its own card on the next pass, with the refit that pulls it back.",
      "Easements, environmental reserve, riparian setbacks and utility rights-of-way are not " +
        "modelled at all, and any one of them can cut the envelope below what this card reads.",
    ],
    notModelled: [],
    outcome: fitsAfter
      ? "Measured on the result by re-running `checkSpecAgainstParcel`: it fits the buildable " +
        "envelope."
      : "Measured on the result by re-running `checkSpecAgainstParcel`: it still does not fit. " +
        "The suggested area is rounded to buildable six-inch numbers, and here the rounding lands " +
        "the wrong side of the setbacks — so this gets you closer and the lot still needs a " +
        "conversation.",
    action,
  });
}

/* ----------------------------------------------------------------- budget */

/** Steps the budget card walks, largest home first. Eight rungs at 5% of a
 *  dimension each: enough range to reach a third of the floor area, few enough
 *  that the whole search is eight bills of materials rather than a hundred. */
const BUDGET_LADDER: readonly number[] = [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

function priceOf(
  document: BuilderDocument,
  spec: HomeSpec,
  basis: CoPilotBasis,
): ProjectBudget | null {
  try {
    return createProjectBudget({
      document: { ...document, spec },
      scenario: basis.scenario,
      region: basis.region,
      municipality: basis.municipality,
      budgetCapCad: basis.budgetCapCad,
    });
  } catch {
    /* `createProjectBudget` refuses to price a document it cannot validate
       rather than guessing at one. A refused rung is simply not a candidate;
       the caller reports the whole search coming back empty. */
    return null;
  }
}

function budget(
  document: BuilderDocument,
  basis: CoPilotBasis,
  suggestions: CoPilotSuggestion[],
  refusals: CoPilotRefusal[],
): void {
  if (basis.budgetCapCad === null) return;

  const spec = document.spec;
  const priced = priceOf(document, spec, basis);
  if (priced === null) {
    refusals.push({
      id: "budget-over-stated-cap",
      topic: "Your stated budget cap",
      reason:
        "`createProjectBudget` will not price this design as it stands, so there is no midpoint " +
        "to compare with your cap. The live read-out prints the reason it gave.",
    });
    return;
  }
  if (priced.cap === null || priced.cap.state !== "over") return;

  const volume = soleVolume(spec);
  if (volume === null) {
    refusals.push({
      id: "budget-over-stated-cap",
      topic: "Your stated budget cap",
      reason:
        `The working midpoint is ${scenarioCad(priced.total.mid)} against your ` +
        `${scenarioCad(priced.cap.capCad)} cap, but this home has ${spec.volumes.length} ` +
        "volumes and the co-pilot has no basis for choosing which one to shrink. Shrink the one " +
        "you can spare, and the live read-out will follow.",
    });
    return;
  }

  for (const factor of BUDGET_LADDER) {
    const wantWidth = boundedFt(volume.widthFt * factor, LIMITS.widthFt);
    const wantDepth = boundedFt(volume.depthFt * factor, LIMITS.depthFt);
    const action: PreparedAction = {
      suggestionId: "budget-over-stated-cap",
      confirmText: `Resize ${volume.name} to ${ft(wantWidth)} × ${ft(wantDepth)} to reach your cap`,
      label: "co-pilot: reach the budget cap",
      payload: {
        via: "phrases",
        volumeId: volume.id,
        phrases: [`width ${wantWidth}`, `depth ${wantDepth}`],
      },
      routedThrough: "applyPhrase · components/builder/phrases.ts",
    };

    const candidate = candidateFor(document, action);
    if (candidate.spec === null || sameSpec(candidate.spec, spec)) continue;

    const after = priceOf(document, candidate.spec, basis);
    if (after === null || after.cap === null || after.cap.state === "over") continue;

    suggestions.push({
      id: "budget-over-stated-cap",
      kind: "budget-over-stated-cap",
      proposal:
        `Resize ${volume.name} from ${ft(volume.widthFt)} × ${ft(volume.depthFt)} to ` +
        `${ft(wantWidth)} × ${ft(wantDepth)} — the largest home on this search that prices ` +
        "inside your stated cap.",
      because:
        `The working midpoint is ${scenarioCad(priced.total.mid)} against your stated cap of ` +
        `${scenarioCad(priced.cap.capCad)}, which is ` +
        `${scenarioCad(Math.abs(priced.cap.midpointDeltaCad))} over. The size above was not ` +
        "derived from a rule of thumb: eight progressively smaller homes were priced by " +
        "`createProjectBudget` and this is the largest one that came back inside the cap.",
      evidence: [
        {
          label: "Working midpoint now",
          value: priced.total.mid,
          formatted: scenarioCad(priced.total.mid),
          source: "createProjectBudget · lib/builder/projectBudget.ts",
        },
        {
          label: "Your stated cap",
          value: priced.cap.capCad,
          formatted: scenarioCad(priced.cap.capCad),
          source: "createProjectBudget · lib/builder/projectBudget.ts",
        },
        {
          label: "Floor area now",
          value: totalFloorAreaSqFt(spec),
          formatted: sqFt(totalFloorAreaSqFt(spec)),
          source: "totalFloorAreaSqFt · lib/builder/spec.ts",
        },
        {
          label: "Floor area proposed",
          value: totalFloorAreaSqFt(candidate.spec),
          formatted: sqFt(totalFloorAreaSqFt(candidate.spec)),
          source: "totalFloorAreaSqFt · lib/builder/spec.ts",
        },
      ],
      tradeOffs: [
        `This is a smaller home: ${sqFt(totalFloorAreaSqFt(spec))} becomes ` +
          `${sqFt(totalFloorAreaSqFt(candidate.spec))}, and the plan engine will pack fewer or ` +
          "smaller rooms out of it.",
        "Cost does not fall with area the way the area falls. Site preparation, delivery, " +
          "soft costs and the utility spine are allowances that barely move, so the shell is " +
          "doing all the work in this number.",
        "The bands are a planning range, not a quote, and the confidence label on the read-out " +
          `is currently ${priced.confidence.label}. Nothing here has been priced by a builder.`,
        "The windows keep their positions and their sizes, so a smaller shell carries the same " +
          "glass. That raises the glazing ratio, and a wall that becomes shorter than the glass " +
          "on it leaves that opening hanging off the end — both come back as their own cards.",
      ],
      notModelled: [],
      outcome:
        `Measured on the result by re-pricing it: ${scenarioCad(after.total.mid)} midpoint, ` +
        `${after.cap.state === "within" ? "inside" : "at the edge of"} your ` +
        `${scenarioCad(priced.cap.capCad)} cap.`,
      action,
    });
    return;
  }

  refusals.push({
    id: "budget-over-stated-cap",
    topic: "Your stated budget cap",
    reason:
      `The working midpoint is ${scenarioCad(priced.total.mid)} against your ` +
      `${scenarioCad(priced.cap.capCad)} cap. Eight progressively smaller homes were priced, ` +
      "down to about a third of this floor area, and none of them came back inside the cap — so " +
      "the gap is not in the size of the house. The scenario, the finish level, the delivery " +
      "mode and the site allowance are where that money is.",
  });
}

/* --------------------------------------------------------------- openings */

/** How many opening cards the sidebar will carry. A list of fourteen is a
 *  list nobody reads; the rest are named in a refusal so none is hidden. */
const OPENING_CARD_LIMIT = 3;

function openings(
  document: BuilderDocument,
  suggestions: CoPilotSuggestion[],
  refusals: CoPilotRefusal[],
): void {
  const spec = document.spec;
  const illegal: Array<{ volume: Volume; openingId: string }> = [];

  for (const volume of spec.volumes) {
    for (const opening of volume.openings) {
      const legality = checkOpening(spec, volume.id, opening.id);
      if (legality.onWall && legality.clashes.length === 0) continue;
      illegal.push({ volume, openingId: opening.id });
    }
  }

  if (illegal.length === 0) return;

  let carried = 0;
  const skipped: string[] = [];

  for (const entry of illegal) {
    const volume = entry.volume;
    const opening = volume.openings.find((candidate) => candidate.id === entry.openingId);
    if (!opening) continue;

    if (carried >= OPENING_CARD_LIMIT) {
      skipped.push(`${opening.id} on ${volume.name}`);
      continue;
    }

    const legality = checkOpening(spec, volume.id, opening.id);
    const runFt = openingRunFt(spec, volume, opening.wall);
    const headFt = wallHeadFt(volume);
    const id = `opening-off-its-wall:${volume.id}:${opening.id}`;

    const action: PreparedAction = {
      suggestionId: id,
      confirmText: `Pull ${opening.id} back onto the ${volume.name} wall`,
      label: `co-pilot: refit ${volume.id}/${opening.id}`,
      payload: { via: "refit-opening", volumeId: volume.id, openingId: opening.id },
      routedThrough: "applyOpeningEdit · components/builder/openingEdit.ts",
    };

    const candidate = candidateFor(document, action);
    if (candidate.spec === null) {
      refusals.push({
        id,
        topic: `Opening ${opening.id} on ${volume.name}`,
        reason:
          `This opening ${legality.onWall ? "overlaps" : "hangs off the end of"} ` +
          `${legality.onWall ? legality.clashes.join(", ") : "its wall"}, and re-asking for its ` +
          "own box through `applyOpeningEdit` moves nothing — so there is no card here rather " +
          "than a control that would appear to fix it and would not. Move it by hand in the " +
          "plan, or delete it.",
      });
      continue;
    }

    const after = checkOpening(candidate.spec, volume.id, opening.id);
    carried += 1;

    suggestions.push({
      id,
      kind: "opening-off-its-wall",
      proposal:
        `Re-ask for ${opening.id}'s own position and size on the ${volume.name} wall, so the ` +
        "editor's clamps pull it back inside the wall and off its neighbours. This is exactly " +
        "what dragging its handle a hair and letting go would do.",
      because: legality.onWall
        ? `${opening.id} interpenetrates ${legality.clashes.join(", ")} on the same wall. ` +
          "`checkOpening` is the rule every plan in the catalogue is held to, and no shipped " +
          "plan has two openings sharing the same piece of wall in both axes."
        : `${opening.id} is not fully on its wall. It runs from ${ft(opening.offsetFt)} to ` +
          `${ft(opening.offsetFt + opening.widthFt)} along a wall that is ${ft(runFt)} long, and ` +
          `from ${ft(opening.sillFt)} to ${ft(opening.sillFt + opening.heightFt)} up a wall ` +
          `whose head is at ${ft(headFt)}.`,
      evidence: [
        {
          label: "Wall run",
          value: runFt,
          formatted: ft(runFt),
          source: "openingRunFt · components/builder/openingEdit.ts",
        },
        {
          label: "Wall head",
          value: headFt,
          formatted: ft(headFt),
          source: "wallHeadFt · components/builder/openingEdit.ts",
        },
        {
          label: "Openings it overlaps",
          value: legality.clashes.length,
          formatted:
            legality.clashes.length === 0 ? "none" : legality.clashes.join(", "),
          source: "checkOpening · components/builder/openingEdit.ts",
        },
      ],
      tradeOffs: [
        "The opening moves, and possibly shrinks, from where you put it. The clamp keeps the " +
          "size when it can and takes it down to the editor's minimum when it cannot.",
        "It fixes this opening only. If the wall is genuinely too short for the glass you want, " +
          "the volume is the thing to change.",
      ],
      notModelled: [],
      outcome:
        after.onWall && after.clashes.length === 0
          ? "Measured on the result by re-running `checkOpening`: on its wall, and clear of its " +
            "neighbours."
          : `Measured on the result by re-running \`checkOpening\`: ` +
            `${after.onWall ? "on its wall" : "still not fully on its wall"}, ` +
            `${after.clashes.length === 0 ? "clear of its neighbours" : `still overlapping ${after.clashes.join(", ")}`}. ` +
            "The clamp never makes an opening worse, and here it cannot make it whole either.",
      action,
    });
  }

  if (skipped.length > 0) {
    refusals.push({
      id: "openings-beyond-the-limit",
      topic: "More openings than the sidebar carries",
      reason:
        `${skipped.length} more opening${skipped.length === 1 ? "" : "s"} would not survive ` +
        `\`checkOpening\`: ${skipped.join(", ")}. The co-pilot shows ${OPENING_CARD_LIMIT} at a ` +
        "time so the sidebar stays readable; apply these and the next ones appear.",
    });
  }
}

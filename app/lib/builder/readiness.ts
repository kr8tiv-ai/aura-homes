/* THE READINESS READING — design intent, or ready for a professional to review.
 *
 * There are two honest things a design in this tool can be, and confusing them
 * is how somebody books a designer for a study that is still missing the lot.
 * So this returns a state and a LIST OF GAPS, and nothing else. No score, no
 * percentage, no ring filling up. A number you cannot act on is decoration:
 * "68% ready" tells you to keep clicking, while "the setbacks you entered use
 * up the whole lot — fix them in the Site step" tells you what to do next.
 *
 * WHY THIS OWNS NO FACTS OF ITS OWN. Every gap here is quoted from the module
 * that already computed it: the budget's own `gaps`, the parcel module's own
 * blocking findings, the document's own quarantine. This file decides ONE
 * thing — whether the list is empty — and routes each entry to the screen that
 * can close it. The moment it restated a gap in its own words, or recomputed
 * the fact behind one, there would be two answers to one question and they
 * would drift, which is the failure this repo has already paid for three
 * times (mask literals, slope, cost).
 *
 * PURE AND TOTAL. No clock, no storage, no network, no randomness, no locale
 * formatting; the same inputs always produce a deeply equal result, and the
 * inputs are never mutated. That is what lets the strip in the builder call it
 * on every keystroke and what lets a spec assert it.
 */

import type { BuilderDocument } from "./document";
import type { ProjectBudget } from "./projectBudget";
import type { SpecParcelCheck } from "./toPlan";
import type { ParcelTopic } from "@/lib/design/parcel";

/** `review-ready` means a professional has the inputs they need to review the
 *  study — never that anything has been approved, checked against a code, or
 *  engineered. Nothing in this tool can say that. */
export type ReadinessState = "design-intent" | "review-ready";

export interface ReadinessGap {
  /** Stable across renders so a list can key on it and a spec can name one. */
  id: string;
  /** The specific missing or unresolved input, in the words of the module
   *  that found it. */
  need: string;
  /** Where in Aura to supply it. A gap without an address is a complaint. */
  where: string;
}

export interface Readiness {
  state: ReadinessState;
  gaps: ReadinessGap[];
}

export interface ReadinessInput {
  document: BuilderDocument;
  /** From `createProjectBudget` — the only cost model in the product. */
  budget: ProjectBudget;
  /** From `checkSpecAgainstParcel`. `null` when no parcel is attached, which
   *  is itself the first gap: the check has nothing to run against. */
  parcelCheck: SpecParcelCheck | null;
}

const WHERE_SITE = "Site step — lot width, depth and the three setbacks";
const WHERE_SHELL = "Shell step — the massing that sets the footprint";
const WHERE_BUDGET = "Budget — the cost scenario, and the project location set in Start";
const WHERE_REPAIR = "Repair held project details, at the top of the builder";
const WHERE_GRAPH_BOUNDARY =
  "Held at the planar-geometry boundary, alongside fixtures, drawings and the legacy exports";

/**
 * Whether a spec-derived parcel check describes the design on screen.
 *
 * It does not once the project has been converted to planar graph geometry:
 * `document.spec` becomes a frozen recovery copy at conversion and graph edits
 * never touch it, so a fit verdict computed from it is a verdict about a home
 * that no longer exists. Every other legacy consumer already refuses this
 * (`GraphPending`); the readiness reading and the live strip refuse it here,
 * through one predicate so they cannot come apart.
 */
export function parcelCheckApplies(document: BuilderDocument): boolean {
  return document.geometry.kind !== "building-graph";
}

/** Which screen closes a blocking parcel finding. Setbacks that eat the lot
 *  are a Site answer; a footprint that will not fit can be fixed from either
 *  end, so both are named. */
const PARCEL_WHERE: Partial<Record<ParcelTopic, string>> = {
  inputs: WHERE_SITE,
  envelope: `${WHERE_SHELL} — or the setbacks in Site`,
};

export function readDesignReadiness(input: ReadinessInput): Readiness {
  const gaps: ReadinessGap[] = [];

  if (!parcelCheckApplies(input.document)) {
    gaps.push({
      id: "graph-parcel-check",
      need: "The setback and buildable-envelope check still reads the legacy recovery spec, so it has not been run against this planar-graph design.",
      where: WHERE_GRAPH_BOUNDARY,
    });
  } else if (input.parcelCheck === null) {
    gaps.push({
      id: "site-parcel",
      need: "The land under this home is not described, so no setback or buildable-envelope check has been run.",
      where: WHERE_SITE,
    });
  } else if (input.parcelCheck.report === null) {
    /* `checkSpecAgainstParcel` returns a null report for exactly one reason,
       and it says so itself: an empty footprint "fits" every lot, so it
       declines to answer rather than pass. */
    gaps.push({
      id: "site-footprint",
      need: "This design has no floor area, so there is no footprint to test against the setbacks.",
      where: WHERE_SHELL,
    });
  } else {
    for (const finding of input.parcelCheck.report.findings) {
      if (finding.severity !== "blocking") continue;
      gaps.push({
        id: `parcel-${finding.id}`,
        need: finding.title,
        where: PARCEL_WHERE[finding.id] ?? WHERE_SITE,
      });
    }
  }

  /* Quoted verbatim. The budget already names each missing input precisely —
     "Delivery distance and origin are unknown; obtain a route and mobilization
     quote" — and rewording it here would give the product two sentences for
     one fact. */
  input.budget.gaps.forEach((gap, index) => {
    gaps.push({ id: `budget-${index}`, need: gap, where: WHERE_BUDGET });
  });

  const held = input.document.quarantine.entries.length;
  if (held > 0) {
    gaps.push({
      id: "quarantine",
      need: `${held} project detail${held === 1 ? " is" : "s are"} held for repair after a geometry edit, so the design is not yet whole.`,
      where: WHERE_REPAIR,
    });
  }

  return { state: gaps.length === 0 ? "review-ready" : "design-intent", gaps };
}

/* ===========================================================================
   THE STAMP — the words that keep a beautiful drawing honest.

   Before this file, five places carried their own copy of the warning: the
   drafting kit, the axonometric, the questionnaire's blueprint sheet, the
   design-result page quoting that sheet, and the DXF writer. Copies of a
   LEGAL sentence drift like any other copy — one had already dropped its
   period — and a set that words its own warning five slightly different ways
   reads as five levels of seriousness.

   There are exactly TWO stamps, because there are exactly two artifacts:

   · REVIEW_SET_STAMP — the eight-sheet review set and everything derived
     from the builder's model (kit sheets, axon, DXF). "REVIEW SET" is what
     that artifact is.
   · DESIGN_PACKAGE_STAMP — the questionnaire's single-sheet design package
     and the page that presents it. Its second line names the Alberta
     residential designer because that package is Alberta-pilot output.

   A sheet may ADD lines below its stamp (the axonometric warns that it is
   not a measured drawing — real information, specific to that projection),
   but the first line comes from here, verbatim, everywhere. The texts are
   pinned by golden byte tests downstream; changing a word here is a visible,
   reviewed decision, which is the point.
   =========================================================================== */

/** The load-bearing phrase, for writers that compose their own sentence. */
export const NOT_FOR_CONSTRUCTION = "NOT FOR CONSTRUCTION";

/** The eight-sheet review set, the axonometric, and the DXF. */
export const REVIEW_SET_STAMP = [
  `${NOT_FOR_CONSTRUCTION} — REVIEW SET.`,
  "A licensed professional completes, corrects and seals this set.",
] as const;

/** The questionnaire's design package, and the page that quotes it. */
export const DESIGN_PACKAGE_STAMP = [
  `REVIEW-READY DESIGN PACKAGE — ${NOT_FOR_CONSTRUCTION}.`,
  "A licensed Alberta residential designer completes the permit set.",
] as const;

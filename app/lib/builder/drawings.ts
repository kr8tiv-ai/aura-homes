/* ===========================================================================
   THE DRAWING SET — a HomeSpec becomes eight sheets a professional can work on.

   THE ASK, AND WHAT IT HONESTLY MEANS.

   The founder's words were "it should render to actual drawings they can have
   approved by an architect." Two corrections live in this file's copy and in
   every sheet it produces, because getting them wrong would be a promise the
   product cannot keep:

   1. AN ARCHITECT DOES NOT APPROVE SOMEBODY ELSE'S DRAWINGS. They review
      them, take professional responsibility, and SEAL them. What software can
      produce is a set complete and correct enough to be WORTH sealing, and
      cheap for a professional to correct. That is the target here, and it is
      a real and useful target.
   2. IN ALBERTA IT IS USUALLY NOT AN ARCHITECT. The Architects Act exempts
      dwellings of one to four units, of any size, so the professional who
      normally completes and seals a single-family permit set is a LICENSED
      RESIDENTIAL DESIGNER. Truss design arrives stamped from the truss plant.
      The screw-pile foundation needs a P.Eng. Every sheet says so.

   So: a coordinated set, drawn to a stated scale, dimensioned, with real
   schedules — not a concept image. Stamped NOT FOR CONSTRUCTION until a
   professional seals it.

   WHAT IS IN THE SET

     A0  COVER + PROJECT DATA   project data block, sheet index, key plan
     A1  SITE PLAN              parcel, setbacks, footprint, north, access —
                                or an honest blank when no lot was supplied
     A2  FOUNDATION PLAN        the screw-pile layout, because no concrete
     A3  FLOOR PLAN             poché walls, door swings, window cuts,
                                dimensioned inside and out, section cut line
     A4  ROOF PLAN              outline, ridge, slope arrows with the pitch,
                                overhang, and the array footprint if given
     A5  ELEVATIONS             all four, one scale, true opening positions,
                                grade, wall height, ridge, pitch triangle
     A6  BUILDING SECTION       a cut on the long axis with the assemblies
     A7  SCHEDULES              window/door schedule and assembly R-values

   THE RULE THAT SHAPES EVERY SHEET. Where a fact is missing, the sheet is
   issued with the gap NAMED — in the drawing, in the general notes, and in
   the returned `notes` array. It is never issued with a plausible number in
   the gap. A generator that guesses a setback, a valley line or an R-value
   produces a set that costs a professional more to check than to redraw,
   which is the exact opposite of the point.

   DETERMINISM. Pure arithmetic and string building. No `Math.random`, no
   `Date.now` — the date is a required parameter, so the same spec and the
   same date always produce byte-identical SVG. No new dependencies.

   CREDIT. Nothing in this module derives from any third-party source. The
   drafting language is a continuation of `lib/design/blueprint.ts`, which is
   this repo's own port of its Python design service.
   =========================================================================== */

import type { HomeSpec } from "@/lib/builder/spec";

import { buildHomeModel, type HomeModel } from "./drawings/model";
import {
  buildSheets,
  PROFESSIONAL_NOTE,
  type DrawingParcel,
  type DrawingRooms,
  type DrawingSetInput,
  type DrawingSetResult,
  type DrawingSheet,
} from "./drawings/sheets";

export { drawingDataUrl } from "./drawings/kit";
export { PROFESSIONAL_NOTE };
export type { DrawingParcel, DrawingRooms, DrawingSetInput, DrawingSetResult, DrawingSheet };

/* Re-exported so a caller can inspect the geometry the sheets were drawn
   from — a UI that wants to show the ridge height, the pile count or the
   opening schedule should read it from here rather than measure the SVG. */
export {
  allElevations,
  buildHomeModel,
  elevationOf,
  largestGlazing,
  modelFdwr,
  openingSchedule,
  sectionOf,
  totalPiles,
} from "./drawings/model";
export type {
  BuildingSection,
  Elevation,
  ElevationView,
  HomeModel,
  PileGrid,
  RoofSection,
  ScheduleRow,
  VolumeModel,
  WorldOpening,
  WorldWall,
} from "./drawings/model";

/**
 * The whole set, in the order a permit set carries it.
 *
 * @param input the spec, plus the facts a HomeSpec does not carry: the date
 *              for the title block (a parameter, never a clock), the address,
 *              the parcel when there is one, a solved room program when there
 *              is one, and an array size when the owner has chosen one.
 *
 * Total: it never throws for a bad spec. A model with no volumes returns eight
 * sheets that say so.
 */
export function drawingSet(input: DrawingSetInput): DrawingSetResult {
  const model = buildHomeModel(input.spec);
  return buildSheets(input, model);
}

/**
 * One sheet by number, for a UI that pages through the set.
 *
 * The whole set is built either way — the sheets share a model, an index and a
 * scale decision, and building one in isolation would let A0's sheet index
 * disagree with the scale A5 actually used.
 */
export function drawingSheet(input: DrawingSetInput, number: string): DrawingSheet | null {
  return drawingSet(input).sheets.find((s) => s.number === number.toUpperCase()) ?? null;
}

/** Convenience: the set from a bare spec and a date, with no site facts.
 *  Every sheet that needs a fact it was not given says so on its face. */
export const drawingSetForSpec = (spec: HomeSpec, dateISO: string): DrawingSetResult =>
  drawingSet({ spec, dateISO });

/** The drawing model on its own, for a caller that wants the numbers without
 *  the ink — the ridge heights, the pile grid, the opening schedule. */
export const drawingModel = (spec: HomeSpec): HomeModel => buildHomeModel(spec);

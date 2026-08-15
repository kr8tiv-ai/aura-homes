"use client";

/* ===========================================================================
   VARIATION STRIP — several versions of this home, side by side.

   WHAT THIS IS NOT. It is not a set of pictures, it is not a model's guess,
   and nothing on this strip was imagined. Every card below is a REAL builder
   document: it went through `validateBuilderDocument`, it has a
   `hashBuilderDocument` of its own, and its band came out of
   `createProjectBudget` — the same call `/budget` and the live read-out make.
   Click Apply and that exact document becomes the one on screen, in one undo
   step. The words on this strip are chosen to keep that distinction sharp;
   `variations.spec.ts` scans the rendered text and fails if it drifts.

   WHERE EVERY NUMBER COMES FROM. Nowhere in this file. It formats
   `variationSet(...)` and nothing else — no cost estimate of its own, no
   second glazing ratio, no area arithmetic. A component that recomputed one
   of those would agree with the engine on the day it was written.

   THE COST MODEL'S LIMITS ARE PRINTED BESIDE THE COST, NOT UNDER IT. When a
   variant moves something `buildBom` does not read, or moves glazed area
   without moving the window COUNT it prices per unit, the engine emits the
   sentence that says so and this component renders it in the same block as
   the band. A figure whose caveat is a footnote is a figure that will be
   quoted without the caveat.
   =========================================================================== */

import { useCallback, useMemo, useRef, useState } from "react";
import type { BuilderDocument } from "@/lib/builder/document";
import type { ProjectBudgetScenario } from "@/lib/builder/projectBudget";
import type { HomeSpec } from "@/lib/builder/spec";
import {
  AXIS_LABELS,
  VARIATION_ENGINE,
  applyVariation,
  variationSet,
  type DesignVariation,
} from "@/lib/builder/variations";

/** Presentation only, matching the live read-out so one project never reads
 *  in two currencies. */
const cad = (value: number): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

const sqft = (value: number): string =>
  `${Math.round(value).toLocaleString("en-CA")} sq ft`;

/** The midpoint move, in words. "Unchanged" is never printed alone — the
 *  engine's `COST_MODEL_UNMOVED` sentence renders directly beneath it. */
function midDeltaText(delta: number): string {
  if (delta === 0) return "Midpoint unchanged";
  return `Midpoint ${delta > 0 ? "+" : "−"}${cad(Math.abs(delta))} against the current design`;
}

function VariationCard({
  variation,
  onApply,
}: {
  variation: DesignVariation;
  onApply: (variation: DesignVariation) => void;
}) {
  return (
    <li
      className="variation-card"
      data-variation-id={variation.id}
      data-variation-axis={variation.axis}
      data-variation-over-ceiling={variation.overCeiling ? "yes" : "no"}
    >
      <p className="variation-axis">{AXIS_LABELS[variation.axis]}</p>
      <h3 className="variation-card-title">{variation.title}</h3>

      <ul className="variation-deltas">
        {variation.deltas.map((delta) => (
          <li key={delta.sentence}>{delta.sentence}</li>
        ))}
      </ul>

      <div className="variation-cost">
        <span className="variation-cost-label">Planning range</span>
        <span className="variation-cost-figure">
          {cad(variation.cost.total.low)} – {cad(variation.cost.total.high)}
        </span>
        <span className="variation-cost-mid">{midDeltaText(variation.cost.midDeltaCad)}</span>
        {variation.cost.blindSpots.map((note) => (
          <p className="variation-blindspot" key={note}>
            {note}
          </p>
        ))}
      </div>

      <p className="variation-glazing">{variation.glazingSentence}</p>

      <p className="variation-figures">
        {sqft(variation.areaSqFt)} of modelled floor area · {sqft(variation.glazedAreaSqFt)} glazed ·
        design {variation.designHash.slice(0, 10)} · budget {variation.cost.budgetHash.slice(0, 10)}
      </p>

      <button type="button" className="variation-apply" onClick={() => onApply(variation)}>
        Apply {variation.title}
      </button>
    </li>
  );
}

export default function VariationStrip({
  document,
  onApply,
  region = "Alberta",
  municipality = "",
  scenario,
  budgetCapCad = null,
}: {
  /** The document on screen. Everything on the strip is derived from it. */
  document: BuilderDocument;
  /**
   * The editor's own spec-edit path. The SPEC crosses back rather than the
   * whole document, because that path already reconciles partitions,
   * finishes, fixtures and comfort targets inside ONE commit — which is what
   * makes applying a variation one undo step instead of two states.
   */
  onApply: (spec: HomeSpec, label: string) => void;
  /** The same four values the live read-out prices with, so the strip and the
   *  read-out can never quote two different bands for one design. */
  region?: string;
  municipality?: string;
  scenario?: ProjectBudgetScenario;
  budgetCapCad?: number | null;
}) {
  const set = useMemo(
    () => variationSet({ document, region, municipality, scenario, budgetCapCad }),
    [budgetCapCad, document, municipality, region, scenario],
  );

  /* UI-only, never persisted, and nothing about the geometry or the export
     reads it. It exists so two applications in a row carry two different
     history labels and therefore cost two undo steps rather than one. */
  const sequence = useRef(0);
  const [announcement, setAnnouncement] = useState("");

  const apply = useCallback(
    (variation: DesignVariation) => {
      sequence.current += 1;
      const result = applyVariation(set, variation.id, sequence.current);
      if (!result.ok) {
        setAnnouncement(result.problem);
        return;
      }
      onApply(result.spec, result.label);
      setAnnouncement(result.announcement);
    },
    [onApply, set],
  );

  return (
    <section
      className="variation-strip"
      aria-label="Design variations"
      data-variation-engine={VARIATION_ENGINE}
      data-variation-count={set.variations.length}
    >
      <header className="variation-head">
        <p className="variation-eyebrow">Parametric variations · deterministic</p>
        <h2 className="variation-title">Several versions of this home, at once</h2>
        <p className="variation-method">
          Each version below moves numbers in this document — glazing area, orientation, roof form,
          footprint proportion, storeys — through the same validated geometry pipeline the editor
          uses. Nothing here is a picture and nothing here was guessed: every card is a document
          that opens, hashes and costs. The same design always produces the same versions, in the
          same order.
        </p>
        <p className="variation-method">
          Applying one replaces the design on screen in a single undo step, and says so out loud.
        </p>
        {/* The live region lives INSIDE the header rather than as its own grid
            row, so that while it is empty it contributes no height and no gap.
            It is never unmounted: a live region has to be in the accessibility
            tree BEFORE its text arrives or the announcement is not made. */}
        <p className="variation-announce" role="status" aria-live="polite">
          {announcement}
        </p>
      </header>

      {set.unavailable !== null ? (
        <p className="variation-unavailable">{set.unavailable}</p>
      ) : null}

      {set.basis !== null ? (
        <div className="variation-basis">
          <p className="variation-axis">The design on screen</p>
          <p className="variation-cost-figure">
            {cad(set.basis.total.low)} – {cad(set.basis.total.high)}
          </p>
          <p className="variation-glazing">{set.basis.glazingSentence}</p>
          <p className="variation-figures">
            {sqft(set.basis.areaSqFt)} of modelled floor area · {sqft(set.basis.glazedAreaSqFt)}{" "}
            glazed · design {set.basis.designHash.slice(0, 10)}
          </p>
        </div>
      ) : null}

      {set.variations.length > 0 ? (
        <ol className="variation-grid">
          {set.variations.map((variation) => (
            <VariationCard key={variation.id} variation={variation} onApply={apply} />
          ))}
        </ol>
      ) : null}

      {set.refusals.length > 0 ? (
        <div className="variation-refusals">
          <p className="variation-axis">Not offered, and why</p>
          <ul>
            {set.refusals.map((refusal) => (
              <li key={`${refusal.axis}:${refusal.reason}`}>{refusal.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="variation-source">
        variationSet · createProjectBudget · modelledGlazingRatio · FDWR_MAX ·
        hashBuilderDocument
      </p>
    </section>
  );
}

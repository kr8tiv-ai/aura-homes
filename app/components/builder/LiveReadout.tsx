"use client";

/* THE LIVE READ-OUT — what this edit costs, what it breaks, and whether it is
   ready for anybody but you. On screen while the sliders are still moving.

   The consequence of a decision belongs beside the decision. All three of
   these facts existed before this strip and all three lived somewhere else:
   the cost bands on /budget, the fit check inside the Site step, the glazing
   ratio under the model. A person widening a volume could not see any of them
   move, which meant the numbers were true and useless at the same time.

   ONE SOURCE PER FACT, AND NONE OF THEM IS HERE.

   · The bands are `createProjectBudget` — the same call /budget makes, handed
     the live document instead of the saved one. There is deliberately no
     faster "good enough for the editor" cost estimate. A second cost model
     would agree on the day it was written and disagree by the time anybody
     noticed, and this repo has already paid for that class of bug three times.
   · The fit and coverage figures are `analyseParcel`, reached through
     `checkSpecAgainstParcel`, which the builder already computes for the Site
     panel and passes straight in.
   · The glazing ratio is `modelledGlazingRatio` against `FDWR_MAX`, the same
     two values the read-out below the model prints.
   · The readiness state is `readDesignReadiness`, which owns no facts either.

   WHAT IS NOT HERE, SAID OUT LOUD. Municipal minimum dwelling size is not
   modelled against a design anywhere in this product — the builder's parcel
   carries lot dimensions, setbacks, facing and slope, and nothing about a
   district's bylaw. So this strip does not show a minimum-size check. Printing
   one from a plausible number would be the most convincing wrong answer the
   tool could give; the footnote says the check is absent instead.

   MOTION. Only colour and border transitions, on `--motion-echo` — the token,
   through `.builder-figure__value` and `.builder-readout__state` rather than a
   utility that happens to emit the same 150 ms. Numbers that count up while
   you drag a slider are a toy; these change the instant the document does.

   TYPE (ED01). This strip and the model read-out below it now share one type
   ladder — `.builder-figure__*` in globals.css. The strip already had the
   right INSTINCT (a separate mono line naming the function that owns each
   verdict); what it did not have was a figure. Three cost bands and three
   findings were all set at 14–16px, so the panel's numbers were the same
   weight as the footnotes explaining them. */

import { useMemo } from "react";
import { useAuraProject } from "@/components/project/ProjectContext";
import { FDWR_MAX } from "@/lib/design";
import { feetInches, sqft } from "@/components/design/ecoSpec";
import type { BuilderDocument } from "@/lib/builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
} from "@/lib/builder/projectBudget";
import { parcelCheckApplies, readDesignReadiness } from "@/lib/builder/readiness";
import { modelledGlazingRatio, type SpecParcelCheck } from "@/lib/builder/toPlan";

/** Presentation only, mirroring /budget so one project never reads in two
 *  currencies. Every value it formats arrives from `createProjectBudget`. */
const cad = (value: number): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

const pct = (ratio: number): string => `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;

const BANDS = [
  { key: "low", label: "Lean path" },
  { key: "mid", label: "Working midpoint" },
  { key: "high", label: "Risk envelope" },
] as const;

/** One finding, on the read-out ladder the model panel below also uses:
 *  figure, what it measures, the sentence, the helper that owns it. */
function Check({
  name,
  verdict,
  qualifier,
  detail,
  source,
  alert,
}: {
  name: string;
  verdict: string;
  /** the limit a verdict is measured against — subordinate to the figure but
   *  beside it, the same treatment the model read-out gives its ceiling */
  qualifier?: string;
  detail: string;
  source: string;
  alert?: boolean;
}) {
  return (
    <div className="builder-figure" data-alert={alert ? "true" : undefined}>
      <p className="builder-figure__label">{name}</p>
      <p className="builder-figure__value">
        <span>{verdict}</span>
        {qualifier ? <span className="builder-figure__qualifier">{qualifier}</span> : null}
      </p>
      <p className="builder-figure__note">{detail}</p>
      <p className="builder-figure__source">{source}</p>
    </div>
  );
}

export default function LiveReadout({
  document,
  parcelCheck,
}: {
  document: BuilderDocument;
  /** The builder's own `checkSpecAgainstParcel` result; `null` with no parcel. */
  parcelCheck: SpecParcelCheck | null;
}) {
  const { project } = useAuraProject();
  const region = project?.requirements.location.region ?? "Alberta";
  const municipality = project?.requirements.location.municipality ?? "";
  const capCad = project?.requirements.budgetCad.max ?? null;
  const savedScenario = project?.budgetBasis?.scenario;

  /* `createProjectBudget` refuses to price an invalid document rather than
     guessing at one. In the editor that must not take the page down with it,
     so the refusal is caught and printed — a strip that says why it cannot
     price this design is worth more than a blank one. */
  const priced = useMemo(() => {
    try {
      return {
        ok: true as const,
        budget: createProjectBudget({
          document,
          scenario: savedScenario ?? defaultProjectBudgetScenario(),
          region,
          municipality,
          budgetCapCad: capCad,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        problem: error instanceof Error ? error.message : String(error),
      };
    }
  }, [capCad, document, municipality, region, savedScenario]);

  const readiness = useMemo(
    () => (priced.ok ? readDesignReadiness({ document, budget: priced.budget, parcelCheck }) : null),
    [document, parcelCheck, priced],
  );

  /* Both of these refuse the frozen recovery spec after a graph conversion,
     rather than printing a verdict about a home that is no longer on screen.
     The parcel half is `parcelCheckApplies`, shared with the readiness reading
     so the strip and the state below it cannot disagree. */
  const parcelApplies = parcelCheckApplies(document);
  const graphMode = !parcelApplies;
  const glazingRatio = graphMode ? null : modelledGlazingRatio(document.spec);
  const report = parcelApplies ? (parcelCheck?.report ?? null) : null;

  return (
    <section
      className="builder-readout"
      aria-label="Live cost and constraint read-out"
      data-readiness={readiness?.state ?? "unpriced"}
      data-readiness-gaps={readiness?.gaps.length ?? 0}
    >
      <div className="builder-readout__head">
        <p className="builder-readout__title">Live read-out</p>
        {readiness ? (
          <span
            className="builder-readout__state"
            data-alert={readiness.state === "review-ready" ? undefined : "true"}
          >
            {readiness.state === "review-ready" ? "Ready for professional review" : "Design intent"}
          </span>
        ) : null}
      </div>

      {priced.ok ? (
        <div>
          <div className="builder-figures" data-columns="3-early">
            {BANDS.map((band) => (
              <div key={band.key} className="builder-figure">
                <p className="builder-figure__label">{band.label}</p>
                <p className="builder-figure__value">
                  <span>{cad(priced.budget.total[band.key])}</span>
                </p>
                <p className="builder-figure__note">
                  Includes the {priced.budget.scenario.contingencyPct}% contingency
                </p>
              </div>
            ))}
          </div>
          {/* The basis for all three bands, so it carries the block rule and
              sits under the row — without it, a source line at the foot of a
              three-column grid reads as the source of the LEFT column only. */}
          <p className="builder-figure__source builder-readout__block">
            createProjectBudget · {Math.round(priced.budget.areaSqFt)} sq ft ·{" "}
            {municipality || region} · confidence {priced.budget.confidence.label}
          </p>
        </div>
      ) : (
        <p className="builder-readout__refusal">
          This design cannot be priced as it stands: {priced.problem}
        </p>
      )}

      {/* Stacked, not three across. This strip renders inside the builder's
          controls column, which is `minmax(22rem, …)` wide — and a `sm:`
          breakpoint tracks the viewport, not the column, so a multi-column
          grid would be at its narrowest exactly where these sentences are
          longest. The money bands above stay in a row because they are three
          short numbers; these are three findings. `data-columns="1"` is what
          holds that decision in the stylesheet. */}
      <div className="builder-figures" data-columns="1">
        <Check
          name="Buildable envelope"
          verdict={
            !parcelApplies
              ? "Not run"
              : parcelCheck === null
                ? "Not checked"
                : report === null
                  ? "Nothing to place"
                  : report.fits
                    ? "Fits"
                    : "Does not fit"
          }
          detail={
            !parcelApplies
              ? "This project uses planar graph geometry. The setback check still reads the frozen recovery spec, so it is not run against the design on screen."
              : parcelCheck === null
                ? "No parcel is attached, so no setback check has been run against this design."
                : report === null
                  ? "This design has no floor area, so an empty footprint was not reported as fitting."
                  : `${feetInches(report.buildableWidthFt)} × ${feetInches(report.buildableDepthFt)} buildable, against a ${sqft(report.footprintSqFt)} footprint.`
          }
          source="analyseParcel · a modelled check, not a permit decision"
          alert={report !== null && !report.fits}
        />
        <Check
          name="Site coverage"
          verdict={
            graphMode ? "Not run" : report === null ? "Not checked" : `${(Math.round(report.coveragePct * 10) / 10).toFixed(1)}%`
          }
          /* Graph mode needs its own sentence. Coverage divides the SPEC's
             footprint by the lot, and after a conversion the spec is the
             frozen recovery copy — so `parcelApplies` withholds the figure no
             matter what land is attached. Telling a person to attach the lot
             here was an instruction that could not work: they would do it and
             the reading would stay blank. Undo is the one action that brings
             the check back, which the Shape panel already says. */
          detail={
            graphMode
              ? "This project uses planar graph geometry. Coverage is measured from the frozen recovery spec's footprint, so attaching a lot will not produce a figure here — Undo returns through the conversion, where this check runs again."
              : report === null
                ? "Attach the lot in the Site step and coverage is measured against it."
                : `Footprint over ${sqft(report.lotSqFt)} of lot. Most bylaws also count decks and covered areas, which this does not.`
          }
          source="analyseParcel · your district's own limit is not known here"
        />
        <Check
          name="Glazing"
          verdict={glazingRatio === null ? "Not modelled" : pct(glazingRatio)}
          qualifier={glazingRatio === null ? undefined : `of ${pct(FDWR_MAX)}`}
          detail={
            glazingRatio === null
              ? "This project uses planar graph geometry; the ratio is not run against the recovery spec."
              : "Your glass over modelled wall area, compared with the NBC 9.36 prescriptive ceiling. A comparison, not a code check."
          }
          source="modelledGlazingRatio · FDWR_MAX"
          alert={glazingRatio !== null && glazingRatio > FDWR_MAX}
        />
      </div>

      {readiness ? (
        <div className="builder-readout__block">
          {readiness.gaps.length === 0 ? (
            <p className="builder-readout__foot">
              Every input this study needs is present: the land, the fit, the cost scenario and the
              project location. That is what ready for professional review means here — a designer,
              an engineer and the trades have something complete to price and check. It is not an
              approval, and nothing on this page has been checked against a building code.
            </p>
          ) : (
            <>
              <p className="builder-figure__label" data-alert="true">
                {readiness.gaps.length} thing{readiness.gaps.length === 1 ? "" : "s"} still missing
                before a professional can review this
              </p>
              <ul className="grid gap-3">
                {readiness.gaps.map((gap) => (
                  <li key={gap.id} className="builder-readout__gap">
                    <span>{gap.need}</span> <span>— {gap.where}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <p className="builder-readout__foot builder-readout__block">
        A planning range, not a quote, and a modelled check, not a permit decision. Every figure
        above recomputes from the design on screen. One check people expect is deliberately absent:
        Aura does not model a municipal minimum dwelling size, because it does not know your
        district and has not looked it up — read that off your land use bylaw.
      </p>
    </section>
  );
}

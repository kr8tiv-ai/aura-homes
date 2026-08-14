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

   MOTION. Only colour and border transitions, at the 150 ms `--motion-echo`
   Tailwind `transition-colors` already emits. Numbers that count up while you
   drag a slider are a toy; these change the instant the document does. */

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

function Check({
  name,
  verdict,
  detail,
  source,
  alert,
}: {
  name: string;
  verdict: string;
  detail: string;
  source: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 transition-colors ${
        alert ? "border-aura-violet" : "aura-hairline"
      }`}
    >
      <p className="aura-label">{name}</p>
      <p
        className={`mt-1.5 text-sm tabular-nums transition-colors ${
          alert ? "text-aura-violet" : "text-aura-text"
        }`}
      >
        {verdict}
      </p>
      <p className="mt-1 text-xs leading-snug text-aura-text/55">{detail}</p>
      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/40">
        {source}
      </p>
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
      className="rounded-xl border aura-hairline p-5"
      aria-label="Live cost and constraint read-out"
      data-readiness={readiness?.state ?? "unpriced"}
      data-readiness-gaps={readiness?.gaps.length ?? 0}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="aura-label text-aura-emerald">Live read-out</p>
        {readiness ? (
          <span
            className={`rounded-full border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-label transition-colors ${
              readiness.state === "review-ready"
                ? "border-aura-emerald text-aura-emerald"
                : "border-aura-violet text-aura-violet"
            }`}
          >
            {readiness.state === "review-ready" ? "Ready for professional review" : "Design intent"}
          </span>
        ) : null}
      </div>

      {priced.ok ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {BANDS.map((band) => (
              <div key={band.key} className="rounded-md border aura-hairline px-4 py-3">
                <p className="aura-label">{band.label}</p>
                <p className="mt-1.5 text-base tabular-nums text-aura-text transition-colors">
                  {cad(priced.budget.total[band.key])}
                </p>
                <p className="mt-1 text-xs leading-snug text-aura-text/55">
                  Includes the {priced.budget.scenario.contingencyPct}% contingency
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/40">
            createProjectBudget · {Math.round(priced.budget.areaSqFt)} sq ft ·{" "}
            {municipality || region} · confidence {priced.budget.confidence.label}
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-text/75">
          This design cannot be priced as it stands: {priced.problem}
        </p>
      )}

      {/* Stacked, not three across. This strip renders inside the builder's
          controls column, which is `minmax(22rem, …)` wide — and Tailwind's
          `sm:` tracks the viewport, not the column, so a three-across grid
          would be at its narrowest exactly where these sentences are longest.
          The money bands above stay in a row because they are three short
          numbers; these are three findings. */}
      <div className="mt-5 grid gap-3">
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
          verdict={report === null ? "Not checked" : `${(Math.round(report.coveragePct * 10) / 10).toFixed(1)}%`}
          detail={
            report === null
              ? "Attach the lot in the Site step and coverage is measured against it."
              : `Footprint over ${sqft(report.lotSqFt)} of lot. Most bylaws also count decks and covered areas, which this does not.`
          }
          source="analyseParcel · your district's own limit is not known here"
        />
        <Check
          name="Glazing"
          verdict={glazingRatio === null ? "Not modelled" : `${pct(glazingRatio)} of ${pct(FDWR_MAX)}`}
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
        <div className="mt-5 border-t aura-hairline pt-4">
          {readiness.gaps.length === 0 ? (
            <p className="max-w-3xl text-xs leading-relaxed text-aura-text/65">
              Every input this study needs is present: the land, the fit, the cost scenario and the
              project location. That is what ready for professional review means here — a designer,
              an engineer and the trades have something complete to price and check. It is not an
              approval, and nothing on this page has been checked against a building code.
            </p>
          ) : (
            <>
              <p className="aura-label text-aura-violet">
                {readiness.gaps.length} thing{readiness.gaps.length === 1 ? "" : "s"} still missing
                before a professional can review this
              </p>
              <ul className="mt-3 space-y-2">
                {readiness.gaps.map((gap) => (
                  <li key={gap.id} className="text-sm leading-relaxed text-aura-text/80">
                    <span>{gap.need}</span>{" "}
                    <span className="text-aura-text/50">— {gap.where}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <p className="mt-4 border-t aura-hairline pt-4 max-w-3xl text-xs leading-relaxed text-aura-text/55">
        A planning range, not a quote, and a modelled check, not a permit decision. Every figure
        above recomputes from the design on screen. One check people expect is deliberately absent:
        Aura does not model a municipal minimum dwelling size, because it does not know your
        district and has not looked it up — read that off your land use bylaw.
      </p>
    </section>
  );
}

"use client";

/* SCENARIO COMPARE — the Impact verb, over the engines this repo already runs.

   Two columns, a delta, and a target. That is the shape sustainability tools
   use, and it is exactly why this panel is dangerous: the same layout normally
   carries DAYLIGHT AUTONOMY, ENERGY USE INTENSITY and HEATING LOAD, and this
   build models none of them. So the not-modelled quantities are ROWS IN THE
   PANEL, in full-strength type, immediately under the figures — not a footnote,
   not a tooltip, and not greyed to the point of reading as "loading". The
   /land zoning panel already made that argument and this one keeps it:
   tests/scenarios.spec.ts measures the contrast of those rows in both themes
   so "first-class answer" is a fact about pixels rather than about intent.

   ONE SOURCE PER FACT, AND NONE OF THEM IS HERE.

   · Comfort is `comfortReport`, the same call the Comfort panel makes.
   · The glazing ratio is `modelledGlazingRatio` against `FDWR_MAX`, the same
     two values the live read-out prints, carrying the same label: a
     comparison, not a code check.
   · The cost bands are `createProjectBudget`, the same call /budget makes.
   · Every scenario is a real `BuilderDocument` with a real
     `hashBuilderDocument`, and both hashes are on screen.

   This component computes no quantity of its own. `lib/builder/scenarios.ts`
   assembles the readings and this file lays them out; every figure carries the
   name of the function that owns it, which is the read-out ladder's existing
   rule and the only reason a reader can check us.

   IT WRITES NOTHING. There is no `onEdit` here and there is no apply button:
   switching scenarios changes what is on screen and nothing else, which is the
   cheapest possible way to keep the promise that comparing changes nothing on
   disk. The base document is handed in and handed back untouched.

   TYPE. The figure cells use the builder read-out ladder — `.builder-figure__*`
   — rather than a second one, so a number in this panel has the same weight as
   the same number in the strip above it. `.scenario-*` owns layout and chrome
   only. */

import { useMemo, useState } from "react";

import type { BuilderDocument } from "@/lib/builder/document";
import type { Season } from "@/lib/builder/comfort";
import {
  compareScenarios,
  defaultScenarioCostBasis,
  SCENARIO_MOVES,
  type ScenarioCostBasis,
  type ScenarioMoveId,
  type ScenarioRow,
} from "@/lib/builder/scenarios";
import { Segmented } from "./ui";

/** Created once. A basis object rebuilt on every render would re-run two plan
 *  solves and two bills of materials per keystroke through the memo below. */
const FALLBACK_BASIS = defaultScenarioCostBasis();

const SEASONS: ReadonlyArray<{ id: Season; label: string }> = [
  { id: "winter", label: "Winter" },
  { id: "summer", label: "Summer" },
];

/** The first six characters of a keccak hash, which is how the rest of this
 *  product abbreviates one. Never the whole thing in a column head — the point
 *  is that the two columns are demonstrably different documents, and six
 *  characters carry that. */
const shortHash = (hash: string | null): string => (hash ? hash.slice(0, 8) : "—");

function Cell({
  formatted,
  qualifier,
  alert,
  side,
}: {
  formatted: string;
  qualifier?: string;
  alert: boolean;
  side: "a" | "b";
}) {
  return (
    <div className="builder-figure scenario-cell" data-side={side} data-alert={alert ? "true" : undefined}>
      <p className="builder-figure__value">
        <span>{formatted}</span>
        {qualifier ? <span className="builder-figure__qualifier">{qualifier}</span> : null}
      </p>
    </div>
  );
}

function Row({ row }: { row: ScenarioRow }) {
  /* The alert ink means one thing across the whole editor — "this is over a
     limit" — so it is spent only where a target exists and is missed, never on
     "this number went up". A delta is not a verdict. */
  const aOver = row.a.target !== null && !row.a.target.met;
  const bOver = row.b.target !== null && !row.b.target.met;
  const qualifier = row.a.target ? `of ${row.a.target.formatted}` : undefined;

  return (
    <div className="scenario-row" data-changed={row.changed ? "true" : "false"}>
      <div className="scenario-row__head">
        <p className="builder-figure__label">{row.label}</p>
        <p className="builder-figure__note">{row.note}</p>
        <p className="builder-figure__source">{row.source}</p>
      </div>
      <Cell formatted={row.a.formatted} qualifier={qualifier} alert={aOver} side="a" />
      <Cell formatted={row.b.formatted} qualifier={qualifier} alert={bOver} side="b" />
      <div className="scenario-delta">
        <p className="scenario-delta__value" data-changed={row.changed ? "true" : "false"}>
          {row.deltaFormatted}
        </p>
        {row.a.target ? (
          <p className="scenario-delta__target">
            {/* "met / not met" rather than "inside / over": the same line has to
                read correctly for a CEILING (the glazing ratio, where inside is
                good) and for a FLOOR (every modelled room meeting its comfort
                target, where more is good). "B over" was printed under both and
                was plainly wrong under the second. */}
            {row.a.target.label}
            {": "}
            {row.a.target.met ? "A met" : "A not met"} ·{" "}
            {row.b.target?.met ? "B met" : "B not met"}
          </p>
        ) : (
          <p className="scenario-delta__target">no target in this build</p>
        )}
      </div>
    </div>
  );
}

export default function ScenarioCompare({
  document,
  costBasis,
  initialA = "as-designed",
  initialB = "more-glass",
}: {
  /** the design on screen. Read, never written. */
  document: BuilderDocument;
  /** the project's own budget basis, so both columns are priced identically.
   *  Omitted, both columns use the default scenario in Alberta with no cap,
   *  and the cost row then carries no target rather than a made-up one. */
  costBasis?: ScenarioCostBasis;
  initialA?: ScenarioMoveId;
  initialB?: ScenarioMoveId;
}) {
  const [a, setA] = useState<ScenarioMoveId>(initialA);
  const [b, setB] = useState<ScenarioMoveId>(initialB);
  const [season, setSeason] = useState<Season>("winter");

  const basis = costBasis ?? FALLBACK_BASIS;

  /* Two plan solves and two bills of materials. Memoised on everything that
     can change the answer, and on nothing that cannot. */
  const comparison = useMemo(
    () => compareScenarios(document, { a, b, season, costBasis: basis }),
    [a, b, basis, document, season],
  );

  const options = SCENARIO_MOVES.map((move) => ({
    id: move.id,
    label: move.label,
    title: move.change,
  }));

  return (
    <section className="scenario" aria-label="Scenario comparison" data-season={season}>
      <div className="scenario-head">
        <p className="scenario-eyebrow">Compare two scenarios</p>
        <p className="scenario-lede">
          {/* "the panel above" was the first draft and it is a claim about
              where the orchestrator chooses to mount this component, which
              nothing here can know. Named by function instead. */}
          Two real designs, read by the same engines as the live read-out — comfortReport,
          modelledGlazingRatio and createProjectBudget — against the targets this build actually has.
          Nothing here is written to your project: switching columns changes what you are looking at
          and nothing else.
        </p>
      </div>

      <div className="scenario-controls">
        <Segmented label="Scenario A" value={a} options={options} onChange={setA} />
        <Segmented label="Scenario B" value={b} options={options} onChange={setB} />
        <Segmented label="Season" value={season} options={SEASONS} onChange={setSeason} />
      </div>

      {comparison.identical ? (
        <p className="scenario-identical">
          Both columns are the same document — identical hash {shortHash(comparison.a.hash)}. Every
          delta below is zero because there is nothing to compare yet. Pick a different move for one
          of them.
        </p>
      ) : null}

      {comparison.available ? (
        <div className="scenario-table" role="table" aria-label="Modelled figures, scenario A against scenario B">
          <div className="scenario-row scenario-row--head" role="row">
            <div className="scenario-row__head">
              <p className="builder-figure__label">What is modelled</p>
            </div>
            {([comparison.a, comparison.b] as const).map((reading, index) => (
              <div key={reading.move.id + String(index)} className="scenario-column">
                <p className="scenario-column__name">
                  {index === 0 ? "A · " : "B · "}
                  {reading.move.label}
                </p>
                <p className="builder-figure__note">{reading.move.change}</p>
                <p className="builder-figure__source">hashBuilderDocument {shortHash(reading.hash)}</p>
              </div>
            ))}
            <div className="scenario-column">
              <p className="scenario-column__name">B − A</p>
              <p className="builder-figure__note">
                The change, in the figure&rsquo;s own units. A delta is a difference, not a verdict —
                nothing here says which column is better.
              </p>
            </div>
          </div>

          {comparison.rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <p className="scenario-refusal">
          {comparison.reason ?? "This comparison could not be read for this project."}
        </p>
      )}

      {comparison.a.costProblem || comparison.b.costProblem ? (
        <p className="scenario-refusal">
          One of these scenarios could not be priced, so the cost rows are absent rather than
          estimated: {comparison.a.costProblem ?? comparison.b.costProblem}
        </p>
      ) : null}

      {/* ==================================================== NOT MODELLED

          The reason this panel exists in this shape. These are rows, at the
          same type weight as the figures above, because a reader who came for
          a daylight or an energy number must leave knowing this build does not
          have one — and must not be able to mistake silence for a good result.
          The contrast of this block is measured in tests/scenarios.spec.ts. */}
      <div className="scenario-absent">
        <p className="scenario-absent__title">
          Not modelled — {comparison.notModelled.length} things this comparison does not answer
        </p>
        <p className="scenario-absent__lede">
          These are the figures a sustainability comparison is usually expected to carry. Aura does
          not model any of them, and an estimate with no physics behind it is the most convincing
          wrong answer this tool could give — so they are named here instead.
        </p>
        <ul className="scenario-absent__list">
          {comparison.notModelled.map((entry) => (
            <li key={entry.id} className="scenario-absent__item">
              <p className="scenario-absent__label">{entry.label}</p>
              <p className="scenario-absent__why">{entry.why}</p>
              <p className="scenario-absent__needs">
                <span>An honest answer would need</span> {entry.needs}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="scenario-foot">{comparison.disclaimer}</p>
    </section>
  );
}

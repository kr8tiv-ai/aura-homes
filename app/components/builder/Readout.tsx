"use client";

/* THE READ-OUT — the numbers, live, while the sliders are still moving.

   Every figure here comes from a helper that already OWNS its definition:
   `totalFloorAreaSqFt`, `groundFootprintSqFt`, `glazedAreaSqFt` and
   `ridgeHeightFt` from `lib/builder/spec.ts` (forwarded on the site summary so
   there is one call and one source), the glazing ratio from
   `lib/builder/toPlan.ts`, the 22% ceiling from `lib/design/materials.ts`.
   Nothing on this panel is multiplied out inline. That rule is the reason the
   number on the screen and the number on the drawing can never disagree.

   The warnings are not a failure state. A model that reports an opening it had
   to trim, or two volumes sitting on the same ground, is a model telling the
   truth about what you built — the same posture the design page takes with the
   layout engine's own warnings.

   TYPE (ED01). The panel prints four things per cell and they are four
   different KINDS of thing, so they are four tiers rather than three greys:
   the figure, what it measures, the sentence, and the helper that owns it.
   The helper used to be run into the sentence — `totalFloorAreaSqFt —
   footprint × storeys` — which put an identifier and an explanation in one
   size, one colour and one face. The live strip beside this one already
   separated them; `.builder-figure__*` in globals.css is now that separation
   for both, and tests/builder-craft.spec.ts measures the order rather than
   asserting it in a comment. */

import type { ReactNode } from "react";

import { FDWR_MAX } from "@/lib/design";
import { feetInches, sqft } from "@/components/design/ecoSpec";
import type { SiteSummary } from "@/lib/builder/geometry";
import { modelledGlazingRatio, modelledWallAreaSqFt } from "@/lib/builder/toPlan";
import type { HomeSpec } from "@/lib/builder/spec";
import { Notice } from "./ui";

const pct = (r: number): string => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;

/** One cell of the instrument. `source` is the helper that owns the number —
 *  never prose, never optional: a figure whose origin is unnamed is the one
 *  kind of number this product does not print. */
function Figure({
  label,
  value,
  qualifier,
  note,
  source,
  alert,
}: {
  label: string;
  value: ReactNode;
  qualifier?: ReactNode;
  note: ReactNode;
  source: string;
  alert?: boolean;
}) {
  return (
    <div className="builder-figure" data-alert={alert ? "true" : undefined}>
      <p className="builder-figure__label">{label}</p>
      <p className="builder-figure__value">
        <span>{value}</span>
        {qualifier ? <span className="builder-figure__qualifier">{qualifier}</span> : null}
      </p>
      <p className="builder-figure__note">{note}</p>
      <p className="builder-figure__source">{source}</p>
    </div>
  );
}

export default function Readout({
  spec,
  summary,
  warnings,
}: {
  spec: HomeSpec;
  summary: SiteSummary;
  warnings: readonly string[];
}) {
  const ratio = modelledGlazingRatio(spec);
  const wallArea = modelledWallAreaSqFt(spec);
  const over = ratio > FDWR_MAX;
  const storeys = spec.volumes.some((v) => v.storeys === 2) ? 2 : 1;

  return (
    /* `.stack` is the site's own modular rhythm (--space-5), not a Tailwind
       number picked for this panel. */
    <div className="stack">
      <div className="builder-figures" data-columns="3">
        <Figure
          label="Floor area"
          value={sqft(summary.totalFloorAreaSqFt)}
          note={`Footprint × storeys, over ${summary.volumes.length} volume${
            summary.volumes.length === 1 ? "" : "s"
          }`}
          source="totalFloorAreaSqFt"
        />
        <Figure
          label="Ground footprint"
          value={sqft(summary.groundFootprintSqFt)}
          note={
            summary.hasOverlap
              ? `Over-reported by ${sqft(summary.overlapAreaSqFt)} — your volumes overlap`
              : "What the buildable envelope on your lot has to contain"
          }
          source="groundFootprintSqFt"
          alert={summary.hasOverlap}
        />
        <Figure
          label="Tallest ridge"
          value={feetInches(summary.maxRidgeHeightFt)}
          note={`Above finished floor · ${storeys === 2 ? "two storeys" : "single storey"} — the number to take to your district`}
          source="maxRidgeHeightFt"
        />
        <Figure
          label="Glazing"
          value={sqft(summary.glazedAreaSqFt)}
          note="Windows and glazing walls, doors excluded"
          source="glazedAreaSqFt"
        />
        <Figure
          label="Glazing ratio"
          value={pct(ratio)}
          qualifier={`of ${pct(FDWR_MAX)}`}
          note={`Your glass over ${sqft(wallArea)} of modelled wall. A comparison against the NBC 9.36 prescriptive ceiling, not a code check`}
          source="modelledGlazingRatio · FDWR_MAX"
          alert={over}
        />
        <Figure
          label="Site extent"
          value={`${feetInches(summary.boundsWithRoof.widthFt)} × ${feetInches(summary.boundsWithRoof.depthFt)}`}
          note="East–west by north–south, eave overhangs included — the line a projection limit measures"
          source="boundsWithRoof"
        />
      </div>

      {over ? (
        /* A rule, not a second violet box. The warning list below this is
           already a bordered violet panel, and two of them stacked make the
           page shout twice about two different things. */
        <div className="builder-readout__refusal">
          <p className="builder-figure__label">
            Glazing is above the {pct(FDWR_MAX)} prescriptive ceiling
          </p>
          <p>
            Nothing has been trimmed — the builder draws what you asked for. On the NBC 9.36
            prescriptive path {pct(FDWR_MAX)} is the limit, and buying the glass back above it means
            a performance-path energy model. The denominator here is rough (perimeter × wall height
            × storeys, with no deduction where volumes meet), so read it as the conversation to have
            rather than as a verdict.
          </p>
        </div>
      ) : null}

      <Notice
        title={`${warnings.length} thing${warnings.length === 1 ? "" : "s"} the model could not build faithfully`}
        items={warnings}
        foot="These come from the geometry itself, not from a rule about taste. An opening that falls off its wall still counts toward the glazed area above, which is why it is named here instead of quietly disappearing."
      />
    </div>
  );
}

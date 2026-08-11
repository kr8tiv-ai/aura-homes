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
   layout engine's own warnings. */

import { FDWR_MAX } from "@/lib/design";
import { feetInches, sqft } from "@/components/design/ecoSpec";
import type { SiteSummary } from "@/lib/builder/geometry";
import { modelledGlazingRatio, modelledWallAreaSqFt } from "@/lib/builder/toPlan";
import type { HomeSpec } from "@/lib/builder/spec";
import { Notice, Stat } from "./ui";

const pct = (r: number): string => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;

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
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          k="Floor area"
          v={sqft(summary.totalFloorAreaSqFt)}
          sub={`totalFloorAreaSqFt — footprint × storeys, over ${summary.volumes.length} volume${
            summary.volumes.length === 1 ? "" : "s"
          }`}
        />
        <Stat
          k="Ground footprint"
          v={sqft(summary.groundFootprintSqFt)}
          sub={
            summary.hasOverlap
              ? `Over-reported by ${sqft(summary.overlapAreaSqFt)} — your volumes overlap`
              : "What the buildable envelope on your lot has to contain"
          }
        />
        <Stat
          k="Tallest ridge"
          v={feetInches(summary.maxRidgeHeightFt)}
          sub={`Above finished floor · ${storeys === 2 ? "two storeys" : "single storey"} — the number to take to your district`}
        />
        <Stat
          k="Glazing"
          v={sqft(summary.glazedAreaSqFt)}
          sub="glazedAreaSqFt — windows and glazing walls, doors excluded"
        />
        <Stat
          k="Glazing ratio"
          v={
            <span className={over ? "text-aura-violet" : undefined}>
              {pct(ratio)} <span className="text-aura-text/45">of {pct(FDWR_MAX)}</span>
            </span>
          }
          sub={`Your glass over ${sqft(wallArea)} of modelled wall. A comparison against the NBC 9.36 prescriptive ceiling, not a code check`}
        />
        <Stat
          k="Site extent"
          v={`${feetInches(summary.boundsWithRoof.widthFt)} × ${feetInches(summary.boundsWithRoof.depthFt)}`}
          sub="East–west by north–south, eave overhangs included — the line a projection limit measures"
        />
      </div>

      {over ? (
        <div className="rounded-xl border border-aura-violet p-5">
          <p className="aura-label text-aura-violet">
            Glazing is above the {pct(FDWR_MAX)} prescriptive ceiling
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
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

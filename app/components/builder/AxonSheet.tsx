"use client";

/* ===========================================================================
   THE AXONOMETRIC SHEET — the 3/4 view, as line art, on the page.

   `lib/builder/drawings/` draws the plans, elevations and sections from
   arithmetic: those sheets carry true dimensions because the generator knows
   what every line MEANS. This one is different in kind. A three-quarter view
   has no closed form — which line you can see depends on every solid in the
   model at once — so `lib/builder/axon.ts` computes it, by projecting the
   model and removing the hidden segments.

   WHY AN <img> AND NOT INLINE SVG. Exactly the reason `DrawingSheets.tsx`
   gives, and for the same threat: the sheet letters a project name that can
   arrive from a share link, which is untrusted text from a URL. Rendered
   through `<img src="data:image/svg+xml,…">` the SVG is an isolated,
   script-disabled document, which closes that door completely. The cost is
   that the page's theme tokens do not reach it, and `axon.ts`'s pen chain
   already anticipates that: standalone it falls back to white paper and black
   ink, which is what a drawing should be anyway.

   WHY `useDeferredValue`. The pass costs roughly 22 ms on the reference home
   (measured; see the module header, including why that figure is a floor and
   not a benchmark). That is nothing for a drawing generated
   on demand and far too much to run on every frame of a slider drag. Deferring
   the model lets React finish the drag at full speed and redraw the
   axonometric when it has a moment — the drawing lags a beat behind the
   massing, which is the correct trade and is visible as such rather than as a
   stutter.

   OWNERSHIP. The geometries inside `home` belong to whoever called
   `buildHome`. This component only READS them, and it holds no reference past
   the render, so the owner is free to `disposeHome` as usual.
   =========================================================================== */

import { useDeferredValue, useMemo, useState } from "react";
import {
  AXON_PRESET_IDS,
  AXON_PRESET_LABELS,
  AXON_STAMP,
  axonometricDataUrl,
  axonometricFromHome,
  type AxonPreset,
} from "@/lib/builder/axon";
import type { HomeGeometry } from "@/lib/builder/geometry";
import { Notice, Segmented } from "./ui";

/** Filesystem-safe download name. Same rule as `DrawingSheets.tsx` so a set
 *  downloaded together lands in one alphabetical block. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "home";

export default function AxonSheet({
  home,
  name,
  className = "",
}: {
  home: HomeGeometry;
  /** the project name, lettered on the sheet. Escaped by `axon.ts`. */
  name: string;
  className?: string;
}) {
  const [preset, setPreset] = useState<AxonPreset>("iso");
  const [showHidden, setShowHidden] = useState(false);
  const [showStats, setShowStats] = useState(false);

  /* The drag stays at full speed; the drawing catches up. */
  const deferred = useDeferredValue(home);
  const stale = deferred !== home;

  const result = useMemo(
    () =>
      axonometricFromHome(deferred, {
        view: preset,
        showHidden,
        title: name || "Aura home",
        subtitle: AXON_PRESET_LABELS[preset].hint,
      }),
    [deferred, preset, showHidden, name],
  );

  const href = axonometricDataUrl(result.svg);

  return (
    <section className={`aura-panel p-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="aura-label">The axonometric</p>
        <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
          {result.stats.visibleSegments} lines · hidden lines removed
        </p>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
        A three-quarter view of the whole home, drawn as vector line art with everything you cannot
        see from here taken out. It is the one drawing in the set that is computed rather than
        derived, because which lines are visible depends on the whole model at once. It carries no
        dimensions on purpose — the plan and the elevations are the measured drawings, and this one
        says so on its face.
      </p>

      {/* ------------------------------------------------------- the controls */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Segmented
          label="Point of view"
          value={preset}
          onChange={setPreset}
          options={AXON_PRESET_IDS.map((id) => ({
            id,
            label: AXON_PRESET_LABELS[id].label,
            title: AXON_PRESET_LABELS[id].hint,
          }))}
          hint={AXON_PRESET_LABELS[preset].hint}
        />
        <label className="flex items-center gap-2.5 pb-1 text-xs text-aura-text/70">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="h-3.5 w-3.5 rounded-sm accent-aura-emerald"
          />
          <span>Show the removed lines, dashed</span>
        </label>
      </div>

      {/* ---------------------------------------------------------- the sheet */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-xs text-aura-text/55">{result.viewLabel}</p>
        <a
          href={href}
          download={`aura-${slug(name)}-axonometric-${preset}.svg`}
          data-cursor="Download"
          className="rounded-full border border-aura-teal px-4 py-1.5 font-mono text-xs uppercase tracking-label text-aura-teal transition-colors hover:bg-aura-teal/5"
        >
          Download SVG
        </a>
      </div>

      <div
        className={`mt-4 overflow-x-auto rounded-lg border aura-hairline transition-opacity ${
          stale ? "opacity-50" : "opacity-100"
        }`}
      >
        {/* A drawing is a DOCUMENT — white paper, black ink — so it is shown as
            drawn rather than recoloured by the theme. next/image would want to
            optimise a data URL it cannot read. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={`Axonometric line drawing of ${name || "the home"}, ${result.viewLabel.toLowerCase()}. Generated from the model with hidden lines removed. ${AXON_STAMP[1]}`}
          className="block h-auto w-full min-w-[36rem] bg-white"
        />
      </div>

      {result.warnings.length > 0 ? (
        <div className="mt-4">
          <Notice
            title={`${result.warnings.length} thing${result.warnings.length === 1 ? "" : "s"} this drawing could not do faithfully`}
            items={result.warnings}
          />
        </div>
      ) : null}

      {/* ------------------------------------------------- what the pass did

          A drawing that cannot be checked is a picture. These are the numbers
          a reader would need to tell "the pass removed 1,064 lines" from "the
          pass did nothing and the model is simple". */}
      <div className="mt-5 border-t aura-hairline pt-4">
        <button
          type="button"
          onClick={() => setShowStats((v) => !v)}
          aria-expanded={showStats}
          data-cursor="Select"
          className="aura-label text-aura-text/60 transition-colors hover:text-aura-text"
        >
          {showStats ? "Hide" : "Show"} what the hidden-line pass did
        </button>
        {showStats ? (
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs text-aura-text/65 sm:grid-cols-2">
            {(
              [
                ["Meshes read", result.stats.meshes],
                ["Triangles", result.stats.triangles],
                ["Vertices, welded from", `${result.stats.weldedVertices} of ${result.stats.rawVertices}`],
                ["Edges examined", result.stats.edges],
                ["Drawn: outline / junction / crease", `${result.stats.silhouette} / ${result.stats.boundary} / ${result.stats.crease}`],
                ["Cut into runs", `${result.stats.runsBeforeMerge} at ${result.stats.splitPoints} crossings`],
                ["Merged to strokes", `${result.stats.visibleSegments} visible, ${result.stats.hiddenSegments} hidden`],
                ["Bin grid", `${result.stats.gridCells} cells, ${result.stats.oversizedTriangles} oversized`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b aura-hairline py-1">
                <dt>{k}</dt>
                <dd className="tabular-nums text-aura-text/85">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

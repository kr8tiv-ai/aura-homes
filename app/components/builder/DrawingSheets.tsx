"use client";

/* ===========================================================================
   THE SET — eight sheets, drawn from the same HomeSpec.

   `lib/builder/toPlan.ts` hands the model to the plan engine and gets back a
   floor plan of a rectangle. `lib/builder/drawings/` does something different
   and complementary: it draws the model ITSELF — the site, the piles, the roof
   plan, all four elevations, a building section and the schedules — so the
   things a floor plan structurally cannot carry are not simply lost.

   WHY BOTH ARE ON THE PAGE, in this order. The plan engine's sheet is the one
   with a solved ROOM PROGRAM in it, and the honest account of what that
   translation cost is the thing this product exists to publish. The drawing
   set is the one with the ROOF, the GLAZING WALL and the MASSING on it. Read
   together they are the whole truth about the same house; either one alone is
   a partial view, and the copy here says which is which rather than leaving
   somebody to notice that two drawings of their home disagree.

   WHY AN <img> AND NOT INLINE SVG. A sheet carries a project name that can
   arrive from a share link — untrusted text from a URL. Rendered through
   `<img src="data:image/svg+xml,…">` the SVG is an isolated, script-disabled
   document, which closes that door completely. The cost is that the page's
   theme tokens do not reach it, and the drawing kit already anticipated
   exactly this: standalone it falls back to white paper and black ink, which
   is what a drawing should be anyway.
   =========================================================================== */

import { useState } from "react";
import {
  PROFESSIONAL_NOTE,
  drawingDataUrl,
  type DrawingSetResult,
} from "@/lib/builder/drawings";
import { Notice } from "./ui";

/** Filesystem-safe download name. Deliberately simpler than the exporters'
 *  slug in `exportSpec.ts` — that one strips accents to keep the base letter,
 *  which needs a combining-mark range written into the source; here an accent
 *  just becomes a hyphen, which is fine for a filename and leaves no invisible
 *  characters in this file. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "home";

export default function DrawingSheets({
  set,
  name,
  dateISO,
}: {
  set: DrawingSetResult;
  name: string;
  /** the issue date printed in every title block, passed in so the set is
   *  reproducible — the drawing module refuses to read a clock itself */
  dateISO: string;
}) {
  const [current, setCurrent] = useState(0);
  const sheet = set.sheets[current] ?? set.sheets[0];
  if (!sheet) return null;

  const href = drawingDataUrl(sheet.svg);

  return (
    <section className="aura-panel mt-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="aura-label">The drawing set — {set.sheets.length} sheets</p>
        <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
          Issued {dateISO} · not sealed
        </p>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
        These are drawn from your model directly rather than from the plan engine&rsquo;s rectangle,
        so the roof, the openings and the massing you built are all on them — the note above about
        the roof not reaching the drawing is about the FLOOR PLAN, which structurally has no roof in
        it. A coordinated starting set: drawn to a stated scale, dimensioned, and scheduled, so a
        professional can review and correct it quickly instead of starting from a blank sheet.
      </p>

      {/* --------------------------------------------------------- the index */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {set.sheets.map((s, i) => {
          const on = i === current;
          return (
            <button
              key={s.number}
              type="button"
              onClick={() => setCurrent(i)}
              aria-pressed={on}
              data-cursor="Select"
              className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                on ? "border-aura-emerald text-aura-text" : "aura-hairline text-aura-text/60 hover:text-aura-text"
              }`}
            >
              <span className="block font-mono text-[0.65rem] tracking-label">{s.number}</span>
              <span className="mt-0.5 block text-[0.7rem] text-aura-text/60">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------- the sheet */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-aura-text">
          {sheet.number} · {sheet.title}
          <span className="ml-3 font-mono text-xs text-aura-text/55">{sheet.scale}</span>
        </p>
        <a
          href={href}
          download={`aura-${slug(name)}-${sheet.number}.svg`}
          data-cursor="Download"
          className="rounded-full border border-aura-teal px-4 py-1.5 font-mono text-xs uppercase tracking-label text-aura-teal transition-colors hover:bg-aura-teal/5"
        >
          Download {sheet.number}
        </a>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border aura-hairline">
        {/* The sheet is a DOCUMENT — white paper, black ink — so it is shown as
            drawn rather than recoloured by the theme. next/image would want to
            optimise a data URL it cannot read. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={`Sheet ${sheet.number}, ${sheet.title}, at ${sheet.scale}. Generated from the model — not sealed, not for construction.`}
          className="block h-auto w-full min-w-[44rem] bg-white"
        />
      </div>

      {sheet.notes.length > 0 ? (
        <div className="mt-4 rounded-md border aura-hairline p-4">
          <p className="aura-label">What {sheet.number} names as missing or assumed</p>
          <ul className="mt-3 space-y-2">
            {sheet.notes.map((n) => (
              <li key={n} className="flex gap-3 text-xs leading-relaxed text-aura-text/70">
                <span aria-hidden className="text-aura-teal">
                  ·
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {set.warnings.length > 0 ? (
        <div className="mt-4">
          <Notice
            title={`${set.warnings.length} thing${set.warnings.length === 1 ? "" : "s"} the drawing engine had to clamp, cut or refuse`}
            items={set.warnings}
          />
        </div>
      ) : null}

      {/* --------------------------------------------- who finishes this set */}
      <div className="mt-6 border-t aura-hairline pt-5">
        <p className="aura-label">Who completes this set</p>
        <div className="mt-3 space-y-3">
          {PROFESSIONAL_NOTE.map((p) => (
            <p key={p} className="max-w-3xl text-xs leading-relaxed text-aura-text/65">
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

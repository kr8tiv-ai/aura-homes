"use client";

/* ===========================================================================
   THE DRAWING, AND WHAT IT COST.

   This is the moment the product promises: the same object you have been
   dragging sliders on goes through `lib/builder/toPlan.ts` into the same
   deterministic engine the design page uses, and a dimensioned sheet at
   1/4" = 1'-0" comes back.

   TWO HALVES, AND THE SECOND ONE IS NOT OPTIONAL.

   · The sheet itself is rendered by `components/design/DesignResult` — the
     SAME component the design page uses, given the same `DesignResponse`.
     Reused rather than rebuilt, so the drawing, the room schedule, the
     envelope figures and the NOT-FOR-CONSTRUCTION stamp cannot drift between
     the two pages. `engine="local"` is not decoration: it is why an absent PDF
     is explained as a property of the browser path rather than blamed on a
     service nobody called.

   · The account of the translation is rendered here, ABOVE the drawing, and
     it leads with what was LOST. The builder can express an L of two volumes
     with five roof forms, a glazing wall and a hot tub; the plan engine can
     express one rectangle with rooms in it. Handing somebody a drawing of a
     rectangle after they built an L — with no word about it — is worse than
     handing them nothing, because a drawing is believed.

   Nothing on this page is a permit set, a structural check or an energy
   model. That sentence appears next to the button that produces this, not
   only here.
   =========================================================================== */

import DesignResult from "@/components/design/DesignResult";
import type { HandoffKind, HandoffNote, PlanHandoff } from "@/lib/builder/toPlan";

/** Loudest first — the order `toPlan.ts` already sorted them into. */
const KIND_STYLE: Record<
  HandoffKind,
  { tag: string; border: string; text: string; blurb: string }
> = {
  blocked: {
    tag: "Blocked",
    border: "border-aura-violet",
    text: "text-aura-violet",
    blurb: "No drawing was produced, and nothing has been quietly resized to make one appear.",
  },
  lost: {
    tag: "Lost",
    border: "border-aura-violet",
    text: "text-aura-violet",
    blurb: "Something you built is NOT in the drawing.",
  },
  assumed: {
    tag: "Assumed",
    border: "aura-hairline",
    text: "text-aura-teal",
    blurb: "The drawing contains something you never said, because the engine required it.",
  },
  carried: {
    tag: "Carried",
    border: "aura-hairline",
    text: "text-aura-emerald",
    blurb: "Crossed unchanged.",
  },
};

function Note({ note }: { note: HandoffNote }) {
  const s = KIND_STYLE[note.kind];
  return (
    <div className={`rounded-xl border ${s.border} p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-aura-text">{note.title}</p>
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label ${s.text} ${
            note.kind === "carried"
              ? "border-aura-emerald"
              : note.kind === "assumed"
                ? "border-aura-teal"
                : "border-aura-violet"
          }`}
        >
          {s.tag}
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/75">{note.detail}</p>
      {note.figures && note.figures.length > 0 ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {note.figures.map((f) => (
            <div key={`${note.id}-${f.k}`} className="rounded-md border aura-hairline px-4 py-3">
              <dt className="aura-label">{f.k}</dt>
              <dd className="mt-1.5 text-sm tabular-nums text-aura-text">{f.v}</dd>
              {f.sub ? (
                <dd className="mt-1 text-xs leading-snug text-aura-text/55">{f.sub}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export default function PlanSheet({ handoff }: { handoff: PlanHandoff }) {
  const counts = handoff.notes.reduce<Record<HandoffKind, number>>(
    (acc, n) => ({ ...acc, [n.kind]: acc[n.kind] + 1 }),
    { blocked: 0, lost: 0, assumed: 0, carried: 0 },
  );

  return (
    <div className="mt-8 space-y-6">
      {/* ------------------------------------------- the honest account */}
      <section className="aura-panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="aura-label">What the translation cost</p>
          <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
            {counts.blocked > 0 ? `${counts.blocked} blocked · ` : ""}
            {counts.lost} lost · {counts.assumed} assumed · {counts.carried} carried
          </p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
          The 3D model above is the truth about the massing. The sheet below is a layout study of
          the same floor area, drawn by an engine that solves ONE rectangle. Everything the trip
          cost is itemised here, loudest first, with the numbers on both sides — because a drawing
          is believed, and an unstated gap between the two is the one thing this tool refuses to
          ship.
        </p>
        <div className="mt-5 space-y-4">
          {handoff.notes.map((n) => (
            <Note key={n.id} note={n} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ the brief sent */}
      <section className="aura-panel p-6">
        <p className="aura-label">The brief the engine was given</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
          Your model does not contain a questionnaire — a box 34 feet wide does not say who sleeps
          in it — so the bedroom and bathroom counts below were inferred from the floor area and the
          number of masses. The rule is printed in full in the &ldquo;assumed&rdquo; note above.
          Change the model and this changes with it.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "Bedrooms", v: String(handoff.request.bedrooms) },
            { k: "Bathrooms", v: String(handoff.request.bathrooms) },
            { k: "Total floor area", v: `${Math.round(handoff.totalFloorAreaSqFt)} sq ft` },
            { k: "Storeys", v: String(handoff.request.storeys ?? 1) },
            { k: "Style", v: (handoff.request.style ?? "").replace(/_/g, " ") },
            { k: "Material", v: (handoff.request.material ?? "").replace(/_/g, " ") },
            { k: "Climate zone", v: handoff.request.climate_zone ?? "" },
            { k: "Off grid", v: handoff.request.off_grid ? "yes" : "no" },
          ].map((f) => (
            <div key={f.k} className="rounded-md border aura-hairline px-4 py-3">
              <dt className="aura-label">{f.k}</dt>
              <dd className="mt-1.5 text-sm tabular-nums text-aura-text">{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------- the sheet itself */}
      {handoff.response ? (
        <DesignResult res={handoff.response} engine="local" />
      ) : (
        <section className="rounded-xl border border-aura-violet p-6">
          <p className="aura-label text-aura-violet">No drawing was produced</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
            {handoff.error
              ? `The plan engine threw rather than drawing, and the message is printed verbatim: "${handoff.error}". Everything above still describes your model.`
              : "The blocked note above says why, in words. Nothing was substituted for the missing drawing — a rectangle with negative room areas printed on it reads as a drawing and is not one."}
          </p>
        </section>
      )}
    </div>
  );
}

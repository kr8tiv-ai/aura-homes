"use client";

/* THE INLINE WHY — one sentence, sourced, beside the control it explains.
 *
 * GQ02 in one component. A beginner making a decision they have never made
 * before does not need a manual; they need the reason for THIS control, here,
 * in a sentence, with the thing that reason came from named underneath. That
 * is the whole surface: a label, a sentence, a provenance line.
 *
 * THIS COMPONENT OWNS NO WORDS. Every sentence comes from
 * `lib/builder/guidance.ts`, which is pure and therefore testable — the point
 * of putting the content in a module instead of in JSX is that a spec can
 * assert a claim is sourced. A sentence written inline here could not be
 * checked by anything.
 *
 * WHEN IT RENDERS NOTHING. `explain` returns `null` when the fact it would
 * state cannot be traced to a source for this document, and this component
 * then renders nothing at all. Saying nothing is the correct output; a
 * placeholder ("no guidance available") would be a sentence about Aura where
 * the person wanted a sentence about their home.
 *
 * QUIET BY CONSTRUCTION. No card, no icon, no colour that pulls the eye — a
 * hairline down the left, dim text, and the source in the same micro-mono the
 * live read-out already uses for provenance. The only motion is colour, bound
 * to `--motion-echo` so `prefers-reduced-motion` (which zeroes the token)
 * stills it at the source rather than needing its own rule.
 */

import type { CSSProperties } from "react";

import type { BuilderDocument } from "@/lib/builder/document";
import { explain, type GuidanceTopic } from "@/lib/builder/guidance";

/* Bound to the token rather than to Tailwind's default 150 ms, which merely
   happens to equal it today. `--motion-echo` is the surface answering where it
   stands: nothing travels, so nothing needs time to arrive. */
const ECHO: CSSProperties = {
  transitionDuration: "var(--motion-echo)",
  transitionTimingFunction: "var(--motion-ease)",
};

export default function GuidanceNote({
  topic,
  document,
  className = "",
}: {
  topic: GuidanceTopic;
  /** The live builder document. The sentence is about THIS home or it is not
   *  worth reading. */
  document: BuilderDocument;
  className?: string;
}) {
  const explanation = explain(topic, document);
  if (explanation === null) return null;

  const { source, standing } = explanation;
  /* `null` here means no target was modelled, which is a different statement
     from "compared and failed". Flattening the two would be exactly the lie
     this module exists to prevent, so the attribute keeps three states. */
  const withinTarget = explanation.measurement?.withinTarget ?? null;

  return (
    <div
      className={`mt-2 border-l aura-hairline pl-3 transition-colors ${className}`}
      style={ECHO}
      data-guidance-topic={explanation.topic}
      data-guidance-standing={standing}
      data-guidance-source-kind={source.kind}
      data-guidance-within-target={withinTarget === null ? "no-target" : String(withinTarget)}
    >
      <p className="aura-label">{explanation.title}</p>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-aura-text/70 transition-colors" style={ECHO}>
        {explanation.sentence}
      </p>
      {/* Provenance, always, in two registers. The standing and the module go
          in the micro-mono the live read-out already uses for a source line,
          because those are scanned rather than read. The authority is a clause
          in ordinary case underneath — set in tracked capitals it would be a
          wall of tiny type, and the one thing this note must never become is
          loud. The standing LEADS: "not modelled" is what a person needs
          before they decide how much to trust the sentence above it. */}
      <p className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/40">
        {standing === "checked" ? "Checked here" : "Not modelled"} · {source.module}
      </p>
      <p className="mt-0.5 max-w-prose text-[0.65rem] leading-snug text-aura-text/45">
        {source.authority}
      </p>
    </div>
  );
}

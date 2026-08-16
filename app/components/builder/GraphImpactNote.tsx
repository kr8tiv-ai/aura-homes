"use client";

/* PR03 — the performance panel that is honest about what it is not.

   Cost bands and FDWR already live in LiveReadout. This list is the other
   half: the four quantities Chaos's Impact product sells, which Aura does
   not model. The sentences come from `NOT_MODELLED` in scenarios.ts. */

import { NOT_MODELLED } from "@/lib/builder/scenarios";

export function GraphImpactNote() {
  return (
    <aside className="rounded-xl border aura-hairline px-4 py-3">
      <p className="aura-label">Not modelled</p>
      <ul className="mt-2 space-y-2">
        {NOT_MODELLED.map((entry) => (
          <li key={entry.id} className="text-xs leading-relaxed text-aura-text/70">
            <span className="font-medium text-aura-text/85">{entry.label}.</span> {entry.why}
          </li>
        ))}
      </ul>
    </aside>
  );
}

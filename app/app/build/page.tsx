"use client";

/* 03 · BUILD — the parametric home builder.

   WHAT THIS PAGE IS. You compose a home out of rectangular volumes with real
   roofs and real openings, watch it in 3D as you go, and then hand the SAME
   object to the deterministic plan engine that already emits a dimensioned
   architectural drawing. The toy and the drawing are one object. That is the
   entire point, and everything on the page is arranged around protecting it:
   the read-out reads spec.ts's own helpers, the 3D view is built from the same
   spec, and the drawing step publishes an itemised account of everything the
   translation cost rather than letting the sheet imply more than it knows.

   WHY THE EDITOR IS A DYNAMIC, CLIENT-ONLY IMPORT. three.js, the geometry
   builder and the drafting engine are a few hundred kilobytes that nobody
   reading the paragraph below needs yet, and the model is built with real
   BufferGeometry — work that has no business happening during a server render
   of a static export. `ssr: false` is the same pattern the story landing page
   uses for its canvas.

   THE HONESTY POLICY. This is a massing and layout tool. It is not a
   structural design, not an energy model, and not a permit set. That sentence
   appears here, again beside the Generate button, and inside every file the
   builder exports — because a recipient who is emailed a .glb never saw this
   page. */

import dynamic from "next/dynamic";
import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal } from "@/components/Reveal";

const BuilderApp = dynamic(() => import("@/components/builder/BuilderApp"), {
  ssr: false,
  loading: () => (
    <div className="mt-10 space-y-6">
      <div className="aspect-[16/10] min-h-[20rem] w-full animate-pulse rounded-xl border aura-hairline bg-aura-sunken" />
      <p className="aura-label animate-pulse">Loading the builder</p>
    </div>
  ),
});

export default function BuildPage() {
  return (
    <div className="builder-page py-8 sm:py-10">
      <header className="builder-page__intro grid gap-6 border-b aura-hairline pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.52fr)] lg:items-end">
        <div>
          <Reveal y={8}>
            <p className="builder-page__eyebrow aura-label mb-3">03 · Build</p>
          </Reveal>
          <RevealWords
            text="Design your cabin."
            className="builder-page__title max-w-4xl font-display text-[clamp(2rem,4vw,3.7rem)] font-medium leading-[0.98] tracking-[-0.045em]"
          />
        </div>
        <Reveal delay={0.1} y={10}>
          <div className="builder-page__summary">
            <p className="max-w-xl text-sm leading-relaxed text-aura-text/68">
              Work in model or plan. One local project carries the geometry, rooms, finishes,
              fixtures, comfort targets, exports, and quote handoff.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-aura-text/50">
              Design intent only—not structural, energy, manufacturing, or permit compliance. A
              licensed professional completes the build set. Prefer a guided start? Use the{" "}
              <Link href="/design" className="text-aura-teal underline-offset-4 hover:underline">
                questionnaire
              </Link>
              .
            </p>
          </div>
        </Reveal>
      </header>

      <div className="builder-page__workspace mt-6">
        <BuilderApp />
      </div>
    </div>
  );
}

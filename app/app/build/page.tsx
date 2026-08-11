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
    <div className="py-16">
      <Reveal y={10}>
        <p className="aura-label mb-4">03 · Build</p>
      </Reveal>
      <RevealWords
        text="Build the home, then take the drawing"
        className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
      />
      <Reveal delay={0.12} y={12}>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-aura-text/75">
          Compose your home out of rectangular volumes with real roofs, real openings and the
          floor-to-eave glass wall that makes a Nordic home a Nordic home. Move the sun and watch
          what the overhang does in June and what the low winter light does through the south
          glazing. Switch to the plan and push one wall, drag a corner, slide a window or draw the
          interior partitions yourself — it is the same home, from above, and an edit in either
          view is an edit in both. Click a surface in the model to say what it is made of, and put
          the wood stove in — it tells you what has to stay clear around it before a wall is in the
          way. When it is yours, the <span className="text-aura-text/90">Drawings</span> tab turns
          the same object into a dimensioned floor plan with a room schedule — and an itemised
          account of everything the translation had to drop.
        </p>
      </Reveal>
      <Reveal delay={0.18} y={12}>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-aura-text/55">
          Then take it with you: a DXF a drafter opens in any CAD program — written, read back by a
          separate parser and checked against your model before it will download — an IFC a designer
          imports into Revit or ArchiCAD as a building rather than a shape, ifcJSON and glTF for a
          browser or a script, or the HomeSpec itself. Your designs are saved in this browser, with
          no account and nothing sent anywhere. A massing and layout tool — not a structural design,
          not an energy model, and not a permit set. Everything runs in this browser: no account, no
          server, no key. Already answered the{" "}
          <Link href="/design" className="text-aura-teal underline-offset-4 hover:underline">
            design questionnaire
          </Link>
          ? That path asks how many bedrooms you want; this one asks what shape the house is.
        </p>
      </Reveal>

      <div className="mt-12">
        <BuilderApp />
      </div>
    </div>
  );
}

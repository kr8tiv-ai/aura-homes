/* B-P1 — "Use this plot" on /land.
 *
 * The action has two halves and this spec pins both: the arithmetic that
 * turns a listing into a site (components/land/plotSite.ts), and the write
 * that puts that site under the project's design (lib/project/document.ts).
 * Neither needs a browser, so this runs in the same server-free way the rest
 * of `npm test` does — the rendered flow is proved separately, by
 * scripts/site-proof.mjs, against the built export.
 *
 * The assertion that matters most is the one in the first test: the derived
 * parcel's BUILDABLE ENVELOPE must come back byte-for-byte equal to the
 * envelope the listing evidenced. Any invented setback — one foot, five,
 * a plausible-looking twenty-five — shrinks it and fails, which is exactly
 * the failure this rule exists to cause.
 */
import { expect, test } from "playwright/test";

import { PLOT_SETBACK_NOTE, isPlotOnSite, siteFromListing } from "@/components/land/plotSite";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { validateBuilderSite } from "@/lib/builder/site";
import { buildableEnvelope } from "@/lib/design/parcel";
import { DEMO_LAND_LISTINGS } from "@/lib/marketplace/discovery";
import {
  createAuraProject,
  validateAuraProject,
  withProjectSite,
} from "@/lib/project/document";

const AT = new Date("2026-08-14T12:00:00.000Z");

const listing = (id: string) => {
  const found = DEMO_LAND_LISTINGS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`The demonstration record ${id} is gone; this spec is measuring nothing.`);
  return found;
};

const aspen = () => listing("lsa-aspen-road");
const lakeside = () => listing("lsa-lakeside-estates");

const project = () =>
  createAuraProject({
    id: "plot-spec",
    name: "Plot spec",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now: AT,
  });

test("a listing's post-setback envelope becomes the lot, and the setbacks stay zero", () => {
  const record = aspen();
  const plot = siteFromListing(record);
  expect(plot).not.toBeNull();

  // Read from the record rather than retyped, so a fixture change moves both
  // sides of the comparison together instead of silently passing.
  const width = record.facts.buildableWidthFt.value;
  const depth = record.facts.buildableDepthFt.value;
  expect(plot!.parcel.lotWidthFt).toBe(width);
  expect(plot!.parcel.lotDepthFt).toBe(depth);

  expect(plot!.parcel.frontSetbackFt).toBe(0);
  expect(plot!.parcel.sideSetbackFt).toBe(0);
  expect(plot!.parcel.rearSetbackFt).toBe(0);

  /* The whole point of the zeroes: subtracting setbacks from this parcel
     leaves the evidenced envelope untouched. A listing states the land AFTER
     setbacks; taking them again would remove the same land twice. */
  const envelope = buildableEnvelope(plot!.parcel);
  expect(envelope.widthFt).toBe(width);
  expect(envelope.depthFt).toBe(depth);
  expect(envelope.usable).toBe(true);

  // Nothing the record does not carry is filled in with something plausible.
  expect(plot!.parcel.frontFaces).toBe("unknown");
  expect(plot!.parcel.slope).toBe("flat");
  expect(plot!.grade).toBe("flat");
  expect(plot!.provenance).toBe("listing-derived");

  // And the reader is told why, in the sentence the page prints verbatim.
  expect(PLOT_SETBACK_NOTE).toContain("setbacks as zero");
});

test("a record with no evidenced envelope produces no plot at all", () => {
  const blanks = DEMO_LAND_LISTINGS.filter(
    (record) =>
      record.facts.buildableWidthFt.value === null || record.facts.buildableDepthFt.value === null,
  );
  // If the demonstration set ever loses its unknown-evidence record, this
  // test is no longer exercising the refusal and should say so.
  expect(blanks.length).toBeGreaterThan(0);
  for (const record of blanks) expect(siteFromListing(record)).toBeNull();

  // Every record that DOES carry both dimensions produces a plot.
  const evidenced = DEMO_LAND_LISTINGS.filter((record) => !blanks.includes(record));
  for (const record of evidenced) expect(siteFromListing(record)).not.toBeNull();
});

test("the derived site is one the document layer will actually store", () => {
  const plot = siteFromListing(aspen());
  const checked = validateBuilderSite(plot);
  expect(checked.ok).toBe(true);
  expect(checked.ok && checked.site).toEqual(plot);
});

test("using a plot lands it on the project design, and dropping it restores the document", () => {
  const started = project();
  const before = started.design.documentHash;
  const plot = siteFromListing(lakeside())!;

  const withPlot = withProjectSite(started, plot, AT);
  expect(withPlot.design.document.site).toEqual(plot);
  expect(withPlot.design.documentHash).not.toBe(before);
  expect(validateAuraProject(withPlot).ok).toBe(true);

  /* A site is a design change, so the design step reopens exactly as any
     other edit would — the confirmation that came before it is stale. */
  expect(withPlot.stepStates.design.status).toBe("in-progress");

  // Removing the slot returns the document to what it was, hash included.
  const cleared = withProjectSite(withPlot, null, AT);
  expect(cleared.design.document.site).toBeUndefined();
  expect(cleared.design.documentHash).toBe(before);
});

test("the card knows whether the project is already standing on this plot", () => {
  const plot = siteFromListing(aspen())!;

  expect(isPlotOnSite(aspen(), null)).toBe(false);
  expect(isPlotOnSite(aspen(), plot)).toBe(true);
  // A different parcel is a different plot, even though both came from listings.
  expect(isPlotOnSite(lakeside(), plot)).toBe(false);

  /* Answering slope in the builder's Site step is the whole reason the Site
     step exists; it must not make the card forget which plot is underneath. */
  const answered = {
    ...plot,
    parcel: { ...plot.parcel, slope: "gentle" as const, frontFaces: "s" as const },
    grade: "plane" as const,
  };
  expect(isPlotOnSite(aspen(), answered)).toBe(true);

  // A hand-typed parcel that happens to match is not this listing's plot.
  expect(isPlotOnSite(aspen(), { ...plot, provenance: "manual" })).toBe(false);
});

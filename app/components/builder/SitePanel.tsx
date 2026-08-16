"use client";

/* THE SITE STEP — the guided walk's fifth stop, where the home meets a
   specific piece of ground.

   It reuses /design's ParcelPanel verbatim rather than growing a second
   parcel form: same fields, same validation, same buildable-envelope
   arithmetic, so the two places in the product that ask about land cannot
   drift apart. What this adds is durability — the answers land on the
   builder document as `site`, so they survive a reload, travel inside a
   project file, and reach the A1 SITE PLAN sheet.

   One edit, one undo: the panel keeps its own half-typed form state and
   only writes a validated parcel to the document, so typing "1" on the way
   to "150" never commits a 1-foot lot. */

import { useEffect, useMemo, useState } from "react";
import ParcelPanel, {
  INITIAL_PARCEL,
  parcelErrors,
  parseParcel,
  type LandStatus,
  type ParcelForm,
} from "@/components/design/ParcelPanel";
import {
  provenanceForBuilderEdit,
  sameParcel,
  siteProvenanceNote,
  type BuilderSite,
} from "@/lib/builder/site";
import type { SpecParcelCheck } from "@/lib/builder/toPlan";

/** The stored parcel, back into the form's strings. */
function formFromSite(site: BuilderSite | undefined): ParcelForm {
  if (!site?.parcel) return INITIAL_PARCEL;
  const p = site.parcel;
  return {
    lotWidth: String(p.lotWidthFt),
    lotDepth: String(p.lotDepthFt),
    front: String(p.frontSetbackFt),
    side: String(p.sideSetbackFt),
    rear: String(p.rearSetbackFt),
    frontFaces: p.frontFaces,
    slope: p.slope,
  };
}

/** Slope decides how the ground is drawn and how the piles are scheduled. */
function gradeForSlope(slope: ParcelForm["slope"]): BuilderSite["grade"] {
  return slope === "flat" ? "flat" : "plane";
}

export default function SitePanel({
  site,
  onSite,
  check,
}: {
  site: BuilderSite | undefined;
  onSite: (next: BuilderSite | null, label: string) => void;
  /** Null until a parcel is stored — the fit question needs both halves. */
  check: SpecParcelCheck | null;
}) {
  const [status, setStatus] = useState<LandStatus>(site?.parcel ? "have" : "looking");
  const [form, setForm] = useState<ParcelForm>(() => formFromSite(site));
  const errors = useMemo(() => parcelErrors(form), [form]);
  const invalid = errors.length > 0;

  /* A project opened from disk or a share link arrives with its own site;
     the form follows the document, never the other way around. */
  useEffect(() => {
    setForm(formFromSite(site));
    setStatus(site?.parcel ? "have" : "looking");
  }, [site]);

  /* Only a complete, valid parcel is written. Everything else leaves the
     document exactly as it was — including "still looking", which clears
     the slot rather than storing an empty parcel. */
  useEffect(() => {
    if (status !== "have") {
      if (site !== undefined) onSite(null, "site:clear");
      return;
    }
    if (invalid) return;
    const parcel = parseParcel(form);
    /* An origin belongs to the numbers it describes. A lot stated on /land
       arrives here already filled in, and simply LOOKING at this step must not
       relabel it as typed-in-the-builder; retyping one of its numbers must.
       `provenanceForBuilderEdit` owns that rule, and keeps `listing-derived`
       sticky for the reason its own comment gives. */
    const next: BuilderSite = {
      parcel,
      provenance: provenanceForBuilderEdit(site, parcel),
      grade: gradeForSlope(form.slope),
    };
    const same =
      site?.parcel !== undefined &&
      site.parcel !== null &&
      site.grade === next.grade &&
      site.provenance === next.provenance &&
      sameParcel(site.parcel, parcel);
    if (!same) onSite(next, "site:parcel");
  }, [form, invalid, onSite, site, status]);

  return (
    <div className="builder-site-step">
      <ParcelPanel
        status={status}
        onStatus={setStatus}
        value={form}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        invalid={invalid}
      />
      {status === "have" ? (
        <p className="builder-site-step__state" role="status">
          {/* One sentence per origin, read from the same record the document
              stores, so a parcel stated on /land is not described as one typed
              here. Nothing saved yet reads as `manual`, which is what the very
              next keystroke will make it. */}
          {invalid
            ? "The parcel is not saved yet — finish the numbers above."
            : siteProvenanceNote(site?.provenance ?? "manual")}
        </p>
      ) : null}

      {/* THE ANSWER TO THE QUESTION THE FORM ASKS. Placed here rather than in
          Review because "does my home fit this land?" is what somebody is
          thinking while typing setbacks, and an answer three steps later is
          an answer they have to go looking for. */}
      {check?.report ? (
        <div className="builder-site-step__fit aura-panel p-6" aria-live="polite">
          <p className="aura-label">Does this home fit this land</p>
          {!check.report.usable ? (
            <p className="mt-3 text-sm leading-relaxed text-aura-violet">
              Those setbacks leave no buildable rectangle at all, so there is nothing to place a
              home inside. Check them against your district&rsquo;s table.
            </p>
          ) : check.report.fits ? (
            <p className="mt-3 text-sm leading-relaxed tabular-nums text-aura-text/80">
              Yes. The {check.footprintFt[0]}&nbsp;×&nbsp;{check.footprintFt[1]} ft footprint sits
              inside a {Math.round(check.report.buildableWidthFt)}&nbsp;×&nbsp;
              {Math.round(check.report.buildableDepthFt)} ft buildable envelope, covering{" "}
              {check.report.coveragePct.toFixed(1)}% of the lot. Aura has not read your
              district&rsquo;s coverage maximum, so that figure carries no verdict.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-aura-violet">
              No. The {check.footprintFt[0]}&nbsp;×&nbsp;{check.footprintFt[1]} ft footprint does not
              fit the {Math.round(check.report.buildableWidthFt)}&nbsp;×&nbsp;
              {Math.round(check.report.buildableDepthFt)} ft envelope your setbacks leave, either way
              round.
              {check.report.largestFitDims
                ? ` At these proportions the largest home that would fit is about ${check.report.largestFitDims[0]} × ${check.report.largestFitDims[1]} ft.`
                : ""}
            </p>
          )}
          {check.notes.length ? (
            <ul className="mt-4 space-y-2 border-t aura-hairline pt-4 text-xs leading-relaxed text-aura-text/60">
              {check.notes.map((note) => (
                <li key={note.id}>
                  <strong className="font-medium text-aura-text/75">{note.title}.</strong>{" "}
                  {note.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

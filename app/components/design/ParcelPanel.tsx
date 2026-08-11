"use client";

/* "I ALREADY HAVE LAND" — the branch that makes the design step about a
   specific piece of ground.

   THE DIRECTION THIS SERVES. The generator has to end up designing for a
   real parcel — setbacks, solar orientation, slope, everything. This is
   the first real step of that, not the whole thing, and the copy says so
   rather than implying the rest already exists.

   WHY THESE FOUR FACTS AND NOTHING ELSE. Every field here has to change
   an output or it does not belong on the form:
   · lot width and depth, and the three setbacks, give the buildable
     envelope — the one check that can say this home does not go on this
     land, in pure arithmetic, with no guessing.
   · which way the front lot line faces decides whether the spec's
     south-facing glazing wall can actually point south.
   · slope maps to a plain consequence for the screw-pile foundation.
   Aquifer, septic soils, district minimums and title work are NOT here:
   they are real, they are not arithmetic, and asking for them so they can
   be echoed back would be theatre. They live on /land and in the agent
   pipeline.

   The default branch is "still looking", because most people are. */

import Link from "next/link";
import { Field, NumberInput, Select, ChoiceRow } from "@/components/design/Controls";
import { buildableEnvelope, type Facing, type ParcelFacts, type Slope } from "@/lib/design/parcel";

/* ------------------------------------------------------------------ state */

export type LandStatus = "looking" | "have";

/** Strings, not numbers — a half-typed field is a normal state in a form. */
export interface ParcelForm {
  lotWidth: string;
  lotDepth: string;
  front: string;
  side: string;
  rear: string;
  frontFaces: Facing;
  slope: Slope;
}

/**
 * Placeholders, and labelled as placeholders on screen.
 *
 * The setback numbers in particular are NOT a recommendation and are not
 * read off any bylaw — Aura does not know the reader's district. They are
 * a shape to type over.
 */
export const INITIAL_PARCEL: ParcelForm = {
  lotWidth: "150",
  lotDepth: "290",
  front: "25",
  side: "10",
  rear: "25",
  frontFaces: "unknown",
  slope: "flat",
};

const FACINGS: ReadonlyArray<{ id: Facing; label: string }> = [
  { id: "unknown", label: "Not sure yet" },
  { id: "n", label: "North" },
  { id: "ne", label: "North-east" },
  { id: "e", label: "East" },
  { id: "se", label: "South-east" },
  { id: "s", label: "South" },
  { id: "sw", label: "South-west" },
  { id: "w", label: "West" },
  { id: "nw", label: "North-west" },
];

const SLOPES: ReadonlyArray<{ id: Slope; label: string }> = [
  { id: "flat", label: "Flat — you would not notice walking it" },
  { id: "gentle", label: "Gentle — a noticeable fall across the site" },
  { id: "steep", label: "Steep — you feel it climbing" },
];

/* Generous bounds. They exist to catch a typo, not to have an opinion
   about how big someone's land is. */
const LOT_MIN_FT = 10;
const LOT_MAX_FT = 5280;
const SETBACK_MAX_FT = 1000;

const num = (s: string): number => Number(s.trim());

/** The form as the parcel module wants it. Only meaningful once valid. */
export function parseParcel(f: ParcelForm): ParcelFacts {
  return {
    lotWidthFt: num(f.lotWidth),
    lotDepthFt: num(f.lotDepth),
    frontSetbackFt: num(f.front),
    sideSetbackFt: num(f.side),
    rearSetbackFt: num(f.rear),
    frontFaces: f.frontFaces,
    slope: f.slope,
  };
}

/**
 * The same shape of sentence the rest of the questionnaire returns.
 *
 * These block Generate on purpose: a parcel check run on a number nobody
 * typed properly is worse than no parcel check, because it looks like one.
 */
export function parcelErrors(f: ParcelForm): string[] {
  const out: string[] = [];
  const dim = (v: string, what: string) => {
    const n = num(v);
    if (v.trim() === "" || !Number.isFinite(n) || n < LOT_MIN_FT || n > LOT_MAX_FT)
      out.push(`${what} must be a number of feet from ${LOT_MIN_FT} to ${LOT_MAX_FT.toLocaleString("en-CA")}.`);
  };
  const back = (v: string, what: string) => {
    const n = num(v);
    if (v.trim() === "" || !Number.isFinite(n) || n < 0 || n > SETBACK_MAX_FT)
      out.push(`${what} setback must be a number of feet from 0 to ${SETBACK_MAX_FT.toLocaleString("en-CA")}.`);
  };
  dim(f.lotWidth, "Lot width along the front");
  dim(f.lotDepth, "Lot depth");
  back(f.front, "Front");
  back(f.side, "Side");
  back(f.rear, "Rear");
  return out;
}

/* -------------------------------------------------------------- the panel */

const ft = (v: number): string => {
  const whole = Math.floor(Math.abs(v) + 1e-9);
  const inches = Math.round((Math.abs(v) - whole) * 12);
  const [w, i] = inches === 12 ? [whole + 1, 0] : [whole, inches];
  return `${v < 0 ? "-" : ""}${w}'-${i}"`;
};

export default function ParcelPanel({
  status,
  onStatus,
  value,
  onChange,
  invalid,
}: {
  status: LandStatus;
  onStatus: (v: LandStatus) => void;
  value: ParcelForm;
  onChange: <K extends keyof ParcelForm>(key: K, v: ParcelForm[K]) => void;
  /** True while `parcelErrors` is non-empty — the preview stays silent. */
  invalid: boolean;
}) {
  const have = status === "have";
  const env = invalid ? null : buildableEnvelope(parseParcel(value));
  const lotSqFt = invalid ? 0 : num(value.lotWidth) * num(value.lotDepth);

  return (
    <div className="aura-panel p-8">
      <p className="aura-label">Your land</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
        A home that is right in the abstract can still be the wrong home for a specific piece of
        ground. If you already have a parcel, four facts about it change what Aura tells you below.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ChoiceRow
          name="land-status"
          label="I’m still looking"
          detail="Design first, match land to it later. The plan is checked against the code and against itself, but against no particular lot."
          checked={!have}
          onSelect={() => onStatus("looking")}
        />
        <ChoiceRow
          name="land-status"
          label="I already have land"
          detail="Aura checks the solved home against your buildable envelope, your solar orientation and your slope, and says so when it does not fit."
          checked={have}
          onSelect={() => onStatus("have")}
        />
      </div>

      {!have ? (
        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-aura-text/60">
          Nothing below is checked against a parcel, and the result will not pretend otherwise.
          When you do have one, come back to this step — the same design gets measured against the
          buildable envelope your setbacks leave. Parcels, district minimums, aquifer and septic
          soils live on{" "}
          <Link href="/land" data-cursor="Open" className="text-aura-emerald underline underline-offset-4">
            /land
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Lot width along the front (ft)"
              hint="The frontage — the dimension along the street or access side."
            >
              <NumberInput
                value={value.lotWidth}
                onChange={(v) => onChange("lotWidth", v)}
                min={LOT_MIN_FT}
                max={LOT_MAX_FT}
              />
            </Field>
            <Field label="Lot depth (ft)" hint="Front lot line to rear lot line.">
              <NumberInput
                value={value.lotDepth}
                onChange={(v) => onChange("lotDepth", v)}
                min={LOT_MIN_FT}
                max={LOT_MAX_FT}
              />
            </Field>
            <Field
              label="Slope"
              hint="The spec is screw piles and no concrete, so this is a foundation cost, not a landscaping note."
            >
              <Select value={value.slope} onChange={(v) => onChange("slope", v)} options={SLOPES} />
            </Field>
            <Field label="Front setback (ft)" hint="From the front lot line.">
              <NumberInput
                value={value.front}
                onChange={(v) => onChange("front", v)}
                min={0}
                max={SETBACK_MAX_FT}
              />
            </Field>
            <Field label="Side setback (ft)" hint="Taken on each of the two side lot lines.">
              <NumberInput
                value={value.side}
                onChange={(v) => onChange("side", v)}
                min={0}
                max={SETBACK_MAX_FT}
              />
            </Field>
            <Field label="Rear setback (ft)" hint="From the rear lot line.">
              <NumberInput
                value={value.rear}
                onChange={(v) => onChange("rear", v)}
                min={0}
                max={SETBACK_MAX_FT}
              />
            </Field>
            <Field
              label="The front lot line faces"
              hint="Stand in the yard looking at the street. This is the one answer that decides whether the glazing wall can face south."
            >
              <Select
                value={value.frontFaces}
                onChange={(v) => onChange("frontFaces", v)}
                options={FACINGS}
              />
            </Field>
          </div>

          {/* The buildable envelope, live, before anything is generated —
              it is the number that decides whether the rest is worth
              filling in, so it does not wait for a submit. */}
          <div className="mt-6 rounded-md border aura-hairline p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="aura-label">Buildable envelope</p>
              <p className="font-mono text-[0.6rem] uppercase tracking-label text-aura-text/50">
                Derived from your numbers
              </p>
            </div>
            {env === null ? (
              <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
                Waiting on the numbers above.
              </p>
            ) : env.usable ? (
              <p className="mt-3 text-sm leading-relaxed tabular-nums text-aura-text/80">
                {ft(env.widthFt)} across the frontage × {ft(env.depthFt)} front to back ={" "}
                {Math.round(env.areaSqFt).toLocaleString("en-CA")} sq ft to place a home in, on a{" "}
                {Math.round(lotSqFt).toLocaleString("en-CA")} sq ft lot (
                {(Math.round((lotSqFt / 43560) * 100) / 100).toLocaleString("en-CA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                acres).
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-aura-violet">
                Those setbacks use up the whole lot — they leave {ft(env.widthFt)} across the
                frontage and {ft(env.depthFt)} front to back, so there is no rectangle left to put a
                home in. Check them against your district&rsquo;s table before going further.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
              Setbacks are set by the land use bylaw <em>district</em> your parcel sits in, not by
              the county as a whole, and Aura has not looked yours up — the numbers above are
              placeholders to type over, never a recommendation. These figures stay in this browser:
              the parcel check is arithmetic that runs here and is not sent anywhere.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

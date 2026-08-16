"use client";

/** @jsxImportSource react */

/* WHY THE PRAGMA ABOVE. Same reason as ZoningLookup, which mounts this file:
 * Playwright transforms every .tsx it loads with its own jsx runtime, so a spec
 * that imports this component renders `{__pw_type: "jsx"}` objects instead of
 * markup. Babel honours a per-file `@jsxImportSource` over the runner's
 * default. It is per FILE, which is also why the controls below are written out
 * here rather than imported from `components/design/Controls.tsx`: that file
 * carries no pragma, so rendering its `Field`/`NumberInput`/`Select` from
 * inside this subtree breaks tests/land-ui.spec.ts with "Objects are not valid
 * as a React child" — observed, not assumed. The shared VALIDATION still comes
 * from ParcelPanel via `statedLot.ts`, which is where the duplication would
 * actually matter; only the markup is local, and it is deliberately the
 * `.zoning-*` language of the surface it sits in rather than /design's.
 */

/* YOUR OWN LOT — the first surface on /land where the reader is the subject.
 *
 * THE GAP THIS FILLS. /land had two halves and neither could take a real
 * parcel. The four demonstration records are fictional and say so. The zoning
 * lookup is real and read-only: `districtConstraintFacts` records the buildable
 * width and depth as `unknown` on all 156 districts, because a district
 * genuinely does not know your lot, and `siteFromListing` therefore refuses
 * every one of them. That refusal is right. What was missing is the other side
 * of it — the person knows the lot, and nothing on the page would take it.
 * /contractors solved the same shape of problem by letting the person bring the
 * subject and having the app supply the rigour. On /land the subject a person
 * can honestly bring is their own land.
 *
 * WHAT IT WILL NOT DO.
 *   · The separate register surface may look up a City-recorded lot area only
 *     after its button is pressed. It never fills this form or infers parcel
 *     geometry: a register publishes an area, never a width and a depth, and no
 *     free source in Edmonton Open Data publishes frontage. Every value this
 *     form saves is therefore still one the reader deliberately typed.
 *   · It does not write anything until the button is pressed. Attaching a site
 *     runs through `withProjectSite` -> `withProjectDesign`, which revalidates
 *     the project, recanonicalises and rehashes the document and reopens the
 *     design step. The builder's SitePanel commits on every settled keystroke
 *     because its callback lands in a reducer; here the same callback would
 *     rewrite the whole project per keystroke, so it is deliberately not reused.
 *   · It does not say a lot works. The envelope facts it states are `declared`,
 *     so the fit engine can refuse and can never pass.
 *
 * WHY THE INLINE STYLES. `app/globals.css` is another node's write set in this
 * change, so the three layout rules this panel needs are declared here against
 * the same tokens and the same `minmax(min(…), 100%)` shape the `.zoning-*`
 * block uses — one fixed min-width anywhere in this section would push /land
 * sideways at 390 px, which tests/land-ui.spec.ts measures. Every text class
 * below is an existing `.zoning-*` class, reused rather than restyled.
 */

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  DERIVED_DEPTH_NOTE,
  EMPTY_UNTIL_STATED_NOTE,
  INITIAL_STATED_LOT,
  PROPERTY_REGISTER_BOUNDARY,
  SLOPE_DEFAULT_NOTE,
  STATED_LOT_SETBACK_NOTE,
  STATED_LOT_WHOLE_LOT_NOTE,
  envelopeFinding,
  evaluateDistrictAgainstStatedLot,
  resolveStatedLot,
  statedLotErrors,
  statedLotRefusal,
  statedLotSite,
  statedNothingYet,
  type StatedLotForm,
} from "@/components/land/statedLot";
import { useAuraProject } from "@/components/project/ProjectContext";
import { buildableEnvelope, type Facing, type Slope } from "@/lib/design/parcel";
import type { LandDesignRequirements } from "@/lib/marketplace/discovery";
import type { EdmontonZoningDistrict } from "@/lib/marketplace/landData";
import { withProjectSite } from "@/lib/project/document";

/* ------------------------------------------------------------------ context */

/**
 * The project, or null, without throwing.
 *
 * `useAuraProject` throws outside a provider by design, and this panel is
 * mounted inside `ZoningLookup`, which specs render bare. The hook is called
 * unconditionally — `useContext` runs before the throw, so hook order is stable
 * — and only the error is swallowed. The clean form is a `useOptionalAuraProject`
 * export beside `useAuraProject`; that file is outside this node's write set,
 * so the shim carries the behaviour here and the report hands over the
 * replacement.
 */
function useOptionalProject(): ReturnType<typeof useAuraProject> | null {
  try {
    return useAuraProject();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- layout */

const BLOCK: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "clamp(0.9rem, 2vw, 1.2rem)",
  border: "1px solid var(--st-hair-soft)",
  background: "rgb(var(--tone-sunken))",
};

const FIELD_GRID: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(11rem, 100%), 1fr))",
};

const CHOICE_GRID: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(15rem, 100%), 1fr))",
};

const FIELD: CSSProperties = { display: "grid", gap: "0.3rem", minWidth: 0 };

/* -------------------------------------------------------------- primitives */

function LotField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label style={FIELD}>
      <span className="zoning-search-label">{label}</span>
      {children}
      <span className="zoning-reason">{hint}</span>
    </label>
  );
}

function LotNumber({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  return (
    <LotField label={label} hint={hint}>
      <input
        type="number"
        inputMode="decimal"
        className="zoning-input"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </LotField>
  );
}

function LotSelect<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ id: T; label: string }>;
}) {
  return (
    <LotField label={label} hint={hint}>
      <select
        className="zoning-input"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </LotField>
  );
}

/* A real radio rather than a styled button: grouping, arrow-key movement and
   the announced "2 of 2" come free from the platform, and this branch decides
   whether a number is measured or calculated. */
function LotChoice({
  label,
  detail,
  checked,
  onSelect,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="zoning-question" style={{ cursor: "pointer" }}>
      <span className="zoning-question-head">
        <input type="radio" name="stated-lot-depth" checked={checked} onChange={onSelect} />
        <span className="zoning-question-label">{label}</span>
      </span>
      <span className="zoning-reason">{detail}</span>
    </label>
  );
}

/* --------------------------------------------------------------- the options */

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

const ft1 = (v: number): string =>
  (Math.round(v * 10) / 10).toLocaleString("en-CA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const sqft = (v: number): string => Math.round(v).toLocaleString("en-CA");

/** What the panel says where a project is required and absent. Not a control
 *  that looks broken — the reason and the fix are both on screen. */
export const NO_PROJECT_NOTE =
  "There is no project open in this browser to write this lot onto. Start or open a project — the same one the builder uses — and this lot goes onto its design.";

export const INCOMPLETE_NOTE =
  "The button waits on the numbers above. Nothing is written while any of them is incomplete.";

export const NOTHING_WRITTEN_NOTE =
  "Nothing has been written yet. Pressing the button is the only thing that changes your project.";

/** The block that stands where the arithmetic goes before there is any. It
 *  exists so an untouched form is not greeted by five sentences about fields
 *  the reader has not reached yet, and so nothing on screen can be read as a
 *  figure Aura is proposing. */
export const NOTHING_STATED_NOTE =
  "Nothing has been checked here, because nothing has been stated yet. Type the frontage, the depth and the three setbacks above and this block works out what your setbacks leave, against your numbers and no others.";

export const SAVED_NOTE =
  "Saved onto this project's design. The design step reopened because the design changed, and the builder's Site step now opens on these numbers.";

export type CommitState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "problem"; message: string };

/**
 * Every sentence the state line owes the reader, not the first one that
 * applies. A half-typed lot with no project open has two things standing in
 * the way, and a reader who fixes one should not have to press the button
 * again to find out about the other. Pure, so the spec reads the same rule the
 * panel renders.
 */
export function commitState(
  commit: CommitState,
  usable: boolean,
  hasProject: boolean,
): string[] {
  if (commit.kind === "problem") return [`This lot was not written. ${commit.message}`];
  if (commit.kind === "saved") return [SAVED_NOTE];
  if (commit.kind === "saving") return ["Writing this lot onto the project."];
  const out: string[] = [];
  if (!usable) out.push(INCOMPLETE_NOTE);
  if (!hasProject) out.push(NO_PROJECT_NOTE);
  if (out.length === 0) out.push(NOTHING_WRITTEN_NOTE);
  return out;
}

/**
 * The second gate on the commit, and the one that does not depend on a
 * `disabled` attribute.
 *
 * The button is already unavailable while the lot is incomplete. This is the
 * same refusal expressed where it cannot be styled away: whatever the control
 * looks like, a form nobody has stated a lot on, and a form with a field
 * missing, are both refused here with the reason on screen rather than written
 * to the project under a label saying the owner stated them. Pure, so the spec
 * reads the rule the panel enforces instead of a copy of it.
 */
export function commitRefusal(form: StatedLotForm): string | null {
  if (statedNothingYet(form)) return NOTHING_STATED_NOTE;
  if (statedLotErrors(resolveStatedLot(form).form).length > 0) return INCOMPLETE_NOTE;
  return null;
}

/** The one sentence that keeps this block from reading as a verdict. */
export const STATED_LOT_SCOPE_NOTE =
  "Your lot answers one of the seven questions above and changes nothing else: the district dwelling minimum, the height ceiling, road access, water, private sewage and grid distance are exactly as open as they were. This rectangle is your statement rather than a survey, so this check can refuse the design and can never confirm it.";

/* ---------------------------------------------------------------- the panel */

export default function StatedLotPanel({
  district,
  requirements,
  initialForm,
}: {
  district: EdmontonZoningDistrict;
  requirements: LandDesignRequirements;
  /** The lot the panel opens on. /land passes none and gets
   *  `INITIAL_STATED_LOT`; tests/land-stated-lot.spec.ts passes one so it can
   *  render the branches a default can never reach — a derived depth, a lot the
   *  design does not fit, and setbacks that use up the lot. Same reason and same
   *  shape as `ZoningLookup`'s `initialCode`, and stated plainly because a prop
   *  that exists for a test should say so. */
  initialForm?: StatedLotForm;
}) {
  const context = useOptionalProject();
  const [form, setForm] = useState<StatedLotForm>(initialForm ?? INITIAL_STATED_LOT);
  const [commit, setCommit] = useState<CommitState>({ kind: "idle" });

  /* The instant this component first rendered, used as the "stated at" stamp on
     the declared facts. Never printed: a clock formatted on the server and
     again in the browser is a hydration mismatch nobody goes looking for. */
  const [statedAtISO] = useState(() => new Date().toISOString());

  const resolved = useMemo(() => resolveStatedLot(form), [form]);
  const errors = useMemo(() => statedLotErrors(resolved.form), [resolved.form]);
  const usable = errors.length === 0;
  /* Untouched is a different thing from incomplete, and gets a different block:
     see `statedNothingYet`. On the surface /land renders — no `initialForm` —
     this is true on first paint, which is why nothing is checked and the button
     is unavailable until the reader has actually stated a lot. */
  const blank = statedNothingYet(form);

  const parcel = useMemo(
    () => (usable ? statedLotSite(resolved.form).parcel : null),
    [resolved.form, usable],
  );
  const envelope = parcel ? buildableEnvelope(parcel) : null;
  const refusal = parcel ? statedLotRefusal(parcel, requirements) : null;

  const check = useMemo(() => {
    if (!envelope?.usable) return null;
    return evaluateDistrictAgainstStatedLot(district, requirements, {
      widthFt: envelope.widthFt,
      depthFt: envelope.depthFt,
      statedAtISO,
      sourceLabel:
        "Stated by the project owner on this page: the lot dimensions and the setbacks are theirs, and Aura has confirmed none of them.",
    });
  }, [district, envelope, requirements, statedAtISO]);

  const finding = check ? envelopeFinding(check) : null;

  const change = useCallback(
    <K extends keyof StatedLotForm>(key: K, value: StatedLotForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setCommit({ kind: "idle" });
    },
    [],
  );

  const useThisLot = useCallback(async () => {
    /* THE GATE THAT IS NOT THE DISABLED ATTRIBUTE. `commitRefusal` refuses an
       untouched form and a half-typed one, in words, rather than returning
       silently the way this function used to when there was no parcel. */
    const refused = commitRefusal(resolved.form);
    if (refused || !parcel) {
      setCommit({ kind: "problem", message: refused ?? INCOMPLETE_NOTE });
      return;
    }
    /* The button stays pressable without a project so the refusal explains
       itself on screen rather than being a control that looks broken. */
    if (!context?.project) {
      setCommit({ kind: "problem", message: NO_PROJECT_NOTE });
      return;
    }
    setCommit({ kind: "saving" });
    try {
      const site = statedLotSite(resolved.form);
      await context.update((current) => withProjectSite(current, site, new Date()));
      setCommit({ kind: "saved" });
    } catch (error) {
      setCommit({
        kind: "problem",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [context, parcel, resolved.form]);

  const derived = resolved.derived;
  const hasProject = Boolean(context?.project);

  return (
    <div style={BLOCK} data-slot="stated-lot">
      <p className="zoning-section-head">Your own lot</p>
      <p className="zoning-boundary">{PROPERTY_REGISTER_BOUNDARY}</p>
      <p className="zoning-design-note">
        A district governs every parcel inside it and knows nothing about the one you are standing
        on, which is why six of the seven questions above stay open. State your lot here and the
        buildable-envelope question is re-answered against your rectangle. Aura can look up only
        the City-recorded lot area, and only when you press the lookup button above. That lookup
        never fills or overwrites these fields and does not infer parcel geometry, so every value
        saved from this form is one you type.
      </p>
      <p className="zoning-reason">{EMPTY_UNTIL_STATED_NOTE}</p>

      <div style={FIELD_GRID}>
        <LotNumber
          label="Lot area (sq ft)"
          hint="From your title, your Real Property Report, or the City's property register. Leave it empty if you already know the depth."
          value={form.lotAreaSqFt}
          onChange={(v) => change("lotAreaSqFt", v)}
          min={0}
          max={27878400}
        />
        <LotNumber
          label="Frontage along the front lot line (ft)"
          hint="The dimension along the street or access side. A property register never publishes this, so it has to come from you."
          value={form.lotWidth}
          onChange={(v) => change("lotWidth", v)}
          min={10}
          max={5280}
        />
      </div>

      <div style={CHOICE_GRID}>
        <LotChoice
          label="I know the depth"
          detail="Type the front-to-rear dimension off your title, your survey, or your Real Property Report."
          checked={form.depthSource === "stated"}
          onSelect={() => change("depthSource", "stated")}
        />
        <LotChoice
          label="Work the depth out from the area"
          detail="Aura divides the lot area by your frontage. That is the real depth only on a rectangular lot, and it says so beside the number."
          checked={form.depthSource === "derived"}
          onSelect={() => change("depthSource", "derived")}
        />
      </div>

      {form.depthSource === "stated" ? (
        <div style={FIELD_GRID}>
          <LotNumber
            label="Lot depth (ft)"
            hint="Front lot line to rear lot line."
            value={form.lotDepth}
            onChange={(v) => change("lotDepth", v)}
            min={10}
            max={5280}
          />
        </div>
      ) : (
        <div className="zoning-question">
          <div className="zoning-question-head">
            <p className="zoning-question-label">Lot depth (ft)</p>
            <span className="zoning-state zoning-state-open">Worked out, not measured</span>
          </div>
          <p className="zoning-design-figure">
            {derived
              ? `${sqft(derived.fromAreaSqFt)} sq ft ÷ ${ft1(derived.frontageFt)} ft frontage = ${ft1(derived.depthFt)} ft front to back`
              : "Waiting on a lot area and a frontage above."}
          </p>
          {derived ? <p className="zoning-reason">{DERIVED_DEPTH_NOTE}</p> : null}
        </div>
      )}

      <div style={FIELD_GRID}>
        <LotNumber
          label="Front setback (ft)"
          hint="From the front lot line."
          value={form.front}
          onChange={(v) => change("front", v)}
          min={0}
          max={1000}
        />
        <LotNumber
          label="Side setback (ft)"
          hint="Taken on each of the two side lot lines."
          value={form.side}
          onChange={(v) => change("side", v)}
          min={0}
          max={1000}
        />
        <LotNumber
          label="Rear setback (ft)"
          hint="From the rear lot line."
          value={form.rear}
          onChange={(v) => change("rear", v)}
          min={0}
          max={1000}
        />
        <LotSelect
          label="Slope"
          hint="The spec is screw piles and no concrete, so this is a foundation cost rather than a landscaping note."
          value={form.slope}
          onChange={(v) => change("slope", v)}
          options={SLOPES}
        />
        <LotSelect
          label="The front lot line faces"
          hint="Stand in the yard looking at the street. This is what decides whether the glazing wall can point south."
          value={form.frontFaces}
          onChange={(v) => change("frontFaces", v)}
          options={FACINGS}
        />
      </div>

      <p className="zoning-reason">{STATED_LOT_WHOLE_LOT_NOTE}</p>
      <p className="zoning-reason">{STATED_LOT_SETBACK_NOTE}</p>
      <p className="zoning-reason">{SLOPE_DEFAULT_NOTE}</p>

      {/* WHAT THE NUMBERS ADD UP TO. Three states, and the first of them is the
          one this panel used to skip: nothing stated. The refusal comes before
          the arithmetic that produced it, because a reader whose lot does not
          take the design needs the reason first and the working second. */}
      {blank ? (
        <div className="zoning-question">
          <div className="zoning-question-head">
            <p className="zoning-question-label">Nothing stated yet</p>
            <span className="zoning-state zoning-state-open">Waiting on your lot</span>
          </div>
          <p className="zoning-detail">{NOTHING_STATED_NOTE}</p>
          <p className="zoning-reason">{STATED_LOT_SCOPE_NOTE}</p>
        </div>
      ) : errors.length > 0 ? (
        <div className="zoning-question">
          <div className="zoning-question-head">
            <p className="zoning-question-label">Not enough to check yet</p>
            <span className="zoning-state zoning-state-open">Incomplete</span>
          </div>
          <ul>
            {errors.map((problem) => (
              <li key={problem} className="zoning-detail">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="zoning-question">
          <div className="zoning-question-head">
            <p className="zoning-question-label">{finding ? finding.label : "Buildable envelope"}</p>
            <span
              className={
                refusal ? "zoning-state zoning-state-blocked" : "zoning-state zoning-state-open"
              }
            >
              {refusal ? "Refuses this design" : "Checked against your numbers"}
            </span>
          </div>
          {refusal ? <p className="zoning-detail">{refusal.sentence}</p> : null}
          {envelope?.usable ? (
            <p className="zoning-design-figure">
              {ft1(envelope.widthFt)} ft across the frontage × {ft1(envelope.depthFt)} ft front to
              back = {sqft(envelope.areaSqFt)} sq ft to place a home in, against a footprint of{" "}
              {sqft(requirements.footprintSqft)} sq ft.
            </p>
          ) : null}
          {finding && !refusal ? <p className="zoning-detail">{finding.detail}</p> : null}
          <p className="zoning-reason">{STATED_LOT_SCOPE_NOTE}</p>
        </div>
      )}

      <button
        type="button"
        className="zoning-result"
        onClick={() => void useThisLot()}
        disabled={!usable || commit.kind === "saving"}
        aria-disabled={!usable || commit.kind === "saving"}
      >
        <span className="zoning-result-code">
          {commit.kind === "saving" ? "Saving this lot…" : "Use this lot in my design"}
        </span>
        <span className="zoning-result-meta">
          Writes the lot onto this project&rsquo;s design and reopens the design step
        </span>
      </button>

      {/* EVERY REASON, not the first one. An incomplete lot with no project
          open has two things standing in the way and a reader who fixes one of
          them should not have to press the button again to discover the
          other. */}
      <div role="status" style={{ display: "grid", gap: "0.3rem" }}>
        {commitState(commit, usable, hasProject).map((sentence) => (
          <p key={sentence} className="zoning-reason">
            {sentence}
          </p>
        ))}
      </div>
    </div>
  );
}

"use client";

/** @jsxImportSource react */

/* WHY THE PRAGMA ABOVE. React is already the JSX source for the Next build, so
 * for the app this line changes nothing. It is here for the test runner:
 * Playwright transforms every .tsx it loads with its OWN jsx runtime
 * (`playwright/jsx-runtime.js`, which returns `{__pw_type: "jsx", …}` objects),
 * so importing this component into a spec and rendering it produced "Objects
 * are not valid as a React child" instead of markup. Babel honours a per-file
 * `@jsxImportSource` over the runner's default, which is what lets
 * `tests/land-ui.spec.ts` render this component for real and read the text a
 * browser would show — the gap LAND01's verifier found, where the
 * forbidden-vocabulary guard covered the artifact and not the page.
 */

/* THE ZONING LOOKUP — the on-screen half of the Edmonton constraint data.
 *
 * WHY IT LOOKS LIKE THIS. The founder asked why he cannot search for land. The
 * honest answer has two halves and this surface has to carry both.
 *
 *   1. There is no point-in-parcel lookup and there cannot be one here. The
 *      City's polygon geometry measured about 8 MB and a static export will not
 *      carry it, so an address box would be a lie made of JavaScript: it would
 *      accept an address, return a zone, and have guessed. What this offers
 *      instead is a DISTRICT lookup — you bring the zone code (or reach the
 *      City's map, linked at the point where geometry is needed) and the
 *      authority's own published rules come back.
 *
 *   2. A district answers ONE of the seven questions the fit engine asks, and
 *      only when the zone code carries an `h` modifier. Six stay open. So the
 *      unanswered count is the headline number on this surface and the verified
 *      ceiling sits underneath it. A design that led with one green tick and
 *      buried six unknowns would be worse than the four fictionalized records it
 *      sits beside, because those at least announce themselves as a
 *      demonstration.
 *
 * TWO VERDICTS, NEVER A MATCH. `evaluateEdmontonDistrict` returns exactly
 * `district-rule-blocks` or `parcel-evidence-required` and no 0–100 score. This
 * file adds neither. The single most useful sentence it can produce is a
 * citable refusal — and note what that refusal can actually be about: the
 * height ceiling, and nothing else. Minimum Site area lives in Zoning Bylaw
 * 20001's text rather than in any open dataset, so it is recorded `unknown` for
 * every one of the 156 districts and can never refuse anything. That is stated
 * on screen rather than hidden behind an empty row.
 *
 * EVERY FIGURE CARRIES ITS LINK. `districtFigures` returns a non-nullable
 * `sourceHref` per figure, so an unsourced number cannot be constructed, let
 * alone rendered. `tests/land-ui.spec.ts` walks all 156 districts through it and
 * then checks the rendered DOM, because a rule the component forgets to honour
 * is a rule that only exists in a comment.
 */

import { useCallback, useMemo, useState, type CSSProperties } from "react";

import StatedLotPanel from "@/components/land/StatedLotPanel";
import {
  EDMONTON_LOT_AREA_SET,
  LOT_AREA_BOUNDARY,
  LOT_AREA_COVERAGE_NOTE,
  lotAreaAttribution,
  lotAreaSummaryForBaseCode,
  lotAreaSummarySentence,
  sqMetresToSqFeet,
} from "@/lib/land/lotAreas";
import {
  PROPERTY_LOOKUP_SENDS_NOTE,
  lookupProperty,
  parseTypedAddress,
  type PropertyAddressMatch,
  type PropertyQuery,
} from "@/lib/land/propertyLookup";
import type { LandDesignRequirements, LandFitFinding } from "@/lib/marketplace/discovery";
import {
  CITY_ZONING_MAP_URL,
  EDMONTON_CONSTRAINT_SET,
  EDMONTON_DISTRICTS,
  EDMONTON_OVERLAYS,
  LAND_CONSTRAINT_BOUNDARY,
  districtConstraintFacts,
  districtMaxHeightFt,
  evaluateEdmontonDistrict,
  findEdmontonDistrict,
  landConstraintAttribution,
  type EdmontonDistrictVerdict,
  type EdmontonZoningDistrict,
  type EdmontonZoningOverlay,
} from "@/lib/marketplace/landData";

const NUM = new Intl.NumberFormat("en-CA");

/* ------------------------------------------------------------ the sources */

/** A dataset's catalogue page, by portal id. Never null: a claim this surface
 *  makes about the City's data always resolves to something a reader can open,
 *  and the City's zoning map is the backstop rather than a dead `href`. */
function catalogueUrl(sourceId: string): string {
  const source = EDMONTON_CONSTRAINT_SET.sources.find((candidate) => candidate.id === sourceId);
  return source?.catalogueUrl ?? EDMONTON_CONSTRAINT_SET.sources[0]?.catalogueUrl ?? CITY_ZONING_MAP_URL;
}

const ZONING_MAP_DATASET = catalogueUrl("fixa-tstc");
const OVERLAY_DATASET = catalogueUrl("6w3s-58pv");

/** The extract date as the artifact records it, sliced rather than formatted.
 *  `Intl.DateTimeFormat` resolves against the runtime's zone, which differs
 *  between the export build and the reader's browser — a hydration mismatch on
 *  a date is the kind of defect nobody looks for. */
const EXTRACT_DATE = EDMONTON_CONSTRAINT_SET.retrievedAtISO.slice(0, 10);

/* ------------------------------------------------------------- the figures */

/** One published number, with the authority page it came from. */
export interface ZoningFigure {
  id: string;
  label: string;
  /** The value exactly as it is shown. */
  value: string;
  /** Where the number came from. Deliberately NOT nullable — an unsourced
   *  figure is the thing this project refuses, so it cannot be built. */
  sourceHref: string;
  sourceLabel: string;
}

/**
 * Everything this district publishes as a number, each bound to its source.
 *
 * The height ceiling's source is the district's own section of Zoning Bylaw
 * 20001. Every district that carries an `h` modifier currently has one; the
 * fallback names the section that publishes the modifier CONVENTION instead, so
 * a future extract that drops a section still cannot produce a bare number.
 */
export function districtFigures(district: EdmontonZoningDistrict): ZoningFigure[] {
  const figures: ZoningFigure[] = [];
  const heightFt = districtMaxHeightFt(district);

  if (district.maxHeightM !== null && heightFt !== null) {
    figures.push({
      id: "height",
      label: "Maximum Height",
      value: `${district.maxHeightM.toFixed(1)} m · ${heightFt.toFixed(1)} ft`,
      sourceHref: district.bylawUrl ?? EDMONTON_CONSTRAINT_SET.modifierConvention.sourceUrl,
      sourceLabel: district.bylawUrl
        ? "Zoning Bylaw 20001 · this district's section"
        : "Zoning Bylaw 20001 · the Modifier convention",
    });
  }

  if (district.floorAreaRatio !== null) {
    figures.push({
      id: "far",
      label: "Maximum Floor Area Ratio",
      value: district.floorAreaRatio.toFixed(1),
      sourceHref: district.bylawUrl ?? EDMONTON_CONSTRAINT_SET.modifierConvention.sourceUrl,
      sourceLabel: district.bylawUrl
        ? "Zoning Bylaw 20001 · this district's section"
        : "Zoning Bylaw 20001 · the Modifier convention",
    });
  }

  figures.push({
    id: "mapped-areas",
    label: "Areas on the zoning map",
    value: NUM.format(district.mappedAreas),
    sourceHref: ZONING_MAP_DATASET,
    sourceLabel: `City of Edmonton weekly extract · read ${EXTRACT_DATE}`,
  });

  return figures;
}

/** Where this district's rules are written, and what to do when they are not
 *  written in one place. "No link" and "no single section" are different
 *  situations for a reader, and collapsing them into a blank throws that away. */
export function districtSection(district: EdmontonZoningDistrict): {
  href: string;
  label: string;
  note: string | null;
} {
  if (district.bylawUrl) {
    return {
      href: district.bylawUrl,
      label: "Read this district in Zoning Bylaw 20001",
      note: null,
    };
  }
  if (district.bylawUrlState === "site-specific") {
    return {
      href: CITY_ZONING_MAP_URL,
      label: "Open the City's zoning map",
      note: `The City writes this district's rules per site rather than as one section — the current extract points at ${NUM.format(district.bylawUrlCount)} of them — so there is no single section to link.`,
    };
  }
  return {
    href: CITY_ZONING_MAP_URL,
    label: "Open the City's zoning map",
    note: "The current extract publishes no bylaw section for this district.",
  };
}

/* ------------------------------------------------------------ the verdicts */

/**
 * The two things a district can say. There is no third entry and there must
 * never be one: a district governs every parcel inside it and knows nothing
 * about the one you are standing on, so "this land works" is not a sentence it
 * is entitled to. `tests/land-ui.spec.ts` pins the key count and reads both
 * strings for the vocabulary that would imply otherwise.
 */
export const ZONING_VERDICT_COPY: Record<EdmontonDistrictVerdict, { title: string; body: string }> = {
  "district-rule-blocks": {
    title: "Refused by a published rule",
    body: "A rule the City published refuses the design as drawn. This is a real refusal with a section behind it — read the section, then change the design or look at another district.",
  },
  "parcel-evidence-required": {
    title: "Parcel evidence required",
    body: "Nothing the City publishes about this district refuses the design. That is emphatically not the same as land here working: the questions below that stay open are answered by the parcel, the survey and the utility, never by the zone code.",
  },
};

/* ------------------------------------------------------- the seven questions */

/** Each finding's fact, so the reason a question is open travels with it. The
 *  map is exhaustive on purpose: a finding id the engine adds and this file has
 *  never seen renders with no reason, and the spec goes red rather than the
 *  reader quietly getting a blank. */
const FACT_OF_FINDING: Record<string, keyof ReturnType<typeof districtConstraintFacts>> = {
  "district-minimum": "districtMinimumSqft",
  "buildable-envelope": "buildableWidthFt",
  height: "maximumHeightFt",
  road: "yearRoundRoadAccess",
  water: "potableWater",
  septic: "septicSuitability",
  grid: "gridDistanceKm",
};

/** Why a question is open, in the words the data module already wrote. */
export function reasonForFinding(district: EdmontonZoningDistrict, finding: LandFitFinding): string | null {
  const key = FACT_OF_FINDING[finding.id];
  if (!key) return null;
  const fact = districtConstraintFacts(district)[key];
  return fact.status === "unknown" ? fact.sourceLabel : null;
}

const STATE_OF_SEVERITY: Record<LandFitFinding["severity"], { text: string; className: string }> = {
  pass: { text: "Published by the City", className: "zoning-state zoning-state-published" },
  block: { text: "Refuses this design", className: "zoning-state zoning-state-blocked" },
  check: { text: "Unanswered", className: "zoning-state zoning-state-open" },
};

/* ------------------------------------------------------------- the overlays */

/**
 * The artifact records `bylawInForce` on every overlay record; the
 * `EdmontonZoningOverlay` interface in `lib/marketplace/landData.ts` does not
 * declare it yet, and that module is outside this node's write set. So the
 * field is read through a local type AND a runtime guard rather than an
 * unchecked cast: anything that is not exactly `true` or `false` comes back
 * null and renders as "status not recorded" instead of quietly reading as in
 * force. `tests/land-ui.spec.ts` fails if the field ever goes missing, so the
 * guard cannot become a silent shrug.
 */
type OverlayRecord = EdmontonZoningOverlay & { bylawInForce?: unknown };

export function overlayInForce(overlay: EdmontonZoningOverlay): boolean | null {
  const raw = (overlay as OverlayRecord).bylawInForce;
  return raw === true ? true : raw === false ? false : null;
}

export function overlayStatusText(overlay: EdmontonZoningOverlay): string {
  const inForce = overlayInForce(overlay);
  const bylaw = overlay.bylawNumber === null ? "no bylaw recorded" : `Bylaw ${overlay.bylawNumber}`;
  if (inForce === null) return `Status not recorded · ${bylaw}`;
  return inForce ? `In force · ${bylaw}` : `Not in force · ${bylaw}`;
}

/* ------------------------------------------------- the property register */

/* WHAT THIS BLOCK IS FOR, and why it is on screen rather than in a module
 * nobody imports.
 *
 * /land's boundary panel says Aura can tell you what the City's rules AND ITS
 * PROPERTY REGISTER say about a lot you already have. Before this block that
 * second half was false: `lib/land/lotAreas.ts` and `lib/land/propertyLookup.ts`
 * were reachable only from their own spec, so no register figure had ever
 * reached a reader. A sentence on a page claiming a capability the code does not
 * have is worse than the capability being absent, because a reader cannot see
 * the difference.
 *
 * TWO HALVES, AND THE DIFFERENCE BETWEEN THEM IS THE WHOLE DESIGN.
 *
 *   1. THE DISTRICT TYPICAL is offline. It is the aggregate that was baked
 *      instead of 282,034 parcel rows, and the reason that scope call was made
 *      was so somebody could see what a lot in their district turns out to be.
 *      It is quantiles over thousands of properties. It is never the reader's
 *      lot, it is an AREA rather than a width or a depth, and both of those
 *      sentences are printed rather than implied.
 *
 *   2. THE ONE LIVE CALL is the only thing on this page that needs a network,
 *      and it fires on a button press and on nothing else — no effect, no
 *      keystroke handler, no district select. `PROPERTY_LOOKUP_SENDS_NOTE` sits
 *      beside the button BEFORE it is pressed, so the person knows what leaves
 *      the browser and where it goes while deciding. Every failure the module
 *      can produce comes back as a sentence naming what failed, and the lot-area
 *      field in "Your own lot" directly below stays typable in all of them.
 *      Offline is the default mode here, not a degraded one.
 *
 * WHERE A RETURNED NUMBER LANDS. The register publishes an area. It is not a
 * frontage and it is not a depth — no free City of Edmonton source publishes
 * frontage at all — so the answer is printed as an area, said to be an area, and
 * pointed at the "Lot area (sq ft)" field below, which the reader fills in.
 * Aura does not reach into that panel and overwrite what somebody typed.
 */

/** The lot-area dataset's own catalogue page. Every figure this block states
 *  links to it, the same rule the district figures above follow. */
const LOT_AREA_CATALOGUE = EDMONTON_LOT_AREA_SET.source.catalogueUrl;
const LOT_AREA_READ_DATE = EDMONTON_LOT_AREA_SET.retrievedAtISO.slice(0, 10);
const LOT_AREA_SOURCE_LABEL = `City of Edmonton property register · read ${LOT_AREA_READ_DATE}`;

/** Fixed-locale and integer, like every other figure on this surface: a number
 *  formatted against the runtime's locale differs between the export build and
 *  the reader's browser, and a hydration mismatch on a figure is the kind of
 *  defect nobody goes looking for. */
function areaBothUnits(sqM: number): string {
  return `${NUM.format(Math.round(sqM))} m2 · ${NUM.format(Math.round(sqMetresToSqFeet(sqM)))} sq ft`;
}

/**
 * The district's lot-area distribution as five stated figures, each carrying
 * the source it came from — `ZoningFigure` rather than a bare string for the
 * same reason `districtFigures` uses it: an unsourced number cannot be built.
 *
 * Empty when the City's register files no titled lot under this base code. That
 * is a real state and not a rare one: 19 of the 156 districts' base codes have
 * no row in the aggregate, counted rather than assumed, so the surface says why
 * rather than rendering a blank — a blank reads as a page still loading.
 */
export function districtTypicalFigures(district: EdmontonZoningDistrict): ZoningFigure[] {
  const summary = lotAreaSummaryForBaseCode(district.baseCode);
  if (!summary) return [];
  const figure = (id: string, label: string, sqM: number): ZoningFigure => ({
    id,
    label,
    value: areaBothUnits(sqM),
    sourceHref: LOT_AREA_CATALOGUE,
    sourceLabel: LOT_AREA_SOURCE_LABEL,
  });
  return [
    figure("p10", "10th percentile", summary.p10SqM),
    figure("p25", "Lower quartile", summary.p25SqM),
    figure("median", "Median lot area", summary.medianSqM),
    figure("p75", "Upper quartile", summary.p75SqM),
    figure("p90", "90th percentile", summary.p90SqM),
  ];
}

/** Why there is nothing to show, when there is nothing to show. */
export function noTypicalNote(district: EdmontonZoningDistrict): string {
  return (
    `The City's register files no titled lot under the base code ${district.baseCode}, so there is no ` +
    `district typical to state here. The ${NUM.format(EDMONTON_LOT_AREA_SET.baseCodes.length)} codes it ` +
    "does carry are the ones with titled property behind them, and inventing a figure for the rest would " +
    "be arithmetic on nothing."
  );
}

/** The sentence that stops a quantile from being read as a parcel fact, and an
 *  area from being read as a dimension. Both mistakes are one word apart. */
export const REGISTER_AREA_NOTE =
  "Every figure above is an AREA. The register publishes no frontage and no depth, so it cannot say how " +
  "wide a lot is or how far back it runs, and a quantile over thousands of properties is not a statement " +
  "about the one you are standing on.";

/** Said beside the button, so the cost of the one live call is on screen before
 *  anybody pays it. */
export const REGISTER_NETWORK_NOTE =
  "This button is the only thing on this page that uses the network. The district rules, the district " +
  "figures above and your own lot below are baked into Aura and run in your browser, so if the City does " +
  "not answer, nothing else here stops working.";

/**
 * The field a returned area is meant to be typed into. It lives in
 * `StatedLotPanel`, which is another module's file, so the name is held here as
 * a constant and `tests/land-register-surface.spec.ts` asserts that the panel
 * on screen still carries it. A rename there turns this sentence into a
 * direction to a field that does not exist, and the point of the constant is
 * that the rename goes red instead of quietly misdirecting a reader.
 */
export const LOT_AREA_FIELD_LABEL = "Lot area (sq ft)";

/** Where a returned number goes, said where the number lands. Aura does not
 *  write it into the panel below: overwriting numbers somebody typed is not a
 *  thing a lookup gets to do. */
export const REGISTER_LANDING_NOTE =
  `An area is not a frontage and not a depth. Type the square footage into “${LOT_AREA_FIELD_LABEL}” under ` +
  "Your own lot below and state your own frontage there — no free City of Edmonton source publishes it — " +
  "and the buildable envelope is worked out from your numbers.";

/** The register's own change stamp, when the portal lets a browser read it. */
export function REGISTER_AS_OF_NOTE(asOfISO: string): string {
  return (
    `The register's own stamp says these rows last changed ${asOfISO.slice(0, 10)}. That is the City's ` +
    "statement about when its data moved, not Aura's about when the property did."
  );
}

/** And when it does not. A header a browser is not permitted to read is not a
 *  missing date to gloss over; it is a fact about this call, so it is stated. */
export const REGISTER_NO_STAMP_NOTE =
  "The portal did not hand this browser a change stamp for this row — it does not expose that header " +
  "across origins — so the row carries no date of its own, and the coverage window the City states above " +
  "is the only currency claim on screen.";

/** Typed text this dataset cannot be asked about, answered without sending it.
 *  A refusal that explains itself beats a request that comes back empty. */
export const ADDRESS_UNREADABLE_NOTE =
  "That does not start with a house number, so there is nothing here to ask the City for. The register " +
  "files an address as a house number and then a street name, as in 12110 148 Ave NW. Nothing was sent.";

/** An empty answer is a fact about this dataset, never a fact about the place. */
export function noRowNote(query: PropertyQuery): string {
  return (
    `The City's register returns no row for ${query.houseNumber} ${query.streetName}. That is what this ` +
    "dataset holds and not a statement about the address: a condominium unit carries a share of a parcel " +
    "rather than a lot and is filtered out, a recent subdivision may not be in the rows yet, and a street " +
    "spelled another way or in another quadrant is a different street. Type the lot area yourself below."
  );
}

/** One returned row, in one sentence. The zone code is stated as the BASE code
 *  it is: the register drops the `h` and `f` modifiers, which are the only
 *  thing the district register can evidence, so an address still leaves the
 *  height ceiling unknown. */
export function registerRowSentence(row: PropertyAddressMatch): string {
  return (
    `${row.houseNumber} ${row.streetName} — the City records a lot area of ${areaBothUnits(row.lotAreaSqM)}. ` +
    `It files the property under zone code ${row.zoneCode}, which is a base code with the h and f modifiers ` +
    "stripped, so this still carries no height ceiling."
  );
}

/** Everything the lookup can be in. `asking` is a real state with a real end:
 *  `lookupProperty` never throws and times out at eight seconds, so there is no
 *  path that leaves this stuck. */
export type RegisterAskState =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "unreadable" }
  | { kind: "rows"; query: PropertyQuery; rows: PropertyAddressMatch[]; asOf: string | null }
  | { kind: "no-row"; query: PropertyQuery }
  | { kind: "unreachable"; reason: string };

const REGISTER_BLOCK: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "clamp(0.9rem, 2vw, 1.2rem)",
  border: "1px solid var(--st-hair-soft)",
  background: "rgb(var(--tone-sunken))",
};

/* One fixed min-width anywhere in this section pushes /land sideways at 390 px,
   which tests/land-ui.spec.ts measures. Same `minmax(min(…), 100%)` shape the
   rest of the `.zoning-*` block uses. */
const REGISTER_ASK_ROW: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(14rem, 100%), 1fr))",
  alignItems: "end",
};

function RegisterSurface({ district }: { district: EdmontonZoningDistrict }) {
  const [typed, setTyped] = useState("");
  const [ask, setAsk] = useState<RegisterAskState>({ kind: "idle" });

  const typical = useMemo(() => districtTypicalFigures(district), [district]);
  const summary = useMemo(() => lotAreaSummaryForBaseCode(district.baseCode), [district]);
  const attribution = lotAreaAttribution();

  /* THE ONLY CALLER. There is no effect in this file and no handler on the
     input that reaches the network — typing sends nothing, choosing a district
     sends nothing, and mounting sends nothing. */
  const askTheCity = useCallback(async () => {
    const query = parseTypedAddress(typed);
    if (!query) {
      setAsk({ kind: "unreadable" });
      return;
    }
    setAsk({ kind: "asking" });
    const outcome = await lookupProperty(query);
    if (outcome.kind === "matches") {
      setAsk({ kind: "rows", query, rows: outcome.matches, asOf: outcome.truthLastModifiedISO });
    } else if (outcome.kind === "no-row") {
      setAsk({ kind: "no-row", query: outcome.query });
    } else {
      setAsk({ kind: "unreachable", reason: outcome.reason });
    }
  }, [typed]);

  return (
    <div style={REGISTER_BLOCK} data-slot="land-register-surface">
      <p className="zoning-section-head">What the City&rsquo;s property register says</p>
      <p className="zoning-boundary">{LOT_AREA_BOUNDARY}</p>

      {/* HALF ONE: the district typical, offline. */}
      {summary && typical.length > 0 ? (
        <>
          <p className="zoning-detail">{lotAreaSummarySentence(summary)}</p>
          <div className="zoning-figures">
            {typical.map((figure) => (
              <p key={figure.id} className="zoning-figure">
                <strong className="zoning-figure-value">{figure.value}</strong>
                <span className="zoning-figure-label">{figure.label}</span>
                <a className="zoning-source" href={figure.sourceHref} target="_blank" rel="noreferrer">
                  {figure.sourceLabel}
                </a>
              </p>
            ))}
          </div>
          <p className="zoning-reason">{REGISTER_AREA_NOTE}</p>
          <p className="zoning-reason">{LOT_AREA_COVERAGE_NOTE}</p>
        </>
      ) : (
        <p className="zoning-reason">{noTypicalNote(district)}</p>
      )}

      {/* HALF TWO: one address, on a press. */}
      <div className="zoning-question" data-slot="land-register-ask">
        <div className="zoning-question-head">
          <p className="zoning-question-label">Ask the City about one address</p>
          <span className="zoning-state zoning-state-open">Needs the network</span>
        </div>
        <p className="zoning-reason">{PROPERTY_LOOKUP_SENDS_NOTE}</p>
        <p className="zoning-reason">{REGISTER_NETWORK_NOTE}</p>

        <div style={REGISTER_ASK_ROW}>
          <label style={{ display: "grid", gap: "0.3rem", minWidth: 0 }}>
            <span className="zoning-search-label" id="register-address-label">
              Edmonton street address
            </span>
            <input
              id="register-address"
              className="zoning-input"
              type="text"
              autoComplete="off"
              placeholder="12110 148 Ave NW"
              value={typed}
              data-slot="land-register-address"
              /* onChange sets state and nothing else. No debounce, no
                 as-you-type request: the note above promises nothing is sent
                 until the button is pressed, and this is that promise. */
              onChange={(event) => {
                setTyped(event.target.value);
                setAsk({ kind: "idle" });
              }}
            />
          </label>
          <button
            type="button"
            className="zoning-result"
            data-slot="land-register-button"
            onClick={() => void askTheCity()}
            disabled={typed.trim().length === 0 || ask.kind === "asking"}
            aria-disabled={typed.trim().length === 0 || ask.kind === "asking"}
          >
            <span className="zoning-result-code">
              {ask.kind === "asking" ? "Asking the City…" : "Ask the City for this lot's area"}
            </span>
            <span className="zoning-result-meta">
              {typed.trim().length === 0
                ? "Waiting on an address. Nothing is sent until you press it."
                : "Sends this address to data.edmonton.ca and asks for the area it records"}
            </span>
          </button>
        </div>

        {/* EVERY OUTCOME SAYS WHAT HAPPENED. There is no branch here that
            renders nothing, and none that leaves the reader without the next
            move — the lot-area field below takes a typed number in all of
            them. */}
        <div role="status" style={{ display: "grid", gap: "0.4rem" }}>
          {ask.kind === "asking" ? (
            <p className="zoning-reason">
              Asking data.edmonton.ca for this address. It has eight seconds to answer, and if it does
              not, this says so rather than waiting.
            </p>
          ) : null}
          {ask.kind === "unreadable" ? <p className="zoning-detail">{ADDRESS_UNREADABLE_NOTE}</p> : null}
          {ask.kind === "no-row" ? <p className="zoning-detail">{noRowNote(ask.query)}</p> : null}
          {ask.kind === "unreachable" ? <p className="zoning-detail">{ask.reason}</p> : null}
          {ask.kind === "rows" ? (
            <>
              {ask.rows.length > 1 ? (
                <p className="zoning-reason">
                  The City files {NUM.format(ask.rows.length)} titles at that address — duplex halves and
                  multiple titles on one parcel both do this — so all of them are here and the one that
                  is yours is yours to pick.
                </p>
              ) : null}
              {ask.rows.map((row, index) => (
                <p
                  key={`${row.houseNumber}-${row.streetName}-${row.legalDescription}-${index}`}
                  className="zoning-detail"
                  data-slot="land-register-row"
                >
                  {registerRowSentence(row)}
                  {row.legalDescription ? ` ${row.legalDescription}.` : ""}
                  {row.neighbourhood ? ` ${row.neighbourhood}.` : ""}
                </p>
              ))}
              <p className="zoning-reason">{REGISTER_LANDING_NOTE}</p>
              {/* FRESHNESS, INCLUDING WHEN THERE IS NONE TO STATE. `lookupProperty`
                  reads the portal's `X-SODA2-Truth-Last-Modified` header, and a
                  browser can only read a header the server exposes across
                  origins. Asked from a real page, data.edmonton.ca exposes
                  `content-type` and `last-modified` and nothing else — observed,
                  not assumed — so this comes back null and the second branch is
                  the one a reader actually sees. Both are written because
                  printing nothing would read as a stamp Aura had decided not to
                  show, and printing a date Aura cannot read would be worse. */}
              {ask.asOf ? (
                <p className="zoning-reason">{REGISTER_AS_OF_NOTE(ask.asOf)}</p>
              ) : (
                <p className="zoning-reason">{REGISTER_NO_STAMP_NOTE}</p>
              )}
            </>
          ) : null}
        </div>
      </div>

      <p className="zoning-attrib">
        {attribution.text}{" "}
        <a href={attribution.termsUrl} target="_blank" rel="noreferrer">
          Open Data Terms of Use
        </a>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- the default */

/** Opens on the most-mapped district that publishes anything at all: 960 areas
 *  on the current map and an h16 ceiling. Opening on a district that publishes
 *  nothing would hide the mechanism; opening on a rare one would misrepresent
 *  the city. The fallbacks keep the panel alive if a later extract renames it. */
export const ZONING_DEFAULT_CODE = "RM h16";

function defaultDistrict(): EdmontonZoningDistrict | null {
  return (
    findEdmontonDistrict(ZONING_DEFAULT_CODE) ??
    EDMONTON_DISTRICTS.find((district) => district.maxHeightM !== null) ??
    EDMONTON_DISTRICTS[0] ??
    null
  );
}

const RESULT_LIMIT = 10;

function searchDistricts(query: string): EdmontonZoningDistrict[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
  const pool = needle
    ? EDMONTON_DISTRICTS.filter(
        (district) =>
          district.code.toLowerCase().includes(needle) ||
          district.code.toLowerCase().replace(/\s+/g, "").includes(needle.replace(/\s+/g, "")) ||
          district.name.toLowerCase().includes(needle),
      )
    : EDMONTON_DISTRICTS.slice();
  return pool.sort((a, b) => b.mappedAreas - a.mappedAreas);
}

/* ------------------------------------------------------------ the component */

export default function ZoningLookup({
  requirements,
  initialCode,
}: {
  requirements: LandDesignRequirements;
  /** The district the panel opens on. /land does not pass one and gets
   *  `ZONING_DEFAULT_CODE`; the spec passes one so it can render the branches a
   *  single default can never reach — a district that publishes nothing at all,
   *  and one whose rules are written per site rather than as one section.
   *  Stated plainly because a prop that exists only for a test should say so. */
  initialCode?: string;
}) {
  const [query, setQuery] = useState("");
  const [code, setCode] = useState<string | null>(
    (initialCode ? findEdmontonDistrict(initialCode)?.code : null) ?? defaultDistrict()?.code ?? null,
  );

  const found = useMemo(() => searchDistricts(query), [query]);
  const district = useMemo(() => (code ? findEdmontonDistrict(code) : null), [code]);
  const check = useMemo(
    () => (district ? evaluateEdmontonDistrict(district, requirements) : null),
    [district, requirements],
  );

  const attribution = landConstraintAttribution();
  const notInForce = EDMONTON_OVERLAYS.filter((overlay) => overlayInForce(overlay) === false);
  const repealedBylaw = notInForce.filter((overlay) => overlay.bylawNumber === "12800").length;
  const heightPublishing = EDMONTON_DISTRICTS.filter((item) => item.maxHeightM !== null).length;
  const mappedAreas = EDMONTON_DISTRICTS.reduce((sum, item) => sum + item.mappedAreas, 0);

  return (
    <section className="zoning" aria-labelledby="zoning-heading" data-slot="zoning-lookup">
      <header className="zoning-head">
        <p className="zoning-eyebrow">City of Edmonton · authority data, not inventory</p>
        <h2 id="zoning-heading" className="zoning-title">
          Look up what a zoning district actually publishes
        </h2>
        <p className="zoning-boundary">{LAND_CONSTRAINT_BOUNDARY}</p>
        <p className="zoning-lede">
          This is the real half of this page. Every figure below is the City&rsquo;s own, read from
          its weekly open-data extract on {EXTRACT_DATE}, and every one of them links to the
          authority page it came from. A district answers one of the seven questions the fit engine
          asks. The other six are answered by a parcel, and this screen says so on every district
          rather than at the bottom in small print.
        </p>
      </header>

      <div className="zoning-counts">
        {[
          { id: "districts", value: NUM.format(EDMONTON_DISTRICTS.length), label: "Zoning districts", href: ZONING_MAP_DATASET },
          { id: "heights", value: NUM.format(heightPublishing), label: "Publish a Height on the map", href: ZONING_MAP_DATASET },
          { id: "areas", value: NUM.format(mappedAreas), label: "Mapped zone areas", href: ZONING_MAP_DATASET },
          { id: "overlays", value: NUM.format(EDMONTON_OVERLAYS.length), label: "Overlay records", href: OVERLAY_DATASET },
        ].map((item) => (
          <p key={item.id} className="zoning-figure">
            <strong className="zoning-figure-value">{item.value}</strong>
            <span className="zoning-figure-label">{item.label}</span>
            <a className="zoning-source" href={item.href} target="_blank" rel="noreferrer">
              Source
            </a>
          </p>
        ))}
      </div>

      {/* WHY THERE IS NO ADDRESS BOX, said where a reader would look for one
          rather than in a footnote — and said in the artifact's own words, so
          the sentence on screen cannot drift from the data behind it. */}
      <div className="zoning-cannot">
        <p className="zoning-cannot-head">What this data cannot answer</p>
        <ul>
          {EDMONTON_CONSTRAINT_SET.whatThisCannotAnswer.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <a className="zoning-map-link" href={CITY_ZONING_MAP_URL} target="_blank" rel="noreferrer">
          Open the City&rsquo;s zoning map for a specific parcel
        </a>
      </div>

      <form className="zoning-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="zoning-search-label" htmlFor="zoning-code">
          Zone code or district name
        </label>
        <input
          id="zoning-code"
          className="zoning-input"
          type="search"
          autoComplete="off"
          placeholder="RS · RM h16 · River Valley"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="zoning-search-note">
          This searches the {NUM.format(EDMONTON_DISTRICTS.length)} zone codes the City publishes. It
          cannot find a district from a street address: Aura holds no parcel geometry, so an address
          box here would be returning a guess with a confident face on it.
        </p>
      </form>

      <p className="zoning-count-line">
        {found.length === 0
          ? "No zone code or district name contains that."
          : `Showing ${NUM.format(Math.min(found.length, RESULT_LIMIT))} of ${NUM.format(found.length)} districts, most-mapped first.`}
      </p>

      <ul className="zoning-results">
        {found.slice(0, RESULT_LIMIT).map((item) => (
          <li key={item.code}>
            <button
              type="button"
              className="zoning-result"
              aria-pressed={item.code === code}
              onClick={() => setCode(item.code)}
            >
              <span className="zoning-result-code">{item.code}</span>
              <span className="zoning-result-name">{item.name}</span>
              <span className="zoning-result-meta">
                {item.maxHeightM === null
                  ? "no Height on the map"
                  : `${item.maxHeightM.toFixed(1)} m Height`}
                {" · "}
                {NUM.format(item.mappedAreas)} areas
              </span>
            </button>
          </li>
        ))}
      </ul>

      {district && check ? (
        <article className="zoning-panel" aria-live="polite">
          <div className="zoning-panel-head">
            <div>
              <p className="zoning-code">{district.code}</p>
              <h3 className="zoning-name">{district.name}</h3>
            </div>
            <p
              className={
                check.verdict === "district-rule-blocks"
                  ? "zoning-verdict zoning-verdict-blocks"
                  : "zoning-verdict zoning-verdict-open"
              }
            >
              {ZONING_VERDICT_COPY[check.verdict].title}
            </p>
          </div>

          {/* THE UNANSWERED COUNT LEADS. The one verified figure sits under it,
              never above it — that ordering is the whole point of this block,
              and tests/land-ui.spec.ts compares the two positions in the
              rendered text rather than just checking both are present. */}
          <div className="zoning-ratio">
            <p className="zoning-ratio-big">
              {NUM.format(check.outstanding)} of {NUM.format(check.findings.length)} questions
              unanswered
            </p>
            <p className="zoning-ratio-small">
              {check.evidenced === 0
                ? "This district publishes none of them. Everything below needs parcel evidence."
                : `${NUM.format(check.evidenced)} answered by the City's published rules · read on the City's extract of ${EXTRACT_DATE}`}
            </p>
            <p className="zoning-verdict-body">{ZONING_VERDICT_COPY[check.verdict].body}</p>
          </div>

          <div className="zoning-design">
            <p className="zoning-design-head">Checked against the design on this page</p>
            <p className="zoning-design-figure">
              {NUM.format(Math.round(requirements.floorAreaSqft))} sqft floor area ·{" "}
              {NUM.format(Math.round(requirements.footprintSqft))} sqft footprint ·{" "}
              {requirements.maxHeightFt.toFixed(1)} ft tall · {requirements.storeys === 1 ? "one" : "two"} storey
            </p>
            <p className="zoning-design-note">
              Those four numbers come from your design, not from the City. Change them in the Design
              fit controls above and this answer changes with them.
            </p>
          </div>

          {/* WHAT THE CITY'S REGISTER SAYS. It sits directly above the panel
              where a reader states their own lot because that is where its one
              answerable number goes: the register publishes an AREA, and the
              "Lot area (sq ft)" field below is what takes one. Below the
              unanswered count, because a district typical answers none of the
              seven questions — it is context for the lot somebody states, not
              a published rule, and the panel's ordering rule is that what the
              district cannot answer leads. */}
          <RegisterSurface district={district} />

          {/* THE ONE QUESTION THE READER CAN ANSWER. It sits here, below the
              unanswered count and above the published figure, on purpose: the
              ordering rule for this panel is that what the district cannot
              answer leads, and the lot somebody states is the answer to one of
              those six — not a second published fact. It takes no props beyond
              what this block already holds, so /land keeps mounting
              `<ZoningLookup requirements={requirements} />` unchanged. */}
          <StatedLotPanel district={district} requirements={requirements} />

          <div className="zoning-published">
            <p className="zoning-section-head">What the City publishes about {district.code}</p>
            <div className="zoning-figures">
              {districtFigures(district).map((figure) => (
                <p key={figure.id} className="zoning-figure">
                  <strong className="zoning-figure-value">{figure.value}</strong>
                  <span className="zoning-figure-label">{figure.label}</span>
                  <a className="zoning-source" href={figure.sourceHref} target="_blank" rel="noreferrer">
                    {figure.sourceLabel}
                  </a>
                </p>
              ))}
            </div>
            {(() => {
              const section = districtSection(district);
              return (
                <p className="zoning-section-link">
                  <a href={section.href} target="_blank" rel="noreferrer">
                    {section.label}
                  </a>
                  {section.note ? <span className="zoning-reason">{section.note}</span> : null}
                </p>
              );
            })()}
            <p className="zoning-caution">{EDMONTON_CONSTRAINT_SET.modifierConvention.caution}</p>
          </div>

          <ol className="zoning-questions">
            {check.findings.map((finding) => {
              const state = STATE_OF_SEVERITY[finding.severity];
              const reason = reasonForFinding(district, finding);
              return (
                <li key={finding.id} className="zoning-question">
                  <div className="zoning-question-head">
                    <p className="zoning-question-label">{finding.label}</p>
                    <span className={state.className}>{state.text}</span>
                  </div>
                  <p className="zoning-detail">{finding.detail}</p>
                  {reason ? <p className="zoning-reason">{reason}</p> : null}
                  {finding.sourceUrl ? (
                    <a className="zoning-source" href={finding.sourceUrl} target="_blank" rel="noreferrer">
                      Zoning Bylaw 20001 · this district&rsquo;s section
                    </a>
                  ) : (
                    <span className="zoning-reason">
                      This district has no single bylaw section in the current extract, so this
                      question carries no link of its own.
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </article>
      ) : null}

      <div className="zoning-overlays">
        <p className="zoning-section-head">Overlays and special areas</p>
        <p className="zoning-overlays-note">
          An overlay adds to or overrides the district underneath it, so a ceiling read without them
          is an overstatement. The extract does not say which overlays touch which district — that
          join needs the parcel geometry Aura does not hold — so these are shown whole rather than
          attached to the zone above.{" "}
          {NUM.format(notInForce.length)} of the {NUM.format(EDMONTON_OVERLAYS.length)} records are
          recorded as not in force, {NUM.format(repealedBylaw)} of them under the repealed Zoning
          Bylaw 12800. They are on screen because they are in the City&rsquo;s own extract, not
          because they still govern anything.
        </p>
        <ul>
          {EDMONTON_OVERLAYS.map((overlay) => (
            <li
              key={`${overlay.code}-${overlay.bylawNumber ?? "none"}`}
              className={
                overlayInForce(overlay) === true
                  ? "zoning-overlay zoning-overlay-live"
                  : "zoning-overlay zoning-overlay-dead"
              }
            >
              <span className="zoning-overlay-code">{overlay.code}</span>
              <span className="zoning-overlay-name">
                {overlay.name}
                {overlay.specialArea ? " · special area" : ""}
              </span>
              <span className="zoning-overlay-status">{overlayStatusText(overlay)}</span>
            </li>
          ))}
        </ul>
        <a className="zoning-source" href={OVERLAY_DATASET} target="_blank" rel="noreferrer">
          City of Edmonton Zoning Overlays · read {EXTRACT_DATE}
        </a>
      </div>

      <p className="zoning-attrib">
        {attribution.text}{" "}
        <a href={attribution.termsUrl} target="_blank" rel="noreferrer">
          Open Data Terms of Use
        </a>
      </p>
    </section>
  );
}

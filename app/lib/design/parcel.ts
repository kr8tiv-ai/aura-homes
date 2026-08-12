/* ---------------------------------------------------------------------
   PARCEL FIT — the first real step of designing for a specific piece of
   land, rather than for a square footage in the abstract.

   WHY IT IS A SEPARATE MODULE. `layout.ts`, `materials.ts` and
   `blueprint.ts` are a verified line-by-line port of the Python design
   service — diffed leaf value by leaf value against it. Teaching any of
   them about lots would silently break that guarantee, and the guarantee
   is worth more than the convenience. So the parcel arithmetic sits
   beside them and consumes their output: a solved plan goes in, findings
   about THIS piece of land come out, and the drawing is untouched.

   WHAT IT HONESTLY IS. Four checks, all of them arithmetic on numbers the
   owner typed:

   · BUILDABLE ENVELOPE — lot less setbacks, against the solved footprint,
     tried both ways round. Pure subtraction and two comparisons. This is
     the one that can say NO, and it is the most valuable thing on the page.
   · SITE COVERAGE — footprint over lot area, as a FIGURE. Aura has not
     read your district's land use bylaw, so it prints no maximum and
     renders no verdict against one it invented.
   · SOLAR ORIENTATION — the eco spec is passive solar with south-facing
     glazing. Given which way the front lot line faces, the two square-to-
     the-lot placements put the long glazing wall on different walls, and
     only one of them can point south. Geometry, not a solar-gain model.
   · SLOPE — mapped to a plain consequence for the screw-pile foundation
     the spec commits to. Three answers, three different costs.

   WHAT IT IS NOT, said here so no caller can forget it: not a permit
   check, not a zoning opinion, not a site plan, and not a survey. Aura
   facilitates and carries no liability; the district's land use bylaw, a
   real survey and a safety codes officer are the authorities. Every
   number below is derived from owner-entered inputs and is labelled as
   derived where it is shown.

   WHAT IT DELIBERATELY DOES NOT MODEL, because guessing would be worse
   than silence: easements, environmental reserve, riparian and
   daylighting setbacks, corner-lot flanking rules, irregular and pie
   lots, accessory buildings, driveway access, and anything to do with
   soil. Those are named in `assumptions` rather than quietly ignored.

   PURITY CONTRACT, the same one the three ports carry: no network, no
   Node APIs, no `Math.random`, no `Date.now`. The same lot and the same
   plan always produce the same findings.
--------------------------------------------------------------------- */

import type { FloorPlan } from "@/lib/designApi";
import { formatFeetInches } from "@/lib/units";
/* Read-only import. `envelopeFor` is the engine's own footprint chooser,
   and the "largest area that would fit" suggestion has to agree with the
   plan the engine will actually solve — including its rounding to
   buildable 6" dimensions. Re-deriving that arithmetic here would produce
   a recommendation that misses by a few inches, which on a lot that is
   already too small is the difference between a fix and another failure. */
import { envelopeFor } from "./layout";

// --------------------------------------------------------------------------
// the facts a lot can contribute today
// --------------------------------------------------------------------------

/** Ground under the home, as the owner would describe it standing on it. */
export type Slope = "flat" | "gentle" | "steep";

/**
 * Which way the front (street or access) lot line faces.
 *
 * `unknown` is a real answer and the default. It is the single input that
 * decides the solar check, and Aura does not assume a compass direction
 * for someone else's land.
 */
export type Facing = "unknown" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

/** Everything the owner tells us about the parcel. Feet throughout. */
export interface ParcelFacts {
  /** Frontage — the lot dimension along the front (street/access) line. */
  lotWidthFt: number;
  /** Depth — front line to rear line. */
  lotDepthFt: number;
  frontSetbackFt: number;
  sideSetbackFt: number;
  rearSetbackFt: number;
  frontFaces: Facing;
  slope: Slope;
}

// --------------------------------------------------------------------------
// what comes back
// --------------------------------------------------------------------------

/**
 * How loudly a finding needs to be heard.
 *
 * `blocking` is reserved for the two things that stop the design being
 * placeable on this land at all: unusable inputs, and a footprint that
 * does not fit the buildable envelope. Nothing else earns it — a
 * severity that fires on advice is a severity nobody reads.
 */
export type ParcelSeverity = "blocking" | "caution" | "note";

export type ParcelTopic = "inputs" | "envelope" | "coverage" | "solar" | "slope";

/** A labelled number in a finding. `sub` says where it came from. */
export interface ParcelFigure {
  k: string;
  v: string;
  sub?: string;
}

export interface ParcelFinding {
  id: ParcelTopic;
  severity: ParcelSeverity;
  title: string;
  detail: string;
  figures?: ParcelFigure[];
}

/**
 * One of the two ways a rectangular home sits square to a rectangular lot.
 *
 * Both are tried, always. A plan that does not fit one way round very
 * often fits the other, and which one you choose is also what decides
 * where the glazing wall points — so the fit check and the solar check
 * are answered by the same object rather than by two that can disagree.
 */
export interface Placement {
  id: "along_frontage" | "front_to_back";
  /** Plain-language description of how the home is turned. */
  label: string;
  /** Footprint dimension parallel to the front lot line. */
  acrossFt: number;
  /** Footprint dimension running front to back. */
  alongFt: number;
  fits: boolean;
  /** Buildable envelope left over, feet. Negative when it does not fit. */
  slackAcrossFt: number;
  slackAlongFt: number;
  /**
   * Compass bearing of the outward normal of the long (glazing) wall, in
   * degrees clockwise from north — the better of the wall's two faces.
   * `null` when the owner has not said which way the front line faces.
   */
  glazingBearingDeg: number | null;
  /** Absolute angular distance from due south, degrees. */
  offSouthDeg: number | null;
  glazingCompass: string | null;
  /** True when the south-facing long wall is the one facing the street. */
  glazingFacesStreet: boolean;
}

export interface ParcelReport {
  /** False when the inputs cannot produce a buildable rectangle. */
  usable: boolean;
  /** True when at least one placement fits the buildable envelope. */
  fits: boolean;

  lotSqFt: number;
  lotAcres: number;
  buildableWidthFt: number;
  buildableDepthFt: number;
  buildableSqFt: number;

  footprintSqFt: number;
  coveragePct: number;

  placements: Placement[];
  /** The fitting placement whose glazing wall comes closest to south. */
  chosen: Placement | null;

  /** Largest footprint at this plan's proportions, sq ft. */
  largestFitSqFt: number | null;
  /** That footprint's dimensions, long side first. */
  largestFitDims: [number, number] | null;
  /**
   * A total floor area the questionnaire will accept whose solved
   * envelope actually fits — verified by re-running `envelopeFor`, not
   * estimated. `null` when nothing in range fits.
   */
  suggestedTotalSqFt: number | null;

  findings: ParcelFinding[];
  assumptions: string[];
}

// --------------------------------------------------------------------------
// constants
// --------------------------------------------------------------------------

/** design-api/app/models.py — DesignRequest.total_sq_ft bounds. */
const MIN_TOTAL_SQ_FT = 200;
const MAX_TOTAL_SQ_FT = 4000;

/** The questionnaire's area step, so a suggestion can be typed straight in. */
const TOTAL_STEP_SQ_FT = 10;

const SQ_FT_PER_ACRE = 43_560;

/**
 * The passive-solar window, degrees either side of due south.
 *
 * A rule of thumb from passive-solar practice, not a code number and not
 * a modelled figure — which is exactly how the copy states it. Winter
 * gain falls away gradually inside this band and sharply outside it.
 */
const SOLAR_WINDOW_DEG = 30;

/**
 * A site-coverage range commonly seen in Alberta country-residential
 * districts. UNVERIFIED for any particular parcel, used only to decide
 * whether coverage is worth flagging as the first thing to check — never
 * as a limit to pass or fail against. See `coverageFinding`.
 */
const COVERAGE_RULE_OF_THUMB_MAX_PCT = 40;

/** Feet are multiples of 0.5 out of the engine; this only kills float noise. */
const EPS = 1e-9;

// --------------------------------------------------------------------------
// formatting
// --------------------------------------------------------------------------
//
// This copy existed because `lib` must not depend on `components`, where the
// original formatter lived. `lib/units` satisfies that rule for everyone, so
// the body now lives there and only the short local name remains.

/** Feet-and-inches the way the drawing's dimension strings read: 34'-6". */
const ft = (v: number): string => formatFeetInches(v);

const sq = (n: number): string => `${Math.round(n).toLocaleString("en-CA")} sq ft`;

const one = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("en-CA");

const two = (n: number): string =>
  (Math.round(n * 100) / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// --------------------------------------------------------------------------
// compass
// --------------------------------------------------------------------------

/** Bearing of each facing, degrees clockwise from north. */
export const FACING_DEG: Record<Exclude<Facing, "unknown">, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
};

const POINTS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;

const bearingName = (deg: number): string => POINTS[Math.round(norm(deg) / 45) % 8];

/** Shortest angular distance from a bearing to due south, degrees. */
function offSouth(deg: number): number {
  const d = norm(deg - 180);
  return d > 180 ? 360 - d : d;
}

// --------------------------------------------------------------------------
// the buildable envelope — the whole check in two subtractions
// --------------------------------------------------------------------------

export interface BuildableEnvelope {
  /** Across the frontage: lot width less a side setback on each side line. */
  widthFt: number;
  /** Front to back: lot depth less the front and rear setbacks. */
  depthFt: number;
  areaSqFt: number;
  usable: boolean;
}

/**
 * buildable = (lotW - 2 x side) x (lotD - front - rear).
 *
 * Exported because the questionnaire shows this live, before anything is
 * generated: it is the number that tells an owner whether the rest of the
 * form is even worth filling in.
 */
export function buildableEnvelope(parcel: ParcelFacts): BuildableEnvelope {
  const widthFt = parcel.lotWidthFt - 2 * parcel.sideSetbackFt;
  const depthFt = parcel.lotDepthFt - parcel.frontSetbackFt - parcel.rearSetbackFt;
  const usable = widthFt > EPS && depthFt > EPS;
  return {
    widthFt,
    depthFt,
    areaSqFt: usable ? widthFt * depthFt : 0,
    usable,
  };
}

// --------------------------------------------------------------------------
// placement
// --------------------------------------------------------------------------

function placementFor(
  id: Placement["id"],
  acrossFt: number,
  alongFt: number,
  env: BuildableEnvelope,
  frontFaces: Facing
): Placement {
  const fits =
    env.usable && acrossFt <= env.widthFt + EPS && alongFt <= env.depthFt + EPS;

  /* Where the long wall points. Square to the lot lines, the long walls of
     `along_frontage` are the front and rear walls, so their outward normals
     are the front bearing and its opposite; turned front to back, the long
     walls are the side walls, at ninety degrees to those. */
  let glazingBearingDeg: number | null = null;
  let offSouthDeg: number | null = null;
  let glazingFacesStreet = false;

  if (frontFaces !== "unknown") {
    const front = FACING_DEG[frontFaces];
    const base = id === "along_frontage" ? front : front + 90;
    const a = norm(base);
    const b = norm(base + 180);
    /* Either face of the wall can carry the glass; the one nearer south is
       the one a passive-solar plan would use. Ties resolve to `a`, which
       keeps the answer stable for a given lot. */
    const pick = offSouth(a) <= offSouth(b) ? a : b;
    glazingBearingDeg = pick;
    offSouthDeg = offSouth(pick);
    glazingFacesStreet = id === "along_frontage" && Math.abs(pick - norm(front)) < EPS;
  }

  return {
    id,
    /* Written as a noun phrase so it reads correctly in all three places it
       is used: "with the {label}", "the other placement — {label} —", and
       "{label} — needs ...". */
    label:
      id === "along_frontage"
        ? "long wall parallel to the front lot line"
        : "long wall running front to back, ninety degrees to the street",
    acrossFt,
    alongFt,
    fits,
    slackAcrossFt: env.widthFt - acrossFt,
    slackAlongFt: env.depthFt - alongFt,
    glazingBearingDeg,
    offSouthDeg,
    glazingCompass: glazingBearingDeg === null ? null : bearingName(glazingBearingDeg),
    glazingFacesStreet,
  };
}

/**
 * The fitting placement whose glazing wall comes closest to south.
 *
 * When neither fits, the better-oriented one is still returned so the solar
 * finding can describe the lot honestly — the envelope finding has already
 * said, in its own words, that nothing goes on it yet.
 */
function choose(placements: Placement[]): Placement | null {
  const pool = placements.filter((p) => p.fits);
  const from = pool.length > 0 ? pool : placements;
  if (from.length === 0) return null;
  return from.reduce((best, p) => {
    const a = p.offSouthDeg ?? Infinity;
    const b = best.offSouthDeg ?? Infinity;
    // Strictly-less keeps ties on the first entry: sitting square to the
    // street is what actually gets built, so it wins a tie.
    return a < b ? p : best;
  });
}

// --------------------------------------------------------------------------
// the largest that would fit
// --------------------------------------------------------------------------

const fitsEither = (
  w: number,
  h: number,
  env: BuildableEnvelope
): boolean =>
  (w <= env.widthFt + EPS && h <= env.depthFt + EPS) ||
  (h <= env.widthFt + EPS && w <= env.depthFt + EPS);

/**
 * The largest total floor area the questionnaire accepts whose SOLVED
 * envelope fits — found by asking `envelopeFor` rather than by inverting
 * it, because it rounds to buildable 6" dimensions and an inverted formula
 * would hand back a number that misses by an inch and fails again.
 *
 * Bounded: it steps down in the questionnaire's own 10 sq ft increments
 * from at most 4,000 to 200, so at most 380 iterations.
 */
function largestBuildableTotal(
  env: BuildableEnvelope,
  storeys: number,
  ceilingSqFt: number
): number | null {
  if (!env.usable) return null;
  let total =
    Math.floor(Math.min(ceilingSqFt, MAX_TOTAL_SQ_FT) / TOTAL_STEP_SQ_FT) *
    TOTAL_STEP_SQ_FT;
  while (total >= MIN_TOTAL_SQ_FT) {
    const [w, h] = envelopeFor(total, storeys);
    if (fitsEither(w, h, env)) return total;
    total -= TOTAL_STEP_SQ_FT;
  }
  return null;
}

// --------------------------------------------------------------------------
// the findings
// --------------------------------------------------------------------------

function envelopeFinding(
  parcel: ParcelFacts,
  env: BuildableEnvelope,
  placements: Placement[],
  chosen: Placement | null,
  longFt: number,
  shortFt: number,
  footprintSqFt: number,
  largestFitSqFt: number | null,
  largestFitDims: [number, number] | null,
  suggestedTotalSqFt: number | null,
  storeys: number
): ParcelFinding {
  const envLine = `${ft(env.widthFt)} across the frontage by ${ft(
    env.depthFt
  )} front to back (${sq(env.areaSqFt)})`;
  const homeLine = `${ft(longFt)} x ${ft(shortFt)} (${sq(footprintSqFt)})`;

  const figures: ParcelFigure[] = [
    {
      k: "Buildable envelope",
      v: `${ft(env.widthFt)} × ${ft(env.depthFt)}`,
      sub: `Derived: your ${ft(parcel.lotWidthFt)} × ${ft(
        parcel.lotDepthFt
      )} lot less the ${ft(parcel.frontSetbackFt)} front, ${ft(
        parcel.sideSetbackFt
      )} side and ${ft(parcel.rearSetbackFt)} rear setbacks you entered`,
    },
    {
      k: "Solved footprint",
      v: `${ft(longFt)} × ${ft(shortFt)}`,
      sub: `${sq(footprintSqFt)} — from the plan above, not re-derived here`,
    },
  ];

  if (chosen?.fits) {
    figures.push({
      k: "Room to spare",
      v: `${ft(chosen.slackAcrossFt)} × ${ft(chosen.slackAlongFt)}`,
      sub: `Derived, across the frontage × front to back, with the ${chosen.label}`,
    });
    return {
      id: "envelope",
      severity: "note",
      title: "The home fits inside your setbacks",
      detail:
        `The buildable envelope derived from your numbers is ${envLine}. The solved ` +
        `footprint is ${homeLine}, so it goes in with the ${chosen.label}, leaving ` +
        `${ft(chosen.slackAcrossFt)} across the frontage and ${ft(
          chosen.slackAlongFt
        )} front to back. That leftover is where the driveway, the deck and the ` +
        `hot tub, the array and the septic field have to live — this check places the ` +
        `home only.`,
      figures,
    };
  }

  // --- it does not fit. Say so with both numbers, per placement.
  const bust = (p: Placement): string => {
    const parts: string[] = [];
    if (p.acrossFt > env.widthFt + EPS)
      parts.push(
        `needs ${ft(p.acrossFt)} across the frontage where there is ${ft(env.widthFt)}`
      );
    if (p.alongFt > env.depthFt + EPS)
      parts.push(`needs ${ft(p.alongFt)} front to back where there is ${ft(env.depthFt)}`);
    return `with the ${p.label} it ${parts.join(", and ")}`;
  };

  const remedy =
    largestFitSqFt !== null && largestFitDims !== null
      ? ` At this plan's proportions the largest footprint that fits is about ${sq(
          largestFitSqFt
        )} — roughly ${ft(largestFitDims[0])} × ${ft(largestFitDims[1])}` +
        (suggestedTotalSqFt !== null
          ? `, which is ${sq(suggestedTotalSqFt)} of floor area over ${
              storeys === 2 ? "two storeys" : "one storey"
            }.`
          : `. Nothing the questionnaire accepts solves small enough for this envelope.`)
      : "";

  figures.push({
    k: "Shortfall",
    v: placements
      .map((p) =>
        [
          p.acrossFt > env.widthFt + EPS ? ft(p.acrossFt - env.widthFt) : null,
          p.alongFt > env.depthFt + EPS ? ft(p.alongFt - env.depthFt) : null,
        ]
          .filter(Boolean)
          .join(" + ")
      )
      .filter((s) => s.length > 0)
      .join("  ·  "),
    sub: "Derived: how far past the buildable envelope each placement runs",
  });

  if (largestFitSqFt !== null && largestFitDims !== null) {
    figures.push({
      k: "Largest that fits",
      v: `${sq(largestFitSqFt)}`,
      sub: `Derived at this plan's ${two(longFt / shortFt)}:1 proportions — about ${ft(
        largestFitDims[0]
      )} × ${ft(largestFitDims[1])}`,
    });
  }

  return {
    id: "envelope",
    severity: "blocking",
    title: "This home does not fit inside your setbacks",
    detail:
      `The buildable envelope derived from your numbers is ${envLine}. The solved ` +
      `footprint is ${homeLine}, and it does not go in either way round: ` +
      `${placements.map(bust).join("; ")}.${remedy} Nothing above has been ` +
      `resized for you — the drawing is still the home you asked for.`,
    figures,
  };
}

function coverageFinding(
  parcel: ParcelFacts,
  lotSqFt: number,
  lotAcres: number,
  footprintSqFt: number,
  coveragePct: number
): ParcelFinding {
  const high = coveragePct > COVERAGE_RULE_OF_THUMB_MAX_PCT;

  /* HONESTY RULE, enforced here rather than in the copy alone: Aura has not
     read this parcel's land use bylaw, so it prints no maximum and returns
     no pass/fail. `high` only decides whether coverage is worth reading
     first — never whether it is legal. */
  return {
    id: "coverage",
    severity: high ? "caution" : "note",
    title: `Site coverage — ${one(coveragePct)}% of the lot`,
    detail:
      `Derived: a ${sq(footprintSqFt)} footprint on a ${sq(lotSqFt)} lot (${two(
        lotAcres
      )} acres) is ${one(coveragePct)}% site coverage.` +
      (high
        ? ` That is above the 30–40% band commonly seen in Alberta country-residential ` +
          `districts, so it is the first number to take to your district's table.`
        : ``) +
      ` Aura has not verified a maximum for your district and will not print one it ` +
      `has not read: site coverage limits are set by the land use bylaw district your ` +
      `parcel sits in and they vary — the number that governs you is in that table, ` +
      `not here. Two things to carry with it: most bylaws count accessory buildings, ` +
      `and many count decks and covered areas, so the Aura deck and hot tub are ` +
      `likely part of your real figure; and it is the DISTRICT, not the county, whose ` +
      `table you need.`,
    figures: [
      {
        k: "Lot area",
        v: sq(lotSqFt),
        sub: `Derived: ${ft(parcel.lotWidthFt)} × ${ft(parcel.lotDepthFt)} as entered — ${two(
          lotAcres
        )} acres`,
      },
      {
        k: "Site coverage",
        v: `${one(coveragePct)}%`,
        sub: "Derived: home footprint ÷ lot area. Judged against nothing — see above",
      },
    ],
  };
}

function solarFinding(
  parcel: ParcelFacts,
  chosen: Placement | null,
  placements: Placement[],
  anyFits: boolean
): ParcelFinding {
  /* When nothing fits yet, the orientation is still a true fact about the
     lot — it is just not the headline. The lead-in carries that, and the
     sentence after it stays lower-case so the join reads as one sentence. */
  const sited = anyFits
    ? ""
    : "Once the footprint fits, the lot has already decided the orientation: ";
  const Cap = (s: string): string =>
    sited === "" ? s.charAt(0).toUpperCase() + s.slice(1) : sited + s;

  if (parcel.frontFaces === "unknown" || !chosen || chosen.offSouthDeg === null) {
    return {
      id: "solar",
      severity: "note",
      title: "Solar orientation — not checked, because Aura does not know where south is",
      detail:
        `The Aura spec is passive solar: the long wall carries south-facing triple ` +
        `glazing for winter gain. Square to a rectangular lot there are only two ` +
        `placements, and they put that long wall on different lot lines — one of them ` +
        `can face south and the other cannot. Which is which depends entirely on the ` +
        `direction your front lot line faces, and Aura has not assumed one. Answer ` +
        `that above and this becomes a real check instead of a blank.`,
      figures: [
        {
          k: "Front lot line faces",
          v: "Not answered",
          sub: "The one input this check needs",
        },
      ],
    };
  }

  const off = chosen.offSouthDeg;
  const inWindow = off <= SOLAR_WINDOW_DEG + EPS;
  const facing = chosen.glazingCompass ?? "unknown";

  const figures: ParcelFigure[] = [
    {
      k: "Glazing wall faces",
      v: facing,
      sub: `Derived from the front lot line facing ${bearingName(
        FACING_DEG[parcel.frontFaces]
      )}, with the ${chosen.label}`,
    },
    {
      k: "Off due south",
      v: `${one(off)}°`,
      sub: `Derived. Passive-solar practice keeps this inside about ${SOLAR_WINDOW_DEG}°`,
    },
  ];

  if (inWindow) {
    const other = placements.find((p) => p.id !== chosen.id);
    return {
      id: "solar",
      severity: "note",
      title:
        off < EPS
          ? "Solar orientation — the glazing wall can face due south"
          : `Solar orientation — the glazing wall lands ${one(off)}° off south`,
      detail:
        Cap(`with the ${chosen.label}, the long glazing wall faces ${facing}`) +
        (off < EPS ? "" : `, ${one(off)}° off due south`) +
        `. That is inside the roughly ${SOLAR_WINDOW_DEG}-degree window passive-solar ` +
        `design works in, so the spec's south glazing lands where it is supposed to on ` +
        `this lot.` +
        (other && other.offSouthDeg !== null && other.offSouthDeg > off
          ? ` The other placement — ${other.label} — would put it ${one(
              other.offSouthDeg
            )}° off south instead, so the siting is not arbitrary.`
          : ``) +
        (chosen.glazingFacesStreet
          ? ` One thing to look at on site: on this placement the glazing wall is the ` +
            `one facing the street. That is a privacy and screening question, not a ` +
            `geometry problem.`
          : ``) +
        ` This is the angle only. Aura has not modelled solar gain for your site — ` +
        `that is a calculation on real weather data and real horizon shading, and this ` +
        `step does not do it.`,
      figures,
    };
  }

  return {
    id: "solar",
    severity: "caution",
    title: `Solar orientation — the glazing wall lands ${one(off)}° off south`,
    detail:
      Cap(`square to your lot lines, the best either placement can do is a long `) +
      `glazing wall facing ${facing} — ${one(off)}° off due south, outside the roughly ` +
      `${SOLAR_WINDOW_DEG}-degree window passive-solar design works in. What it costs: ` +
      `the winter gain the glass wall is there to collect drops and shifts to one end of ` +
      `the day, so the wood stove and the array carry more of the winter, and the summer ` +
      `overheating risk moves to the afternoon on a south-west wall. The glass is not ` +
      `wasted — it is just no longer the heating strategy the spec assumes. Three fixes, ` +
      `all of them siting decisions rather than drawing changes: rotate the home off the ` +
      `lot lines toward south (the setbacks still measure to the lot lines, so a rotated ` +
      `home eats more of the envelope — re-check the fit above), site it where the lot ` +
      `allows a different angle, or accept the ${facing} wall and re-plan the glazing ` +
      `onto the wall that does face south. Aura has not modelled the kWh either way; ` +
      `this is the angle, stated honestly.`,
    figures,
  };
}

function slopeFinding(parcel: ParcelFacts): ParcelFinding {
  /* The Aura spec commits to no concrete and protected galvanized screw
     piles, so slope is not a generic site note here — it is the foundation
     line item, and the three answers cost three different amounts. */
  if (parcel.slope === "flat") {
    return {
      id: "slope",
      severity: "note",
      title: "Slope — flat, so the pile foundation is as costed",
      detail:
        `A flat pad is what the screw-pile schedule in the budget assumes: piles to a ` +
        `uniform embedment, one repeated detail, no engineered variation. Two things ` +
        `flat ground does not tell you, and this step cannot: what the soil is, and ` +
        `where the water goes. Pile capacity comes from the soil, and the pile ` +
        `installer's torque readings are what confirm it on the day.`,
    };
  }

  if (parcel.slope === "gentle") {
    return {
      id: "slope",
      severity: "note",
      title: "Slope — gentle, so pile heights step and the schedule lengthens",
      detail:
        `A gentle fall is the case screw piles are good at: the pile heights step to ` +
        `hold one level floor, which means longer piles on the low side and a taller ` +
        `skirt to close and insulate the crawl space under them. Expect a modest cost ` +
        `over flat — more pile length, more skirt, a longer set — not a different kind ` +
        `of foundation. It is still a catalog detail. Budget the drainage away from the ` +
        `piles on the uphill side; that is the part people leave out.`,
    };
  }

  return {
    id: "slope",
    severity: "caution",
    title: "Slope — steep, so the foundation becomes engineered work",
    detail:
      `On a steep site the pile foundation stops being a repeated catalog detail. ` +
      `Long exposed piles carry lateral load and the embedment differs pile to pile, ` +
      `so this needs a foundation design and a P.Eng stamp on it rather than a ` +
      `standard schedule — and the cost moves materially, not marginally: engineering ` +
      `fees, longer and heavier piles, bracing, plus getting the pile rig onto the ` +
      `slope in the first place. Cut-and-fill to make a flat bench is the other route, ` +
      `and it has its own earthworks cost and its own drainage consequences. Neither ` +
      `is priced here. What does not change: this is exactly the case where the ` +
      `stamped foundation design is worth having before anything else is ordered.`,
  };
}

// --------------------------------------------------------------------------
// the public entry point
// --------------------------------------------------------------------------

const SEVERITY_ORDER: Record<ParcelSeverity, number> = {
  blocking: 0,
  caution: 1,
  note: 2,
};

/**
 * Check a solved plan against a specific parcel.
 *
 * Takes the plan's envelope only (`width` x `height`) so a `FloorPlan` or a
 * `SolvedFloorPlan` can be passed without a cast, and so this module can
 * never accidentally influence the geometry it is measuring.
 *
 * Deterministic and total: it always returns a report. Unusable inputs come
 * back as a `blocking` finding, not as a throw and not as a silent pass.
 */
export function analyseParcel(
  parcel: ParcelFacts,
  plan: Pick<FloorPlan, "width" | "height">,
  storeys = 1
): ParcelReport {
  const env = buildableEnvelope(parcel);

  const lotSqFt = Math.max(0, parcel.lotWidthFt) * Math.max(0, parcel.lotDepthFt);
  const lotAcres = lotSqFt / SQ_FT_PER_ACRE;

  const longFt = Math.max(plan.width, plan.height);
  const shortFt = Math.min(plan.width, plan.height);
  const footprintSqFt = plan.width * plan.height;
  const coveragePct = lotSqFt > 0 ? (footprintSqFt / lotSqFt) * 100 : 0;

  const assumptions = [
    "The home sits square to the lot lines. A rotated home is legal and often better for solar, but it uses more of the buildable envelope and this check does not model it.",
    "Side setbacks are taken on the two lot lines running front to back; the front and rear setbacks are taken off the depth.",
    "The lot is treated as a rectangle. Pie lots, corner lots with a flanking setback, and irregular parcels need their own drawing.",
    "Easements, environmental reserve, riparian and daylighting setbacks, right-of-way widenings and utility rights-of-way are not modelled at all. Any one of them can cut the envelope below what is shown here.",
    "Driveway, well and septic separation distances, and soil bearing, are not checked. Nothing here is a site plan.",
  ];

  if (!env.usable) {
    return {
      usable: false,
      fits: false,
      lotSqFt,
      lotAcres,
      buildableWidthFt: env.widthFt,
      buildableDepthFt: env.depthFt,
      buildableSqFt: 0,
      footprintSqFt,
      coveragePct,
      placements: [],
      chosen: null,
      largestFitSqFt: null,
      largestFitDims: null,
      suggestedTotalSqFt: null,
      assumptions,
      findings: [
        {
          id: "inputs",
          severity: "blocking",
          title: "The setbacks you entered use up the whole lot",
          detail:
            `A ${ft(parcel.lotWidthFt)} × ${ft(parcel.lotDepthFt)} lot with ${ft(
              parcel.frontSetbackFt
            )} front, ${ft(parcel.sideSetbackFt)} side and ${ft(
              parcel.rearSetbackFt
            )} rear setbacks leaves ${ft(env.widthFt)} across the frontage and ${ft(
              env.depthFt
            )} front to back. There is no buildable rectangle left, so nothing has been ` +
            `checked against your land and no result below has been adjusted. If those ` +
            `setbacks are right, this parcel needs a variance conversation before it ` +
            `needs a house. Re-read them off your district's land use bylaw — Aura does ` +
            `not know your district and has not looked it up.`,
          figures: [
            {
              k: "Across the frontage",
              v: ft(env.widthFt),
              sub: `Derived: ${ft(parcel.lotWidthFt)} less ${ft(
                parcel.sideSetbackFt
              )} on each side line`,
            },
            {
              k: "Front to back",
              v: ft(env.depthFt),
              sub: `Derived: ${ft(parcel.lotDepthFt)} less ${ft(
                parcel.frontSetbackFt
              )} front and ${ft(parcel.rearSetbackFt)} rear`,
            },
          ],
        },
      ],
    };
  }

  const placements: Placement[] = [
    placementFor("along_frontage", longFt, shortFt, env, parcel.frontFaces),
    placementFor("front_to_back", shortFt, longFt, env, parcel.frontFaces),
  ];
  const chosen = choose(placements);
  const fits = placements.some((p) => p.fits);

  /* The largest footprint at THIS plan's proportions, scaled into the
     buildable rectangle whichever way round works better. Pure arithmetic:
     the scale factor is the tighter of the two ratios in each orientation. */
  const scaleAlong = Math.min(env.widthFt / longFt, env.depthFt / shortFt);
  const scaleAcross = Math.min(env.widthFt / shortFt, env.depthFt / longFt);
  const scale = Math.max(scaleAlong, scaleAcross);
  const largestFitSqFt = footprintSqFt * scale * scale;
  const largestFitDims: [number, number] = [longFt * scale, shortFt * scale];

  const suggestedTotalSqFt = largestBuildableTotal(
    env,
    storeys,
    largestFitSqFt * storeys
  );

  const findings: ParcelFinding[] = [
    envelopeFinding(
      parcel,
      env,
      placements,
      chosen,
      longFt,
      shortFt,
      footprintSqFt,
      largestFitSqFt,
      largestFitDims,
      suggestedTotalSqFt,
      storeys
    ),
    solarFinding(parcel, chosen, placements, fits),
    coverageFinding(parcel, lotSqFt, lotAcres, footprintSqFt, coveragePct),
    slopeFinding(parcel),
  ];

  // Stable order: severity first, then the order written above — the fit
  // check leads whenever it is the loudest thing on the page.
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    usable: true,
    fits,
    lotSqFt,
    lotAcres,
    buildableWidthFt: env.widthFt,
    buildableDepthFt: env.depthFt,
    buildableSqFt: env.areaSqFt,
    footprintSqFt,
    coveragePct,
    placements,
    chosen,
    largestFitSqFt,
    largestFitDims,
    suggestedTotalSqFt,
    findings,
    assumptions,
  };
}

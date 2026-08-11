/* ===========================================================================
   DESIGN-TIME COMFORT TARGETS — what the owner is ASKING the home to do.

   WHAT THIS IS, IN ONE SENTENCE. Per-room comfort targets, stored the way IFC
   already stores them, evaluated against conditions the OWNER STATES, so the
   number on screen is always traceable to the assumption that produced it.

   WHAT THIS IS NOT, AND THE LIST IS THE POINT
   -------------------------------------------
   It is NOT an energy model. It is NOT a thermal simulation. It is NOT a
   compliance check, an HVAC sizing calculation, or a prediction. This home has
   not been built. There are no sensors, no telemetry, no weather file and no
   heat-loss calculation anywhere in this repository, so there is no honest way
   to say what the air temperature in a room WILL be.

   The simplified PMV equation needs an air temperature. Since nothing here can
   predict one, the temperature is an INPUT THE OWNER SETS, and every figure
   this module returns carries the temperature and the humidity it was computed
   from. The honest sentence about any result in here is:

       "under these assumed conditions, this room meets its stated target"

   and never "this room will be comfortable". A module that quietly dropped the
   assumption from the sentence would be an energy model with no physics in it,
   which is the single worst thing this file could become.

   WHY sPMV AND NOT PMV
   --------------------
   Fanger's PMV needs six inputs: air temperature, mean radiant temperature,
   air speed, humidity, metabolic rate and clothing insulation. Four of those
   are properties of a person standing in a finished room, and an unbuilt
   massing model can supply none of them. The SIMPLIFIED PMV takes two — air
   temperature and the water-vapour pressure derived from relative humidity —
   with the clothing and metabolic assumptions FOLDED INTO ITS COEFFICIENTS.
   That folding is exactly why it is usable here and exactly why its answer is
   narrow: you cannot vary what has been baked into a constant.

   WHAT IS ASSUMED, NAMED IN ONE PLACE (all of this is on screen too):

   · The coefficients a = 0.2803, b = 0.1717, c = 7.1383 were supplied as the
     living/active-space set. They are used verbatim and are not tuned.
   · A SECOND coefficient set for sleeping spaces — a lower metabolic rate and
     a duvet rather than clothing — was NOT available from a source this build
     could verify. Rather than invent one, sleeping spaces are evaluated with
     the SAME coefficients and flagged `modelled: false`. Their sPMV is the
     awake, clothed, active answer for a room that will be used asleep, and
     the panel says so beside every bedroom. That is the honest outcome.
   · The vapour-pressure UNIT is an interpretation. See `VAPOUR_UNIT_NOTE`.
   · Every default target below is INDICATIVE. They are ordinary residential
     comfort bands for a cold climate, not values read out of a code table,
     and `TARGET_PROVENANCE` says so in the words the panel prints.

   ROOMS COME FROM THE PLAN ENGINE, NOT FROM HERE. `toPlan.ts` already hands a
   HomeSpec to the deterministic layout solver and gets back a solved room
   program. Those rooms are the rooms. This module invents no second notion of
   one, which is why it can be wrong about nothing except comfort.

   PURE AND DETERMINISTIC. No clock, no randomness, no DOM, no network. The
   same spec and the same settings always produce the same report.
   =========================================================================== */

import type { PlacedRoom } from "@/lib/designApi";
import type { HomeSpec } from "@/lib/builder/spec";
import { planFromSpec } from "@/lib/builder/toPlan";

/* ===========================================================================
   THE TARGET — one room's stated intent
   =========================================================================== */

/**
 * How a room is used, which is the only thing that changes its target.
 *
 * Three categories rather than a per-room free-for-all, because the plan
 * engine's room program has three kinds in it and a fourth would be a
 * distinction nobody could act on.
 */
export type SpaceUse =
  /** great room, kitchen, anything awake and clothed */
  | "living"
  /** bedrooms — a different clothing case, and see the header on why that is
   *  NOT modelled rather than modelled with a made-up number */
  | "sleeping"
  /** bath, powder, mechanical: the packer's own `wet` rooms */
  | "service";

export const SPACE_USE_LABEL: Readonly<Record<SpaceUse, string>> = {
  living: "Living / active",
  sleeping: "Sleeping",
  service: "Service / wet",
};

/**
 * One room's comfort target.
 *
 * The shape follows IFC's `Pset_SpaceThermalRequirements` (winter and summer
 * temperature bands, a humidity band) plus `Pset_SpaceLightingRequirements`
 * (a minimum illuminance), because those two property sets are where a
 * receiving BIM tool already looks for exactly this. Inventing a shape would
 * have made the export a private note rather than a handover.
 *
 * Temperatures in °C, humidity in %RH, illuminance in lux — the units the
 * owner types and the units the IFC writers convert from.
 */
export interface ComfortTarget {
  winterMinC: number;
  winterMaxC: number;
  summerMinC: number;
  summerMaxC: number;
  humidityMinPct: number;
  humidityMaxPct: number;
  illuminanceMinLux: number;
}

/** Printed wherever a default target is shown or written. It is not a
 *  disclaimer bolted on; it is the provenance of every number in
 *  `DEFAULT_TARGETS`, and there is no second, better-sourced set hiding
 *  behind it. */
export const TARGET_PROVENANCE =
  "INDICATIVE. These are ordinary residential comfort bands for a cold climate, " +
  "chosen as a sensible starting point for an off-grid home in climate zone 7A. " +
  "They are not read from a code table, not from ASHRAE 55, and not from the " +
  "National Building Code — no such table was consulted by this build. Change " +
  "them to whatever you are actually asking your home to do; they are your " +
  "targets, not ours.";

/**
 * The starting targets, per use.
 *
 * Zone 7A is the Alberta cold-climate zone this repo's material and glazing
 * defaults already assume. The bands are deliberately WIDE — a narrow band on
 * an unbuilt house is false precision — and the winter humidity ceiling is the
 * one number here with a physical reason behind it rather than a comfort one:
 * in a 7A winter, indoor humidity carried much above the low forties condenses
 * on glazing and inside the assembly, so the ceiling is a building-durability
 * limit as much as a comfort one. It is still indicative.
 */
export const DEFAULT_TARGETS: Readonly<Record<SpaceUse, ComfortTarget>> = Object.freeze({
  living: Object.freeze({
    winterMinC: 20,
    winterMaxC: 24,
    summerMinC: 22,
    summerMaxC: 26,
    humidityMinPct: 30,
    humidityMaxPct: 50,
    illuminanceMinLux: 200,
  }),
  sleeping: Object.freeze({
    winterMinC: 17,
    winterMaxC: 21,
    summerMinC: 19,
    summerMaxC: 24,
    humidityMinPct: 30,
    humidityMaxPct: 50,
    illuminanceMinLux: 100,
  }),
  service: Object.freeze({
    winterMinC: 18,
    winterMaxC: 24,
    summerMinC: 20,
    summerMaxC: 26,
    humidityMinPct: 30,
    humidityMaxPct: 55,
    illuminanceMinLux: 150,
  }),
});

/* ===========================================================================
   THE ASSUMPTIONS — the only inputs, and they are the owner's
   =========================================================================== */

export type Season = "winter" | "summer";

export const SEASON_LABEL: Readonly<Record<Season, string>> = {
  winter: "Winter",
  summer: "Summer",
};

/**
 * The stated design conditions. Not measurements, not predictions — four
 * numbers the owner sets, which every result on the page is computed from and
 * printed beside.
 */
export interface DesignConditions {
  /** assumed indoor air temperature on a winter design day, °C */
  winterIndoorC: number;
  /** assumed indoor relative humidity on a winter design day, % */
  winterRhPct: number;
  /** assumed indoor air temperature on a summer design day, °C */
  summerIndoorC: number;
  /** assumed indoor relative humidity on a summer design day, % */
  summerRhPct: number;
}

/**
 * The starting assumptions.
 *
 * 21 °C is the indoor heating design temperature residential heat-loss work in
 * Canada is normally done at, and 35 %RH is a realistic winter figure for a
 * tight home in zone 7A once the outdoor air is cold enough to be bone dry.
 * Both are STARTING POINTS the owner is expected to change — the whole panel
 * exists to let them.
 */
export const DEFAULT_CONDITIONS: Readonly<DesignConditions> = Object.freeze({
  winterIndoorC: 21,
  winterRhPct: 35,
  summerIndoorC: 24,
  summerRhPct: 50,
});

/** Everything the owner controls, in one immutable value.
 *
 *  `targets` is SPARSE: a room with no entry uses the default for its use, so
 *  a stored settings value never has to be reconciled against a plan that has
 *  been re-solved under it. A key for a room that no longer exists is simply
 *  never read, and comes back the moment that room does. */
export interface ComfortSettings {
  conditions: DesignConditions;
  /** room id → target, for the rooms the owner has edited */
  targets: Readonly<Record<string, ComfortTarget>>;
}

export const DEFAULT_SETTINGS: Readonly<ComfortSettings> = Object.freeze({
  conditions: DEFAULT_CONDITIONS,
  targets: Object.freeze({}),
});

/* ===========================================================================
   THE EQUATION
   =========================================================================== */

/**
 * The simplified-PMV coefficients, exactly as supplied for living/active
 * spaces. Used verbatim, never tuned, and never silently substituted for a
 * different case — see the header on the sleeping-space gap.
 */
export const SPMV_COEFFICIENTS = Object.freeze({
  a: 0.2803,
  b: 0.1717,
  c: 7.1383,
});

/**
 * Saturation vapour pressure over liquid water, kPa, for T in °C.
 *
 * FORMULA: TETENS' FORMULA (Tetens, 1930), in the coefficient set popularised
 * by Murray (1967):
 *
 *     es(T) = 0.61078 · exp( 17.27·T / (T + 237.3) )      [kPa, T in °C]
 *
 * Named here rather than left as three magic numbers because the sPMV result
 * moves with it: Tetens, Magnus-Buck and the Goff-Gratch formulation disagree
 * by a fraction of a percent over the 0-40 °C range this tool operates in,
 * which is far below the uncertainty in the ASSUMED temperature but is still
 * a choice somebody is entitled to check.
 *
 * Below −45 °C the denominator approaches zero; the guard keeps the function
 * total rather than letting an absurd input return Infinity into a UI.
 */
export function saturationVapourPressureKPa(tempC: number): number {
  if (!Number.isFinite(tempC)) return 0;
  const denom = tempC + 237.3;
  if (denom <= 1e-6) return 0;
  return 0.61078 * Math.exp((17.27 * tempC) / denom);
}

/** Partial pressure of water vapour, kPa, from temperature and %RH.
 *  Pv = (RH / 100) · es(T) — the definition of relative humidity. */
export function vapourPressureKPa(tempC: number, rhPct: number): number {
  const rh = Number.isFinite(rhPct) ? Math.min(100, Math.max(0, rhPct)) : 0;
  return (rh / 100) * saturationVapourPressureKPa(tempC);
}

/**
 * WHICH UNIT `Pv` IS IN, AND WHY IT MATTERS — printed on screen, not buried.
 *
 * The coefficients were supplied without a unit for the vapour-pressure term,
 * and the choice is not cosmetic: kPa and hPa differ by a factor of ten on the
 * `b·Pv` term and move the answer by about 1.5 sPMV points at ordinary indoor
 * conditions. This build uses kPa, on a check anybody can repeat: with Pv in
 * kPa the equation crosses zero — its own definition of neutral — at about
 * 24.5 °C at 50 %RH, which is a recognisable light-clothing neutral
 * temperature. With Pv in hPa it would cross zero at about 18.8 °C, which no
 * comfort standard calls neutral. So kPa is the reading that makes the
 * equation self-consistent. It is an INTERPRETATION, not a citation.
 */
export const VAPOUR_UNIT_NOTE =
  "The supplied coefficients carry no unit for the vapour-pressure term, and the " +
  "choice moves the answer by roughly 1.5 sPMV points. This tool reads Pv in kPa, " +
  "on the check that the equation then crosses zero — its own neutral — at about " +
  "24.5 °C at 50 %RH, a recognisable light-clothing neutral. Read in hPa it would " +
  "cross zero near 18.8 °C, which nothing calls neutral. That is an interpretation, " +
  "not a citation: treat the index as indicative.";

/** Every term of the equation, kept so nothing has to print a bare result.
 *  A comfort figure without the arithmetic behind it is a claim; with it, it
 *  is a calculation somebody can check. */
export interface SpmvTerms {
  tempC: number;
  rhPct: number;
  /** es(T), kPa */
  saturationKPa: number;
  /** Pv, kPa */
  vapourKPa: number;
  /** a·T */
  tempTerm: number;
  /** b·Pv */
  vapourTerm: number;
  /** c, subtracted */
  constantTerm: number;
  /** a·T + b·Pv − c */
  value: number;
}

/**
 * sPMV = a·T + b·Pv − c.
 *
 * Total: an absurd input produces a finite number rather than NaN, because
 * this feeds a colour ramp and a table and neither has anywhere to put NaN.
 */
export function sPmv(tempC: number, rhPct: number): SpmvTerms {
  const t = Number.isFinite(tempC) ? tempC : 0;
  const rh = Number.isFinite(rhPct) ? Math.min(100, Math.max(0, rhPct)) : 0;
  const saturationKPa = saturationVapourPressureKPa(t);
  const vapourKPa = (rh / 100) * saturationKPa;
  const tempTerm = SPMV_COEFFICIENTS.a * t;
  const vapourTerm = SPMV_COEFFICIENTS.b * vapourKPa;
  const value = tempTerm + vapourTerm - SPMV_COEFFICIENTS.c;
  return {
    tempC: t,
    rhPct: rh,
    saturationKPa,
    vapourKPa,
    tempTerm,
    vapourTerm,
    constantTerm: SPMV_COEFFICIENTS.c,
    value: Number.isFinite(value) ? value : 0,
  };
}

/**
 * The band this tool calls acceptable: |sPMV| ≤ 0.5.
 *
 * That is ISO 7730's category B and the same window ASHRAE 55 uses for its
 * PMV-based method. It is a band on the INDEX, not a band on the room — see
 * the header.
 */
export const NEUTRAL_BAND = 0.5;

/** The ASHRAE seven-point sensation scale, as words. */
export function sensationWord(value: number): string {
  if (value <= -2.5) return "cold";
  if (value <= -1.5) return "cool";
  if (value < -NEUTRAL_BAND) return "slightly cool";
  if (value <= NEUTRAL_BAND) return "neutral";
  if (value < 1.5) return "slightly warm";
  if (value < 2.5) return "warm";
  return "hot";
}

/* ===========================================================================
   THE ROOMS — the plan engine's, not ours
   =========================================================================== */

/**
 * One solved room, plus the only thing this module adds to it: a use.
 *
 * `x`, `y`, `w`, `h` are the PLAN ENGINE'S frame verbatim — feet, origin at
 * the top-left of the solved envelope, +y DOWN, which on a north-up plan means
 * +y runs south. They are carried unchanged rather than pre-transformed, so
 * the frame conversion happens in exactly one place (`comfortPlates`) and can
 * be checked there.
 */
export interface ComfortRoom {
  /** stable across re-solves of the same program: a slug of the room name */
  id: string;
  name: string;
  use: SpaceUse;
  areaSqFt: number;
  windows: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An ASCII id for a room name. `NFKD` first so an accented letter decomposes
 *  to its base plus a combining mark, and the `[^a-z0-9]` pass then drops the
 *  mark — which is why there is no separate diacritic strip here. */
const slug = (name: string): string =>
  name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "room";

/**
 * How a solved room becomes a use.
 *
 * The packer's own `wet` flag does the service rooms — bath, powder, kitchen
 * and mechanical are all flagged by the engine, so this is not a second
 * opinion about them. The kitchen is pulled back out because a kitchen is an
 * awake, active, clothed room whatever its plumbing says, and bedrooms are
 * matched by name because "Bedroom" and "Bedroom 2" are the only names
 * `defaultProgram` in `lib/design/layout.ts` gives a sleeping room.
 *
 * A name this mapping does not recognise is `living`, which is the widest
 * band and therefore the choice that claims the least.
 */
export function useOfRoom(room: PlacedRoom): SpaceUse {
  const name = room.name.trim().toLowerCase();
  if (name.startsWith("bedroom")) return "sleeping";
  if (name.startsWith("kitchen")) return "living";
  if (room.wet) return "service";
  if (name.startsWith("bath") || name.startsWith("powder")) return "service";
  if (name.startsWith("mechanical") || name.startsWith("utility")) return "service";
  return "living";
}

/** The solved rooms, or the reason there are none. */
export interface ComfortRoomSet {
  rooms: ComfortRoom[];
  /** the rectangle the plan engine solved, feet: [width, depth] */
  envelopeFt: readonly [number, number];
  /** non-null exactly when `rooms` is empty for a reason worth printing */
  blockedReason: string | null;
}

/**
 * Ask `toPlan.ts` for the room program.
 *
 * Deliberately a thin read of `planFromSpec`: that module owns the handoff,
 * owns the blocked cases and owns the account of what the translation cost.
 * Reproducing any of that judgement here would give the builder two answers to
 * the question "what rooms does this home have", and a comfort panel that
 * disagreed with the floor plan below it would be worse than no comfort panel.
 */
export function comfortRooms(spec: HomeSpec): ComfortRoomSet {
  const handoff = planFromSpec(spec);
  const plan = handoff.response?.plan ?? null;
  if (!plan || plan.rooms.length === 0) {
    const blocked = handoff.notes.find((n) => n.kind === "blocked");
    return {
      rooms: [],
      envelopeFt: [0, 0],
      blockedReason:
        blocked?.detail ??
        handoff.error ??
        "The plan engine solved no rooms for this model, so there is nothing to set a " +
          "comfort target on yet.",
    };
  }

  const seen = new Map<string, number>();
  const rooms: ComfortRoom[] = plan.rooms.map((r) => {
    const base = slug(r.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      id: n === 1 ? base : `${base}-${n}`,
      name: r.name,
      use: useOfRoom(r),
      areaSqFt: Math.max(0, r.w * r.h),
      windows: r.windows,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    };
  });

  return { rooms, envelopeFt: [plan.width, plan.height], blockedReason: null };
}

/** The target in force for a room: the owner's, or the default for its use. */
export function targetFor(settings: ComfortSettings, room: ComfortRoom): ComfortTarget {
  return settings.targets[room.id] ?? DEFAULT_TARGETS[room.use];
}

/** Whether that target is still the default, so the UI and the export can say
 *  which figures the owner actually chose. */
export const targetIsDefault = (settings: ComfortSettings, room: ComfortRoom): boolean =>
  settings.targets[room.id] === undefined;

/* ===========================================================================
   THE EVALUATION
   =========================================================================== */

/** One room, one season, under the stated conditions. */
export interface SeasonResult {
  season: Season;
  /** the assumed conditions this result was computed from — carried, never
   *  implied, so nothing downstream can print the answer without them */
  tempC: number;
  rhPct: number;
  terms: SpmvTerms;
  /** is the ASSUMED temperature inside the target band for this season? */
  tempInTarget: boolean;
  /** is the ASSUMED humidity inside the target band? */
  humidityInTarget: boolean;
  /** is |sPMV| within `NEUTRAL_BAND`? `null` when this use is unmodelled. */
  indexInBand: boolean | null;
  /** all three, or `null` when the clothing case is unmodelled */
  meets: boolean | null;
  /** |sPMV| — the deviation the heatmap colours by */
  deviation: number;
  /** why it missed, in plain sentences; empty when it meets */
  misses: string[];
}

export interface RoomComfort {
  room: ComfortRoom;
  target: ComfortTarget;
  /** false once the owner has edited this room's target */
  targetIsDefault: boolean;
  /**
   * False for sleeping spaces. The living/active coefficients are applied
   * anyway — see the header — so the sPMV printed for a bedroom is the awake,
   * clothed answer and is NOT the resting case. Stated rather than corrected
   * with a coefficient set nobody could verify.
   */
  modelled: boolean;
  /** the sentence to print beside an unmodelled room, or null */
  modelNote: string | null;
  winter: SeasonResult;
  summer: SeasonResult;
}

/** The home-wide deviation KPI, per season. */
export interface ComfortKpi {
  season: Season;
  roomCount: number;
  roomsModelled: number;
  roomsUnmodelled: number;
  roomsMeeting: number;
  /** mean |sPMV| across the rooms — the simple deviation figure */
  meanAbsDeviation: number;
  /** the worst room and its deviation, or null when there are no rooms */
  worstRoomId: string | null;
  worstDeviation: number;
}

export interface ComfortReport {
  /** false when the plan engine solved nothing — `blockedReason` says why */
  available: boolean;
  blockedReason: string | null;
  conditions: DesignConditions;
  rooms: RoomComfort[];
  envelopeFt: readonly [number, number];
  winter: ComfortKpi;
  summer: ComfortKpi;
}

const SLEEPING_NOTE =
  "Evaluated with the living/active coefficients. A resting, duvet-covered " +
  "clothing case needs its own coefficient set and none could be verified for " +
  "this build, so the resting case is UNMODELLED rather than guessed — read this " +
  "row as the awake, clothed answer for a room that will be used asleep.";

function evaluate(
  season: Season,
  tempC: number,
  rhPct: number,
  target: ComfortTarget,
  modelled: boolean,
): SeasonResult {
  const terms = sPmv(tempC, rhPct);
  const minC = season === "winter" ? target.winterMinC : target.summerMinC;
  const maxC = season === "winter" ? target.winterMaxC : target.summerMaxC;

  const tempInTarget = tempC >= minC && tempC <= maxC;
  const humidityInTarget = rhPct >= target.humidityMinPct && rhPct <= target.humidityMaxPct;
  const deviation = Math.abs(terms.value);
  const indexInBand = modelled ? deviation <= NEUTRAL_BAND : null;

  const misses: string[] = [];
  if (!tempInTarget) {
    misses.push(
      `The assumed ${season} air temperature of ${fmt1(tempC)} °C is outside this room's ` +
        `stated ${fmt1(minC)}–${fmt1(maxC)} °C band.`,
    );
  }
  if (!humidityInTarget) {
    misses.push(
      `The assumed relative humidity of ${fmt0(rhPct)} % is outside this room's stated ` +
        `${fmt0(target.humidityMinPct)}–${fmt0(target.humidityMaxPct)} % band.`,
    );
  }
  if (indexInBand === false) {
    misses.push(
      `sPMV is ${fmtSigned(terms.value)} (${sensationWord(terms.value)}) under those ` +
        `conditions, outside the ±${NEUTRAL_BAND} band.`,
    );
  }

  return {
    season,
    tempC,
    rhPct,
    terms,
    tempInTarget,
    humidityInTarget,
    indexInBand,
    meets: modelled ? tempInTarget && humidityInTarget && indexInBand === true : null,
    deviation,
    misses,
  };
}

function kpi(season: Season, rooms: readonly RoomComfort[]): ComfortKpi {
  const modelledRooms = rooms.filter((room) => room.modelled);
  const results = modelledRooms.map((r) => (season === "winter" ? r.winter : r.summer));
  if (results.length === 0) {
    return {
      season,
      roomCount: rooms.length,
      roomsModelled: 0,
      roomsUnmodelled: rooms.length,
      roomsMeeting: 0,
      meanAbsDeviation: 0,
      worstRoomId: null,
      worstDeviation: 0,
    };
  }
  let sum = 0;
  let worstDeviation = -1;
  let worstRoomId: string | null = null;
  results.forEach((r, i) => {
    sum += r.deviation;
    if (r.deviation > worstDeviation) {
      worstDeviation = r.deviation;
      worstRoomId = modelledRooms[i].room.id;
    }
  });
  return {
    season,
    roomCount: rooms.length,
    roomsModelled: results.length,
    roomsUnmodelled: rooms.length - results.length,
    roomsMeeting: results.filter((r) => r.meets === true).length,
    meanAbsDeviation: sum / results.length,
    worstRoomId,
    worstDeviation: Math.max(0, worstDeviation),
  };
}

/**
 * The whole report. Pure: same spec, same settings, same answer.
 *
 * Cost is one `planFromSpec` — the deterministic layout solve — plus a handful
 * of exponentials. Callers that only need it sometimes should gate the memo
 * rather than pay it on every keystroke; `BuilderApp` does exactly that.
 */
export function comfortReport(
  spec: HomeSpec,
  settings: ComfortSettings = DEFAULT_SETTINGS,
): ComfortReport {
  const set = comfortRooms(spec);
  const c = settings.conditions;

  const rooms: RoomComfort[] = set.rooms.map((room) => {
    const target = targetFor(settings, room);
    const modelled = room.use !== "sleeping";
    return {
      room,
      target,
      targetIsDefault: targetIsDefault(settings, room),
      modelled,
      modelNote: modelled ? null : SLEEPING_NOTE,
      winter: evaluate("winter", c.winterIndoorC, c.winterRhPct, target, modelled),
      summer: evaluate("summer", c.summerIndoorC, c.summerRhPct, target, modelled),
    };
  });

  return {
    available: rooms.length > 0,
    blockedReason: set.blockedReason,
    conditions: c,
    rooms,
    envelopeFt: set.envelopeFt,
    winter: kpi("winter", rooms),
    summer: kpi("summer", rooms),
  };
}

/** The result for one season, without a caller having to branch on it. */
export const seasonResult = (room: RoomComfort, season: Season): SeasonResult =>
  season === "winter" ? room.winter : room.summer;

/* ===========================================================================
   THE HEATMAP PLATES — the one frame change, in one place
   =========================================================================== */

/**
 * A room's floor rectangle in the SITE frame the 3D viewport works in.
 *
 * THE FRAME CHANGE, WRITTEN DOWN ONCE. The plan engine's frame is feet with
 * the origin at the top-left of the solved envelope and +y DOWN, which on a
 * north-up plan is south. The builder's site frame is +x east, +z SOUTH, with
 * finished floor at y = 0. So +y maps straight onto +z, and the only other
 * step is centring: the solved envelope is placed with its CENTRE on the site
 * origin.
 *
 * THAT CENTRING IS AN ASSUMPTION, AND IT IS THE HONEST ONE AVAILABLE. The plan
 * engine solves ONE rectangle sized from total floor area — it does not solve
 * your volumes, and `toPlan.ts` prints the whole account of that difference in
 * the Drawings tab. So these plates are the SOLVED PLAN laid on the finished
 * floor at the site origin. They are not a claim that the great room is
 * physically where the plate is.
 */
export interface ComfortPlate {
  id: string;
  name: string;
  /** centre, site frame, feet */
  xFt: number;
  zFt: number;
  widthFt: number;
  depthFt: number;
  sPmv: number;
  deviation: number;
  meets: boolean | null;
  modelled: boolean;
}

export function comfortPlates(report: ComfortReport, season: Season): ComfortPlate[] {
  const [envW, envD] = report.envelopeFt;
  return report.rooms.map((r) => {
    const s = seasonResult(r, season);
    return {
      id: r.room.id,
      name: r.room.name,
      xFt: r.room.x + r.room.w / 2 - envW / 2,
      zFt: r.room.y + r.room.h / 2 - envD / 2,
      widthFt: r.room.w,
      depthFt: r.room.h,
      sPmv: s.terms.value,
      deviation: s.deviation,
      meets: s.meets,
      modelled: r.modelled,
    };
  });
}

/* ===========================================================================
   SENTENCES — written here so the panel and the exported files say the same
   thing, and neither can drift into a claim the other does not make
   =========================================================================== */

/** The sentence that must accompany every comfort figure this repo emits. */
export const COMFORT_DISCLAIMER =
  "Design-time comfort targets, evaluated against STATED ASSUMPTIONS. This is not " +
  "an energy model, not a thermal simulation and not a compliance check: no heat " +
  "loss was calculated, no weather file was read and nothing was measured. The " +
  "temperatures and humidities below are values the owner entered, not values this " +
  "home has been shown to reach. Read every result as \"under these assumed " +
  "conditions\" and never as a prediction.";

/** How the index itself should be described wherever it is printed. */
export const SPMV_METHOD_NOTE =
  "Simplified PMV: sPMV = a·T + b·Pv − c with a = 0.2803, b = 0.1717, c = 7.1383, " +
  "T the assumed air temperature in °C and Pv the water-vapour partial pressure " +
  "derived from the assumed relative humidity by Tetens' formula " +
  "es(T) = 0.61078·exp(17.27·T / (T + 237.3)) kPa. The clothing and metabolic " +
  "assumptions are folded into the coefficients and cannot be varied here.";

/** One line for a KPI strip or an export note. Always carries the conditions. */
export function comfortSentence(report: ComfortReport, season: Season): string {
  const k = season === "winter" ? report.winter : report.summer;
  if (!report.available) {
    return report.blockedReason ?? "No rooms have been solved for this model yet.";
  }
  const t = season === "winter" ? report.conditions.winterIndoorC : report.conditions.summerIndoorC;
  const rh = season === "winter" ? report.conditions.winterRhPct : report.conditions.summerRhPct;
  const unmodelled = k.roomsUnmodelled
    ? ` ${k.roomsUnmodelled} sleeping room${k.roomsUnmodelled === 1 ? " is" : "s are"} unmodelled.`
    : "";
  return (
    `Under an assumed ${fmt1(t)} °C and ${fmt0(rh)} %RH, ${k.roomsMeeting} of ${k.roomsModelled} ` +
    `modelled room${k.roomsModelled === 1 ? "" : "s"} meet${k.roomsMeeting === 1 ? "s" : ""} their ` +
    `stated ${SEASON_LABEL[season].toLowerCase()} target. Mean |sPMV| ${fmt2(k.meanAbsDeviation)}.` +
    unmodelled
  );
}

/* ------------------------------------------------------------- formatting

   Local, and deliberately not `toLocaleString`: these strings go into an
   exported IFC file as well as onto the page, and a figure inside a quoted
   document must not drift with the reader's ICU data. */

export const fmt0 = (n: number): string => String(Math.round(n));
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);
export const fmt2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
export const fmtSigned = (n: number): string => `${n >= 0 ? "+" : "−"}${fmt2(Math.abs(n))}`;

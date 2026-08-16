/* One live, user-initiated question to the City of Edmonton: what lot area does
 * your property register record at this address.
 *
 * WHY A LIVE CALL WHEN EVERYTHING ELSE IS BAKED. The register holds 439,631
 * properties. Baking them costs about 6.1 MB, republishes a quarter of a million
 * real Edmonton addresses in a public repository, and buys no additional
 * evidenced constraint, because the register's zone codes drop the `h` and `f`
 * modifiers that are the only thing the district register can evidence. So the
 * rows stay at the City and one address at a time comes back on request.
 *
 * WHAT THAT COSTS, stated rather than hidden. This is the one thing on the land
 * page that does not work offline. Nothing here runs on mount, on a keystroke,
 * or on a district being chosen: `lookupProperty` is called from a button press
 * and from nowhere else. Every failure — transport, a non-2xx, a timeout,
 * malformed JSON, a throttle — comes back as `unreachable` with a sentence a
 * person can read, and the surface is required to leave the area field open for
 * typing. A refusal that leaves a dead control is a bug.
 *
 * WHAT LEAVES THE BROWSER: the house number and the street name, to
 * data.edmonton.ca and nowhere else. See PROPERTY_LOOKUP_SENDS_NOTE, which the
 * surface prints beside the button BEFORE it is pressed.
 *
 * WHAT IS DELIBERATELY NOT REQUESTED: the coordinate columns, the register's
 * account key, and every column of the sibling assessment dataset, which carries
 * an assessed value. A dollar figure on a surface with nothing on offer reads as
 * a price no matter what the label says. `SELECT_COLUMNS` below is the whole
 * list, and the spec asserts it.
 *
 * A PROPERTY REGISTER SAYS WHO OWNS WHAT. IT NEVER SAYS WHAT IS BEING SOLD.
 */

const ENDPOINT = "https://data.edmonton.ca/resource/dkk9-cj3x.json";

/**
 * Every column this module will ever ask for. Six, matching
 * `PropertyAddressMatch` field for field.
 *
 * The interface contract described this list as "the eight fields above" while
 * specifying a six-field match type; the six are the ones the panel renders, and
 * the two that would have made eight are `latitude` and `longitude`, which the
 * same paragraph forbids. Six it is, and the mismatch is recorded here rather
 * than resolved silently.
 */
const SELECT_COLUMNS = [
  "house_number",
  "street_name",
  "zoning",
  "lot_size",
  "legal_description",
  "neighbourhood",
] as const;

/**
 * 1.26% of Edmonton civic addresses carry more than one title — duplex halves
 * and multiple titles at one address. The surface shows every row and makes the
 * person pick, so the cap only has to be comfortably above the worst real case.
 */
const MATCH_LIMIT = 25;

const DEFAULT_TIMEOUT_MS = 8_000;

export interface PropertyQuery {
  houseNumber: string;
  streetName: string;
}

export interface PropertyAddressMatch {
  houseNumber: string;
  streetName: string;
  /** As the register spells it: a base code, with no `h` or `f` modifier and therefore no ceiling. */
  zoneCode: string;
  lotAreaSqM: number;
  legalDescription: string;
  neighbourhood: string | null;
}

export type PropertyLookupOutcome =
  | { kind: "matches"; matches: PropertyAddressMatch[]; truthLastModifiedISO: string | null }
  | { kind: "no-row"; query: PropertyQuery }
  | { kind: "unreachable"; reason: string };

/**
 * Printed beside the button, before it is pressed. The person should know where
 * what they typed is going before they decide to send it.
 */
export const PROPERTY_LOOKUP_SENDS_NOTE =
  "Pressing this sends the house number and street name you typed to data.edmonton.ca, the City of " +
  "Edmonton's open data portal, and asks it for the lot area it records there. Nothing else about you " +
  "goes with it, nothing is sent until you press it, and you can type the area yourself instead.";

/** The line that has to survive every rewrite of every surface built on this module. */
export const PROPERTY_REGISTER_BOUNDARY =
  "A property register says who owns what. It never says what is being sold.";

/* ------------------------------------------------------ typing an address */

/**
 * Street-type abbreviations the register never uses: it spells every type out in
 * full and uppercases the lot. A person types "148 Ave NW".
 *
 * Only the type token is expanded, never a whole name — "ST ALBERT TRAIL" is a
 * real Edmonton street and turning its leading ST into STREET would destroy it.
 * Anything not in this map is passed through uppercased; if that leaves an
 * abbreviation the City does not use, the query simply returns no row, which is
 * an outcome the surface already has to handle honestly.
 */
const STREET_TYPES: Record<string, string> = {
  AVE: "AVENUE",
  ST: "STREET",
  DR: "DRIVE",
  RD: "ROAD",
  CRES: "CRESCENT",
  BLVD: "BOULEVARD",
  PL: "PLACE",
  CL: "CLOSE",
  GATE: "GATE",
};

const QUADRANTS = new Set(["NW", "NE", "SW", "SE"]);

/**
 * "148 Ave NW" -> "148 AVENUE NW". Uppercases, collapses whitespace, drops
 * trailing punctuation on the type token, and expands the type token only.
 *
 * It does NOT invent a quadrant. 285 base street names exist in more than one
 * quadrant, covering 38.9% of the register's zoned rows, so guessing one would
 * be guessing which of two real streets somebody lives on.
 */
export function normaliseStreetName(raw: string): string {
  const tokens = raw
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return "";

  const last = tokens[tokens.length - 1];
  const typeIndex = QUADRANTS.has(last) && tokens.length > 1 ? tokens.length - 2 : tokens.length - 1;
  const expanded = STREET_TYPES[tokens[typeIndex]];
  if (expanded) tokens[typeIndex] = expanded;
  return tokens.join(" ");
}

/**
 * Null when there is no leading numeric house number. Every one of the 282,034
 * addressed rows in the register has a purely numeric house number — there is no
 * "12110A" — so a person who typed something else has typed something this
 * dataset cannot answer, and saying so beats sending it.
 */
export function parseTypedAddress(raw: string): PropertyQuery | null {
  const match = /^\s*(\d+)\s+(\S.*)$/.exec(raw);
  if (!match) return null;
  const streetName = normaliseStreetName(match[2]);
  if (streetName.length === 0) return null;
  return { houseNumber: match[1], streetName };
}

/** SoQL string literals are single-quoted; a quote inside one is doubled. */
function soqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Pure, and exported so the spec can assert the URL — the columns asked for and
 * the host they are asked of — without a network.
 *
 * `zoning IS NOT NULL` is part of the filter, not a convenience: the rows with no
 * zone code are condominium units whose recorded area is a unit share of the
 * parcel rather than a lot. One of them would hand a reader a 4 m2 lot.
 */
export function propertyLookupUrl(query: PropertyQuery): string {
  const where = [
    "zoning IS NOT NULL",
    "lot_size > 0",
    `house_number=${soqlString(query.houseNumber)}`,
    `upper(street_name)=${soqlString(query.streetName.toUpperCase())}`,
  ].join(" AND ");
  const params = new URLSearchParams({
    $select: SELECT_COLUMNS.join(","),
    $where: where,
    $order: "street_name,house_number",
    $limit: String(MATCH_LIMIT),
  });
  return `${ENDPOINT}?${params}`;
}

function readMatch(row: unknown): PropertyAddressMatch | null {
  if (typeof row !== "object" || row === null) return null;
  const record = row as Record<string, unknown>;
  const area = Number(record.lot_size);
  if (!Number.isFinite(area) || area <= 0) return null;
  if (typeof record.house_number !== "string" || typeof record.street_name !== "string") return null;
  if (typeof record.zoning !== "string") return null;
  return {
    houseNumber: record.house_number,
    streetName: record.street_name,
    zoneCode: record.zoning,
    lotAreaSqM: area,
    legalDescription: typeof record.legal_description === "string" ? record.legal_description : "",
    neighbourhood: typeof record.neighbourhood === "string" ? record.neighbourhood : null,
  };
}

/**
 * Never throws. Every way this can go wrong comes back as an outcome the surface
 * can render, because the alternative is an exception crossing a component
 * boundary and leaving a spinner that never resolves.
 *
 * `fetchImpl` exists so the spec can prove all three outcomes offline. A refusal
 * path nobody has watched fail is not a refusal path.
 */
export async function lookupProperty(
  query: PropertyQuery,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PropertyLookupOutcome> {
  const doFetch = options?.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    return { kind: "unreachable", reason: "This browser cannot make the request to the City's open data portal." };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onOuterAbort);

  try {
    const response = await doFetch(propertyLookupUrl(query), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 429) {
      return {
        kind: "unreachable",
        reason:
          "The City's open data portal is limiting requests right now, so it did not answer. Wait a moment " +
          "and press again, or type the lot area yourself.",
      };
    }
    if (!response.ok) {
      return {
        kind: "unreachable",
        reason:
          `The City's open data portal answered with HTTP ${response.status} instead of the record, so Aura ` +
          "has nothing to show. This is the portal, not anything you typed.",
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        kind: "unreachable",
        reason:
          "The City's open data portal answered with something Aura could not read as a record. Nothing was " +
          "changed, and you can type the lot area yourself.",
      };
    }
    if (!Array.isArray(payload)) {
      return {
        kind: "unreachable",
        reason:
          "The City's open data portal answered in a shape this version of Aura does not understand. The " +
          "register's format may have changed.",
      };
    }

    const matches = payload.map(readMatch).filter((match): match is PropertyAddressMatch => match !== null);
    if (matches.length === 0) return { kind: "no-row", query };

    const stamp = response.headers?.get?.("X-SODA2-Truth-Last-Modified") ?? null;
    const parsed = stamp === null ? Number.NaN : Date.parse(stamp);
    return {
      kind: "matches",
      matches,
      truthLastModifiedISO: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      kind: "unreachable",
      reason: aborted
        ? `The City's open data portal did not answer within ${Math.round(timeoutMs / 1000)} seconds. It may be ` +
          "down, or this device may be offline. Everything else on this page still works; type the lot area yourself."
        : "Aura could not reach the City's open data portal. It may be down, or this device may be offline. " +
          "Everything else on this page still works; type the lot area yourself.",
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onOuterAbort);
  }
}

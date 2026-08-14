/* ---------------------------------------------------------------------
   THE ALBERTA SUPPLIER DIRECTORY — evidence layer.

   data/alberta/suppliers.json has been checked into this repository since
   the sourcing sweep and nothing in app/ has ever read it. The contractor
   workbench therefore renders demonstration records while real, public,
   free-tier research sits unused one directory away. This module closes
   that gap WITHOUT upgrading what the research actually is.

   Three rules govern every line below.

   1. ONE anchored source per fact. The file states its collection date once,
      in `asOf`. This module derives every record's `checkedAtISO` from that
      single field. It never carries a second date, and it never computes the
      same number twice.

   2. A tick needs a reopenable source AND a date. `evidenceStatusFor` is the
      only place that decision is made: both -> confirmed, one -> self-declared,
      neither -> unknown. An unknown tick scores zero and renders as unknown;
      it is never quietly promoted to a check that was not performed.

   3. Desk research has a ceiling and the ceiling is visible. Only the
      `reopenable-source` tick can ever reach "confirmed", because only a URL
      can be reopened. A location or a capability note is Aura's own summary
      with no third-party source behind it, so it tops out at partial credit.
      No record in this file can score 100, and `SUPPLIER_BEST_POSSIBLE_SCORE`
      exists so a surface can say so out loud rather than implying a supplier
      fell short of a bar that was never reachable.

   Aura does not call anyone vetted, endorsed, approved, or recommended. This
   is a record of what was written down and when — nothing more.
--------------------------------------------------------------------- */

import suppliersJson from "@data/alberta/suppliers.json";

/* ------------------------------------------------------------------ types */

export type SupplierEvidenceKind =
  | "reopenable-source"
  | "stated-location"
  | "capability-note";

/** Deliberately the same vocabulary as ContractorEvidence in ./discovery, so
 *  one workbench can render both without a translation layer inventing
 *  meaning at the boundary. */
export type SupplierEvidenceStatus =
  | "confirmed"
  | "not-found"
  | "expired"
  | "self-declared"
  | "unknown";

export interface SupplierEvidence {
  kind: SupplierEvidenceKind;
  status: SupplierEvidenceStatus;
  label: string;
  sourceUrl: string | null;
  checkedAtISO: string | null;
  expiresAtISO: string | null;
}

export interface SupplierProfile {
  id: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  location: string | null;
  note: string | null;
  websiteUrl: string | null;
  /** The file's own Alberta-first classification. It is a filter, never a score. */
  albertaLocal: boolean;
  /** Public desk research. Not a partnership, a quote, or a supplier relationship. */
  access: "public-research";
  /** Earliest instant consistent with the directory's stated collection date. */
  collectedAtISO: string | null;
  /** That same date exactly as the file writes it, for display. */
  collectedAtLabel: string | null;
  evidence: SupplierEvidence[];
}

export interface SupplierCategorySummary {
  id: string;
  label: string;
  count: number;
}

export interface SupplierScoreContribution {
  kind: SupplierEvidenceKind;
  label: string;
  points: number;
  possiblePoints: number;
  state: "confirmed" | "partial" | "expired" | "unknown" | "missing" | "negative";
  sourceUrl: string | null;
  checkedAtISO: string | null;
  /** Plain words for this single tick. Never a verdict about the supplier. */
  reading: string;
}

export type SupplierReadiness = "source-backed" | "manual-review" | "check-expired";

export interface SupplierScore {
  profile: SupplierProfile;
  score: number;
  readiness: SupplierReadiness;
  /** One plain sentence a reader can act on. */
  reading: string;
  contributions: SupplierScoreContribution[];
  /** Named, not summarised: exactly what this record is missing. */
  gaps: string[];
}

export interface SupplierDirectory {
  /** The collection date verbatim from the file. */
  asOfLabel: string | null;
  /** The one derived instant. Null when the file states no date at all. */
  checkedAtISO: string | null;
  principle: string | null;
  provenanceMethod: string | null;
  profiles: SupplierProfile[];
  categories: SupplierCategorySummary[];
  /** Records the file could not stand behind, named rather than dropped in silence. */
  problems: string[];
}

/* ------------------------------------------------------------ vocabulary */

export const SUPPLIER_WEIGHTS: Record<SupplierEvidenceKind, number> = {
  "reopenable-source": 50,
  "stated-location": 25,
  "capability-note": 25,
};

export const SUPPLIER_EVIDENCE_LABELS: Record<SupplierEvidenceKind, string> = {
  "reopenable-source": "Source you can reopen",
  "stated-location": "Location on file",
  "capability-note": "Capability note on file",
};

/** Aura's own review window, not a supplier commitment. Locations, product
 *  lines and URLs move; a desk check older than a year cannot be presented as
 *  current, and this directory has no live feed that could refresh it. */
export const SUPPLIER_REVIEW_WINDOW_DAYS = 365;

export const SUPPLIER_DIRECTORY_DISCLAIMER =
  "This directory is desk research from public sources, not a partnership. It records what Aura found and when. It is not a quote, a referral, or an endorsement, and it says nothing about quality of work.";

export const SUPPLIER_SCORE_MEANING =
  "The score measures how much reopenable evidence is on file, not how good a supplier is. Only a source you can reopen earns full marks, so desk research cannot reach 100.";

const KNOWN_CATEGORY_LABELS: Record<string, string> = {
  sip: "Structural insulated panels",
  foundation: "Foundation",
  solar: "Solar and storage",
  water: "Water",
  septic: "Wastewater",
  windows: "Windows",
  stoves: "Wood stoves",
  hotTubs: "Hot tubs",
  permits: "Permits and safety codes",
  cryptoRails: "Crypto rails",
};

/** camelCase -> "Camel case". Used only when the file adds a category this
 *  module has not been taught, so a new key renders readably instead of raw. */
export function humanizeCategoryId(id: string): string {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  if (!spaced) return id;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export const categoryLabel = (id: string): string => KNOWN_CATEGORY_LABELS[id] ?? humanizeCategoryId(id);

/* ------------------------------------------------------------ validation */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const httpUrl = (value: unknown): string | null => {
  const raw = text(value);
  return raw && /^https?:\/\/[^\s]+$/i.test(raw) ? raw : null;
};

/** Matches the identifier shape validateDiscoveryRecord already enforces, so a
 *  supplier can later become a saved project discovery record without a rename. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "supplier";

/**
 * The directory states its collection date once. A "YYYY-MM" value is
 * expanded to the FIRST instant of that month on purpose: rounding to the
 * month's end would present the check as fresher than the file can prove.
 */
export function collectionInstant(asOf: unknown): { iso: string; label: string } | null {
  const label = text(asOf);
  if (!label) return null;
  const candidate = /^\d{4}-\d{2}$/.test(label) ? `${label}-01T00:00:00.000Z` : label;
  const ms = Date.parse(candidate);
  return Number.isFinite(ms) ? { iso: new Date(ms).toISOString(), label } : null;
}

/**
 * The ONE place a tick's status is decided.
 *
 * Both a reopenable source and a date -> a real check.
 * One of the two -> Aura wrote it down but cannot prove it was checked.
 * Neither -> not a tick at all. It is an unknown and stays one.
 */
export function evidenceStatusFor(
  sourceUrl: string | null,
  checkedAtISO: string | null,
): SupplierEvidenceStatus {
  if (sourceUrl && checkedAtISO) return "confirmed";
  if (sourceUrl || checkedAtISO) return "self-declared";
  return "unknown";
}

/** Only a dated check can expire. An undated one was never current. */
export function reviewExpiry(checkedAtISO: string | null): string | null {
  if (!checkedAtISO) return null;
  const ms = Date.parse(checkedAtISO);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + SUPPLIER_REVIEW_WINDOW_DAYS * 86_400_000).toISOString();
}

function buildEvidence(
  record: { location: string | null; note: string | null; websiteUrl: string | null },
  checkedAtISO: string | null,
): SupplierEvidence[] {
  const evidence: SupplierEvidence[] = [];

  // The only tick with a third-party source behind it. The SUBJECT of this
  // tick is the page itself, so with no page there is nothing declared and
  // nothing to reopen: the directory's collection date cannot lend it partial
  // credit. It is unknown, and it renders as unknown.
  const sourceStatus: SupplierEvidenceStatus = record.websiteUrl
    ? evidenceStatusFor(record.websiteUrl, checkedAtISO)
    : "unknown";
  evidence.push({
    kind: "reopenable-source",
    status: sourceStatus,
    label: record.websiteUrl
      ? "Public supplier page recorded in the directory"
      : "No supplier page recorded in the directory",
    sourceUrl: record.websiteUrl,
    checkedAtISO: record.websiteUrl ? checkedAtISO : null,
    // Nothing that was never a check can go stale.
    expiresAtISO: sourceStatus === "unknown" ? null : reviewExpiry(checkedAtISO),
  });

  // Aura's own summaries. They carry the collection date but no reopenable
  // source, which is why they can never read as confirmed.
  if (record.location) {
    const status = evidenceStatusFor(null, checkedAtISO);
    evidence.push({
      kind: "stated-location",
      status,
      label: `Location recorded as ${record.location}`,
      sourceUrl: null,
      checkedAtISO,
      expiresAtISO: status === "unknown" ? null : reviewExpiry(checkedAtISO),
    });
  }
  if (record.note) {
    const status = evidenceStatusFor(null, checkedAtISO);
    evidence.push({
      kind: "capability-note",
      status,
      label: "Capability note recorded by Aura",
      sourceUrl: null,
      checkedAtISO,
      expiresAtISO: status === "unknown" ? null : reviewExpiry(checkedAtISO),
    });
  }
  return evidence;
}

/**
 * Reads the checked-in directory. Malformed records are named in `problems`
 * rather than dropped in silence, and a record with an unusable URL keeps its
 * row with an honest blank instead of a plausible-looking link.
 */
export function loadSupplierDirectory(raw: unknown): SupplierDirectory {
  const problems: string[] = [];
  if (!isObject(raw)) {
    return {
      asOfLabel: null,
      checkedAtISO: null,
      principle: null,
      provenanceMethod: null,
      profiles: [],
      categories: [],
      problems: ["The supplier directory is not an object; no records were loaded."],
    };
  }

  const collected = collectionInstant(raw.asOf);
  if (!collected) {
    problems.push(
      "The directory states no collection date, so every record reads as an undated note rather than a check.",
    );
  }
  const provenance = isObject(raw.provenance) ? raw.provenance : null;
  if (!provenance) {
    problems.push("The directory carries no provenance block describing how it was collected.");
  }

  const categoriesRaw = isObject(raw.categories) ? raw.categories : null;
  if (!categoriesRaw) {
    problems.push("The directory has no categories object; no records were loaded.");
  }

  const profiles: SupplierProfile[] = [];
  const categories: SupplierCategorySummary[] = [];
  const usedIds = new Set<string>();

  for (const categoryId of categoriesRaw ? Object.keys(categoriesRaw) : []) {
    const entries = categoriesRaw ? categoriesRaw[categoryId] : null;
    if (!Array.isArray(entries)) {
      problems.push(`Category "${categoryId}" is not a list of records and was skipped.`);
      continue;
    }
    const label = categoryLabel(categoryId);
    let count = 0;
    for (const entry of entries) {
      if (!isObject(entry)) {
        problems.push(`A record in "${categoryId}" is not an object and was skipped.`);
        continue;
      }
      const name = text(entry.name);
      if (!name) {
        problems.push(`A record in "${categoryId}" has no name and was skipped.`);
        continue;
      }
      const websiteUrl = httpUrl(entry.url);
      if (entry.url !== undefined && websiteUrl === null) {
        // Blank beats a broken link that still reads as a source.
        problems.push(`"${name}" (${categoryId}) has an unusable URL; it renders with no source.`);
      }
      const albertaLocal = entry.albertaLocal === true;
      if (typeof entry.albertaLocal !== "boolean") {
        problems.push(`"${name}" (${categoryId}) has no Alberta-supply classification; it reads as out of province.`);
      }

      let id = `${slugify(categoryId)}-${slugify(name)}`.slice(0, 96);
      if (usedIds.has(id)) {
        let suffix = 2;
        while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
        id = `${id}-${suffix}`.slice(0, 96);
      }
      usedIds.add(id);

      const location = text(entry.location);
      const note = text(entry.note);
      profiles.push({
        id,
        name,
        categoryId,
        categoryLabel: label,
        location,
        note,
        websiteUrl,
        albertaLocal,
        access: "public-research",
        collectedAtISO: collected?.iso ?? null,
        collectedAtLabel: collected?.label ?? null,
        evidence: buildEvidence({ location, note, websiteUrl }, collected?.iso ?? null),
      });
      count += 1;
    }
    if (count > 0) categories.push({ id: categoryId, label, count });
  }

  return {
    asOfLabel: collected?.label ?? null,
    checkedAtISO: collected?.iso ?? null,
    principle: text(raw.principle),
    provenanceMethod: provenance ? text(provenance.method) : null,
    profiles,
    categories,
    problems,
  };
}

/* --------------------------------------------------------------- scoring */

function contributionReading(
  kind: SupplierEvidenceKind,
  state: SupplierScoreContribution["state"],
  evidence: SupplierEvidence | undefined,
): string {
  if (state === "expired") {
    return `Last checked ${evidence?.checkedAtISO?.slice(0, 10) ?? "on an unknown date"}, which is past Aura's ${SUPPLIER_REVIEW_WINDOW_DAYS}-day review window.`;
  }
  if (state === "negative") return "The directory records this as not found.";
  if (state === "missing") return "Nothing is on file for this.";
  if (state === "unknown") {
    return kind === "reopenable-source"
      ? "No page to reopen and no check date. This is unknown, not a check."
      : "Recorded without a source or a date. This is unknown, not a check.";
  }
  if (state === "confirmed") {
    return `Recorded with a page you can reopen, collected ${evidence?.checkedAtISO?.slice(0, 7) ?? "at an unstated date"}.`;
  }
  return kind === "reopenable-source"
    ? "A page or a date is on file, but not both, so it cannot read as a check."
    : "Aura's own summary. There is no third-party source behind it.";
}

/**
 * Explainable evidence completeness for one supplier record.
 *
 * The shape mirrors contractorEvidenceScore in ./discovery deliberately: same
 * contribution list, same points/possiblePoints pair, same named-gaps array.
 * The rules differ because the evidence differs — there is no registry, WCB,
 * or insurance check behind a supplier row, and pretending otherwise is the
 * exact rounding-up this module exists to prevent.
 */
export function supplierEvidenceScore(profile: SupplierProfile, now: Date): SupplierScore {
  const nowMs = now.getTime();
  const contributions = (Object.keys(SUPPLIER_WEIGHTS) as SupplierEvidenceKind[]).map((kind) => {
    const evidence = profile.evidence.find((item) => item.kind === kind);
    const expiredByDate =
      !!evidence?.expiresAtISO &&
      Number.isFinite(Date.parse(evidence.expiresAtISO)) &&
      Date.parse(evidence.expiresAtISO) < nowMs;
    const state: SupplierScoreContribution["state"] = !evidence
      ? "missing"
      : evidence.status === "not-found"
        ? "negative"
        : evidence.status === "expired" || expiredByDate
          ? "expired"
          : evidence.status === "confirmed"
            ? "confirmed"
            : evidence.status === "self-declared"
              ? "partial"
              : "unknown";
    const possiblePoints = SUPPLIER_WEIGHTS[kind];
    const points =
      state === "confirmed" ? possiblePoints : state === "partial" ? Math.floor(possiblePoints / 3) : 0;
    return {
      kind,
      label: evidence?.label ?? SUPPLIER_EVIDENCE_LABELS[kind],
      points,
      possiblePoints,
      state,
      sourceUrl: evidence?.sourceUrl ?? null,
      checkedAtISO: evidence?.checkedAtISO ?? null,
      reading: contributionReading(kind, state, evidence),
    };
  });

  const score = contributions.reduce((sum, item) => sum + item.points, 0);
  const source = contributions.find((item) => item.kind === "reopenable-source")!;
  const location = contributions.find((item) => item.kind === "stated-location")!;
  const note = contributions.find((item) => item.kind === "capability-note")!;

  const gaps: string[] = [];
  if (source.state === "expired") {
    gaps.push(`The recorded source check is past Aura's ${SUPPLIER_REVIEW_WINDOW_DAYS}-day review window.`);
  } else if (source.state !== "confirmed") {
    gaps.push("There is no source you can reopen for this record.");
  }
  if (!profile.collectedAtISO) gaps.push("The directory does not state when this record was collected.");
  if (location.state === "missing") gaps.push("No location is on file.");
  if (note.state === "missing") gaps.push("No capability note is on file.");

  const anyExpired = contributions.some((item) => item.state === "expired");
  const readiness: SupplierReadiness = anyExpired
    ? "check-expired"
    : gaps.length === 0
      ? "source-backed"
      : "manual-review";

  const reading =
    readiness === "check-expired"
      ? `Recorded ${profile.collectedAtLabel ?? "at an unstated date"} and now past Aura's ${SUPPLIER_REVIEW_WINDOW_DAYS}-day review window. Treat it as out of date until it is rechecked.`
      : readiness === "source-backed"
        ? `Recorded ${profile.collectedAtLabel ?? "at an unstated date"} from a page you can reopen. Confirm current pricing, stock and service area with the supplier before you rely on it.`
        : `Name${profile.location ? " and location" : ""} on file only, with no page to reopen. Confirm this one directly with the supplier.`;

  return { profile, score, readiness, reading, contributions, gaps };
}

/* --------------------------------------------------------------- exports */

export const ALBERTA_SUPPLIER_DIRECTORY: SupplierDirectory = loadSupplierDirectory(
  suppliersJson as unknown,
);

export const ALBERTA_SUPPLIERS: SupplierProfile[] = ALBERTA_SUPPLIER_DIRECTORY.profiles;

export const ALBERTA_SUPPLIER_CATEGORIES: SupplierCategorySummary[] =
  ALBERTA_SUPPLIER_DIRECTORY.categories;

export const suppliersInCategory = (categoryId: string): SupplierProfile[] =>
  ALBERTA_SUPPLIERS.filter((profile) => profile.categoryId === categoryId);

/**
 * The ceiling desk research can reach, measured by RUNNING the scorer on a
 * record that has everything this directory can hold. Deriving it by hand
 * would be a second calculation of the same number, which is exactly the
 * divergence class this repo keeps getting bitten by.
 */
const CEILING_CHECKED_AT = "2026-01-01T00:00:00.000Z";
const CEILING_PROFILE: SupplierProfile = {
  id: "ceiling-reference",
  name: "Ceiling reference",
  categoryId: "reference",
  categoryLabel: "Reference",
  location: "Alberta",
  note: "Every field this directory can hold is present.",
  websiteUrl: "https://example.invalid/reference",
  albertaLocal: true,
  access: "public-research",
  collectedAtISO: CEILING_CHECKED_AT,
  collectedAtLabel: "2026-01",
  evidence: buildEvidence(
    {
      location: "Alberta",
      note: "Every field this directory can hold is present.",
      websiteUrl: "https://example.invalid/reference",
    },
    CEILING_CHECKED_AT,
  ),
};

export const SUPPLIER_BEST_POSSIBLE_SCORE: number = supplierEvidenceScore(
  CEILING_PROFILE,
  new Date(CEILING_CHECKED_AT),
).score;

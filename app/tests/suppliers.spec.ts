import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

import suppliersJson from "@data/alberta/suppliers.json";
import {
  ALBERTA_SUPPLIER_CATEGORIES,
  ALBERTA_SUPPLIER_DIRECTORY,
  ALBERTA_SUPPLIERS,
  SUPPLIER_BEST_POSSIBLE_SCORE,
  SUPPLIER_DIRECTORY_DISCLAIMER,
  SUPPLIER_REVIEW_WINDOW_DAYS,
  SUPPLIER_SCORE_MEANING,
  SUPPLIER_WEIGHTS,
  collectionInstant,
  evidenceStatusFor,
  loadSupplierDirectory,
  supplierEvidenceScore,
  type SupplierProfile,
} from "@/lib/marketplace/suppliers";

/* The directory states 2026-08. Read as the FIRST instant of that month, the
   check is current on the day this suite was written and expires one review
   window later. Both instants are named here so the expiry tests below are a
   falsifiable pair rather than a single-sided assertion. */
const COLLECTED_AT = "2026-08-01T00:00:00.000Z";
const DAY_MS = 86_400_000;
const CURRENT = new Date(Date.parse(COLLECTED_AT) + 5 * DAY_MS);
const JUST_INSIDE_WINDOW = new Date(
  Date.parse(COLLECTED_AT) + SUPPLIER_REVIEW_WINDOW_DAYS * DAY_MS - DAY_MS,
);
const PAST_WINDOW = new Date(
  Date.parse(COLLECTED_AT) + SUPPLIER_REVIEW_WINDOW_DAYS * DAY_MS + DAY_MS,
);

const rawClone = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(suppliersJson)) as Record<string, unknown>;

function byName(name: string): SupplierProfile {
  const matches = ALBERTA_SUPPLIERS.filter((profile) => profile.name === name);
  // Name the thing meant, and prove the name is unambiguous, rather than
  // reaching for the first row and hoping it was the intended one.
  expect(matches, `expected exactly one supplier named ${name}`).toHaveLength(1);
  return matches[0];
}

/* --------------------------------------------------------------- loading */

test("the checked-in Alberta directory loads with every record accounted for", () => {
  // PINNED: 39 records across 10 categories, as checked in. If the data file
  // gains or loses a supplier this fails on purpose — renegotiate the number
  // here with the reason, never delete the count.
  expect(ALBERTA_SUPPLIERS).toHaveLength(39);
  expect(ALBERTA_SUPPLIER_CATEGORIES.map((category) => category.id)).toEqual([
    "sip",
    "foundation",
    "solar",
    "water",
    "septic",
    "windows",
    "stoves",
    "hotTubs",
    "permits",
    "cryptoRails",
  ]);
  expect(
    ALBERTA_SUPPLIER_CATEGORIES.reduce((sum, category) => sum + category.count, 0),
  ).toBe(ALBERTA_SUPPLIERS.length);

  // No record was skipped or repaired in silence.
  expect(ALBERTA_SUPPLIER_DIRECTORY.problems).toEqual([]);

  // The one date anchor, and the honest reading of it.
  expect(ALBERTA_SUPPLIER_DIRECTORY.asOfLabel).toBe("2026-08");
  expect(ALBERTA_SUPPLIER_DIRECTORY.checkedAtISO).toBe(COLLECTED_AT);
  expect(ALBERTA_SUPPLIER_DIRECTORY.provenanceMethod).toContain("Desk research");

  // Ids stay in the shape validateDiscoveryRecord already enforces, so a
  // supplier can become a saved project record later without a rename.
  const ids = ALBERTA_SUPPLIERS.map((profile) => profile.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/);
});

test("a month-granularity collection date reads as the month's first instant, never its last", () => {
  expect(collectionInstant("2026-08")).toEqual({ iso: COLLECTED_AT, label: "2026-08" });
  // Rounding to the month's end would present a check as fresher than the file
  // can prove; this asserts the module does not do that.
  expect(collectionInstant("2026-08")?.iso).not.toBe("2026-08-31T23:59:59.999Z");
  expect(collectionInstant("2026-13")).toBeNull();
  expect(collectionInstant("")).toBeNull();
  expect(collectionInstant(undefined)).toBeNull();
});

/* ------------------------------------------------------- thin reads thin */

test("a thin-evidence supplier cannot score as well-evidenced", () => {
  const sourced = supplierEvidenceScore(byName("Insulspan (PFB/Carlisle)"), CURRENT);
  const noSource = supplierEvidenceScore(
    byName("Screw Piles Edmonton / Edmonton Screw Pile Pros"),
    CURRENT,
  );
  const thinnest = supplierEvidenceScore(byName("Evjen Water Hauling"), CURRENT);

  // PINNED: 50 for a reopenable source, 8 each for Aura's own location and
  // capability summaries (a third of their weight, since nothing backs them).
  expect(sourced.score).toBe(66);
  expect(noSource.score).toBe(16);
  expect(thinnest.score).toBe(8);

  expect(sourced.score).toBeGreaterThan(noSource.score);
  expect(noSource.score).toBeGreaterThan(thinnest.score);

  expect(sourced.readiness).toBe("source-backed");
  expect(noSource.readiness).toBe("manual-review");
  expect(thinnest.readiness).toBe("manual-review");

  expect(noSource.gaps).toContain("There is no source you can reopen for this record.");
  expect(thinnest.gaps).toContain("There is no source you can reopen for this record.");
  expect(thinnest.gaps).toContain("No capability note is on file.");
  expect(sourced.gaps).toEqual([]);
});

test("no record without a reopenable source can out-score one that has it", () => {
  const withoutSource = ALBERTA_SUPPLIERS.filter((profile) => profile.websiteUrl === null);
  const withSource = ALBERTA_SUPPLIERS.filter((profile) => profile.websiteUrl !== null);
  // Both sides must actually exist, or the comparison below proves nothing.
  expect(withoutSource.length).toBeGreaterThan(0);
  expect(withSource.length).toBeGreaterThan(0);

  const ceiling = SUPPLIER_WEIGHTS["reopenable-source"];
  for (const profile of withoutSource) {
    const scored = supplierEvidenceScore(profile, CURRENT);
    expect(scored.score, profile.name).toBeLessThan(ceiling);
    expect(scored.readiness, profile.name).not.toBe("source-backed");
  }
  for (const profile of withSource) {
    expect(supplierEvidenceScore(profile, CURRENT).score, profile.name).toBeGreaterThanOrEqual(ceiling);
  }
});

test("desk research has a visible ceiling and nothing is rounded up to it", () => {
  // Only a reopenable source can reach confirmed, so 100 is unreachable here.
  expect(SUPPLIER_BEST_POSSIBLE_SCORE).toBe(66);
  expect(SUPPLIER_BEST_POSSIBLE_SCORE).toBeLessThan(100);
  for (const profile of ALBERTA_SUPPLIERS) {
    expect(supplierEvidenceScore(profile, CURRENT).score, profile.name).toBeLessThanOrEqual(
      SUPPLIER_BEST_POSSIBLE_SCORE,
    );
  }
  expect(SUPPLIER_SCORE_MEANING).toContain("not how good a supplier is");
});

/* ---------------------------------------------------------- expiry reads */

test("an expired check reads as expired, and a current one does not", () => {
  const profile = byName("Insulspan (PFB/Carlisle)");

  const current = supplierEvidenceScore(profile, JUST_INSIDE_WINDOW);
  expect(current.readiness).toBe("source-backed");
  expect(current.contributions.every((item) => item.state !== "expired")).toBe(true);
  expect(current.score).toBe(66);

  const stale = supplierEvidenceScore(profile, PAST_WINDOW);
  expect(stale.readiness).toBe("check-expired");
  expect(stale.score).toBe(0);
  const source = stale.contributions.find((item) => item.kind === "reopenable-source");
  expect(source?.state).toBe("expired");
  expect(source?.points).toBe(0);
  expect(source?.reading).toContain(`${SUPPLIER_REVIEW_WINDOW_DAYS}-day review window`);
  expect(stale.gaps).toContain(
    `The recorded source check is past Aura's ${SUPPLIER_REVIEW_WINDOW_DAYS}-day review window.`,
  );
  expect(stale.reading).toContain("out of date");
});

/* -------------------------------------------------------- unknown states */

test("a tick with neither a source nor a date is unknown and stays unknown", () => {
  expect(evidenceStatusFor("https://example.test/page", "2026-08-01T00:00:00.000Z")).toBe("confirmed");
  expect(evidenceStatusFor("https://example.test/page", null)).toBe("self-declared");
  expect(evidenceStatusFor(null, "2026-08-01T00:00:00.000Z")).toBe("self-declared");
  expect(evidenceStatusFor(null, null)).toBe("unknown");

  // A record with no page: the source tick is unknown, not partially credited
  // by the file's collection date, and it never expires because it was never
  // a check in the first place.
  const noSource = byName("Evjen Water Hauling");
  const sourceEvidence = noSource.evidence.find((item) => item.kind === "reopenable-source");
  expect(sourceEvidence?.status).toBe("unknown");
  expect(sourceEvidence?.sourceUrl).toBeNull();
  expect(sourceEvidence?.checkedAtISO).toBeNull();
  expect(sourceEvidence?.expiresAtISO).toBeNull();

  const scoredNow = supplierEvidenceScore(noSource, CURRENT);
  const scoredLater = supplierEvidenceScore(noSource, PAST_WINDOW);
  const unknownNow = scoredNow.contributions.find((item) => item.kind === "reopenable-source");
  const unknownLater = scoredLater.contributions.find((item) => item.kind === "reopenable-source");
  expect(unknownNow?.state).toBe("unknown");
  expect(unknownNow?.points).toBe(0);
  // Time passing must not convert an unknown into an expired check.
  expect(unknownLater?.state).toBe("unknown");
  expect(unknownLater?.reading).toContain("unknown, not a check");
});

test("removing the directory's date anchor degrades every record instead of holding it steady", () => {
  const undated = rawClone();
  delete undated.asOf;
  const directory = loadSupplierDirectory(undated);

  expect(directory.checkedAtISO).toBeNull();
  expect(directory.problems.some((problem) => problem.includes("no collection date"))).toBe(true);
  expect(directory.profiles).toHaveLength(ALBERTA_SUPPLIERS.length);

  const before = supplierEvidenceScore(byName("Insulspan (PFB/Carlisle)"), CURRENT);
  const afterProfiles = directory.profiles.filter(
    (profile) => profile.name === "Insulspan (PFB/Carlisle)",
  );
  expect(afterProfiles).toHaveLength(1);
  const after = supplierEvidenceScore(afterProfiles[0], CURRENT);

  expect(after.score).toBeLessThan(before.score);
  expect(after.readiness).not.toBe("source-backed");
  expect(after.gaps).toContain("The directory does not state when this record was collected.");
  // Aura's own summaries lose their only provenance and become unknown.
  expect(
    after.contributions
      .filter((item) => item.kind !== "reopenable-source")
      .every((item) => item.state === "unknown"),
  ).toBe(true);
});

test("removing the provenance block is reported, not absorbed", () => {
  const withProvenance = loadSupplierDirectory(rawClone());
  expect(withProvenance.provenanceMethod).not.toBeNull();
  expect(withProvenance.problems.some((problem) => problem.includes("provenance"))).toBe(false);

  const stripped = rawClone();
  delete stripped.provenance;
  const directory = loadSupplierDirectory(stripped);
  expect(directory.provenanceMethod).toBeNull();
  expect(directory.problems.some((problem) => problem.includes("provenance"))).toBe(true);
});

/* ------------------------------------------------------------ validation */

test("malformed records are named rather than dropped or repaired in silence", () => {
  const broken = loadSupplierDirectory({
    asOf: "2026-08",
    provenance: { method: "Desk research from public pages." },
    categories: {
      sip: [
        { name: "Has a broken link", location: "Alberta", url: "not-a-url", albertaLocal: true },
        { location: "Alberta", albertaLocal: true },
        "not an object",
      ],
      broken: "not a list",
    },
  });

  expect(broken.profiles).toHaveLength(1);
  const kept = broken.profiles[0];
  // A link Aura cannot stand behind renders as a blank, never as a source.
  expect(kept.websiteUrl).toBeNull();
  expect(supplierEvidenceScore(kept, CURRENT).readiness).toBe("manual-review");

  expect(broken.problems.some((problem) => problem.includes("unusable URL"))).toBe(true);
  expect(broken.problems.some((problem) => problem.includes("has no name"))).toBe(true);
  expect(broken.problems.some((problem) => problem.includes("is not an object"))).toBe(true);
  expect(broken.problems.some((problem) => problem.includes("not a list of records"))).toBe(true);

  const notAnObject = loadSupplierDirectory("suppliers");
  expect(notAnObject.profiles).toEqual([]);
  expect(notAnObject.problems).toHaveLength(1);
});

/* ------------------------------------------------------------- the word */

test("nothing this module emits calls a supplier vetted", () => {
  const banned = /\bvetted\b/i;
  // Prove the check can fail before trusting that it passed.
  expect(banned.test("Aura vetted this supplier")).toBe(true);

  // The module states the ban once, in its own header, and nowhere else.
  const source = readFileSync(resolve(process.cwd(), "lib/marketplace/suppliers.ts"), "utf8");
  expect(source).toContain("Aura does not call anyone vetted, endorsed, approved, or recommended.");
  expect(source.match(/vetted/gi) ?? []).toHaveLength(1);

  // The data file it reads never uses the word either.
  const data = readFileSync(resolve(process.cwd(), "..", "data/alberta/suppliers.json"), "utf8");
  expect(banned.test(data)).toBe(false);

  const emitted: string[] = [SUPPLIER_DIRECTORY_DISCLAIMER, SUPPLIER_SCORE_MEANING];
  for (const profile of ALBERTA_SUPPLIERS) {
    const scored = supplierEvidenceScore(profile, CURRENT);
    emitted.push(profile.name, profile.categoryLabel, scored.reading, ...scored.gaps);
    for (const item of scored.contributions) emitted.push(item.label, item.reading);
  }
  for (const line of emitted) expect(banned.test(line), line).toBe(false);

  // The disclaimer says what this directory is NOT, in plain words.
  expect(SUPPLIER_DIRECTORY_DISCLAIMER).toContain("not a partnership");
  expect(SUPPLIER_DIRECTORY_DISCLAIMER).toContain("not a quote, a referral, or an endorsement");
});

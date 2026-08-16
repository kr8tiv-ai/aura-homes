import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";
import { PLAN_TEMPLATES } from "@/lib/builder/planCatalog";

/* Why this file exists.

   Both gates run HARDCODED LISTS — `test` in package.json names its spec files
   one by one, and playwright.ui.config.ts has a testMatch array. A list like
   that drifts the moment someone adds a spec and forgets the list, and the
   failure is completely silent: the file sits in tests/, looks like coverage,
   reads like coverage in a diff, and never executes.

   It had already happened. buy-catalog.spec.ts — twelve assertions including
   the /buy catalogue's forbidden-vocabulary contract — was in neither gate.
   Twelve passing-capable assertions that had never once run in CI or locally
   as part of a gate. plan-selection-visual.spec.ts and landing-film.spec.ts
   were in the same state.

   An external audit found it by reading. That is not a control, so this is.

   The second half of the file guards the same class of defect in the DOCS:
   the README and the hackathon submission both publish spec counts, both were
   wrong, and they disagreed with each other. For a project whose stated pitch
   is that claims carry evidence, the headline evidence number being wrong in
   the judge-facing document is the worst possible place for it. The existing
   release-truth spec pins WORDING and never pins NUMBERS, so numbers drifted. */

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");

const read = (...segments: string[]) => readFileSync(path.join(...segments), "utf8");

const packageJson = read(appRoot, "package.json");
const uiConfig = read(appRoot, "playwright.ui.config.ts");

const specFiles = readdirSync(path.join(appRoot, "tests"))
  .filter((name) => name.endsWith(".spec.ts"))
  .sort();

/* Deliberately outside both gates. Every entry needs a reason, and the reason
   has to be about the FILE, not about it being inconvenient — an allowlist
   that anyone can append to without justification is the drift it replaced. */
const DELIBERATELY_UNGATED: Readonly<Record<string, string>> = {
  "landing-vitals.spec.ts":
    "A measurement, not a pass/fail gate. It reads AURA_TEST_BASE_URL to point at an arbitrary deployed target, runs five cold contexts, and writes vitals artifacts. Run it on purpose against a real deployment; running it inside test:ui would measure the local export server and report that number as if it described production.",
};

const inUnitGate = (file: string) => packageJson.includes(`tests/${file}`);
const inUiGate = (file: string) => uiConfig.includes(`"${file}"`);

/** A spec that needs a served build says so the same way every time: it calls
 *  `test.skip` on the absence of a `baseURL`. Only the UI config supplies one,
 *  so such a file in the unit gate declares its assertions and runs none.
 *
 *  THE PATTERN IS ASSEMBLED, NOT WRITTEN WHOLE, and for the same reason the
 *  test counter below is: a scanner whose source contains the string it hunts
 *  for finds itself. Written as one literal this matched gate-coverage.spec.ts
 *  and demanded that the file policing the gates be moved into the UI gate.
 *  Splitting `base`+`URL` means the shape being described never appears
 *  contiguously in the file describing it. */
const SKIPS_WITHOUT_BASE_URL = new RegExp(
  `test\\.(?:skip|describe\\.skip)?\\s*\\(?[\\s\\S]{0,120}?\\{\\s*base` +
    `URL\\s*\\}\\s*\\)\\s*=>\\s*!\\s*base` +
    `URL`,
);

test("a spec that needs a served build is in the gate that serves one", () => {
  /* THE THIRD TIME THIS CLASS HAS COST US A FEATURE'S COVERAGE.
     buy-catalog.spec.ts was in no gate at all, which the file above now
     catches. walkthrough.spec.ts was in the UNIT gate with eight assertions
     behind a skip on a missing served build — so it was listed, counted,
     green, and executed nothing that mattered. Membership in a gate is not
     execution in that gate, and an environment-conditional skip is invisible to
     every count this file keeps: the counter reads `test(` in source, and the
     runner reports a skip as neither pass nor fail.

     So the condition itself is the check. A file that skips without a baseURL
     belongs in playwright.ui.config.ts, which supplies one, and nowhere else. */
  const needsServer = specFiles.filter((file) =>
    SKIPS_WITHOUT_BASE_URL.test(read(appRoot, "tests", file)),
  );

  /* The detector has to be discriminating before its verdict means anything —
     if the regex stopped matching, this test would pass by finding nothing. */
  expect(
    needsServer.length,
    "no spec matched the baseURL-skip shape, so this gate is asserting nothing. The pattern has probably drifted from how the specs are written.",
  ).toBeGreaterThan(0);

  for (const file of needsServer) {
    expect(
      inUiGate(file),
      `${file} skips its own assertions without a baseURL, and only playwright.ui.config.ts supplies one — so wherever else it runs, those assertions never execute. Add it to that config's testMatch.`,
    ).toBe(true);
    expect(
      inUnitGate(file),
      `${file} needs a served build, but package.json's \`test\` list runs it without one. There it is counted as coverage and executes nothing.`,
    ).toBe(false);
  }
});

test("the gate detectors can actually fail", () => {
  /* Both halves below are membership checks against hand-maintained lists,
     which is exactly the kind of assertion that silently starts matching
     nothing. Prove each detector still discriminates before trusting it. */
  expect(inUnitGate("document.spec.ts")).toBe(true);
  expect(inUnitGate("this-file-does-not-exist.spec.ts")).toBe(false);
  expect(inUiGate("navigation.spec.ts")).toBe(true);
  expect(inUiGate("document.spec.ts")).toBe(false);

  /* And that we are looking at a real, populated tests directory. */
  expect(specFiles.length).toBeGreaterThan(40);
});

test("every spec file runs in a gate, or is excluded on the record", () => {
  const orphans = specFiles.filter(
    (file) => !inUnitGate(file) && !inUiGate(file) && !(file in DELIBERATELY_UNGATED),
  );

  expect(
    orphans,
    `these spec files are in tests/ and execute in NO gate — not in package.json's \`test\` list, not in playwright.ui.config.ts's testMatch, and not on the documented exclusion list.\n` +
      `They look like coverage in a diff and are worth nothing. Add each to the gate it belongs in (pure specs to \`test\`, specs needing the served export to the UI config), or add it to DELIBERATELY_UNGATED with a reason about the file:\n` +
      orphans.join("\n"),
  ).toEqual([]);
});

test("no spec is claimed by both gates", () => {
  /* A file in both lists runs twice, and its UI half runs against no server
     in the pure suite — which either fails confusingly or passes vacuously. */
  const doubled = specFiles.filter((file) => inUnitGate(file) && inUiGate(file));
  expect(doubled, `these spec files are listed in BOTH gates:\n${doubled.join("\n")}`).toEqual([]);
});

test("the exclusion list names only real files, each with a real reason", () => {
  /* An allowlist that outlives its file silently re-opens the hole it was
     documenting, so it is itself checked. */
  for (const [file, reason] of Object.entries(DELIBERATELY_UNGATED)) {
    expect(specFiles, `${file} is on the exclusion list but no longer exists`).toContain(file);
    expect(reason.length, `${file}'s exclusion reason is too short to be a reason`).toBeGreaterThan(80);
  }
});

/** Counts declared tests.
 *
 *  The lookbehind is load-bearing and was added after this counter reported
 *  326 while the runner declared 319. `\b` does NOT exclude a preceding dot,
 *  so every `RegExp.prototype.test(` call in a spec — seven of them, in
 *  builder-readout, buy-readiness, css-tokens, interface-motion and suppliers
 *  — was being counted as a test declaration. Requiring that `test` is not
 *  preceded by a dot or word character keeps `.test(` and `latest(` out while
 *  still counting `test.only` / `test.skip` / `test.fixme`, which are real
 *  declarations. `test.describe(` and `test.use(` never match the suffix
 *  group and are excluded already. */
const countTests = (source: string): number =>
  /* Three corrections are baked into this one expression, each of which had
     the counter disagreeing with the runner:

     1. The lookbehind. `\b` does not exclude a preceding dot, so every
        `RegExp.prototype.test(` call in a spec — seven of them — was counted
        as a declaration.

     2. The pattern is ASSEMBLED rather than written as a regex literal. A
        literal spelling necessarily contains the very text it searches for, so
        this file counted its own matcher and was wrong about itself.

     3. A TITLE IS REQUIRED. The `.skip` form has two meanings in Playwright:
        given a string title and a body it DECLARES a skipped test, but given a
        condition and a reason it is a modifier called inside a running case or
        at describe scope. Three of the modifier form live in
        builder-viewer-tools and story-quality, and counting them put the UI
        total at 92 against the runner's 89. Every real declaration opens with
        a string title, so demanding one separates the two senses exactly.

     Note that all three corrections were found the same way — by disagreeing
     with a runner — and that none of them was visible by reading. This comment
     deliberately spells none of the tokens it describes, because the second
     correction was caused by an earlier version of it doing exactly that. */
  (
    source.match(
      new RegExp(
        `(?<![.\\w])${"tes" + "t"}(?:\\.only|\\.skip|\\.fixme)?\\(\\s*${"[\"'`]"}`,
        "g",
      ),
    ) ?? []
  ).length;

const gatedCount = (predicate: (file: string) => boolean): number =>
  specFiles
    .filter(predicate)
    .reduce((total, file) => total + countTests(read(appRoot, "tests", file)), 0);

const UNIT_TESTS = gatedCount(inUnitGate);
const UI_TESTS = gatedCount(inUiGate);

test("the counter agrees with what the runners actually declare", () => {
  /* The counter is a regex over source, which is an approximation of what the
     runner does — and the first version of it was wrong by seven. So it is
     pinned against numbers OBSERVED from the runners themselves:
       npm test        -> 658 declared, after graph variations glazing
       npm run test:ui -> 132 declared and passed, on a full 13.3-minute run
                          against a fresh static export, after the stated-lot
                          journey and explicit City-register surface joined
                          the served-build gate
     If a spec is added or removed these numbers move, and moving them means
     re-running both suites and writing down what they said — which is the
     point. A counter nobody ever checked against the thing it counts is how
     the README got its numbers wrong in the first place. */
  expect(UNIT_TESTS).toBe(658);
  expect(UI_TESTS).toBe(132);

  const readme = read(repoRoot, "README.md");
  const submission = read(repoRoot, "docs", "SUBMISSION.md");

  /* SUBMISSION.md is the document a hackathon judge opens, and it invites the
     reader to reproduce the numbers. It is the one that must never be wrong. */
  expect(
    submission.includes(String(UNIT_TESTS)),
    `docs/SUBMISSION.md does not state the real deterministic spec count (${UNIT_TESTS}). A judge who runs \`npm test\` gets ${UNIT_TESTS} and compares it against whatever this document promises.`,
  ).toBe(true);
  expect(
    submission.includes(String(UI_TESTS)),
    `docs/SUBMISSION.md does not state the real UI spec count (${UI_TESTS}).`,
  ).toBe(true);

  expect(
    readme.includes(String(UNIT_TESTS)),
    `README.md does not state the real deterministic spec count (${UNIT_TESTS}).`,
  ).toBe(true);
  expect(
    readme.includes(String(UI_TESTS)),
    `README.md does not state the real UI spec count (${UI_TESTS}).`,
  ).toBe(true);

  /* `includes` is satisfied by the right number appearing ANYWHERE, which is
     not the same as the document being right — and this gate proved that on
     itself. It went green while the README's own header badge still read
     "gates-175_unit_+_58_UI", because the corrected numbers were sitting in
     the verification table further down. A reader sees the badge first.

     So the badge is asserted directly, by shape, not by presence. */
  const badge = /badge\/gates-(\d+)_unit_%2B_(\d+)_UI/.exec(readme);
  expect(badge, "README.md's gates badge is missing or has changed shape").not.toBeNull();
  expect(
    `${badge?.[1]}/${badge?.[2]}`,
    "README.md's gates badge disagrees with the suites it is describing",
  ).toBe(`${UNIT_TESTS}/${UI_TESTS}`);
});

test("the published plan count is the real plan count", () => {
  /* Same class as the spec counts, and it drifted the same way: the library
     went 25 -> 55 and the number was hardcoded in five places — README.md,
     two rows and a post draft in SUBMISSION.md, the roadmap page, a comment in
     the UI config, and a comment in plan-proof.mjs. A count that lives in six
     files and is derived in none is a count that will be wrong again.

     PLAN_TEMPLATES is the only authority here, so this cannot drift from it. */
  const total = PLAN_TEMPLATES.length;
  expect(total).toBeGreaterThan(50);

  const readme = read(repoRoot, "README.md");
  const submission = read(repoRoot, "docs", "SUBMISSION.md");

  /* THE NUMBER HAS TO BE ABOUT PLANS. An `includes("72")` passed the moment
     SUBMISSION.md grew a video row reading "72-84s | Chain" — a timestamp
     satisfying a plan-count gate, which is the same presence-is-not-
     correctness hole the README badge check had. So the count must appear
     WITHIN A SENTENCE'S REACH of the word "plan": near enough that no
     unrelated number can wander in, loose enough that "72-plan library",
     "the plan library hit 72" and "Seventy-two-plan" all read as true. */
  const NEAR = 40;
  const statesPlanCount = (source: string, written: string): boolean => {
    const hay = source.toLowerCase();
    const needle = written.toLowerCase();
    for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
      const window = hay.slice(Math.max(0, at - NEAR), at + needle.length + NEAR);
      if (window.includes("plan")) return true;
    }
    return false;
  };

  expect(
    statesPlanCount(readme, String(total)) || statesPlanCount(readme, spelled(total)),
    `README.md does not state the real plan count (${total}) anywhere near the word "plan".`,
  ).toBe(true);
  expect(
    statesPlanCount(submission, String(total)),
    `docs/SUBMISSION.md does not state the real plan count (${total}) near the word "plan" — it is the document a judge opens, and a number that happens to be in a timestamp is not a published count.`,
  ).toBe(true);

  /* The live /roadmap Now arc used to hardcode "55-plan library" after the
     library had already grown. The page must derive the count, not type it. */
  const roadmap = read(appRoot, "app", "roadmap", "page.tsx");
  expect(
    roadmap.includes("PLAN_TEMPLATES.length"),
    "app/app/roadmap/page.tsx must derive its library size from PLAN_TEMPLATES.length",
  ).toBe(true);
  expect(
    roadmap,
    "app/app/roadmap/page.tsx still contains a hardcoded 55-plan claim",
  ).not.toMatch(/\b55-plan\b/);
});

/** The README writes the count in words ("Fifty-five-plan editable library"),
 *  which is the house style and worth keeping, so the check accepts either
 *  form rather than forcing digits into prose. */
function spelled(n: number): string {
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  if (n < 20) return String(n);
  const t = tens[Math.floor(n / 10)];
  const o = ones[n % 10];
  return o ? `${t}-${o}` : t;
}

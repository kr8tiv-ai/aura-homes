// Narrated demo of the Aura Brain memory pipeline — the five-stage discipline
// from @0xWast3's "Memory Engineering" article, run on a scripted journey.
// Every stage is exercised and CHECKed; exit code 0 means all checks passed.
// Run: npm run memory   (or: node dist/brain/memory-demo.js)

import * as fs from "fs";
import * as path from "path";
import {
  absorb,
  AbsorbEntry,
  advanceJourneyWithMemory,
  createStore,
  detectSlips,
  forget,
  getGuidance,
  JourneyState,
  liveFacts,
  loadMemory,
  MemoryStore,
  memoryPath,
  renderDigest,
  retrieve,
  saveMemory,
} from "./index";

const PACKAGE_ROOT = path.join(__dirname, "..", "..");

// Fixed clocks so the run is deterministic and the narration matches.
const T_CAPTURE = "2026-08-09T12:00:00Z"; // first conversation
const T_CONSOLIDATE = "2026-08-10T09:00:00Z"; // next-day restatements
const T_SUPERSEDE = "2026-08-11T09:00:00Z"; // the owner changes their mind
const T_FORGET = new Date("2026-09-20T09:00:00Z"); // weeks later, the forget pass

let failures = 0;
function check(ok: boolean, label: string): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures += 1;
}

function heading(text: string): void {
  console.log(`\n${"=".repeat(74)}\n${text}\n${"=".repeat(74)}`);
}

function printLog(log: AbsorbEntry[]): void {
  for (const entry of log) {
    if (entry.outcome === "rejected") {
      console.log(`  REJECTED   "${entry.statement}"`);
      console.log(`             reason: ${entry.reason}`);
    } else {
      console.log(`  ${entry.outcome.toUpperCase().padEnd(9)}  "${entry.statement}"`);
      console.log(
        `             class=${entry.class} subject=${entry.subject} id=${entry.factId}` +
          (entry.targetId && entry.targetId !== entry.factId ? ` target=${entry.targetId}` : "")
      );
      if (entry.conflictNote) console.log(`             conflict: ${entry.conflictNote}`);
    }
  }
}

function summarize(store: MemoryStore, now: Date): void {
  console.log(`  store: ${store.facts.length} fact(s), ${liveFacts(store, now).length} live`);
  for (const f of store.facts) {
    const status = f.supersededBy
      ? `SUPERSEDED by ${f.supersededBy}`
      : f.expiresISO && new Date(f.expiresISO) <= now
        ? "EXPIRED"
        : "live";
    console.log(
      `    [${status}] (${f.class}, ${f.subject}, conf ${f.confidence.toFixed(2)}` +
        `${f.reinforcements ? `, reinforced x${f.reinforcements}` : ""}` +
        `${f.expiresISO ? `, expires ${f.expiresISO.slice(0, 10)}` : ""}) ${f.content}`
    );
  }
}

function digestExcerpt(text: string): string {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => l.startsWith("MONEY POSITION"));
  const to = lines.findIndex((l) => l.startsWith("WHAT'S NEXT"));
  return lines
    .slice(from, to === -1 ? undefined : to)
    .map((l) => `  | ${l}`)
    .join("\n");
}

function main(): void {
  console.log("aura-brain memory demo — the five-stage memory-engineering pipeline");
  console.log('after "Memory Engineering" by @0xWast3');
  console.log("(https://x.com/0xWast3/status/2084625810112032849)");

  const journey: JourneyState = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "samples", "journey.sample.json"), "utf8")
  );

  // ---------------------------------------------------------------- stage 1
  heading("STAGE 1 — CAPTURE: a rejection system first, a storage system second");
  console.log("Eight things the owner said in one session. Watch what never reaches memory.\n");

  let store = createStore(journey.buildId, T_CAPTURE);
  const batch1 = absorb(
    store,
    [
      "Ugh, I am so frustrated with this permit form today.",
      "Can you show me the budget table again?",
      "We're just poking around at floor plans right now.",
      "Maybe we'll add a hot tub, not sure yet.",
      "I prefer to do the work myself wherever it's legal - DIY is the whole point.",
      "Hard budget ceiling for the whole build: $280K all-in, we cannot exceed it.",
      "The county permit office is closed until 2026-09-02.",
      "We must have at least three acres with reliable well water - non-negotiable.",
    ],
    { nowISO: T_CAPTURE, stage: journey.stage }
  );
  store = batch1.store;
  printLog(batch1.log);

  const rejected = batch1.log.filter((e) => e.outcome === "rejected");
  const inserted = batch1.log.filter((e) => e.outcome === "insert");
  console.log("");
  check(rejected.length === 4, "capture rejected all 4 noise statements (mood, question, session, hedge)");
  check(inserted.length === 4, "capture kept exactly 4 facts and consolidate inserted them");
  check(
    batch1.log.some((e) => e.class === "expiring" && e.subject === "permits"),
    "the date-bound office closure became an EXPIRING fact"
  );
  check(
    batch1.log.some((e) => e.class === "durable" && e.subject === "diy"),
    "the DIY preference became a DURABLE fact"
  );

  // ---------------------------------------------------------------- stage 2
  heading("STAGE 2 — CONSOLIDATE: insert / merge / skip against the live store");
  console.log("Next day the owner talks again. Restatements reinforce; duplicates add nothing.\n");

  const batch2 = absorb(
    store,
    [
      "I really do prefer doing the work myself where the law allows it.",
      "I prefer to do the work myself wherever it's legal - DIY is the whole point.",
      "Never put plumbing in the exterior walls, period.",
    ],
    { nowISO: T_CONSOLIDATE, stage: journey.stage }
  );
  store = batch2.store;
  printLog(batch2.log);

  console.log("");
  check(batch2.log[0].outcome === "merge", "a rephrased DIY preference MERGED into the existing fact (reinforced, not duplicated)");
  check(batch2.log[1].outcome === "skip", "a word-for-word repeat was SKIPPED — nothing new to store");
  check(batch2.log[2].outcome === "insert", "a genuinely new design constraint INSERTED");
  const diyFact = store.facts.find((f) => f.subject === "diy" && !f.supersededBy);
  check(
    (diyFact?.reinforcements ?? 0) >= 1 && (diyFact?.confidence ?? 0) > 0.75,
    "the merged DIY fact carries a reinforcement count and higher confidence"
  );
  console.log("");
  summarize(store, new Date(T_CONSOLIDATE));

  // ---------------------------------------------------------------- stage 3
  heading("STAGE 3 — RETRIEVE: stage-aware, only what matters right now");

  const now3 = new Date(T_CONSOLIDATE);
  const landFacts = retrieve("land", store, now3);
  const escrowFacts = retrieve("escrow", store, now3);
  console.log("retrieve('land') — parcel constraints surface:");
  for (const f of landFacts) console.log(`  - (${f.subject}) ${f.content}`);
  console.log("retrieve('escrow') — money preferences surface:");
  for (const f of escrowFacts) console.log(`  - (${f.subject}) ${f.content}`);
  const queryFacts = retrieve("can I do the electrical work myself", store, now3);
  console.log('retrieve("can I do the electrical work myself") — free-text query:');
  for (const f of queryFacts) console.log(`  - (${f.subject}) ${f.content}`);

  console.log("");
  check(
    landFacts.some((f) => f.subject === "land") && landFacts.some((f) => f.subject === "permits"),
    "LAND retrieval returns the acreage constraint and the county-office closure"
  );
  check(
    !landFacts.some((f) => f.subject === "budget" || f.subject === "diy"),
    "LAND retrieval excludes the budget and DIY facts (relevance, not recall)"
  );
  check(
    escrowFacts.length === 1 && escrowFacts[0].subject === "budget",
    "ESCROW retrieval returns exactly the budget ceiling — a different set for a different stage"
  );
  check(
    queryFacts.length > 0 && queryFacts[0].subject === "diy",
    "free-text retrieval ranks the DIY preference first for a do-it-myself question"
  );

  // The digest BEFORE the ceiling changes: $280K remembered vs $301,280 committed.
  const digestBefore = renderDigest(journey, detectSlips(journey, now3), now3, store);
  console.log("\nThe weekly digest weaves memory in — and flags the remembered ceiling:");
  console.log(digestExcerpt(digestBefore.plainText));
  check(
    digestBefore.plainText.includes("[FLAG]") && digestBefore.plainText.includes("EXCEEDS"),
    "digest flags the $301,280 milestone total against the remembered $280K ceiling"
  );

  // ---------------------------------------------------------------- stage 4
  heading("STAGE 4 — UPDATE: a contradiction supersedes; nothing coexists silently");
  console.log("The owner frees up cash. The statement rides in on a journey event\n(advanceJourneyWithMemory) — state machine and memory advance together.\n");

  const storeBefore = store;
  const advance = advanceJourneyWithMemory(
    journey,
    {
      type: "substepDone",
      stage: "escrow",
      substepId: "sip-quote",
      atISO: T_SUPERSEDE,
      userStatements: [
        "The quote landed, feels good.",
        "Actually, we can stretch the budget ceiling to $320K now.",
      ],
    },
    store,
    new Date(T_SUPERSEDE)
  );
  store = advance.memory;
  const journeyAfter = advance.state;
  printLog(advance.memoryLog);

  const superseded = advance.memoryLog.find((e) => e.outcome === "supersede");
  const old280 = store.facts.find((f) => f.content.includes("$280K"));
  const new320 = liveFacts(store, new Date(T_SUPERSEDE)).find((f) => f.content.includes("$320K"));
  console.log("");
  check(!!superseded, "the contradictory ceiling SUPERSEDED the old fact");
  check(
    advance.memoryLog.some((e) => e.outcome === "rejected"),
    "the small talk on the same event was still rejected"
  );
  check(
    !!old280?.supersededBy && old280.supersededBy === new320?.id,
    "the $280K fact is marked supersededBy the $320K fact (kept, dimmed, until forget)"
  );
  check(!!superseded?.conflictNote, "a lower-confidence overturn carries a conflict note to surface, not to silently trust");
  check(
    journeyAfter.substeps.escrow.find((s) => s.id === "sip-quote")?.status === "done",
    "the journey state advanced on the same event (substep sip-quote done)"
  );

  const escrowFactsAfter = retrieve("escrow", store, new Date(T_SUPERSEDE));
  console.log("\nretrieve('escrow') now returns the NEW ceiling only:");
  for (const f of escrowFactsAfter) console.log(`  - (${f.subject}) ${f.content}`);
  check(
    escrowFactsAfter.length === 1 && escrowFactsAfter[0].content.includes("$320K"),
    "retrieval after the supersede returns the $320K ceiling, never the $280K one"
  );

  const digestAfter = renderDigest(
    journeyAfter,
    detectSlips(journeyAfter, new Date(T_SUPERSEDE)),
    new Date(T_SUPERSEDE),
    store
  );
  console.log("\nThe digest re-checks the money position against the NEW ceiling:");
  console.log(digestExcerpt(digestAfter.plainText));
  check(
    digestAfter.plainText.includes("$320,000") && digestAfter.plainText.includes("sits inside it"),
    "digest now reports the total sits inside the remembered $320K ceiling"
  );

  // Guidance re-ranking on a durable preference.
  const designJourney: JourneyState = { ...journeyAfter, stage: "design" };
  const plain = getGuidance(designJourney);
  const withMemory = getGuidance(designJourney, store, new Date(T_SUPERSEDE));
  console.log("\ngetGuidance at DESIGN stage, without memory:");
  plain.forEach((g, i) => console.log(`  ${i + 1}. [${g.who}] ${g.action}`));
  console.log("getGuidance at DESIGN stage, with the remembered DIY preference:");
  withMemory.forEach((g, i) => console.log(`  ${i + 1}. [${g.who}] ${g.action}`));
  check(
    plain[1].who === "pro" && withMemory.every((g) => g.who === "owner"),
    "the DIY preference re-ranks guidance toward owner-doable actions (the pro item drops out of the top 3)"
  );

  // ---------------------------------------------------------------- stage 5
  heading("STAGE 5 — FORGET: expired and superseded facts drop after the grace window");
  console.log(`Fast-forward to ${T_FORGET.toISOString().slice(0, 10)} — past the office reopening and past the grace window.\n`);

  const { store: pruned, dropped } = forget(store, T_FORGET);
  store = pruned;
  for (const f of dropped) {
    console.log(`  DROPPED  (${f.supersededBy ? "superseded" : "expired"}) ${f.content}`);
  }
  console.log("");
  summarize(store, T_FORGET);
  console.log("");
  check(dropped.length === 2, "forget dropped exactly 2 facts");
  check(
    dropped.some((f) => f.subject === "permits") && dropped.some((f) => f.content.includes("$280K")),
    "the expired office closure and the superseded $280K ceiling are gone for good"
  );
  check(
    liveFacts(store, T_FORGET).length === 4 && store.facts.length === 4,
    "the four facts that still matter (DIY, land, design, $320K) survive"
  );

  // ---------------------------------------------------------------- persistence
  heading("PERSISTENCE — one JSON file per journey");
  const file = saveMemory(store);
  const reloaded = loadMemory(store.buildId);
  console.log(`  wrote ${file}`);
  check(fs.existsSync(memoryPath(store.buildId)), "store persisted to out/memory/<buildId>.json");
  check(
    reloaded.facts.length === store.facts.length &&
      reloaded.facts.every((f, i) => f.id === store.facts[i].id),
    "reload round-trips the store intact"
  );

  // Show the original store object was never mutated (pure functions all the way).
  check(
    storeBefore.facts.find((f) => f.content.includes("$280K"))?.supersededBy === undefined,
    "pure functions: the pre-supersede store snapshot is untouched"
  );

  console.log(
    `\n${failures === 0 ? "MEMORY DEMO PASSED" : `MEMORY DEMO FAILED (${failures} check(s))`}` +
      " — capture rejected, consolidate merged, retrieval stayed contextual, the contradiction superseded, and forget forgot."
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();

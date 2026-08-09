// Memory engineering for the Aura Brain — a per-journey memory store built on
// the five-stage pipeline from "Memory Engineering: The Discipline That
// Decides Whether Your AI Agent Has a Past" by @0xWast3
// (https://x.com/0xWast3/status/2084625810112032849), adopted at the
// founder's direction, Aug 2026. The five stages, mapped to this module:
//
//   1. Capture     -> capture()      rejection-first classifier (most statements
//                                    never reach the store at all)
//   2. Consolidate -> consolidate()  insert | merge | supersede | skip against
//                                    the existing store
//   3. Retrieve    -> retrieve()     contextual and stage-aware ranking
//   4. Reconcile   -> the supersede branch: contradictions never coexist
//                                    silently; low-confidence overturns carry
//                                    a conflict note (the article's flag_conflict)
//   5. Decay       -> forget()       expired and superseded facts are dropped
//                                    once past a grace window
//
// Everything is a pure function with an injectable clock, matching the rest of
// the brain. Persistence is one JSON file per buildId under agent/out/memory/.
// Privacy rule (docs/AI-BRAIN.md): the store holds outcome facts and stated
// preferences as single sentences — never raw transcripts.

import * as fs from "fs";
import * as path from "path";
import { DAY_MS, Stage, STAGE_ORDER } from "./types";

// ---------------------------------------------------------------- types

export type MemoryClass = "durable" | "expiring";

export interface MemoryFact {
  id: string;
  content: string;
  class: MemoryClass;
  subject: string;
  /** 0..1; raised by reinforcement, capped at 0.95. */
  confidence: number;
  sourceISO: string;
  /** Present on expiring facts: when the fact stops being true. */
  expiresISO?: string;
  /** Set when a contradicting fact replaced this one (the fact stays, dimmed, until forget()). */
  supersededBy?: string;
  /** When the supersession happened; drives the forget grace window. */
  supersededISO?: string;
  /** How many later re-statements consolidation merged into this fact. */
  reinforcements?: number;
}

export interface MemoryStore {
  buildId: string;
  facts: MemoryFact[];
  updatedISO: string;
}

export interface CaptureContext {
  /** Clock for sourceISO and relative-date parsing; defaults to now. */
  nowISO?: string;
  /** Journey stage the statement was made in (recorded for context, not required). */
  stage?: Stage;
}

export type CaptureOutcome =
  | { captured: true; fact: MemoryFact }
  | { captured: false; reason: string };

// ---------------------------------------------------------------- text helpers

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "to", "of", "and", "or", "in",
  "on", "for", "with", "we", "our", "i", "my", "it", "its", "that", "this",
  "be", "do", "does", "at", "as", "by", "not", "no", "so", "have", "has",
  "will", "can", "s", "t", "re", "ll", "am", "us", "you", "your",
]);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (let word of text.toLowerCase().replace(/[^a-z0-9$]+/g, " ").split(/\s+/)) {
    if (word.length > 3 && word.endsWith("s")) word = word.slice(0, -1); // light stemming
    if (word && !STOPWORDS.has(word)) out.add(word);
  }
  return out;
}

/** Jaccard similarity over normalized word sets. 0 = disjoint, 1 = identical. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

/** Count of meaningful words two texts share (used by guidance re-ranking). */
export function sharedTokenCount(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared += 1;
  return shared;
}

/** First dollar amount in a text, normalized to whole CAD ($280K -> 280000). */
export function parseMoneyCad(text: string): number | null {
  const m = text.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (m[2]) n *= m[2].toLowerCase() === "k" ? 1_000 : 1_000_000;
  return Math.round(n);
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ---------------------------------------------------------------- stage 1: capture

// Rejection patterns — capture is a rejection system first, storage second.
const TRANSIENT_MARKERS =
  /\b(frustrat\w*|annoy\w*|tired|exhausted|excit\w*|stress\w*|ugh|argh|lol|haha|hmm|brb|one sec|hold on|never ?mind)\b/i;
const SESSION_MARKERS =
  /\b(right now|at the moment|for now|for the moment|this session|just (checking|browsing|looking|poking)|one more time)\b/i;
const HEDGE_MARKERS =
  /\b(maybe|might|possibly|perhaps|not sure|thinking about|toying with|we'll see|haven't decided|undecided)\b/i;

// Durable signal: preference, constraint, or stable-fact language.
const DURABLE_MARKERS =
  /\b(prefer\w*|always|never|must|ceiling|cap of|no more than|cannot exceed|max(imum)?|require[sd]?|non[- ]?negotiable|allerg\w*|only ever|every time|as a rule|we decided|decision|deal[- ]?breaker|whole point|rule of thumb|policy)\b/i;
// Strong constraint language earns higher starting confidence.
const STRONG_MARKERS =
  /\b(never|always|must|non[- ]?negotiable|cannot exceed|hard|deal[- ]?breaker|whole point)\b/i;

// Date-bound signal: the fact is true only until a boundary.
const BOUND_MARKERS =
  /\b(until|through|reopens?|back on|closed|away|expires?|deadline|due|valid)\b/i;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseExpiry(statement: string, now: Date): string | undefined {
  const iso = statement.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return `${iso[1]}T23:59:59.000Z`;
  const md = statement.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i
  );
  if (md) {
    const month = MONTHS.indexOf(md[1].toLowerCase());
    const day = parseInt(md[2], 10);
    const year = md[3] ? parseInt(md[3], 10) : now.getUTCFullYear();
    let d = new Date(Date.UTC(year, month, day, 23, 59, 59));
    if (!md[3] && d.getTime() < now.getTime()) {
      d = new Date(Date.UTC(year + 1, month, day, 23, 59, 59));
    }
    return d.toISOString();
  }
  const rel = statement.match(/\b(this|next)\s+(week|month)\b/i);
  if (rel) {
    const mult = rel[1].toLowerCase() === "next" ? 2 : 1;
    const span = rel[2].toLowerCase() === "week" ? 7 : 30;
    return new Date(now.getTime() + mult * span * DAY_MS).toISOString();
  }
  return undefined;
}

/** Ordered subject map — first pattern that hits names the fact's subject. */
const SUBJECT_RULES: Array<{ subject: string; pattern: RegExp }> = [
  { subject: "budget", pattern: /\b(budget|ceiling|price|cost|spend|afford|\$\s?\d)/i },
  { subject: "diy", pattern: /\b(diy|myself|my own hands|owner[- ]?build\w*|self[- ]?build|do the work|hire|contractor)\b/i },
  { subject: "land", pattern: /\b(land|parcel|acre\w*|zoning|district|aquifer)\b/i },
  { subject: "water", pattern: /\b(water|well|cistern|awg)\b/i },
  { subject: "septic", pattern: /\b(septic|sewage|greywater)\b/i },
  { subject: "energy", pattern: /\b(solar|battery|generator|grid|power|kw)\b/i },
  { subject: "sip", pattern: /\b(sip|panel\w*|shell|envelope)\b/i },
  { subject: "permits", pattern: /\b(permit\w*|county|inspection|bylaw|office)\b/i },
  { subject: "escrow", pattern: /\b(escrow|milestone|holdback|usdc|release|fund\w*)\b/i },
  { subject: "design", pattern: /\b(design|layout|window\w*|glazing|bedroom|plumbing|wall\w*|floor)\b/i },
  { subject: "comms", pattern: /\b(email|digest|notification|update me|weekly)\b/i },
];

export function subjectOf(statement: string): string {
  for (const rule of SUBJECT_RULES) if (rule.pattern.test(statement)) return rule.subject;
  return "general";
}

/**
 * Stage 1 — Capture, rejection first. The test that matters: would this still
 * be true and useful in three months? Transient moods, session mechanics,
 * questions, and hedges are rejected outright; date-bound facts become
 * expiring; preference/constraint language becomes durable; everything else
 * is rejected by default.
 */
export function captureExplained(statement: string, context: CaptureContext = {}): CaptureOutcome {
  const text = statement.trim();
  const now = context.nowISO ? new Date(context.nowISO) : new Date();

  if (text.length < 12 || tokens(text).size < 2) {
    return { captured: false, reason: "too short to hold a fact" };
  }
  if (text.endsWith("?")) {
    return { captured: false, reason: "a question, not an assertion" };
  }
  if (TRANSIENT_MARKERS.test(text)) {
    return { captured: false, reason: "transient emotional state — expires with the moment" };
  }
  if (SESSION_MARKERS.test(text)) {
    return { captured: false, reason: "session-scoped remark, not a lasting fact" };
  }
  if (HEDGE_MARKERS.test(text) && !STRONG_MARKERS.test(text)) {
    return { captured: false, reason: "hedged — not yet a commitment worth storing" };
  }

  const subject = subjectOf(text);
  const sourceISO = now.toISOString();

  const expiresISO = parseExpiry(text, now);
  if (expiresISO && BOUND_MARKERS.test(text)) {
    return {
      captured: true,
      fact: {
        id: `mem-${subject}-${hash(text.toLowerCase())}`,
        content: text,
        class: "expiring",
        subject,
        confidence: 0.8,
        sourceISO,
        expiresISO,
      },
    };
  }

  if (DURABLE_MARKERS.test(text)) {
    return {
      captured: true,
      fact: {
        id: `mem-${subject}-${hash(text.toLowerCase())}`,
        content: text,
        class: "durable",
        subject,
        confidence: STRONG_MARKERS.test(text) ? 0.9 : 0.75,
        sourceISO,
      },
    };
  }

  return { captured: false, reason: "no durable or expiring signal — capture rejects by default" };
}

/** Thin wrapper: the classified fact, or null when capture rejects. */
export function capture(statement: string, context: CaptureContext = {}): MemoryFact | null {
  const outcome = captureExplained(statement, context);
  return outcome.captured ? outcome.fact : null;
}

// ---------------------------------------------------------------- stage 2: consolidate

export type ConsolidateAction = "insert" | "merge" | "supersede" | "skip";

export interface ConsolidateResult {
  action: ConsolidateAction;
  store: MemoryStore;
  /** The live fact after the operation (inserted, merged into, superseding, or the surviving duplicate). */
  fact: MemoryFact;
  /** On merge / supersede / skip: the pre-existing fact affected. */
  targetId?: string;
  /**
   * Set when a lower-confidence statement overturned a higher-confidence fact —
   * the article's flag_conflict branch: surface the ambiguity instead of
   * silently trusting whichever loaded last.
   */
  conflictNote?: string;
}

const CHANGE_MARKERS =
  /\b(actually|instead|no longer|not any ?more|changed (my|our) mind|scratch that|correction|update:|revised|rather than|switch(ing)? to|on second thought)\b/i;
const NEGATION_MARKERS = /\b(never|no longer|not|won't|will not|don't|do not|stop)\b/i;

const SKIP_SIMILARITY = 0.75; // near-identical restatement: nothing new to store
const MERGE_SIMILARITY = 0.2; // same subject, clearly the same fact rephrased

function contradicts(next: MemoryFact, prior: MemoryFact): boolean {
  if (CHANGE_MARKERS.test(next.content)) return true;
  const moneyNext = parseMoneyCad(next.content);
  const moneyPrior = parseMoneyCad(prior.content);
  if (moneyNext !== null && moneyPrior !== null && moneyNext !== moneyPrior) return true;
  const negNext = NEGATION_MARKERS.test(next.content);
  const negPrior = NEGATION_MARKERS.test(prior.content);
  if (negNext !== negPrior && similarity(next.content, prior.content) >= 0.3) return true;
  return false;
}

/**
 * Stage 2 — Consolidate. Resolves a captured fact against the live store:
 * a contradiction with a same-subject fact supersedes it (stage 4, Reconcile);
 * a near-identical restatement is skipped; a same-subject rephrase merges and
 * reinforces (ten mentions collapse into one confident entry, not ten rows);
 * anything genuinely new inserts.
 */
export function consolidate(
  newFact: MemoryFact,
  store: MemoryStore,
  now: Date = new Date(newFact.sourceISO)
): ConsolidateResult {
  const nowISO = now.toISOString();
  const candidates = store.facts.filter(
    (f) => !f.supersededBy && f.subject === newFact.subject && f.class === newFact.class
  );

  if (candidates.length > 0) {
    const contradicted = candidates.filter((f) => contradicts(newFact, f));
    if (contradicted.length > 0) {
      const ids = new Set(contradicted.map((f) => f.id));
      const facts = store.facts
        .map((f) => (ids.has(f.id) ? { ...f, supersededBy: newFact.id, supersededISO: nowISO } : f))
        .concat([newFact]);
      const strongest = contradicted.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      return {
        action: "supersede",
        store: { ...store, facts, updatedISO: nowISO },
        fact: newFact,
        targetId: strongest.id,
        conflictNote:
          strongest.confidence > newFact.confidence
            ? `A ${newFact.confidence.toFixed(2)}-confidence statement overturned a ` +
              `${strongest.confidence.toFixed(2)}-confidence fact ("${strongest.content}"). ` +
              "Worth confirming with the owner rather than trusting silently."
            : undefined,
      };
    }

    let best = candidates[0];
    let bestSim = similarity(newFact.content, best.content);
    for (const f of candidates.slice(1)) {
      const sim = similarity(newFact.content, f.content);
      if (sim > bestSim) {
        best = f;
        bestSim = sim;
      }
    }
    if (bestSim >= SKIP_SIMILARITY) {
      return { action: "skip", store, fact: best, targetId: best.id };
    }
    if (bestSim >= MERGE_SIMILARITY) {
      const merged: MemoryFact = {
        ...best,
        content: newFact.content.length > best.content.length ? newFact.content : best.content,
        confidence: Math.min(0.95, Math.max(best.confidence, newFact.confidence) + 0.05),
        reinforcements: (best.reinforcements ?? 0) + 1,
        expiresISO:
          best.expiresISO && newFact.expiresISO
            ? (newFact.expiresISO > best.expiresISO ? newFact.expiresISO : best.expiresISO)
            : best.expiresISO ?? newFact.expiresISO,
      };
      const facts = store.facts.map((f) => (f.id === best.id ? merged : f));
      return {
        action: "merge",
        store: { ...store, facts, updatedISO: nowISO },
        fact: merged,
        targetId: best.id,
      };
    }
  }

  return {
    action: "insert",
    store: { ...store, facts: [...store.facts, newFact], updatedISO: nowISO },
    fact: newFact,
  };
}

// ---------------------------------------------------------------- stage 3: retrieve

/** Which subjects matter per journey stage — LAND surfaces parcel constraints, ESCROW money preferences. */
const STAGE_SUBJECTS: Record<Stage, string[]> = {
  land: ["land", "water", "septic", "permits"],
  design: ["design", "sip", "energy", "diy", "water"],
  budget: ["budget", "diy", "energy", "sip"],
  escrow: ["budget", "escrow", "comms"],
  build: ["permits", "diy", "sip", "septic", "energy", "design"],
};

export interface RetrievedFact {
  fact: MemoryFact;
  score: number;
}

/** Live = not superseded and not past expiry. */
export function liveFacts(store: MemoryStore, now: Date = new Date()): MemoryFact[] {
  return store.facts.filter(
    (f) => !f.supersededBy && (!f.expiresISO || new Date(f.expiresISO).getTime() > now.getTime())
  );
}

const DECAY_HALF_LIFE_DAYS = 180;

function decayWeight(fact: MemoryFact, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(fact.sourceISO).getTime()) / DAY_MS);
  // Reinforced facts decay slower — repetition is the signal that they matter.
  const halfLife = DECAY_HALF_LIFE_DAYS * (1 + (fact.reinforcements ?? 0));
  return Math.pow(0.5, ageDays / halfLife);
}

/**
 * Stage 3 — Retrieve, contextually. Given a journey stage, ranks live facts
 * whose subject matters at that stage; given free text, ranks by token overlap.
 * Returns the few facts that matter now, never the whole store — twenty
 * marginal memories bury the two that count.
 */
export function retrieveScored(
  queryOrStage: Stage | string,
  store: MemoryStore,
  now: Date = new Date(),
  limit = 5
): RetrievedFact[] {
  const stage = (STAGE_ORDER as string[]).includes(queryOrStage)
    ? (queryOrStage as Stage)
    : undefined;
  const scored: RetrievedFact[] = [];
  for (const fact of liveFacts(store, now)) {
    let relevance = 0;
    if (stage) {
      const rank = STAGE_SUBJECTS[stage].indexOf(fact.subject);
      if (rank >= 0) relevance = 3 - 0.3 * rank;
    } else {
      const queryTokens = tokens(queryOrStage);
      if (queryTokens.has(fact.subject)) relevance += 2;
      relevance += 0.6 * sharedTokenCount(queryOrStage, fact.content);
    }
    if (relevance <= 0) continue; // irrelevant facts never surface, no matter how confident
    scored.push({ fact, score: relevance + fact.confidence + decayWeight(fact, now) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Ranked live facts relevant to a stage or free-text query. */
export function retrieve(
  queryOrStage: Stage | string,
  store: MemoryStore,
  now: Date = new Date(),
  limit = 5
): MemoryFact[] {
  return retrieveScored(queryOrStage, store, now, limit).map((r) => r.fact);
}

// ---------------------------------------------------------------- stage 5: forget

export interface ForgetResult {
  store: MemoryStore;
  dropped: MemoryFact[];
}

export const FORGET_GRACE_DAYS = 14;

/**
 * Stage 5 — Forget, aggressively but not violently: expired and superseded
 * facts stop retrieving immediately, then are dropped for good once past the
 * grace window. A store that never forgets becomes indistinguishable from one
 * that remembers nothing well.
 */
export function forget(
  store: MemoryStore,
  now: Date = new Date(),
  graceDays = FORGET_GRACE_DAYS
): ForgetResult {
  const cutoff = now.getTime() - graceDays * DAY_MS;
  const dropped: MemoryFact[] = [];
  const kept: MemoryFact[] = [];
  for (const fact of store.facts) {
    const expiredAt = fact.expiresISO ? new Date(fact.expiresISO).getTime() : undefined;
    const supersededAt = fact.supersededBy
      ? new Date(fact.supersededISO ?? fact.sourceISO).getTime()
      : undefined;
    const gone =
      (expiredAt !== undefined && expiredAt < cutoff) ||
      (supersededAt !== undefined && supersededAt < cutoff);
    (gone ? dropped : kept).push(fact);
  }
  if (dropped.length === 0) return { store, dropped };
  return { store: { ...store, facts: kept, updatedISO: now.toISOString() }, dropped };
}

// ---------------------------------------------------------------- absorb (capture -> consolidate)

export interface AbsorbEntry {
  statement: string;
  outcome: "rejected" | ConsolidateAction;
  reason?: string;
  factId?: string;
  subject?: string;
  class?: MemoryClass;
  targetId?: string;
  conflictNote?: string;
}

export interface AbsorbResult {
  store: MemoryStore;
  log: AbsorbEntry[];
}

/** Runs a batch of statements through capture then consolidate. Pure. */
export function absorb(
  store: MemoryStore,
  statements: string[],
  context: CaptureContext = {}
): AbsorbResult {
  const log: AbsorbEntry[] = [];
  let current = store;
  const now = context.nowISO ? new Date(context.nowISO) : new Date();
  for (const statement of statements) {
    const outcome = captureExplained(statement, context);
    if (!outcome.captured) {
      log.push({ statement, outcome: "rejected", reason: outcome.reason });
      continue;
    }
    const result = consolidate(outcome.fact, current, now);
    current = result.store;
    log.push({
      statement,
      outcome: result.action,
      factId: result.fact.id,
      subject: result.fact.subject,
      class: result.fact.class,
      targetId: result.targetId,
      conflictNote: result.conflictNote,
    });
  }
  return { store: current, log };
}

// ---------------------------------------------------------------- persistence

// dist/brain -> agent package root.
const PACKAGE_ROOT = path.join(__dirname, "..", "..");
export const DEFAULT_MEMORY_DIR = path.join(PACKAGE_ROOT, "out", "memory");

function safeBuildId(buildId: string): string {
  return buildId.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export function memoryPath(buildId: string, dir = DEFAULT_MEMORY_DIR): string {
  return path.join(dir, `${safeBuildId(buildId)}.json`);
}

export function createStore(buildId: string, nowISO = new Date().toISOString()): MemoryStore {
  return { buildId, facts: [], updatedISO: nowISO };
}

/** Loads the journey's memory store, or an empty store when none exists yet. */
export function loadMemory(buildId: string, dir = DEFAULT_MEMORY_DIR): MemoryStore {
  const file = memoryPath(buildId, dir);
  if (!fs.existsSync(file)) return createStore(buildId);
  return JSON.parse(fs.readFileSync(file, "utf8")) as MemoryStore;
}

/** Persists the store as JSON; returns the file path written. */
export function saveMemory(store: MemoryStore, dir = DEFAULT_MEMORY_DIR): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = memoryPath(store.buildId, dir);
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  return file;
}

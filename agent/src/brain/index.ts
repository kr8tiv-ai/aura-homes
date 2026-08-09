// Aura Brain core: the advanceJourney reducer (deterministic state machine)
// and getGuidance (next actions with who/why/cost). Stage knowledge encoded
// from docs/ALBERTA-PLAYBOOK.md — every cost and rule cited there.

import {
  EscrowSnapshot,
  JourneyState,
  KeyDates,
  MilestoneEscrowState,
  Party,
  Stage,
  STAGE_ORDER,
  Substep,
} from "./types";

import { AbsorbEntry, absorb, MemoryStore, retrieve, sharedTokenCount } from "./memory";

export * from "./types";
export { detectSlips, Slip, SlipSeverity } from "./slips";
export { renderDigest, Digest } from "./digest";
export * from "./memory";

// ---------------------------------------------------------------- events

/**
 * Journey events. Any event may carry userStatements — things the owner said
 * around the event — which advanceJourneyWithMemory runs through the memory
 * pipeline (capture -> consolidate); advanceJourney itself ignores them.
 */
export type JourneyEvent =
  | { type: "stageCompleted"; stage: Stage; atISO?: string; userStatements?: string[] }
  | { type: "substepDone"; stage: Stage; substepId: string; atISO?: string; userStatements?: string[] }
  | { type: "escrowFunded"; milestoneIndex: number; atISO?: string; userStatements?: string[] }
  | { type: "milestoneApproved"; milestoneIndex: number; by: "owner" | "builder"; atISO?: string; userStatements?: string[] }
  | { type: "milestoneReleased"; milestoneIndex: number; atISO?: string; userStatements?: string[] }
  | { type: "dateRecorded"; key: keyof KeyDates; iso: string; userStatements?: string[] };

const nextStage = (stage: Stage): Stage =>
  STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(stage) + 1, STAGE_ORDER.length - 1)];

function updateMilestone(
  escrow: EscrowSnapshot,
  index: number,
  patch: (m: MilestoneEscrowState) => MilestoneEscrowState
): EscrowSnapshot {
  return {
    ...escrow,
    milestones: escrow.milestones.map((m) => (m.index === index ? patch(m) : m)),
  };
}

/** Pure reducer: applies one typed event and returns the next state. */
export function advanceJourney(state: JourneyState, event: JourneyEvent): JourneyState {
  const at = "atISO" in event && event.atISO ? event.atISO : new Date().toISOString();

  switch (event.type) {
    case "stageCompleted": {
      const substeps: Record<Stage, Substep[]> = {
        ...state.substeps,
        [event.stage]: (state.substeps[event.stage] ?? []).map((s) =>
          s.status === "done" ? s : { ...s, status: "done" as const, completedISO: at, waitingOn: undefined }
        ),
      };
      const stage = state.stage === event.stage ? nextStage(event.stage) : state.stage;
      return { ...state, substeps, stage };
    }

    case "substepDone": {
      const list = (state.substeps[event.stage] ?? []).map((s) =>
        s.id === event.substepId
          ? { ...s, status: "done" as const, completedISO: at, waitingOn: undefined }
          : s
      );
      // Promote the first remaining pending substep so the stage always has a front.
      if (!list.some((s) => s.status === "active" || s.status === "waitingOn")) {
        const idx = list.findIndex((s) => s.status === "pending");
        if (idx >= 0) list[idx] = { ...list[idx], status: "active" };
      }
      return { ...state, substeps: { ...state.substeps, [event.stage]: list } };
    }

    case "escrowFunded":
      return {
        ...state,
        escrow: updateMilestone(state.escrow, event.milestoneIndex, (m) =>
          m.status === "awaitingFunding" ? { ...m, status: "funded" } : m
        ),
      };

    case "milestoneApproved":
      return {
        ...state,
        escrow: updateMilestone(state.escrow, event.milestoneIndex, (m) => ({
          ...m,
          approvals: { ...m.approvals, [event.by]: at },
        })),
      };

    case "milestoneReleased":
      return {
        ...state,
        escrow: updateMilestone(state.escrow, event.milestoneIndex, (m) =>
          m.status === "funded" ? { ...m, status: "released", releasedISO: at } : m
        ),
      };

    case "dateRecorded":
      return { ...state, keyDates: { ...state.keyDates, [event.key]: event.iso } };
  }
}

export interface MemoryAdvance {
  state: JourneyState;
  memory: MemoryStore;
  /** What the memory pipeline did with each userStatement on the event. */
  memoryLog: AbsorbEntry[];
}

/**
 * advanceJourney plus memory: applies the event to the journey state, then
 * runs any userStatements it carries through capture -> consolidate. Pure —
 * returns new state and a new store, touching neither input.
 */
export function advanceJourneyWithMemory(
  state: JourneyState,
  event: JourneyEvent,
  memory: MemoryStore,
  now: Date = new Date()
): MemoryAdvance {
  const nextState = advanceJourney(state, event);
  if (!event.userStatements || event.userStatements.length === 0) {
    return { state: nextState, memory, memoryLog: [] };
  }
  const { store, log } = absorb(memory, event.userStatements, {
    nowISO: now.toISOString(),
    stage: state.stage,
  });
  return { state: nextState, memory: store, memoryLog: log };
}

// ---------------------------------------------------------------- guidance

export interface GuidanceItem {
  action: string;
  who: Party;
  why: string;
  costCad?: string; // display string; ranges over point estimates (brand voice)
}

type GuidanceEntry = GuidanceItem & {
  /** Skip the entry when it no longer applies to this state. */
  when?: (state: JourneyState) => boolean;
};

/**
 * Per-stage guidance table. Facts from docs/ALBERTA-PLAYBOOK.md: verify the
 * cited items against primary sources before relying on them in a permit
 * application.
 */
const GUIDANCE: Record<Stage, GuidanceEntry[]> = {
  land: [
    {
      action: "Verify the parcel's district minimum dwelling size in the land-use bylaw",
      who: "platform",
      why:
        "Districts, never counties, set the minimum — Lac Ste. Anne Agricultural is 592 sqft, " +
        "its country-residential district 1,076 sqft. Check before buying, not after.",
      costCad: "No cost",
      when: (s) => !s.keyDates.landClosedISO,
    },
    {
      action: "Confirm the seller's GST status before offering",
      who: "owner",
      why:
        "Bare land from a developer, corporation, or subdivider adds 5 percent GST; personal-use land " +
        "from an individual is generally exempt — a $10,000 swing on a $200,000 parcel.",
      costCad: "No cost",
      when: (s) => !s.keyDates.landClosedISO,
    },
    {
      action: "Run the FortisAlberta Service Estimator and check aquifer reliability",
      who: "owner",
      why:
        "Grid-optional depends on a line passing the parcel; unreliable aquifers mean cistern, not well. " +
        "Both change the budget before you commit.",
      costCad: "No cost",
    },
  ],
  design: [
    {
      action: "Apply for Owner Builder Authorization",
      who: "owner",
      why:
        "Required to owner-build. Without warranty the title carries a no-sale-for-10-years caveat; " +
        "decision takes about 14 business days.",
      costCad: "$95 with warranty, $750 without",
    },
    {
      action: "Engage a residential designer to finish the review-ready package",
      who: "pro",
      why:
        "No architect is needed — the Architects Act exempts 1-4 unit dwellings — but a residential " +
        "designer turns the AI package into the permit set.",
      costCad: "$1,200-2,700",
    },
    {
      action: "Freeze the electrical layout before the SIP panel order",
      who: "owner",
      why:
        "Electrical chases are frozen at panel fabrication; no plumbing in exterior SIP walls. " +
        "Changes after the order mean site-cut workarounds.",
      costCad: "No cost if done now",
    },
  ],
  budget: [
    {
      action: "Lock supplier quotes against the LOW/MID/HIGH budget lines",
      who: "owner",
      why:
        "Alberta-first, no middlemen: the supplier directory covers SIP plants, solar, cistern, and " +
        "septic. Quotes turn ranges into commitments.",
      costCad: "No cost",
    },
    {
      action: "Hold contingency at 10-15 percent of subtotal",
      who: "platform",
      why: "The research range for small rural builds; spending it early is the classic budget slip.",
    },
    {
      action: "Plan the USDC funding path end to end",
      who: "owner",
      why:
        "On-ramp at 0 percent via Wealthsimple or Kraken, Base, then CCTP to native USDC on X Layer — " +
        "never USDC.e. The last land mile is CAD through a lawyer's trust account, convert-then-close.",
      costCad: "Network fees only",
    },
  ],
  escrow: [
    {
      action: "Fund the next milestone in native USDC on X Layer",
      who: "owner",
      why:
        "Work only starts against funded milestones; every release retains the 10 percent statutory " +
        "holdback per Alberta's Prompt Payment and Construction Lien Act, releasable after 60 days.",
      when: (s) => s.escrow.milestones.some((m) => m.status === "awaitingFunding"),
    },
    {
      action: "Order the SIP kit now that drawings are approved",
      who: "owner",
      why: "Panel lead time is 12-20 weeks from approved drawings; the clock only starts at the order.",
      costCad: "$30,000-55,000 (shell kit budget range)",
      when: (s) => !!s.keyDates.drawingsApprovedISO && !s.keyDates.sipOrderedISO,
    },
    {
      action: "Countersign milestone approvals promptly",
      who: "owner",
      why:
        "Release is 2-of-3 — the builder never approves their own milestone alone. A missing second " +
        "signature stalls the builder's cash without protecting you further.",
      costCad: "No cost",
    },
  ],
  build: [
    {
      action: "Pull your own trade permits where allowed",
      who: "owner",
      why:
        "A homeowner may pull electrical, plumbing, gas, and private sewage permits on a home they own " +
        "and will occupy (Leduc County confirms). Exception: solar PV and battery wiring requires a " +
        "licensed electrical contractor (CEC s.64).",
      costCad: "Development permit about $231 (Leduc County), then building and trade permits",
      when: (s) => !s.keyDates.permitIssuedISO,
    },
    {
      action: "Book the certified septic installer",
      who: "pro",
      why:
        "A certified installer is mandatory under the Private Sewage Standard of Practice — the eco " +
        "flagship is the Ecoflo biofilter with drip dispersal, Alberta's one legal greywater-reuse path.",
      costCad: "$10,000-25,000 (system range)",
    },
    {
      action: "Schedule the WETT inspection with the wood stove install",
      who: "pro",
      why: "Insurers demand a WETT-inspected installation; booking it with the install avoids a re-visit.",
    },
    {
      action: "Confirm the SIP delivery and crane day",
      who: "supplier",
      why: "Small-format panels erect with a 2-3 person crew; the delivery window anchors the schedule.",
      when: (s) => !!s.keyDates.sipOrderedISO && !s.keyDates.sipDeliveredISO,
    },
  ],
};

const PREFERS_DIY = /\b(diy|myself|self[- ]?build|owner[- ]?build\w*|own hands|do the work)\b/i;
const PREFERS_HIRING = /\b(hire|contract(or)?|hand (it )?off)\b/i;

/**
 * The next 3 actions for this journey: current-stage guidance first (filtered
 * by state), then the following stage's if fewer than 3 apply. When a memory
 * store is passed, durable facts retrieved for the current stage re-rank the
 * candidates — a remembered DIY preference pulls owner-doable actions up, a
 * hire-it-out preference pulls professional actions up, and token overlap with
 * any remembered fact nudges the matching action. Without memory the behaviour
 * is byte-identical to before.
 */
export function getGuidance(
  state: JourneyState,
  memory?: MemoryStore,
  now: Date = new Date()
): GuidanceItem[] {
  const wanted = memory ? 6 : 3; // with memory, gather a wider slate to re-rank
  const items: GuidanceItem[] = [];
  const startIdx = STAGE_ORDER.indexOf(state.stage);
  for (let i = startIdx; i < STAGE_ORDER.length && items.length < wanted; i++) {
    for (const entry of GUIDANCE[STAGE_ORDER[i]]) {
      if (items.length >= wanted) break;
      if (entry.when && !entry.when(state)) continue;
      const { when, ...item } = entry;
      items.push(item);
    }
  }
  if (!memory) return items;

  const facts = retrieve(state.stage, memory, now).filter((f) => f.class === "durable");
  if (facts.length === 0) return items.slice(0, 3);

  const boost = (item: GuidanceItem): number => {
    let b = 0;
    for (const f of facts) {
      if (f.subject === "diy") {
        const diy = PREFERS_DIY.test(f.content) && !PREFERS_HIRING.test(f.content);
        if (diy && item.who === "owner") b += 2;
        if (!diy && item.who === "pro") b += 2;
      }
      b += 0.4 * sharedTokenCount(f.content, `${item.action} ${item.why}`);
    }
    return b;
  };

  return items
    .map((item, index) => ({ item, index, b: boost(item) }))
    .sort((x, y) => y.b - x.b || x.index - y.index) // stable: original order breaks ties
    .slice(0, 3)
    .map((x) => x.item);
}

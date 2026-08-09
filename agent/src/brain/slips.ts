// Slip detection — ball-drop rules as pure functions over JourneyState
// (docs/AI-BRAIN.md item 3). Deterministic tier-0 code: no model involved.
// Facts cited in messages come from docs/ALBERTA-PLAYBOOK.md.

import { daysSince, JourneyState, allSubsteps } from "./types";

export type SlipSeverity = "nudge" | "warn" | "critical";

export interface Slip {
  ruleId: string;
  severity: SlipSeverity;
  message: string;
  suggestedAction: string;
}

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

const PARTY_LABEL: Record<string, string> = {
  owner: "you",
  pro: "the professional",
  county: "the county",
  supplier: "the supplier",
  platform: "the platform",
};

type Rule = (state: JourneyState, now: Date) => Slip[];

/**
 * sip-kit-unordered — drawings approved more than 7 days ago but no SIP kit
 * order recorded. The 12-20 week panel lead time runs from approved drawings;
 * idle days here push lock-up day for day.
 */
const sipKitUnordered: Rule = (state, now) => {
  const { drawingsApprovedISO, sipOrderedISO } = state.keyDates;
  if (!drawingsApprovedISO || sipOrderedISO) return [];
  const days = daysSince(drawingsApprovedISO, now);
  if (days <= 7) return [];
  return [
    {
      ruleId: "sip-kit-unordered",
      severity: "critical",
      message:
        `Drawings were approved ${days} days ago and the SIP kit is still unordered. ` +
        `Panel lead time is 12-20 weeks from approved drawings, so every idle day pushes lock-up by a day.`,
      suggestedAction: "Place the SIP kit order with the panel plant.",
    },
  ];
};

/**
 * permit-unsubmitted — design complete more than 7 days with no permit
 * application in. The stack starts with the development permit (about $231 in
 * Leduc County); rural approval typically runs 2-6 weeks.
 */
const permitUnsubmitted: Rule = (state, now) => {
  const { designCompleteISO, permitSubmittedISO } = state.keyDates;
  if (!designCompleteISO || permitSubmittedISO) return [];
  const days = daysSince(designCompleteISO, now);
  if (days <= 7) return [];
  return [
    {
      ruleId: "permit-unsubmitted",
      severity: "warn",
      message:
        `Design has been complete for ${days} days with no permit application submitted. ` +
        `The stack starts with the development permit (about $231 in Leduc County) and rural approval typically runs 2-6 weeks.`,
      suggestedAction: "Submit the development permit application to the county.",
    },
  ];
};

/**
 * holdback-maturity — a released milestone's statutory holdback became
 * releasable (60-day period from release has run) but is still held.
 */
const holdbackMaturity: Rule = (state, now) => {
  const slips: Slip[] = [];
  for (const m of state.escrow.milestones) {
    if (m.status !== "released" || m.holdbackReleased || !m.releasedISO) continue;
    const held = daysSince(m.releasedISO, now);
    if (held < state.escrow.holdbackPeriodDays) continue;
    const maturedISO = new Date(
      new Date(m.releasedISO).getTime() + state.escrow.holdbackPeriodDays * 86_400_000
    )
      .toISOString()
      .slice(0, 10);
    slips.push({
      ruleId: "holdback-maturity",
      severity: "warn",
      message:
        `Milestone ${m.index + 1} (${m.name}) holdback of ${cad(m.holdbackCad)} became releasable on ` +
        `${maturedISO} — the ${state.escrow.holdbackPeriodDays}-day statutory holdback period has run and it is still held.`,
      suggestedAction: `Release the matured holdback on milestone ${m.index + 1} to the builder.`,
    });
  }
  return slips;
};

/**
 * escrow-milestone-stale — one party approved a milestone more than 5 days ago
 * and the second approval has not landed, so the 2-of-3 release cannot execute.
 */
const escrowMilestoneStale: Rule = (state, now) => {
  const slips: Slip[] = [];
  for (const m of state.escrow.milestones) {
    if (m.status === "released" || !m.approvals) continue;
    const { owner, builder } = m.approvals;
    if (!!owner === !!builder) continue; // zero or both approvals — not stale
    const firstISO = (owner ?? builder) as string;
    const party = owner ? "owner" : "builder";
    const missing = owner ? "builder" : "owner";
    const days = daysSince(firstISO, now);
    if (days <= 5) continue;
    slips.push({
      ruleId: "escrow-milestone-stale",
      severity: "warn",
      message:
        `Milestone ${m.index + 1} (${m.name}) was approved by the ${party} ${days} days ago ` +
        `and is still waiting on the ${missing}'s approval before the release can execute.`,
      suggestedAction: `Get the ${missing}'s approval (or a dispute) on milestone ${m.index + 1} so the release can execute.`,
    });
  }
  return slips;
};

/**
 * winter-window — foundation work active in Oct-Mar. Screw piles (the standard
 * Aura foundation) install fine in frozen ground; any site-poured concrete
 * needs cold-weather protection and full cure before loading.
 */
const winterWindow: Rule = (state, now) => {
  if (state.stage !== "build") return [];
  const foundationActive = (state.substeps.build ?? []).some(
    (s) => /foundation|pile/i.test(s.id + s.label) && (s.status === "active" || s.status === "waitingOn")
  );
  if (!foundationActive) return [];
  const month = now.getMonth(); // 0-based: Oct=9 .. Mar=2
  if (month >= 3 && month <= 8) return [];
  return [
    {
      ruleId: "winter-window",
      severity: "nudge",
      message:
        "Foundation work is active in a winter month. Screw piles install fine in frozen ground; " +
        "any site-poured concrete needs cold-weather protection and full cure time before it can be loaded.",
      suggestedAction:
        "Keep the foundation on screw piles and schedule any concrete pours around cold-weather cure windows.",
    },
  ];
};

/**
 * waiting-escalation — generic faucet: any substep waiting on the same party
 * for more than 7 days gets escalated.
 */
const waitingEscalation: Rule = (state, now) => {
  const slips: Slip[] = [];
  for (const { substep } of allSubsteps(state)) {
    if (substep.status !== "waitingOn" || !substep.waitingOn) continue;
    const w = substep.waitingOn;
    const days = daysSince(w.sinceISO, now);
    if (days <= 7) continue;
    const who = PARTY_LABEL[w.who] ?? w.who;
    slips.push({
      ruleId: "waiting-escalation",
      severity: "warn",
      message: `Waiting on ${who} for ${days} days: ${w.what}. No movement recorded.`,
      suggestedAction:
        w.who === "owner"
          ? `Clear your own court: ${w.what}.`
          : `Follow up with ${who} on: ${w.what}.`,
    });
  }
  return slips;
};

const RULES: Rule[] = [
  sipKitUnordered,
  permitUnsubmitted,
  holdbackMaturity,
  escrowMilestoneStale,
  winterWindow,
  waitingEscalation,
];

const SEVERITY_ORDER: Record<SlipSeverity, number> = { critical: 0, warn: 1, nudge: 2 };

/** Runs the full rule library over a journey state. Pure; `now` injectable for tests. */
export function detectSlips(state: JourneyState, now: Date = new Date()): Slip[] {
  return RULES.flatMap((rule) => rule(state, now)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

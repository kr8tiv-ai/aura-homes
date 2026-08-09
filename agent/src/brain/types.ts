// Aura Brain journey state — the deterministic per-build state object the
// brain reads every turn (docs/AI-BRAIN.md). The state machine is code; the
// AI's job is judgment and communication on top of it.

export type Stage = "land" | "design" | "budget" | "escrow" | "build";

export const STAGE_ORDER: Stage[] = ["land", "design", "budget", "escrow", "build"];

export type SubstepStatus = "pending" | "active" | "waitingOn" | "done";

/** Who a stalled substep is waiting on. */
export type Party = "owner" | "pro" | "county" | "supplier" | "platform";

export interface WaitingOn {
  who: Party;
  what: string;
  sinceISO: string;
}

export interface Substep {
  id: string;
  label: string;
  status: SubstepStatus;
  /** Present when status is "waitingOn". */
  waitingOn?: WaitingOn;
  completedISO?: string;
}

export interface Blocker {
  id: string;
  description: string;
  raisedISO: string;
  resolvedISO?: string;
}

// ---------------------------------------------------------------- escrow

/**
 * Per-milestone escrow snapshot; mirrors the Milestone shape in ../types.ts
 * plus the on-chain lifecycle AuraBuildEscrow tracks (funding, 2-of-3
 * approvals, release, and the 60-day statutory holdback clock).
 */
export type MilestoneEscrowStatus = "awaitingFunding" | "funded" | "released";

export interface MilestoneEscrowState {
  index: number;
  name: string;
  amountCad: number; // gross, from budget MID column
  holdbackCad: number; // retained on release (Alberta statutory 10%)
  status: MilestoneEscrowStatus;
  /** ISO timestamps of recorded approvals; release needs both (2-of-3 pattern). */
  approvals?: { owner?: string; builder?: string };
  releasedISO?: string;
  holdbackReleased?: boolean;
  holdbackReleasedISO?: string;
}

export interface EscrowSnapshot {
  holdbackRateBps: number; // 1000 = 10%, matches AuraBuildEscrow default
  holdbackPeriodDays: number; // 60, matches AuraBuildEscrow default
  milestones: MilestoneEscrowState[];
}

export interface EscrowPosition {
  totalCad: number;
  fundedCad: number; // funded or released milestones, gross
  releasedNetCad: number; // paid to builder (gross minus holdback)
  heldBackCad: number; // holdback retained and not yet released
  awaitingCad: number; // milestones not yet funded
}

/** Derives the money position from the milestone snapshot. Pure. */
export function escrowPosition(escrow: EscrowSnapshot): EscrowPosition {
  let totalCad = 0;
  let fundedCad = 0;
  let releasedNetCad = 0;
  let heldBackCad = 0;
  for (const m of escrow.milestones) {
    totalCad += m.amountCad;
    if (m.status === "funded" || m.status === "released") fundedCad += m.amountCad;
    if (m.status === "released") {
      releasedNetCad += m.amountCad - m.holdbackCad;
      if (!m.holdbackReleased) heldBackCad += m.holdbackCad;
    }
  }
  return { totalCad, fundedCad, releasedNetCad, heldBackCad, awaitingCad: totalCad - fundedCad };
}

// ---------------------------------------------------------------- dates, prefs

/** Material dates the slip rules run against. All ISO 8601. */
export interface KeyDates {
  landClosedISO?: string;
  designCompleteISO?: string;
  drawingsApprovedISO?: string;
  permitSubmittedISO?: string;
  permitIssuedISO?: string;
  sipOrderedISO?: string;
  sipDeliveredISO?: string;
  foundationCompleteISO?: string;
  buildStartISO?: string;
  moveInISO?: string;
}

export interface EmailPrefs {
  weeklyDigest: boolean;
  materialChanges: boolean;
  address?: string;
}

// ---------------------------------------------------------------- journey

export interface JourneyState {
  buildId: string;
  projectName: string;
  parcel?: string; // display string, e.g. "37 Aspen Road, Lac Ste. Anne County"
  stage: Stage;
  /** Every stage keeps its substep list; earlier stages stay as a done record. */
  substeps: Record<Stage, Substep[]>;
  blockers: Blocker[];
  escrow: EscrowSnapshot;
  keyDates: KeyDates;
  emailPrefs: EmailPrefs;
}

// ---------------------------------------------------------------- helpers

export const DAY_MS = 86_400_000;

/** Whole days from `iso` to `now` (floor; negative if iso is in the future). */
export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
}

export function allSubsteps(state: JourneyState): Array<{ stage: Stage; substep: Substep }> {
  const out: Array<{ stage: Stage; substep: Substep }> = [];
  for (const stage of STAGE_ORDER) {
    for (const substep of state.substeps[stage] ?? []) out.push({ stage, substep });
  }
  return out;
}

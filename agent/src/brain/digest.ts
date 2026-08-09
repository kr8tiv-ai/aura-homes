// The weekly "Your build update" email (docs/AI-BRAIN.md item 4).
// Premium plain design per docs/BRAND.md: dark ground, one dominant accent,
// tracked-caps labels, no exclamation marks, no emoji, ranges with a basis.

import { liveFacts, MemoryStore, parseMoneyCad, retrieve } from "./memory";
import { Slip } from "./slips";
import {
  daysSince,
  escrowPosition,
  JourneyState,
  STAGE_ORDER,
  Substep,
  allSubsteps,
} from "./types";

export interface Digest {
  subject: string;
  plainText: string;
  html: string;
}

// Brand palette (docs/BRAND.md section 2).
const GROUND = "#050807";
const PANEL = "#0a100d";
const EMERALD = "#10b981";
const EMERALD_BRIGHT = "#34d399";
const TEAL = "#2dd4bf";
const VIOLET = "#8b5cf6";
const OFF_WHITE = "#e7ece9";
const DIM = "#8a938f";
const HAIRLINE = "#4a524e";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

/** Escapes state-derived text for HTML interpolation. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MOVED_WINDOW_DAYS = 7;

interface DigestModel {
  moved: string[];
  next: string[];
  money: Array<{ label: string; value: string }>;
  moneyLine: string;
  stageLine: string;
  /** Present when a memory store was supplied: facts remembered for this stage. */
  remembered?: string[];
  /** A remembered budget ceiling checked against the milestone total. */
  budgetFlag?: string;
  budgetExceeded?: boolean;
}

const CEILING_LANGUAGE = /\b(ceiling|cap|limit|max|no more than|exceed|all[- ]?in)\b/i;

function memoryModel(
  state: JourneyState,
  memory: MemoryStore,
  now: Date
): Pick<DigestModel, "remembered" | "budgetFlag" | "budgetExceeded"> {
  const facts = retrieve(state.stage, memory, now, 4);
  const remembered = facts.map((f) =>
    f.class === "expiring" && f.expiresISO
      ? `${f.content} (holds until ${f.expiresISO.slice(0, 10)})`
      : f.content
  );

  const ceilingFact = liveFacts(memory, now)
    .filter(
      (f) =>
        f.subject === "budget" &&
        parseMoneyCad(f.content) !== null &&
        CEILING_LANGUAGE.test(f.content)
    )
    .sort((a, b) => b.confidence - a.confidence || b.sourceISO.localeCompare(a.sourceISO))[0];

  if (!ceilingFact) return { remembered };
  const ceiling = parseMoneyCad(ceilingFact.content) as number;
  const total = escrowPosition(state.escrow).totalCad;
  const budgetExceeded = total > ceiling;
  const budgetFlag = budgetExceeded
    ? `Remembered budget ceiling ${cad(ceiling)} — the ${cad(total)} milestone total EXCEEDS it by ${cad(total - ceiling)}.`
    : `Remembered budget ceiling ${cad(ceiling)} — the ${cad(total)} milestone total sits inside it.`;
  return { remembered, budgetFlag, budgetExceeded };
}

function buildModel(state: JourneyState, now: Date): DigestModel {
  // What moved: substeps completed inside the window, in stage order.
  const moved = allSubsteps(state)
    .filter(
      ({ substep }) =>
        substep.status === "done" &&
        substep.completedISO &&
        daysSince(substep.completedISO, now) <= MOVED_WINDOW_DAYS &&
        daysSince(substep.completedISO, now) >= 0
    )
    .map(({ substep }) => substep.label);

  // What's next: active substeps first, then pending, current stage outward.
  const byStatus = (status: Substep["status"]) =>
    allSubsteps(state)
      .filter(({ substep }) => substep.status === status)
      .map(({ substep }) => substep.label);
  const next = [...byStatus("active"), ...byStatus("waitingOn"), ...byStatus("pending")].slice(0, 3);

  const pos = escrowPosition(state.escrow);
  const money = [
    { label: "Funded to escrow", value: cad(pos.fundedCad) },
    { label: "Released to builder (net)", value: cad(pos.releasedNetCad) },
    { label: "Holdback retained", value: cad(pos.heldBackCad) },
    { label: "Awaiting funding", value: cad(pos.awaitingCad) },
  ];
  const moneyLine =
    `${cad(pos.fundedCad)} funded to escrow, ${cad(pos.releasedNetCad)} released to the builder, ` +
    `${cad(pos.heldBackCad)} held back under the statutory holdback, ${cad(pos.awaitingCad)} awaiting funding.`;

  const stageIdx = STAGE_ORDER.indexOf(state.stage);
  const stageLine = `Stage ${stageIdx + 1} of ${STAGE_ORDER.length} — ${state.stage.toUpperCase()}`;

  return { moved, next, money, moneyLine, stageLine };
}

export function renderDigest(
  state: JourneyState,
  slips: Slip[],
  now: Date = new Date(),
  memory?: MemoryStore
): Digest {
  const m: DigestModel = memory
    ? { ...buildModel(state, now), ...memoryModel(state, memory, now) }
    : buildModel(state, now);
  const subject = `Your build update — ${state.projectName}`;

  // ---------------------------------------------------------------- plain text
  const lines: string[] = [];
  lines.push(subject.toUpperCase());
  lines.push(`${m.stageLine}${state.parcel ? ` · ${state.parcel}` : ""}`);
  lines.push("");
  lines.push("WHAT MOVED");
  if (m.moved.length === 0) lines.push("  No steps completed in the past week.");
  for (const item of m.moved) lines.push(`  - ${item}`);
  lines.push("");
  lines.push("MONEY POSITION");
  for (const row of m.money) lines.push(`  ${row.label}: ${row.value}`);
  if (m.budgetFlag) lines.push(`  ${m.budgetExceeded ? "[FLAG] " : ""}${m.budgetFlag}`);
  lines.push("");
  if (m.remembered) {
    lines.push("REMEMBERED");
    if (m.remembered.length === 0) lines.push("  Nothing remembered for this stage yet.");
    for (const item of m.remembered) lines.push(`  - ${item}`);
    lines.push("");
  }
  lines.push("WHAT'S NEXT");
  if (m.next.length === 0) lines.push("  Nothing queued — the journey is fully complete.");
  for (const item of m.next) lines.push(`  - ${item}`);
  lines.push("");
  lines.push(`FLAGGED (${slips.length})`);
  if (slips.length === 0) lines.push("  Nothing slipping. All timers are inside their windows.");
  for (const s of slips) {
    lines.push(`  [${s.severity.toUpperCase()}] ${s.message}`);
    lines.push(`    Do: ${s.suggestedAction}`);
  }
  lines.push("");
  lines.push(
    "Sent by the Aura Brain — deterministic journey state, no guesswork. " +
      "Every figure reconciles with your escrow and budget records."
  );
  const plainText = lines.join("\n");

  // ---------------------------------------------------------------- html
  const label = (text: string, color = DIM) =>
    `<p style="margin:0 0 10px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${color};">${text}</p>`;
  const listItems = (items: string[], empty: string) =>
    items.length === 0
      ? `<p style="margin:0;color:${DIM};font-size:14px;line-height:1.6;">${empty}</p>`
      : items
          .map(
            (i) =>
              `<p style="margin:0 0 6px;color:${OFF_WHITE};font-size:14px;line-height:1.6;">` +
              `<span style="color:${EMERALD_BRIGHT};">&#9702;</span>&nbsp;&nbsp;${esc(i)}</p>`
          )
          .join("");

  const severityColor = (s: Slip) =>
    s.severity === "critical" ? VIOLET : s.severity === "warn" ? EMERALD_BRIGHT : DIM;

  const slipBlocks =
    slips.length === 0
      ? `<p style="margin:0;color:${DIM};font-size:14px;line-height:1.6;">Nothing slipping. All timers are inside their windows.</p>`
      : slips
          .map(
            (s) =>
              `<div style="border-left:2px solid ${severityColor(s)};padding:2px 0 2px 14px;margin:0 0 16px;">` +
              `<p style="margin:0 0 4px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${severityColor(s)};">${s.severity}</p>` +
              `<p style="margin:0 0 6px;color:${OFF_WHITE};font-size:14px;line-height:1.6;">${esc(s.message)}</p>` +
              `<p style="margin:0;color:${DIM};font-size:13px;line-height:1.5;">Do: ${esc(s.suggestedAction)}</p>` +
              `</div>`
          )
          .join("");

  const moneyRows = m.money
    .map(
      (row) =>
        `<tr>` +
        `<td style="padding:6px 0;color:${DIM};font-size:14px;">${row.label}</td>` +
        `<td style="padding:6px 0;color:${TEAL};font-size:14px;text-align:right;font-variant-numeric:tabular-nums;">${row.value}</td>` +
        `</tr>`
    )
    .join("");

  const section = (heading: string, body: string, headingColor = DIM) =>
    `<tr><td style="padding:28px 32px 0;">${label(heading, headingColor)}${body}</td></tr>`;

  const html = `<div style="background-color:${GROUND};padding:32px 12px;font-family:'Segoe UI',-apple-system,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:${PANEL};border:1px solid ${HAIRLINE};border-radius:8px;">
    <tr>
      <td style="padding:32px 32px 0;">
        ${label("Aura Homes &middot; Weekly build update", EMERALD)}
        <p style="margin:0 0 6px;font-size:24px;font-weight:300;color:${OFF_WHITE};">${esc(state.projectName)}</p>
        <p style="margin:0;font-size:13px;color:${DIM};">${m.stageLine}${state.parcel ? ` &middot; ${esc(state.parcel)}` : ""}</p>
      </td>
    </tr>
    ${section("What moved", listItems(m.moved, "No steps completed in the past week."))}
    ${section(
      "Money position",
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${moneyRows}</table>` +
        (m.budgetFlag
          ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${m.budgetExceeded ? VIOLET : TEAL};">${esc(m.budgetFlag)}</p>`
          : "") +
        `<p style="margin:8px 0 0;font-size:12px;color:${DIM};line-height:1.5;">Milestone escrow in native USDC on X Layer; 10 percent statutory holdback retained on every release, releasable after ${state.escrow.holdbackPeriodDays} days.</p>`
    )}
    ${m.remembered ? section("Remembered", listItems(m.remembered, "Nothing remembered for this stage yet.")) : ""}
    ${section("What's next", listItems(m.next, "Nothing queued — the journey is fully complete."))}
    ${section(`Flagged (${slips.length})`, slipBlocks, slips.length > 0 ? VIOLET : DIM)}
    <tr>
      <td style="padding:28px 32px 32px;">
        <hr style="border:none;border-top:1px solid ${HAIRLINE};margin:0 0 16px;" />
        <p style="margin:0;font-size:12px;color:${DIM};line-height:1.6;">
          Sent by the Aura Brain — deterministic journey state, no guesswork. Every figure reconciles
          with your escrow and budget records. You receive this weekly and on material changes;
          frequency is yours to change.
        </p>
      </td>
    </tr>
  </table>
</div>`;

  return { subject, plainText, html };
}

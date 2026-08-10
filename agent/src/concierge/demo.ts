// npm run concierge — the narrated end-to-end journey, offline-deterministic:
// no network, no model, injectable clock. Two runs over the pure reducer:
//   Run A: question -> REFUSAL with the bylaw citation -> passing parcel ->
//          home -> quote (reconciles to cost-model.json to the dollar) ->
//          deposit with the refund deadline -> unilateral REFUND.
//   Run B: same order up to the deposit, then the window EXPIRES -> the order
//          CONVERTS -> the build starts (holdback math on screen).
// Every figure is asserted against data/alberta/cost-model.json; any mismatch
// exits non-zero. Exit 0 = all checks passed.

import { isRepoCostModel } from "../types";
import {
  loadCostModel,
  loadSampleParcels,
  loadSampleQuestionnaire,
} from "../mcp/load";
import { createOrder, fmtCad, Order } from "./order";
import { ConciergeContext, ConciergeIntent, reduce } from "./reducer";

// ---------------------------------------------------------------- harness

let failures = 0;
const checks: string[] = [];
function check(ok: boolean, label: string): void {
  checks.push(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures += 1;
}

const START = new Date("2026-08-12T17:00:00Z");
let step = 0;
/** Deterministic clock: +5 minutes per turn from the fixed start. */
function nextNow(): Date {
  return new Date(START.getTime() + ++step * 5 * 60_000);
}
/** Jump the clock to a given hour offset from the start (for window tests). */
function atHours(h: number): Date {
  return new Date(START.getTime() + h * 3_600_000);
}

const { model, source, extras } = loadCostModel();
const baseCtx: Omit<ConciergeContext, "now"> = {
  parcels: loadSampleParcels(),
  questionnaire: loadSampleQuestionnaire(),
  costModel: model,
  fileTotalsExLand: extras.totalsExLand,
};

function turn(
  order: Order,
  speaker: string,
  said: string,
  intent: ConciergeIntent,
  now: Date = nextNow()
): Order {
  console.log(`\n[${speaker}] ${said}`);
  const { order: next, reply, actions } = reduce(order, intent, { ...baseCtx, now });
  console.log(indent(`[aura] ${reply}`));
  for (const a of actions) console.log(`       -> action: ${JSON.stringify(a)}`);
  return next;
}

const indent = (s: string): string => s.split("\n").map((l) => `  ${l}`).join("\n");

// ---------------------------------------------------------------- the journey

function main(): void {
  console.log("AURA CONCIERGE — scripted journey (offline-deterministic: no model, no network, injected clock)");
  console.log(`cost model: ${source}`);
  if (!isRepoCostModel(model) || !extras.totalsExLand) {
    console.error("FATAL: data/alberta/cost-model.json not loaded — reconciliation impossible.");
    process.exit(1);
  }

  // ============================================================ RUN A
  console.log("\n================ RUN A — refusal, quote, deposit, REFUND ================");
  let a = createOrder({ id: "aura-order-demo-A", now: nextNow(), buyer: { name: "Demo Buyer" } });

  a = turn(
    a,
    "buyer",
    "I want an off-grid home, about 800 square feet. What's actually included in the price?",
    { type: "askAbout", question: "I want an off-grid home, about 800 square feet. What's actually included in the price?" }
  );
  check(a.desiredSizeSqft === 800, "askAbout slot-fills the desired size (800 sqft) from the question");

  a = turn(a, "buyer", "Show me the homes.", { type: "listHomes" });
  a = turn(a, "buyer", "The Aura SIP 800 is the one.", { type: "selectHome", homeId: "aura-sip-800" });

  // THE REFUSAL — Lakeside Estates, Country Residential, 1,076 sqft minimum.
  console.log("\n---------------- THE REFUSAL ----------------");
  const before = a;
  a = turn(a, "buyer", "Put it on the Lakeside Estates parcel.", {
    type: "selectParcel",
    parcelId: "lsa-lakeside-estates",
  });
  check(a.status === "parcelRejected", "status is parcelRejected after the land gate refuses");
  const refusalEvent = a.events[a.events.length - 1];
  check(refusalEvent.type === "parcelRejected", "append-only log records the parcelRejected event");
  check(a.rejections.length === 1, "the rejection is kept on the order record");
  const refusalResult = reduce(before, { type: "selectParcel", parcelId: "lsa-lakeside-estates" }, {
    ...baseCtx,
    now: new Date(refusalEvent.atISO),
  });
  check(/1,076/.test(refusalResult.reply), "refusal cites the district minimum (1,076 sqft)");
  check(/800/.test(refusalResult.reply), "refusal cites the design size (800 sqft)");
  check(/Country Residential/.test(refusalResult.reply), "refusal names the district");
  check(/land-use bylaw/i.test(refusalResult.reply), "refusal carries the bylaw citation");
  check(/37 Aspen Road/.test(refusalResult.reply), "refusal offers passing parcels (37 Aspen Road)");
  check(/Aura SIP 1200/.test(refusalResult.reply), "refusal offers the larger home (Aura SIP 1200 clears 1,076)");
  check(
    refusalResult.actions.some((x) => x.type === "disableBuy"),
    "refusal disables the BUY control with the citation"
  );

  // The consequence: guided to a parcel that passes.
  a = turn(a, "buyer", "Okay — 37 Aspen Road then.", { type: "selectParcel", parcelId: "lsa-aspen-road" });
  check(a.status === "homeSelected", "home + passing parcel -> homeSelected");
  check(a.parcel?.verdict === "PASS", "37 Aspen Road passes the same design");

  // The quote — must reconcile to the file to the dollar.
  console.log("\n---------------- THE QUOTE ----------------");
  a = turn(a, "buyer", "Quote it.", { type: "requestQuote" });
  check(a.status === "quoted", "status is quoted");
  const quote = a.quote!;
  const f = extras.totalsExLand;
  check(
    quote.budget!.total.lowCad === f.low &&
      quote.budget!.total.midCad === f.mid &&
      quote.budget!.total.highCad === f.high,
    `budget totals equal cost-model.json totalsExLand to the dollar ` +
      `(${fmtCad(f.low)} / ${fmtCad(f.mid)} / ${fmtCad(f.high)})`
  );
  check(quote.reconciliation.reconcilesToFile === true, "quote.reconciliation.reconcilesToFile === true");
  check(
    quote.plan!.totalCad === quote.budget!.total.midCad,
    `milestone schedule total (${fmtCad(quote.plan!.totalCad)}) === budget MID`
  );
  const holdbackExpected = quote.plan!.milestones.reduce(
    (s, m) => s + Math.round((m.amountCad * 1000) / 10000),
    0
  );
  check(
    quote.plan!.totalHoldbackCad === holdbackExpected,
    `total holdback ${fmtCad(quote.plan!.totalHoldbackCad)} = 10% of each milestone, summed`
  );
  check(
    quote.depositCad === quote.plan!.milestones[0].amountCad,
    `deposit ${fmtCad(quote.depositCad)} === milestone 1 amount (escrow v2 milestone 0)`
  );
  check(
    quote.depositUsdc6 === String(Math.round(quote.depositCad * 0.73 * 100) / 100 * 1_000_000),
    `deposit USDC base units (${quote.depositUsdc6}) match the demo FX math`
  );

  // The deposit.
  console.log("\n---------------- THE DEPOSIT ----------------");
  a = turn(a, "buyer", "Place the deposit.", { type: "placeDeposit" });
  check(a.status === "depositPending", "status is depositPending (approve + fund actions emitted)");
  a = turn(a, "app", "(deposit tx confirmed on eip155:1952)", {
    type: "confirmDeposit",
    txRef: "0xDEMO…A",
  });
  check(a.status === "refundWindowOpen", "deposit lands -> depositPaid -> refundWindowOpen");
  check(
    a.events.some((e) => e.type === "depositFunded") && a.events.some((e) => e.type === "refundWindowOpened"),
    "log carries depositFunded and refundWindowOpened events"
  );
  const deadlineA = new Date(a.deposit!.refundDeadlineISO!);
  const fundedA = new Date(a.deposit!.fundedAtISO!);
  check(
    deadlineA.getTime() - fundedA.getTime() === 72 * 3_600_000,
    "refund deadline is exactly 72h after funding"
  );

  // The refund — 48h in, well inside the 72h window.
  console.log("\n---------------- THE REFUND ----------------");
  a = turn(a, "buyer", "Actually — I changed my mind. Refund me.", { type: "requestRefund" }, atHours(48));
  check(a.status === "refunded", "status is refunded (terminal)");
  check(
    a.deposit!.refundedAtISO !== undefined && a.deposit!.amountCad === quote.depositCad,
    "the exact deposit amount is returned"
  );
  const postRefund = reduce(a, { type: "placeDeposit" }, { ...baseCtx, now: atHours(49) });
  check(postRefund.order === a, "refunded order accepts no further intents (unchanged)");

  // ============================================================ RUN B
  console.log("\n================ RUN B — same journey, window EXPIRES, order CONVERTS ================");
  step = 0;
  let b = createOrder({ id: "aura-order-demo-B", now: nextNow(), buyer: { name: "Demo Buyer" } });
  b = turn(b, "buyer", "Aura SIP 800.", { type: "selectHome", homeId: "aura-sip-800" });
  b = turn(b, "buyer", "On 37 Aspen Road.", { type: "selectParcel", parcelId: "lsa-aspen-road" });
  b = turn(b, "buyer", "Quote it.", { type: "requestQuote" });
  b = turn(b, "buyer", "Place the deposit.", { type: "placeDeposit" });
  b = turn(b, "app", "(deposit tx confirmed)", { type: "confirmDeposit", txRef: "0xDEMO…B" });

  b = turn(b, "app", "(clock: 71h after funding — window still open?)", { type: "tick" }, atHours(71));
  check(b.status === "refundWindowOpen", "at 71h the window is still open");
  b = turn(b, "app", "(clock: 73h after funding)", { type: "tick" }, atHours(73.5));
  check(b.status === "converted", "past the deadline the order converts");
  check(
    b.events.some((e) => e.type === "refundWindowClosed") && b.events.some((e) => e.type === "converted"),
    "log carries refundWindowClosed and converted events"
  );
  const lateRefund = reduce(b, { type: "requestRefund" }, { ...baseCtx, now: atHours(74) });
  check(
    lateRefund.order.status === "converted" && /2-of-3/.test(lateRefund.reply),
    "refund after conversion is refused (2-of-3 cancel is the only unwind)"
  );

  b = turn(b, "buyer", "Start the build.", { type: "startBuild" }, atHours(75));
  check(b.status === "building", "startBuild -> building");
  const m0 = b.quote!.plan!.milestones[0];
  check(
    m0.netOnReleaseCad === m0.amountCad - m0.holdbackCad,
    `milestone 1 release math: ${fmtCad(m0.amountCad)} gross = ${fmtCad(m0.netOnReleaseCad)} net + ${fmtCad(m0.holdbackCad)} holdback`
  );

  // ============================================================ reconciliation
  console.log("\n================ RECONCILIATION — vs data/alberta/cost-model.json ================");
  console.log(`  file totalsExLand:     LOW ${fmtCad(f.low)} / MID ${fmtCad(f.mid)} / HIGH ${fmtCad(f.high)}`);
  const t = quote.budget!.total;
  console.log(`  computed quote totals: LOW ${fmtCad(t.lowCad)} / MID ${fmtCad(t.midCad)} / HIGH ${fmtCad(t.highCad)}`);
  console.log(`  milestones: ${quote.plan!.milestones.length}, total ${fmtCad(quote.plan!.totalCad)} (= budget MID), holdback ${fmtCad(quote.plan!.totalHoldbackCad)}`);
  console.log(`  deposit: ${fmtCad(quote.depositCad)} = milestone 1 amount = ${quote.depositUsdc6} USDC base units`);
  console.log(`\nCHECKS (${checks.length}):`);
  for (const line of checks) console.log(line);
  console.log(`\n${failures === 0 ? "CONCIERGE DEMO PASSED — every figure reconciles to the dollar" : `CONCIERGE DEMO FAILED (${failures} check(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

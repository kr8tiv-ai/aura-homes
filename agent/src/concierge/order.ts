// The Order object — the typed, serializable state machine for ONE purchase
// journey (ROADMAP-LONG-FORM M3: "the order object is the contract between
// every part of the demo. The escrow funds this. The registry records this.
// The budget page renders this.").
//
// PURE module: no fs, no env, no network, injectable clock everywhere. The
// Next.js app imports these types and helpers directly; the reducer
// (./reducer.ts) is the only thing that transitions an order.

import { Budget, BuildPlan, ParcelListing, ParcelVerdict } from "../types";

// ---------------------------------------------------------------- constants

/** X Layer testnet (post-Terigon chain id 1952) — docs/ARCHITECTURE.md. */
export const X_LAYER_TESTNET = "eip155:1952";
/** X Layer mainnet (chain id 196). */
export const X_LAYER_MAINNET = "eip155:196";
/** Native Circle USDC on X Layer testnet — never bridged USDC.e. */
export const NATIVE_USDC_TESTNET = "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3";
/** Native Circle USDC on X Layer mainnet — never bridged USDC.e. */
export const NATIVE_USDC_MAINNET = "0xB6CEceAB302E2E4948951eE7843FC24E92933061";

/**
 * Cooling-off refund window, hours. Demo default; the ON-CHAIN value
 * (AuraBuildEscrow's immutable `refundWindow`, set at construction) is the
 * authority once deployed — this constant must match what the deploy passes.
 */
export const REFUND_WINDOW_HOURS_DEFAULT = 72;

/**
 * Static demo conversion rate, USD per CAD. Honest label: this is a DEMO
 * constant, not a live oracle — the app shows CAD figures with the USDC
 * settlement figure beside them, and a production build replaces this with a
 * quoted rate at payment time.
 */
export const DEMO_USD_PER_CAD = 0.73;

/** Reservation deposit for factory units: 5% of published price, min US$1,000
 *  (factory-slot deposits are the industry's universal discrete payment;
 *  Nestron's real-world booking fee — US$1,000 — is the floor). */
export const FACTORY_DEPOSIT_RATE = 0.05;
export const FACTORY_DEPOSIT_MIN_USD = 1_000;

/** AuraBuildRegistry status vocabulary — the CONTRACT enum wins over any doc. */
export type RegistryStatus = "Designed" | "Funded" | "UnderConstruction" | "Complete";

// ---------------------------------------------------------------- money

/** CAD -> USD at the demo rate, rounded to cents. */
export function cadToUsd(cad: number): number {
  return Math.round(cad * DEMO_USD_PER_CAD * 100) / 100;
}

/** USD -> USDC base units (6 decimals), as the string the contract takes. */
export function usdToUsdc6(usd: number): string {
  return String(Math.round(usd * 1_000_000));
}

export const fmtCad = (n: number): string => `CA$${n.toLocaleString("en-CA")}`;
export const fmtUsd = (n: number): string =>
  `US$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtUsdc6 = (units: string): string =>
  `${(Number(units) / 1_000_000).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;

// ---------------------------------------------------------------- states

/**
 * The order lifecycle. Derived checkpoints (browsing -> homeSelected) reflect
 * how far the buyer has bound the two purchase slots (parcel, home) and
 * whether the land gate passed; committed states (quoted -> building) are
 * event-driven and only move through reducer intents.
 *
 *   browsing -> parcelSelected | parcelRejected -> homeSelected -> quoted
 *     -> depositPending -> depositPaid -> refundWindowOpen
 *     -> refunded | converted -> building
 */
export type OrderStatus =
  | "browsing"
  | "parcelSelected"
  | "parcelRejected"
  | "homeSelected"
  | "quoted"
  | "depositPending"
  | "depositPaid"
  | "refundWindowOpen"
  | "refunded"
  | "converted"
  | "building";

/** Statuses from which no further buying intents are accepted. */
export const TERMINAL_STATUSES: OrderStatus[] = ["refunded"];

// ---------------------------------------------------------------- pieces

export interface OrderBuyer {
  name?: string;
  email?: string;
  /** Wallet that funds the deposit; the escrow's homeowner address. */
  wallet?: string;
}

/** A parcel choice with the land-gate verdict attached — never a bare id. */
export interface ParcelChoice {
  listing: ParcelListing;
  verdict: ParcelVerdict;
  /** Filter reasons verbatim from parcels.ts (reject citation + advisories). */
  reasons: string[];
  /** The design size the verdict was computed against. */
  evaluatedAgainstSqft: number;
  atISO: string;
}

export interface OrderHomeChoice {
  catalogId: string;
  name: string;
  sizeSqft: number;
  fulfillment: "factory-unit" | "sip-site-built";
  atISO: string;
}

export interface QuoteReconciliation {
  /** data/alberta/cost-model.json totalsExLand, when the file was supplied. */
  fileTotalsExLand?: { low: number; mid: number; high: number };
  computedTotalsExLand?: { low: number; mid: number; high: number };
  /** true/false when the design is the 800 sqft reference spec; "not-applicable" otherwise. */
  reconcilesToFile: boolean | "not-applicable";
  /** Milestone schedule total === budget MID total (must always be true). */
  milestonesEqualBudgetMid?: boolean;
  /** Deposit === milestone 1 amount (site-built orders; true by construction). */
  depositEqualsFirstMilestone?: boolean;
  note: string;
}

export interface OrderQuote {
  /** Present for sip-site-built homes: the full LOW/MID/HIGH budget. */
  budget?: Budget;
  /** Present for sip-site-built homes: the escrow milestone schedule (MID). */
  plan?: BuildPlan;
  /** Published factory price, when the home is a factory unit. */
  publishedUsd?: number;
  /** The reservation deposit (escrow v2 milestone 0). */
  depositCad: number;
  depositUsd: number;
  depositUsdc6: string;
  refundWindowHours: number;
  fxUsdPerCad: number;
  network: string;
  usdcAsset: string;
  generatedAtISO: string;
  reconciliation: QuoteReconciliation;
}

export interface OrderDeposit {
  amountCad: number;
  amountUsd: number;
  amountUsdc6: string;
  network: string;
  usdcAsset: string;
  requestedAtISO?: string;
  fundedAtISO?: string;
  txRef?: string;
  refundDeadlineISO?: string;
  refundedAtISO?: string;
  convertedAtISO?: string;
}

export type OrderEventType =
  | "created"
  | "questionAsked"
  | "homeSelected"
  | "parcelSelected"
  | "parcelRejected"
  | "quoteIssued"
  | "depositRequested"
  | "depositFunded"
  | "refundWindowOpened"
  | "depositRefunded"
  | "refundWindowClosed"
  | "converted"
  | "buildStarted";

/** Append-only. Events are never edited or removed; seq is 1-based. */
export interface OrderEvent {
  seq: number;
  atISO: string;
  type: OrderEventType;
  summary: string;
}

// ---------------------------------------------------------------- the Order

export interface Order {
  id: string;
  createdAtISO: string;
  status: OrderStatus;
  buyer: OrderBuyer;
  /** Design size the land gate uses before a home is bound (default 800). */
  desiredSizeSqft: number;
  home?: OrderHomeChoice;
  /** The currently bound parcel with its verdict. */
  parcel?: ParcelChoice;
  /** Every rejection, kept for the record (the refusal is the product). */
  rejections: ParcelChoice[];
  quote?: OrderQuote;
  deposit?: OrderDeposit;
  /** Append-only event log. */
  events: OrderEvent[];
}

export interface CreateOrderOptions {
  id: string;
  now: Date;
  buyer?: OrderBuyer;
  desiredSizeSqft?: number;
}

export function createOrder(opts: CreateOrderOptions): Order {
  const atISO = opts.now.toISOString();
  return {
    id: opts.id,
    createdAtISO: atISO,
    status: "browsing",
    buyer: opts.buyer ?? {},
    desiredSizeSqft: opts.desiredSizeSqft ?? 800,
    rejections: [],
    events: [
      {
        seq: 1,
        atISO,
        type: "created",
        summary: "Order opened. Land first: the district bylaw decides what you may build before you pick a floor plan.",
      },
    ],
  };
}

/** Returns a NEW order with the event appended (append-only, seq contiguous). */
export function withEvent(
  order: Order,
  now: Date,
  type: OrderEventType,
  summary: string
): Order {
  return {
    ...order,
    events: [
      ...order.events,
      { seq: order.events.length + 1, atISO: now.toISOString(), type, summary },
    ],
  };
}

/**
 * Derives the checkpoint status from the bound slots. Only used for the
 * pre-commitment phase (before a quote exists); committed states are set
 * explicitly by the reducer.
 */
export function deriveCheckpointStatus(order: Order): OrderStatus {
  if (order.parcel && order.parcel.verdict === "REJECT") return "parcelRejected";
  if (order.home && order.parcel && order.parcel.verdict === "PASS") return "homeSelected";
  if (order.parcel && order.parcel.verdict === "PASS") return "parcelSelected";
  return "browsing";
}

/** True when the refund window is still open at `now`. */
export function refundWindowOpen(order: Order, now: Date): boolean {
  const deadline = order.deposit?.refundDeadlineISO;
  return !!deadline && now.getTime() <= new Date(deadline).getTime();
}

/** Whole hours remaining in the refund window (floor; 0 when closed). */
export function refundHoursLeft(order: Order, now: Date): number {
  const deadline = order.deposit?.refundDeadlineISO;
  if (!deadline) return 0;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - now.getTime()) / 3_600_000));
}

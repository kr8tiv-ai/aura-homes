// x402-style metering, DEMO TIER — honest status:
//
// This module demonstrates the flow SHAPE of the x402 / OKX Agent Payments
// Protocol over MCP: in paid mode, a tool call without payment fails with an
// error shaped like an HTTP 402 challenge (scheme/network/asset/amount/payTo,
// targeting native testnet USDC on X Layer testnet, eip155:1952), and a call
// bearing {payment: {simulated: true}} succeeds and carries a receipt.
//
// Settlement is SIMULATED. No wallet is contacted, no signature is verified,
// and no on-chain transfer occurs. Real settlement (verifying an X-PAYMENT-
// style signed payload and settling USDC on X Layer) is roadmap — see
// agent/README.md and docs/ARCHITECTURE.md "Payments & fees".
//
// Free mode (the default) never gates: every tool call runs without payment.

import { z } from "zod";

/** X Layer testnet (post-Terigon chain id 1952) — docs/ARCHITECTURE.md. */
const NETWORK = "eip155:1952";
/** Native testnet USDC on X Layer testnet (never USDC.e). */
const ASSET = "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3";
/** Demo pay-to address for metered tool calls. */
const PAY_TO = "0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260";
/** $0.01 USDC at 6 decimals. */
const AMOUNT = "10000";

export interface PaymentChallenge {
  code: 402;
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  description: string;
}

export interface PaymentReceipt {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  settlement: "simulated";
  settledAt: string; // ISO 8601
  note: string;
}

/** The 402 challenge returned (as MCP error data) on unpaid calls in paid mode. */
export const X402_CHALLENGE: PaymentChallenge = {
  code: 402,
  scheme: "exact",
  network: NETWORK,
  asset: ASSET,
  amount: AMOUNT,
  payTo: PAY_TO,
  description:
    "aura-brain metered tool call: $0.01 USDC (6 decimals) on X Layer testnet. " +
    "Demo tier — retry the call with {\"payment\": {\"simulated\": true}} to simulate settlement. " +
    "Real x402/OKX Agent Payments Protocol settlement is roadmap.",
};

/** Optional payment argument accepted by every tool. */
export const paymentArgSchema = z
  .object({
    simulated: z
      .boolean()
      .optional()
      .describe("Set true to simulate settlement of the $0.01 USDC demo fee (paid mode only)."),
  })
  .optional()
  .describe(
    "x402-style payment (demo tier). In paid mode (--paid / AURA_PAID=1) calls without " +
      "{simulated: true} fail with a 402 challenge; settlement is simulated, never on-chain."
  );

/** Paid mode: --paid flag or AURA_PAID=1. Free mode (default) never gates. */
export function isPaidMode(argv: string[] = process.argv): boolean {
  return argv.includes("--paid") || process.env.AURA_PAID === "1";
}

export function makeReceipt(now: Date = new Date()): PaymentReceipt {
  return {
    scheme: "exact",
    network: NETWORK,
    asset: ASSET,
    amount: AMOUNT,
    payTo: PAY_TO,
    settlement: "simulated",
    settledAt: now.toISOString(),
    note:
      "Demo tier: this receipt demonstrates the x402/OKX Agent Payments Protocol flow shape " +
      "with SIMULATED settlement. No on-chain transfer occurred; real settlement on X Layer is roadmap.",
  };
}

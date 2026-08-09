"use client";

// Typed hooks for AuraBuildEscrow. Chain definitions and the connect flow are
// real (lib/chains.ts, lib/wagmi.ts); contract reads/writes are stubbed behind
// this file so pages keep a stable interface while the deployment lands.

import { milestonesFixture, type MilestoneFixture } from "./fixtures";

/** Minimal ABI slice for the calls the UI needs. Matches contracts/AuraBuildEscrow.sol. */
export const auraBuildEscrowAbi = [
  {
    type: "function",
    name: "milestoneCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "milestones",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "descriptionHash", type: "bytes32" },
      { name: "funded", type: "bool" },
      { name: "released", type: "bool" },
      { name: "refunded", type: "bool" },
      { name: "holdbackReleased", type: "bool" },
      { name: "releasedAt", type: "uint64" },
      { name: "holdbackAmount", type: "uint256" },
      { name: "approvalCount", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "approveRelease",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundMilestone",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
] as const;

export interface UseMilestonesResult {
  milestones: MilestoneFixture[];
  /** True while data comes from fixtures rather than the chain. */
  isStub: boolean;
}

/**
 * Milestones for a build escrow.
 * TODO: replace the fixture with wagmi's useReadContract over
 * auraBuildEscrowAbi (milestoneCount + milestones(i)) once the escrow is
 * deployed to X Layer testnet, keyed by escrow address from AuraBuildRegistry.
 */
export function useEscrowMilestones(escrowAddress?: `0x${string}`): UseMilestonesResult {
  void escrowAddress; // unused until the read is wired
  return { milestones: milestonesFixture, isStub: true };
}

/**
 * Approve a milestone release (2-of-3 flow).
 * TODO: implement with useWriteContract({ abi: auraBuildEscrowAbi,
 * functionName: "approveRelease" }) plus a USDC allowance check for funding.
 */
export function useApproveRelease(): {
  approve: (milestoneId: number) => void;
  isStub: boolean;
} {
  return {
    approve: (milestoneId: number) => {
      console.info(`[stub] approveRelease(${milestoneId}) — wire useWriteContract here`);
    },
    isStub: true,
  };
}

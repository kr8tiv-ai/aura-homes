import { decodeEventLog, type Hex } from "viem";

import { auraBuildEscrowAbi, auraBuildRegistryAbi } from "@/lib/escrowAbi";

export interface LifecycleLog {
  address: `0x${string}`;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
}

export interface LifecycleReceipt {
  status: "success" | "reverted";
  transactionHash: `0x${string}`;
  logs: readonly LifecycleLog[];
}

export interface RegistryIdentity {
  designHash: Hex;
  budgetHash: Hex;
  escrow: `0x${string}`;
}

export interface RegistryRecordRead extends RegistryIdentity {
  owner: `0x${string}`;
  status: number;
}

const equalHex = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

function successfulReceipt(receipt: LifecycleReceipt, label: string): void {
  if (receipt.status !== "success") {
    throw new Error(`${label} transaction reverted. No lifecycle state was accepted.`);
  }
}

function logsFrom(receipt: LifecycleReceipt, address: `0x${string}`): LifecycleLog[] {
  return receipt.logs.filter((log) => equalHex(log.address, address));
}

export function confirmDepositReceipt(
  receipt: LifecycleReceipt,
  escrowAddress: `0x${string}`,
  expectedAmount: bigint,
): { transactionHash: `0x${string}`; amount: bigint; refundDeadline: bigint } {
  successfulReceipt(receipt, "Deposit");
  for (const log of logsFrom(receipt, escrowAddress)) {
    try {
      const decoded = decodeEventLog({
        abi: auraBuildEscrowAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "DepositPlaced") continue;
      const args = decoded.args as { amount: bigint; refundDeadline: bigint };
      if (args.amount !== expectedAmount) {
        throw new Error(
          `DepositPlaced amount ${args.amount} does not match the approved order amount ${expectedAmount}.`,
        );
      }
      return {
        transactionHash: receipt.transactionHash,
        amount: args.amount,
        refundDeadline: args.refundDeadline,
      };
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("DepositPlaced amount")) throw cause;
    }
  }
  throw new Error("The successful receipt did not contain DepositPlaced from the configured escrow.");
}

export function confirmRefundReceipt(
  receipt: LifecycleReceipt,
  escrowAddress: `0x${string}`,
  expectedAmount?: bigint,
): { transactionHash: `0x${string}`; amount: bigint } {
  successfulReceipt(receipt, "Refund");
  for (const log of logsFrom(receipt, escrowAddress)) {
    try {
      const decoded = decodeEventLog({
        abi: auraBuildEscrowAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "DepositRefunded") continue;
      const args = decoded.args as { amount: bigint };
      if (expectedAmount !== undefined && args.amount !== expectedAmount) {
        throw new Error(
          `DepositRefunded amount ${args.amount} does not match the escrowed amount ${expectedAmount}.`,
        );
      }
      return { transactionHash: receipt.transactionHash, amount: args.amount };
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("DepositRefunded amount")) throw cause;
    }
  }
  throw new Error("The successful receipt did not contain DepositRefunded from the configured escrow.");
}

export function confirmRegistryMintReceipt(
  receipt: LifecycleReceipt,
  registryAddress: `0x${string}`,
  expected: RegistryIdentity,
): { transactionHash: `0x${string}`; tokenId: bigint } {
  successfulReceipt(receipt, "Registry mint");
  for (const log of logsFrom(receipt, registryAddress)) {
    try {
      const decoded = decodeEventLog({
        abi: auraBuildRegistryAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "BuildMinted") continue;
      const args = decoded.args as {
        tokenId: bigint;
        escrow: `0x${string}`;
        designHash: Hex;
        budgetHash: Hex;
      };
      if (!equalHex(args.designHash, expected.designHash)) {
        throw new Error("BuildMinted design hash does not match the immutable order snapshot.");
      }
      if (!equalHex(args.budgetHash, expected.budgetHash)) {
        throw new Error("BuildMinted budget hash does not match the immutable quote.");
      }
      if (!equalHex(args.escrow, expected.escrow)) {
        throw new Error("BuildMinted escrow does not match the configured purchase contract.");
      }
      return { transactionHash: receipt.transactionHash, tokenId: args.tokenId };
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("BuildMinted")) throw cause;
    }
  }
  throw new Error("The successful receipt did not contain BuildMinted from the configured registry.");
}

export function verifyRegistryRecord(
  expected: RegistryIdentity & { owner: `0x${string}` },
  actual: RegistryRecordRead,
): { ok: true } | { ok: false; problem: string } {
  if (!equalHex(actual.designHash, expected.designHash)) {
    return { ok: false, problem: "Registry design hash does not match the immutable order snapshot." };
  }
  if (!equalHex(actual.budgetHash, expected.budgetHash)) {
    return { ok: false, problem: "Registry budget hash does not match the immutable quote." };
  }
  if (!equalHex(actual.escrow, expected.escrow)) {
    return { ok: false, problem: "Registry escrow does not match the configured purchase contract." };
  }
  if (!equalHex(actual.owner, expected.owner)) {
    return { ok: false, problem: "Registry token owner does not match the operator recipient." };
  }
  return { ok: true };
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const item = error as { shortMessage?: unknown; message?: unknown; details?: unknown };
    return [item.shortMessage, item.details, item.message]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }
  return String(error);
}

export function describeTransactionFailure(
  error: unknown,
  action: "approve" | "deposit" | "refund" | "register",
): string {
  const raw = errorText(error);
  const text = raw.toLowerCase();
  if (text.includes("user rejected") || text.includes("user denied") || text.includes("rejected the request")) {
    return `The ${action} signature was rejected in the wallet. Nothing moved; review the request and try again.`;
  }
  if (text.includes("insufficient funds") && (text.includes("gas") || text.includes("fee"))) {
    return `The wallet needs testnet OKB for gas before the ${action} can be sent. No USDC moved.`;
  }
  if (text.includes("wrong network") || text.includes("chain mismatch") || text.includes("chain not configured")) {
    return `The wallet is on the wrong network. Switch to X Layer testnet (1952) and retry the ${action}.`;
  }
  if (text.includes("refundwindowclosed")) {
    return "The on-chain refund window has closed, so refundDeposit() correctly reverted. Nothing moved.";
  }
  if (text.includes("insufficient") && (text.includes("balance") || text.includes("allowance"))) {
    return `The ${action} could not proceed because the wallet lacks the required native USDC balance or allowance. Nothing moved.`;
  }
  if (text.includes("revert")) {
    return `The ${action} reverted on X Layer. Nothing moved. Wallet detail: ${raw.slice(0, 180)}`;
  }
  return `The ${action} did not complete. Nothing moved. Wallet detail: ${raw.slice(0, 180)}`;
}

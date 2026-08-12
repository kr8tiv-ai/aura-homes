import { expect, test } from "playwright/test";
import { encodeAbiParameters, encodeEventTopics } from "viem";

import { auraBuildEscrowAbi, auraBuildRegistryAbi } from "@/lib/escrowAbi";
import { USDC_ADDRESS, xLayerTestnet } from "@/lib/chains";
import { ESCROW_ADDRESS, REGISTRY_ADDRESS, USDC_TESTNET } from "@/lib/contracts";
import {
  confirmDepositReceipt,
  confirmRegistryMintReceipt,
  describeTransactionFailure,
  verifyRegistryRecord,
  type LifecycleReceipt,
} from "@/lib/payments/xLayerLifecycle";

const escrow = "0x1111111111111111111111111111111111111111" as const;
const registry = "0x2222222222222222222222222222222222222222" as const;
const owner = "0x3333333333333333333333333333333333333333" as const;
const designHash = `0x${"a".repeat(64)}` as const;
const budgetHash = `0x${"b".repeat(64)}` as const;
const txHash = `0x${"c".repeat(64)}` as const;

test("the app uses the USDC_TEST contract currently funded by the official X Layer faucet", () => {
  const faucetUsdc = "0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D";

  expect(USDC_ADDRESS[xLayerTestnet.id]).toBe(faucetUsdc);
  expect(USDC_TESTNET).toBe(faucetUsdc);
});

test("the app targets the verified faucet-compatible testnet deployment", () => {
  expect(ESCROW_ADDRESS).toBe("0x4A777bf71d8809244c77A3c2b39ef68793A463b5");
  expect(REGISTRY_ADDRESS).toBe("0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e");
});

function receipt(
  address: `0x${string}`,
  topics: readonly (`0x${string}` | `0x${string}`[] | null)[],
  data: `0x${string}`,
  status: "success" | "reverted" = "success",
): LifecycleReceipt {
  const normalizedTopics = topics.flatMap((topic) =>
    typeof topic === "string" ? [topic] : Array.isArray(topic) ? topic : [],
  ) as `0x${string}`[];
  return { status, transactionHash: txHash, logs: [{ address, topics: normalizedTopics, data }] };
}

test("a deposit is confirmed only when the expected escrow event is in a successful receipt", () => {
  const amount = BigInt("12000000000");
  const deadline = BigInt("1800000000");
  const topics = encodeEventTopics({ abi: auraBuildEscrowAbi, eventName: "DepositPlaced" });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint64" }],
    [amount, deadline],
  );

  expect(confirmDepositReceipt(receipt(escrow, topics, data), escrow, amount)).toEqual({
    transactionHash: txHash,
    amount,
    refundDeadline: deadline,
  });

  expect(() => confirmDepositReceipt(receipt(escrow, topics, data), escrow, amount + BigInt(1))).toThrow(
    "amount",
  );
  expect(() =>
    confirmDepositReceipt({ status: "success", transactionHash: txHash, logs: [] }, escrow, amount),
  ).toThrow("DepositPlaced");
  expect(() => confirmDepositReceipt(receipt(escrow, topics, data, "reverted"), escrow, amount)).toThrow(
    "reverted",
  );
});

test("a registry mint receipt is bound to the expected design, budget and escrow hashes", () => {
  const tokenId = BigInt(7);
  const topics = encodeEventTopics({
    abi: auraBuildRegistryAbi,
    eventName: "BuildMinted",
    args: { tokenId, escrow },
  });
  const data = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "bytes32" }],
    [designHash, budgetHash],
  );

  expect(
    confirmRegistryMintReceipt(receipt(registry, topics, data), registry, {
      designHash,
      budgetHash,
      escrow,
    }),
  ).toEqual({ transactionHash: txHash, tokenId });

  expect(() =>
    confirmRegistryMintReceipt(receipt(registry, topics, data), registry, {
      designHash: `0x${"d".repeat(64)}`,
      budgetHash,
      escrow,
    }),
  ).toThrow("design hash");
});

test("registry read-back verification refuses any identity or hash mismatch", () => {
  const expected = { designHash, budgetHash, escrow, owner };
  const actual = { designHash, budgetHash, escrow, owner, status: 0 };

  expect(verifyRegistryRecord(expected, actual)).toEqual({ ok: true });
  expect(
    verifyRegistryRecord(expected, { ...actual, budgetHash: `0x${"f".repeat(64)}` }),
  ).toEqual({ ok: false, problem: "Registry budget hash does not match the immutable quote." });
  expect(
    verifyRegistryRecord(expected, { ...actual, owner: "0x4444444444444444444444444444444444444444" }),
  ).toEqual({ ok: false, problem: "Registry token owner does not match the operator recipient." });
});

test("wallet failures become explicit recovery guidance", () => {
  expect(describeTransactionFailure({ shortMessage: "User rejected the request." }, "deposit")).toContain(
    "rejected",
  );
  expect(describeTransactionFailure({ message: "insufficient funds for gas" }, "deposit")).toContain(
    "testnet OKB",
  );
  expect(describeTransactionFailure({ message: "execution reverted: RefundWindowClosed" }, "refund")).toContain(
    "refund window",
  );
});

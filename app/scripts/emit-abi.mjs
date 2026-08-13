#!/usr/bin/env node
// Emits app/lib/escrowAbi.ts from the compiled hardhat artifacts so the app's
// ABI can never drift from the deployed bytecode by hand-transcription.
// Run from app/:  node scripts/emit-abi.mjs   (after any `npx hardhat compile`)
import { readFileSync, writeFileSync, statSync } from "node:fs";

const esc = JSON.parse(
  readFileSync("../contracts/artifacts/contracts/AuraBuildEscrow.sol/AuraBuildEscrow.json", "utf8")
);
const reg = JSON.parse(
  readFileSync("../contracts/artifacts/contracts/AuraBuildRegistry.sol/AuraBuildRegistry.json", "utf8")
);

const header = `// Contract ABIs — REGENERATED from the compiled hardhat artifacts, never
// hand-written (source: contracts/artifacts/contracts/*.json; emitter:
// scripts/emit-abi.mjs). Escrow v2 surface: 7-arg constructor, placeDeposit /
// refundDeposit / convertDeposit and the Deposit* events, alongside the 2-of-3
// milestone release with the 10% statutory holdback.
// After any contract change: cd contracts && npx hardhat compile, then
// cd app && node scripts/emit-abi.mjs

`;

const erc20 = `/** Minimal ERC-20 slice for the configured six-decimal settlement token. */
export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;
`;

const body =
  `export const auraBuildEscrowAbi = ${JSON.stringify(esc.abi, null, 2)} as const;\n\n` +
  `export const auraBuildRegistryAbi = ${JSON.stringify(reg.abi, null, 2)} as const;\n\n` +
  erc20;

writeFileSync("lib/escrowAbi.ts", header + body);
console.log("written lib/escrowAbi.ts", statSync("lib/escrowAbi.ts").size, "bytes");

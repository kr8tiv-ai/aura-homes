// Deployed contract addresses — X Layer testnet (chain 1952), deployed
// 2026-08-10 and verified on-chain (docs/DEPLOYMENTS.md is the record;
// getters were read back post-deploy, values matched the constructor args).
// The CHAIN is the authority for every parameter: the UI reads holdbackBps,
// holdbackPeriod, and refundWindow live and never hard-codes them.

import { USDC_ADDRESS, xLayerTestnet } from "./chains";

export const ESCROW_ADDRESS = "0x4A777bf71d8809244c77A3c2b39ef68793A463b5" as const;
export const REGISTRY_ADDRESS = "0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e" as const;
/** Native Circle USDC on X Layer testnet (6 decimals) — never bridged USDC.e. */
export const USDC_TESTNET = USDC_ADDRESS[xLayerTestnet.id];

export const CHAIN_ID = xLayerTestnet.id; // 1952

const OKLINK_BASE = "https://www.oklink.com/xlayer-test";
export const oklinkAddress = (addr: string) => `${OKLINK_BASE}/address/${addr}`;
export const oklinkTx = (hash: string) => `${OKLINK_BASE}/tx/${hash}`;

/** OKX faucet — dispenses testnet OKB for gas (a human-gated captcha step). */
export const FAUCET_URL = "https://web3.okx.com/xlayer/faucet";

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

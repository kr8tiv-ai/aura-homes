// Deployed contract addresses — X Layer testnet (chain 1952), deployed
// 2026-08-10 and verified on-chain (docs/DEPLOYMENTS.md is the record;
// getters were read back post-deploy, values matched the constructor args).
// The CHAIN is the authority for every parameter: the UI reads holdbackBps,
// holdbackPeriod, and refundWindow live and never hard-codes them.

import { xLayerTestnet } from "./chains";

export const ESCROW_ADDRESS = "0xCe0562ABC9e1d05C219E14b519d5A176582e58bd" as const;
export const REGISTRY_ADDRESS = "0x7478E68576a8B1D48954403132FBB4cB878de4A4" as const;
/** Native Circle USDC on X Layer testnet (6 decimals) — never bridged USDC.e. */
export const USDC_TESTNET = "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3" as const;

export const CHAIN_ID = xLayerTestnet.id; // 1952

const OKLINK_BASE = "https://www.oklink.com/xlayer-test";
export const oklinkAddress = (addr: string) => `${OKLINK_BASE}/address/${addr}`;
export const oklinkTx = (hash: string) => `${OKLINK_BASE}/tx/${hash}`;

/** OKX faucet — dispenses testnet OKB for gas (a human-gated captcha step). */
export const FAUCET_URL = "https://web3.okx.com/xlayer/faucet";

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

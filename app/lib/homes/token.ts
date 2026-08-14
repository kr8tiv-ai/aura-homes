/* The live HOMES token.
 *
 * Launched by the founder on August 13, 2026 through XLaunch — a
 * permissionless launchpad on X Layer mainnet (chain 196) — and confirmed by
 * him via the token-page URL. This module is the ONE place the address and
 * venue links live; every page renders from here so a receipt can never
 * drift from another.
 *
 * Deliberately separate from lib/contracts.ts: that module's CHAIN_ID export
 * is load-bearing for the testnet escrow lab (X Layer testnet 1952) and is
 * pinned by xlayer-lifecycle.spec.ts and release-truth.spec.ts. The token is
 * mainnet; the labs stay testnet; the two must never share a chain constant.
 *
 * What this is NOT: the token was minted by XLaunch's factory on venue
 * infrastructure. It is not the audited, vesting-governed token architecture
 * described in the HOMES design docs, and no staking, distribution, trust,
 * or payout exists. Copy that renders these values must keep those labels.
 */

export const HOMES_TOKEN_ADDRESS = "0x642855d557ada1eba8a66014aaff902e6394c0de" as const;

/** X Layer mainnet — matches `xLayer.id` in lib/chains.ts. */
export const HOMES_TOKEN_CHAIN_ID = 196;

export const HOMES_TOKEN_SYMBOL = "$HOMES";

/** The live venue pair: wrapped SpaceX (an xStock wrapper). The wrapper is a
 * third-party upgradeable contract whose issuer can pause transfers — a risk
 * the buy guide states in plain words. */
export const HOMES_QUOTE_ASSET = "wSPCXx";

export const HOMES_POOL_ADDRESS = "0xf59d07dfe38807b398f0b4697f187d2f943b06a4" as const;

/** XLaunch's liquidity locker holds the pool's liquidity with no withdraw
 * path. The locker — not an Aura treasury — owns the position. */
export const HOMES_LOCKER_ADDRESS = "0xa5C6b1A1b76d3DB979381Faede0cdbd4E089e47B" as const;

export const HOMES_LAUNCHED_ISO = "2026-08-13";

export const XLAUNCH_TOKEN_URL =
  `https://xlaunch.fun/token/${HOMES_TOKEN_ADDRESS}` as const;

export const HOMES_GECKOTERMINAL_URL =
  `https://www.geckoterminal.com/x-layer/pools/${HOMES_POOL_ADDRESS}` as const;

/** XLaunch links its own receipts to the OKX explorer; publishing the same
 * explorer keeps our receipt identical to what a buyer sees on the venue. */
export const HOMES_EXPLORER_URL =
  `https://web3.okx.com/explorer/x-layer/address/${HOMES_TOKEN_ADDRESS}` as const;

/** Venue fee mechanics, per XLaunch's published docs: 1% of every swap;
 * quote side split 60% creator / 40% platform. Fees accrue at the venue and
 * count in the HOMES ledger only after claim receipts are published. */
export const XLAUNCH_SWAP_FEE_PERCENT = 1;
export const XLAUNCH_CREATOR_FEE_SHARE_PERCENT = 60;

export function shortHomesAddress(address: `0x${string}` = HOMES_TOKEN_ADDRESS): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

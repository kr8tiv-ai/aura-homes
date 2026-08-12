# AuraBNB reference audit

Source reviewed: [`aurabnb/aura-stay-dashboard`](https://github.com/aurabnb/aura-stay-dashboard), commit `bf4fe21`.

Purpose: recover the useful product thinking from the earlier experiment without importing its Solana architecture, fictional property state, or dashboard sprawl into Aura Homes.

## Keep

1. **A visible funding target.** The old treasury page put raised, target, remaining and percentage together. Aura keeps this relationship, but every value starts at verified zero and includes source, timestamp and receipt status.
2. **Wallet-level treasury visibility.** Named wallets, addresses, balances and refresh/error states are useful. Aura will show purpose-bound X Layer addresses, explorer links, chain ID and last verified block instead of a generic total.
3. **A property lifecycle.** Candidate, diligence, acquired, building and operating states are more useful than a gallery of future properties. Aura carries the lifecycle into the HOMES proof register and project workspace.
4. **Milestones with dependencies.** The roadmap component understood that entity formation, acquisition, construction and operation are dependent stages. Aura uses evidence-gated milestones, not manually entered percentages or stale completion dates.
5. **Explicit loading, stale and failure states.** The old treasury hook had loading, error, refresh and last-updated concepts. Aura retains these while distinguishing unavailable data from a legitimate zero.
6. **Distribution history.** Period, distributable amount, recipient rules and transaction proof belong in one ledger. Aura adds gross rent, expenses, reserves, net profit, snapshot block, claim status and unclaimed balance.
7. **Multisig and treasury separation as product concepts.** Administrative actions, treasury holdings, liquidity and property funds should not be collapsed into one wallet.

## Rebuild rather than copy

- The useful treasury interface becomes a typed `HomesSnapshot` backed by X Layer receipts and a Hostinger proof API. It does not reuse the Solana/Shyft/Jupiter services.
- Roadmap percentages become deterministic evidence gates: a milestone is planned, blocked, ready or proven because required artifacts exist.
- “Live” is a data classification, not decoration. Planned, demonstration, testnet and live states remain visually and semantically distinct.
- Property cards become due-diligence case files with title/entity, acquisition, build, operating and payout evidence.
- Staking becomes a later X Layer USDC distribution mechanism. The public dashboard remains readable without a wallet.

## Reject

- Solana, Anchor, SPL-token, Jupiter and Shyft integration. Aura already standardizes on X Layer, viem, wagmi, Hardhat and OpenZeppelin.
- Mock APYs, expected ROIs, “quarterly dividend” promises, simulated investments, fake profiles and placeholder properties in the default experience.
- “Real-time” or “live blockchain” claims where neighboring components still use mock arrays or demo fallbacks.
- A standalone page for every metric. Treasury, property, distributions, funding and operating evidence should form one project/property narrative.
- Duplicate UI and data stacks. The old project carries many overlapping Radix packages, two Anchor generations, D3 plus Recharts, Prisma plus browser state, and several parallel treasury hooks. Aura adds a dependency only for a demonstrated need.
- Automatic five-minute polling on every mounted dashboard. Aura will refresh on visibility/focus or user request, and subscribe only when a live contract justifies it.
- Hard-coded funding goals or progress claims without a versioned policy and evidence source.
- Any admin-looking button that only simulates a transaction.

## Resulting Aura dashboard structure

1. **Status bar:** planned/testnet/live, last verified block and stale-data warning.
2. **Funding:** recognized fees, purchase-fund provenance, target, committed, spent and available balances.
3. **Allocation ledgers:** token supply, trading-fee revenue and service revenue shown separately.
4. **Property pipeline:** candidate through operating, with blockers and evidence.
5. **Profit reconciliation:** gross revenue → expenses → reserves → net profit → community pool.
6. **Distribution proof:** snapshot, eligibility, claim/payout transactions and unclaimed amounts.
7. **Wind-down proof:** trigger, top-50 eligible snapshot, excluded system addresses and return claims.

No source code is copied in this pass. The reference is MIT licensed, but the design value is in the information relationships; Aura’s implementation remains native to its current stack and brand.

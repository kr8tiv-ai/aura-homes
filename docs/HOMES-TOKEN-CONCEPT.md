# HOMES — product and proof concept

Status: product design only. No token, sale, staking contract, venue approval, trust, property, fee receipt, or payout exists.

## Narrative

Aura first helps a person plan and deliver an eco home. The HOMES extension uses small, disclosed platform margins to build a transparent first-property fund. A properly formed holding trust or entity acquires and operates one real eco home in Alberta or Costa Rica. Aura publishes acquisition, construction, rental, expense, reserve, and distribution evidence. Only after one operating property is proven does the product expand toward an open eco-home rental marketplace and a project launchpad for independent eco homes and unique stays.

The launchpad is a later product boundary, not a live fundraising claim. It could help a named project sponsor assemble a sourced land case, design-intent plans, team, budget, operating model, evidence room, milestones, artifact hashes, and prepared on-chain actions. Each project would require its own holding structure, rules, risk and use-of-funds record, immutable funding window, custody path, eligibility, and explicit participant confirmation. Aura would not autonomously publish a campaign, contact participants, hold funds, or execute transactions.

Future project participation keeps three mechanisms separate:

- a time-bound HOMES lock may signal support, rank interest, or open a participation window for one named project;
- confirmed project funds enter a separate USDC milestone vault bound to that project's evidence and release rules;
- protocol-owned HOMES market liquidity stays independently accounted for and cannot be represented as land or construction money.

Locking HOMES by itself does not fund a build or create an automatic claim. Any project-specific right would have to be defined by that project's own disclosed structure and contracts.

## Economic rules

- Token: HOMES on X Layer.
- Proposed fixed supply allocation:
  - 30% team, sent to labeled vesting wallets;
  - 10% marketing;
  - 10% approved exchange-listing requirements;
  - 20% protocol-owned liquidity;
  - 30% public market distribution.
- First-property fund target: 200,000 USDC.
- Recognized trading-fee revenue uses this proposed split:
  - 60% property fund;
  - 10% marketing;
  - 10% operations;
  - 10% development;
  - 5% burn reserve;
  - 5% protocol-owned liquidity.
- Recognized service, AI, marketplace, partner and API fees use this proposed operating split:
  - 60% property fund;
  - 10% marketing;
  - 10% operations;
  - 10% development;
  - 10% maintenance and infrastructure.
- Planned fee sources: documented venue fee sharing, completed marketplace services, disclosed AI-provider routing margins (including OpenRouter where used), and partner/API usage.
- Intended property economics: 60% community / 40% operating team.
- Rental distributions use net property profit after published operating expenses and reserves, never gross rent.
- Proposed eligibility: the top 200 staked HOMES addresses at a declared X Layer block, paid pro rata by stake in X Layer USDC.
- Proposed wind-down: if a pre-published funding deadline expires below the minimum viable target, or the property program is formally cancelled, reconcile the unspent trading-fee balance earmarked for property purchases and make it claimable pro rata by the top 50 eligible community holders at a declared block. Team, treasury, liquidity, exchange and contract addresses are excluded.

The token-supply percentages and fee-revenue percentages are separate ledgers. A supply allocation cannot be presented as cash raised, and a fee allocation cannot silently change circulating supply.

## Proof contract

The public ledger must never infer live state. It reads configured contracts and receipts and otherwise shows zero or “not established.” Required fields include:

- token, treasury, property-fund escrow, staking and distribution addresses;
- chain ID, snapshot block, eligible cutoff and total eligible stake;
- fee source, gross customer amount, provider cost, net Aura fee, allocation, and receipt hash;
- holding entity/trust formation evidence and registered title evidence;
- property acquisition, build, booking, expense, reserve, net-profit, and payout evidence;
- payout root or recipient ledger, transaction hashes, failures, and unclaimed amounts.
- for wind-down: immutable trigger terms, purchase-fund provenance, snapshot block, excluded system addresses, claim root, claim deadline, dust and unclaimed-balance treatment.

Portable evidence uses SHA-256 checksums. EVM actions and canonical economic snapshots use keccak256. Private homeowner and guest information never goes on-chain.

## Launch budget

- X Layer gas: low; keep a $25 buffer for deployment and setup calls.
- Experimental permissionless launch: roughly $500–$2,500, almost entirely shallow liquidity.
- Credible small launch: roughly $25,000–$100,000, including $10,000–$50,000 liquidity, independent contract review, multisig/timelock operations, monitoring, and holding-structure readiness.
- OKX centralized listing: no public fixed price or approval guarantee. It is separate from an X Layer Uniswap pool and OKX Wallet/DEX discovery.

Liquidity gates:

- $50 total liquidity: testnet/demo or clearly labeled experimental mainnet proof only. If split as $25 USDC and $25-equivalent HOMES, a $10 buy can move the constant-product spot price by roughly 96% before fees.
- $2,000–$5,000 total liquidity: capped community pilot with a narrow cohort, not an unrestricted public launch.
- $10,000+ total liquidity: review readiness for broader price discovery; contract, entity, operational and monitoring gates still apply.

Primary price discovery should use HOMES/USDC. A direct SPACEX pair remains blocked until the exact X Layer token contract, deployer, liquidity, venue support, and lack of affiliation are verified.

## Contract sequence

1. Fixed or capped ERC-20 with documented allocations. Allocate 30% to labeled team vesting wallets at genesis (proposed 12-month cliff, 36-month linear release); do not make the team buy against the launch pool.
2. Multisig-controlled treasury; no single hot-wallet owner.
3. Fee router that emits source, amount, and split events.
4. First-property escrow capped at the approved target and bound to a published acquisition packet.
5. Holding-trust/entity registry that references evidence hashes without placing title or personal data on-chain.
6. Snapshot-based staking and USDC distribution contract with explicit pause, correction, dust, and unclaimed-fund rules.
7. Property accounting registry for gross revenue, expenses, reserves, net profit, and distributions.
8. Wind-down claim contract that can receive only the reconciled, unspent trading-fee purchase-fund balance after its configured trigger; it cannot sweep general treasury assets.

## Liquidity and initial distribution

- Use protocol-owned liquidity. The properly formed HOMES trust treasury supplies both pool assets and owns the LP position.
- Prefer HOMES/USDC as the primary price-discovery pool. A very low nominal token price is not a safety mechanism; pool depth and circulating supply determine the effective launch valuation and slippage.
- Uniswap V3 liquidity is represented by a position NFT. Place that NFT in a dedicated, independently reviewed time-lock vault controlled by a published multisig/timelock policy. Do not burn it: concentrated positions may need approved range migration.
- Use a launch/distribution contract to cap initial purchases at 2% per address. Do not put a permanent max-wallet condition in the ERC-20: bots can split addresses and nonstandard transfer rules can break routers, aggregators, staking, vesting, and treasury operations.
- A 2% address cap is only a friction layer, not Sybil protection. Safer access also needs a declared start block, short allowlisted or commit/reveal phase, per-wallet contribution cap, public terms, bot monitoring, and no private team advantage.
- Avoid transfer taxes. DEX fees belong to the pool/venue; any share routed to Aura must come from a real configured fee agreement or protocol mechanism and be accounted for separately.
- Treat the 5% burn allocation as a reserve until the asset and execution path are explicit. HOMES-denominated fees may be burned directly. A USDC buyback-and-burn must be separately authorized, disclosed, slippage-bounded, and disabled for micro-liquidity; it must never be described as automatic before such a mechanism exists.

Every mainnet contract needs tests, independent review, verified source, role separation, multisig ownership, monitoring, incident procedures, and a testnet lifecycle first.

## Unresolved decisions

- Alberta or Costa Rica for the first holding vehicle and property.
- Exact trust/entity form and who has signing, fiduciary, accounting, and property-management responsibility.
- Whether top-200 eligibility creates manipulation or concentration problems; define minimum snapshot duration, address clustering policy, and dispute handling.
- Supply, vesting, team allocation, upgradeability, governance, pause powers, and recovery paths.
- Listing-allocation custody and the destination of unused listing inventory.
- Funding deadline, minimum viable target, cancellation authority, snapshot duration, Sybil/address-clustering treatment, claim deadline, dust and unclaimed wind-down balances.
- Exact SPACEX asset and network contract.
- Fee agreements with any venue and whether a fee is gross or net of provider costs.
- Booking, guest protection, damage deposits, identity, tax, and local lodging requirements for the rental platform.
- Launchpad sponsor eligibility, project review, holding structures, disclosures, custody, campaign failure and wind-down rules, and separation between independent projects and the HOMES treasury.

## Primary references

- [X Layer network information](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/network-information)
- [Uniswap support on X Layer](https://www.okx.com/en-eu/help/okx-web3-announcement-about-x-layer-support-on-uniswap)
- [OKX listing application guidance](https://www.okx.com/en-gb/help/how-can-i-get-my-project-listed-on-okx)
- [Alberta Securities Commission crypto-asset guidance](https://www.asc.ca/financial-innovation-in-the-capital-markets/crypto-assets-digital-assets)

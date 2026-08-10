# Aura Homes — Token Launch Research: OKX X Layer (chain ID 196)

Research date: 2026-08-09. Sources: X Layer official docs (web3.okx.com/xlayer/docs), live X Layer RPC queries, Uniswap Labs blog, OKX feed/support pages, github.com/okx/xlayer-tokenlist, Pimlico docs, Particle Network blog, OSC/CSA notices, audit-pricing guides. Note: WebSearch quota was exhausted this session; research was done via direct fetches of primary sources plus DuckDuckGo HTML search — coverage is good but a few launchpad details (PotatoSwap MAP fees) could not be confirmed from primary docs.

## Verdict

X Layer has no mature pump.fun-style launchpad worth building on — PotatoSwap (the largest native DEX) has a launchpad arm and there is a thinly-documented fair-launch "X Mint" (flat-price 15-minute mint, bonding curve, auto-LP to PotatoSwap, addresses ending 8888), but neither is documented well enough to trust with a mission token, and fair-launch mechanics conflict with the team-retained-supply requirement anyway. The manual path is genuinely near-zero cost: at X Layer's measured gas price of 0.02 gwei and OKB at ~$94, deploying an OpenZeppelin ERC-20 costs about $0.003 and a full launch (deploy + verify + Uniswap v3 pool + LP position) costs one to two cents — the only real money is LP seeding ($2K–5K minimum to not be embarrassing) and the token becomes tradeable in OKX DEX/Wallet automatically once a pool exists, with logo/metadata added free via OKLink + a GitHub PR to okx/xlayer-tokenlist. The binding constraint is not technical, it is Canadian securities law: a token whose stated purpose is "funding the mission" with a retained team allocation is close to a textbook security under CSA SN 46-308, so the correct sequence is hackathon with no token at all (native USDC + paymaster UX covers everything), and a token only later, after legal advice, structured as burn-on-usage app credit rather than a fundraising instrument.

## Launchpads on X Layer

Plain finding: **there is no dominant, well-documented pump.fun-equivalent on X Layer as of August 2026.** What exists:

### PotatoSwap (DEX + launchpad) — the main native venue
- Largest native DEX on X Layer by TVL; explicitly positioned as "DEX + Launchpad" (Bitkan: "PotatoSwap was designed as both a DEX and a launchpad, giving it a dual role in liquidity provision and project growth").
- Has a "MAP mechanism" for launches — "not just giving projects visibility at launch, but encouraging liquidity and community retention" (their X posts). **Fees/supply-split terms are NOT publicly documented** — potatoswap.finance and docs.potatoswap.finance were unreachable/403 during research (docs domain does not even resolve). Treat their launchpad as "contact the team" territory, not self-serve.
- URLs: potatoswap.finance, x.com/PotatoSwap_Fi, luma.com/user/SpudLauncher.

### "X Mint" — fair-launch memecoin launchpad (thin documentation)
Described in an OKX feed post (okx.com/en-us/feed/post/52562443872608):
- First 15 minutes: everyone mints at the same flat cost price; then bonding-curve dynamic pricing.
- Anti-whale: single mint capped at 1% of total raised.
- Creator reward: 0.5% of transaction fees daily for 60 days pre-launch.
- On completion, liquidity auto-migrates to PotatoSwap and **LP tokens are burned** (sent to a black hole).
- Launched-token contract addresses end in `8888` as a marker.
- **Caveat: only source found is that one feed post; no standalone site, docs, or fee schedule surfaced in searches. Treat as unverified/immature.**

### Confirmed absent
- **Fjord Foundry: no X Layer support** (no results anywhere).
- **four.meme, flap, etc.: not on X Layer.**
- No OKX-official "OKX DEX Launchpad" product for X Layer tokens was found.

### Why launchpads don't fit Aura anyway
Fair-launch launchpads (X Mint style) by design give the team **no retained allocation** — the team buys at mint like everyone else, and LP is burned so there is no treasury LP either. A funding token with a disclosed, vested team/mission allocation requires the **manual path**, where you control the mint split.

## Manual launch path + costs

X Layer facts (verified from official docs + live RPC):
- Chain ID 196, gas token **OKB** (fixed 21M supply after OKX's 2025 burn — the chain's own gas token is a buyback/burn precedent). X Layer migrated from Polygon CDK zkEVM to **OP Stack** (EVM-equivalent, ~sub-second blocks, "negligible gas fees" per docs).
- **Measured gas price (2026-08-09, both rpc.xlayer.tech and xlayerrpc.okx.com): `0x1312d01` = 20,000,001 wei ≈ 0.02 gwei.**
- **OKB spot: $94.02** (CoinGecko, same day).

Cost math at 0.02 gwei / $94 OKB:

| Step | Gas | OKB | USD |
|---|---|---|---|
| Deploy OpenZeppelin ERC-20 (burnable, permit) | ~1.5M | 0.00003 | **~$0.003** |
| Verify source on OKLink explorer | 0 (off-chain) | — | $0 |
| Create + initialize Uniswap v3 pool | ~4.6M | 0.000092 | ~$0.009 |
| Mint LP position + approvals | ~0.7M | 0.000014 | ~$0.001 |
| **Total on-chain launch** | **~7M** | **~0.00014** | **~$0.013** |

$5 of OKB in a deployer wallet covers the launch plus years of admin transactions. Uniswap v3 is **confirmed live on X Layer since mid-January 2026** ("preferred DEX", zero Uniswap Labs interface fees on X Layer, "$0.01-level" transaction costs — blog.uniswap.org). Native markets at Uniswap launch: xBTC, USDT, USDG; **native Circle USDC + CCTP went live on X Layer in early August 2026**, replacing bridged USDC.e — pair against native USDC.

The real cost is **liquidity**, not deployment:
- Paired LP (AURA/USDC full-range v3): **$2K–5K minimum** to not be embarrassing; $10K+ to look serious and absorb a $500 buy without 10% slippage.
- **$0-quote-side option:** single-sided Uniswap v3 range order — mint the sale tranche of supply as a one-sided LP position above the starting price (this is exactly the model of open-source launchpad PotatoPad, github.com/itsfriedpotato/potatopad: "every launch mints its entire supply as permanently locked, single-sided Uniswap V3 liquidity... live and tradable from the first block, no bonding curve"). USDC accumulates in the position as people buy. Costs nothing but the token supply itself.

## OKX DEX listing path

No permissioned listing exists or is needed — OKX DEX is an aggregator over 500+ DEXes / 130+ chains including Uniswap on X Layer:

1. **Tradeable = has a pool.** Once a Uniswap v3 (or PotatoSwap) pool with liquidity exists, the token is tradeable through the OKX DEX interface/Wallet by pasting the contract address. No application, no fee. OKX runs automatic risk screens: honeypots get buying disabled; flagged contracts show risk warnings. (A transfer tax is one of the things that gets tokens flagged — see burn section.)
2. **Metadata/logo (free, ~3–5 business days):**
   - Verify contract source on OKLink explorer (supports standard + proxy contracts).
   - Submit token info/logo via OKLink explorer review flow, and/or in OKX Wallet: find token → "Submit Logo"/"Suggest Logo" (PNG).
   - PR to **github.com/okx/xlayer-tokenlist** — the official X Layer Uniswap-format token list: fork → add EIP-55 checksummed address, name, symbol, decimals, hosted logo (OKLink CDN preferred) → PR. Wallets/dApps supporting Uniswap Token Lists import it directly.
3. **Hackathon Launch Grant note:** volume counted "through the OKX DEX interface" is satisfied by the default path — any X Layer pool's swaps routed via OKX DEX UI/API count; no special listing tier required.

## Burn mechanics that work

What the 2025–2026 market respects vs. punishes:

**Respected:**
- **Buyback-and-burn from real revenue** — the gold standard: "a project earns real revenue, uses it to buy its own token, destroys those tokens permanently, and repeats consistently." Ties deflation to actual earnings; fully verifiable on-chain. OKB itself (X Layer's gas token, hard-capped at 21M after the 2025 burn) is the chain's flagship precedent.
- **Fee-burn on usage** — BNB/ETH-style burns proportional to genuine network/app activity; "automated, usage-driven deflation with simple tokenomics."
- Requirements either way: published burn address, on-chain proof per burn, burns of *circulating* supply (burning never-circulated treasury is theater).

**Punished / red flags:**
- **Deflationary transfer taxes** — increasingly read as a marketing tactic or worse; tax-on-transfer mechanics are precisely what OKX DEX's automated risk scanner flags as honeypot-adjacent, which can get a token warning-labeled or buy-disabled in the very interface Aura needs. Do not put a tax in the token contract.
- Reflection/rebase gimmicks; "burns" divorced from any revenue linkage.

**Canonical model for a usage token behind an app (Aura's case):** user pays USDC → protocol market-buys AURA from the pool (or draws from treasury at oracle price) → AURA is burned (wholly or partly) at point of service. This is simultaneously buyback-and-burn *and* fee-burn-on-usage, funded 100% by real app revenue, with a plain ERC-20 (no tax code in the token). Publish a burn dashboard; keep the vanilla `ERC20Burnable.burn()` path as the only supply-reduction mechanism.

## Invisible-token UX

The "normies never see the token" requirement is achievable on X Layer:

- **ERC-4337 / account abstraction:** X Layer is EVM-equivalent OP Stack, standard EntryPoint deployments work. Official X Layer docs name **Particle Network** and **Safe** as the AA stack ("X Layer is heavily invested in innovating in the account abstraction space"). Particle Network confirmed X Layer mainnet support: Wallet Abstraction SDK, social-login smart accounts (Google/X login → SimpleAccount), and paymaster-sponsored gas. **Pimlico does NOT support X Layer** (chain 196 absent from their supported-chains list) — plan on Particle (or self-hosted bundler + own paymaster contract) rather than the usual Pimlico/ZeroDev stack.
- **Native USDC (Circle, Aug 2026) + CCTP** means users can genuinely hold and pay dollars on-chain — no bridged-asset weirdness.
- **The pattern:**
  1. User signs in with Google → Particle smart account (no seed phrase).
  2. User funds with USDC (onramp or CCTP from any of ~36 chains).
  3. On "pay": a session-key-authorized UserOp swaps USDC→AURA via the Uniswap v3 pool inside the same transaction and burns/escrows the AURA; a paymaster pays gas in OKB (or takes it from the USDC).
  4. UI shows "Paid $49.00". AURA never appears in the wallet UI — it exists for one atomic hop.
- **Even simpler v0:** off-chain USDC/fiat ledger (Stripe-like UX) + a weekly on-chain buyback-and-burn from revenue. Fully invisible, auditable via the burn dashboard, zero AA engineering. Less trustless, fine for pre-scale.

## Canadian legal reality

Brief and honest:

- **CSA Staff Notice 46-308** (June 2018, still the operative guidance with SN 46-307 and CP 21-402): calling something a "utility token" does not exempt it; the CSA applies substance-over-form via the *Pacific Coast Coin* investment-contract test. Regulators treat **nearly all newly minted tokens sold to raise funds as securities**, requiring a prospectus or an exemption (accredited investor, sandbox relief).
- Aura's stated design — **"token used strictly for funding the mission" + retained team supply** — hits both bad limbs at once: fundraising purpose and a common enterprise whose value depends on the team. That is close to a textbook security if sold to anyone, especially Canadians.
- Practical patterns Canadian-founded projects use: offshore issuing foundation (Cayman/BVI/Panama), geoblocking Canadian purchasers, **fair launch with no presale and no fundraising sale** (weakens the investment-contract analysis), accredited-investor-only rounds, or the CSA Regulatory Sandbox (exemptive relief has been granted for token distributions with conditions). **An offshore foundation does not immunize a Canadian-resident founder** — the CSA asserts jurisdiction over conduct by Canadian residents.
- The safest genuinely-cheap posture: token as **app credit that is only ever consumed (burned) for services, never marketed as an investment, never presold**, team allocation modest and vested, all fundraising done in equity (not token) — and a few thousand dollars of Canadian securities-counsel time before any public sale or liquidity event. Budget that as a real launch cost.

## Recommendation for Aura Homes

**Phase 0 — Hackathon (now): NO token.**
- Build the app on X Layer with **native USDC** payments and Particle AA (social login, gasless via paymaster). This alone demonstrates the "invisible crypto" UX and generates OKX-DEX-interface-visible activity via USDC swaps if needed.
- A token adds zero hackathon value and real securities/optics risk. Judges in 2026 discount bolt-on tokens; they reward working payment UX.
- Cost: ~$5 of OKB for gas, $0 everything else.

**Phase 1 — Post-hackathon, pre-revenue (if/when justified): deploy but don't sell.**
- OpenZeppelin Wizard ERC-20: `ERC20 + ERC20Burnable + ERC20Permit`, fixed supply, **no transfer tax, no owner mint**. Deploy: ~$0.003. Verify on OKLink. Run Slither + Aderyn (free); a stock OZ contract with no custom logic doesn't need a paid audit yet.
- Genesis split, fully disclosed: e.g. 70–80% ecosystem/sale tranche, 10–15% team in OZ `VestingWallet` (2–4 yr), 10% mission treasury multisig (Safe — supported on X Layer).
- No pool, no sale, no marketing = no distribution to regulate. Get counsel opinion in this window.

**Phase 2 — Liquidity + listing (post-legal-review, post-revenue-signal):**
- Seed Uniswap v3 AURA/native-USDC: either **$5K paired full-range** or **$0-cost single-sided range order** of the sale tranche (PotatoPad model) if cash-poor. Skip X Layer launchpads — PotatoSwap's terms are undocumented and X Mint's fair-launch design forfeits the team allocation.
- Same week, all free: OKLink logo/info submission, `okx/xlayer-tokenlist` PR, OKX Wallet logo suggestion. Token is tradeable in OKX DEX the moment the pool exists.
- Turn on the burn loop: X% of app revenue auto-buys and burns AURA per epoch; in-app services optionally settle by atomic USDC→AURA→burn behind Particle AA. Publish the burn dashboard from day one.
- Total incremental cash cost of a professional-looking launch: **$0.02 gas + $0–5K LP + ~$2–5K legal**; add a real audit (~$5K entry-tier) only when custom swap/burn/escrow contracts hold user funds.

*Follow-up: five concrete invisible-token architectures (mechanics, AA layer, legal posture, scores, one recommendation) are designed in [TOKEN-DESIGNS.md](TOKEN-DESIGNS.md).*

## The token has a name: HOMES (Aug 10, 2026)

The founder has named the token: **HOMES**. It will launch on X Layer as part of the phased rollout ([ROADMAP.md](ROADMAP.md) Arc 3), and its utility is deliberately TBD — it will be decided later and announced as a rollout phase of its own. Everything above stands unchanged: no token for the hackathon, the burn-on-usage app-credit direction remains the leading design, Canadian securities counsel per CSA SN 46-308 comes before any launch or liquidity event, and the pair remains native USDC. Where earlier sections and [TOKEN-DESIGNS.md](TOKEN-DESIGNS.md) use "AURA" as the ticker placeholder, read HOMES.

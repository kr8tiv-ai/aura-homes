import Link from "next/link";
import {
  HOMES_FEE_ALLOCATION,
  HOMES_FIRST_PROPERTY_TARGET_USDC,
  HOMES_INITIAL_BUY_CAP_PERCENT,
  HOMES_PROPERTY_OWNERSHIP,
  HOMES_TEAM_ALLOCATION_PERCENT,
  HOMES_TOKEN_SUPPLY_ALLOCATION,
  HOMES_TRADING_FEE_ALLOCATION,
  HOMES_WIND_DOWN_HOLDER_LIMIT,
  allocateHomesFees,
  allocateHomesTradingFees,
  currentHomesSnapshot,
  reconcileHomesFeeLedger,
} from "@/lib/homes/fund";
import {
  HOMES_CREATOR_WALLET,
  HOMES_CREATOR_WALLET_EXPLORER_URL,
  HOMES_EXPLORER_URL,
  HOMES_GECKOTERMINAL_URL,
  HOMES_POOL_ADDRESS,
  HOMES_TOKEN_ADDRESS,
  HOMES_TOKEN_CHAIN_ID,
  XLAUNCH_TOKEN_URL,
  shortHomesAddress,
} from "@/lib/homes/token";
import mintVerification from "@data/homes/mint-verification.json";

export const metadata = {
  title: "HOMES on X Layer — Aura Homes",
  description: "The live HOMES token, its fee ledger, first-property target, and the planned property-trust design.",
};

const snapshot = currentHomesSnapshot();
const feeLedger = reconcileHomesFeeLedger(snapshot);
const serviceAllocation = allocateHomesFees(feeLedger.serviceUsdc);
const tradingAllocation = allocateHomesTradingFees(feeLedger.tradingUsdc);

function usdc(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const units = absolute / BigInt(1_000_000);
  const cents = (absolute % BigInt(1_000_000)) / BigInt(10_000);
  return `${negative ? "-" : ""}$${new Intl.NumberFormat("en-US").format(units)}.${cents.toString().padStart(2, "0")}`;
}

const serviceAllocationRows = [
  { key: "propertyFund", label: "Property fund", detail: "Land, home acquisition, construction and funded reserves" },
  { key: "marketing", label: "Marketing", detail: "Measured acquisition and community growth" },
  { key: "operations", label: "Operations", detail: "Administration, reporting and project operations" },
  { key: "development", label: "Development", detail: "Product, contracts and integrations" },
  { key: "maintenance", label: "Maintenance", detail: "Infrastructure first; property upkeep once operating" },
] as const;

const tradingAllocationRows = [
  { key: "propertyFund", label: "Property fund", detail: "Reserved for the published land and home acquisition target" },
  { key: "marketing", label: "Marketing", detail: "Measured acquisition and community growth" },
  { key: "operations", label: "Operations", detail: "Administration, reporting and project operations" },
  { key: "development", label: "Development", detail: "Product, contracts and integrations" },
  { key: "burnReserve", label: "Burn reserve", detail: "A disclosed reserve; no automatic USDC buyback against shallow liquidity" },
  { key: "protocolOwnedLiquidity", label: "Liquidity", detail: "Compounds the protocol-owned HOMES market position" },
] as const;

const supplyAllocationRows = [
  { key: "team", label: "Team", detail: "Labeled vesting wallets; not purchased against the public pool" },
  { key: "marketing", label: "Marketing", detail: "Campaign and ecosystem allocation under published controls" },
  { key: "exchangeListings", label: "Listings", detail: "Reserved for approved venue requirements; unused tokens remain disclosed" },
  { key: "protocolOwnedLiquidity", label: "Liquidity", detail: "Treasury-owned liquidity position held under a timelock policy" },
  { key: "publicMarket", label: "Public market", detail: "The remaining circulating distribution, subject to the initial launch cap" },
] as const;

export default function HomesPage() {
  return (
    <div className="homes-ledger py-10 sm:py-16">
      <header className="homes-hero">
        <div>
          <p className="aura-label">A proposed decentralized property trust</p>
          <h1>HOMES on X Layer</h1>
          <p className="homes-hero-copy">
            The long arc is simple: earn small, disclosed margins across Aura; route 60 percent to
            a transparent property fund; acquire and operate real eco homes; publish the receipts;
            and make the community share of net property profit auditable in X Layer USDC.
          </p>
        </div>
        <aside className="homes-status" aria-label="HOMES launch status">
          <span>Live · X Layer mainnet {HOMES_TOKEN_CHAIN_ID}</span>
          <p>
            The token trades on XLaunch. No staking contract, exchange listing, property, or
            payout is live; venue fees accrue but no claim receipt is published yet.
          </p>
        </aside>
      </header>

      {/* The plain-language band, before any ledger: this page is dense by
          design (it is a ledger), so the one-breath version comes first for
          the person who just wants to know what HOMES is. */}
      <section className="homes-section" aria-label="HOMES in plain words">
        <p className="max-w-3xl text-base leading-relaxed text-aura-text/85">
          In plain words: HOMES is <strong>live</strong> — launched on XLaunch, a permissionless
          launchpad on X Layer mainnet, and you can buy it today. It funds an idea we are
          building in public: a future owner-participating network of eco stays — think Airbnb,
          owned over time by its guests and hosts — backed by a transparent property trust.
          The token is live; the trust, staking, and first property are still being
          <strong> built</strong>, and every zero below is declared until its receipt exists.
        </p>
      </section>

      <section className="homes-metrics" aria-label="HOMES declared zero state">
        <article><span>Total recognized fees</span><strong>{usdc(feeLedger.totalUsdc)}</strong><small>Venue fees accrue at XLaunch · counted after claim receipts publish</small></article>
        <article><span>Property fund balance</span><strong>{usdc(snapshot.propertyFund.balanceUsdc)}</strong><small>Dedicated fund vault not deployed</small></article>
        <article><span>First-property target</span><strong>{usdc(HOMES_FIRST_PROPERTY_TARGET_USDC).replace(".00", "")}</strong><small>Alberta or Costa Rica · not selected</small></article>
        <article><span>Eligible stakers</span><strong>{snapshot.holders.eligibleCount} / 200</strong><small>Top 200 · snapshot block not set</small></article>
      </section>

      <section className="homes-section" aria-labelledby="allocation-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">Separate ledgers</p><h2 id="allocation-heading">Know what is being split.</h2></div>
          <p>Token inventory, trading-fee revenue, and Aura service revenue are independent. Each ledger records its source, amount, rule version, allocation, and receipt.</p>
        </div>
        <h3 className="homes-subledger-title">Token supply · 100%</h3>
        <div className="homes-allocation">
          {supplyAllocationRows.map((row) => (
            <article key={row.key} style={{ "--share": `${HOMES_TOKEN_SUPPLY_ALLOCATION[row.key]}%` } as React.CSSProperties}>
              <div><strong>{row.label}</strong><span>{HOMES_TOKEN_SUPPLY_ALLOCATION[row.key]}%</span></div>
              <p>{row.detail}</p>
              <small>Allocation address · not configured</small>
            </article>
          ))}
        </div>
        <p className="homes-budget-note">
          These percentages are design targets. The live mint is verified on-chain — block{" "}
          {mintVerification.block.toLocaleString("en-US")}: total supply{" "}
          {mintVerification.totalSupply.tokens.toLocaleString("en-US")} HOMES, with{" "}
          {mintVerification.knownHolders.wspcxxPool.percentOfSupply}% in the venue pool and{" "}
          {mintVerification.knownHolders.creatorWallet.percentOfSupply}% in the creator wallet —
          a launchpad curve, not the design split. No design number is presented as the live one.
        </p>
        <h3 className="homes-subledger-title">Trading-fee revenue · proposed</h3>
        <div className="homes-allocation">
          {tradingAllocationRows.map((row) => (
            <article key={row.key} style={{ "--share": `${HOMES_TRADING_FEE_ALLOCATION[row.key]}%` } as React.CSSProperties}>
              <div><strong>{row.label}</strong><span>{HOMES_TRADING_FEE_ALLOCATION[row.key]}%</span></div>
              <p>{row.detail}</p>
              <small>Recognized now · {usdc(tradingAllocation[row.key])}</small>
            </article>
          ))}
        </div>
        <h3 className="homes-subledger-title">Aura service, AI and API fees · proposed</h3>
        <div className="homes-allocation">
          {serviceAllocationRows.map((row) => (
            <article key={row.key} style={{ "--share": `${HOMES_FEE_ALLOCATION[row.key]}%` } as React.CSSProperties}>
              <div><strong>{row.label}</strong><span>{HOMES_FEE_ALLOCATION[row.key]}%</span></div>
              <p>{row.detail}</p>
              <small>Recognized now · {usdc(serviceAllocation[row.key])}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="homes-section" aria-labelledby="sources-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">Small margins, disclosed</p><h2 id="sources-heading">Planned fee sources.</h2></div>
          <p>A source does not count until its commercial basis and on-chain or accounting evidence are configured.</p>
        </div>
        <div className="homes-sources">
          {snapshot.fees.sources.map((source) => (
            <article key={source.id}>
              <span>{source.status}</span>
              <h3>{source.label}</h3>
              <p>{source.model}</p>
              <strong>{usdc(source.recognizedUsdc)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="homes-section homes-economics" aria-labelledby="economics-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">After a property operates</p><h2 id="economics-heading">Net profit, not gross rent.</h2></div>
          <p>Gross rent is reduced by documented operating expenses and reserves first. The proposed community pool is then {HOMES_PROPERTY_OWNERSHIP.community}% of net property profit; the operating team share is {HOMES_PROPERTY_OWNERSHIP.team}%.</p>
        </div>
        <ol className="homes-flow">
          <li><span>01</span><strong>Earn</strong><p>Rental or sale proceeds settle to the property account.</p></li>
          <li><span>02</span><strong>Reconcile</strong><p>Taxes, cleaning, utilities, repairs, management and reserves are published.</p></li>
          <li><span>03</span><strong>Snapshot</strong><p>Top 200 staked HOMES addresses are ranked at a declared X Layer block.</p></li>
          <li><span>04</span><strong>Distribute</strong><p>The community pool is paid pro rata by stake in X Layer USDC with receipt hashes.</p></li>
        </ol>
      </section>

      <section className="homes-section homes-economics" aria-labelledby="wind-down-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">Property-program wind-down</p><h2 id="wind-down-heading">Unused purchase funds have a path home.</h2></div>
          <p>If the published funding deadline expires below its minimum viable target, or the property program is formally cancelled, the unspent trading-fee balance earmarked for property purchases moves to a claim contract.</p>
        </div>
        <ol className="homes-flow">
          <li><span>01</span><strong>Trigger</strong><p>A pre-published deadline or recorded cancellation activates wind-down. Neither is configured today.</p></li>
          <li><span>02</span><strong>Reconcile</strong><p>Spent, committed, refunded and remaining purchase-fund amounts are published with receipts.</p></li>
          <li><span>03</span><strong>Snapshot</strong><p>The top {HOMES_WIND_DOWN_HOLDER_LIMIT} eligible community holders are measured at a declared block; team, treasury, LP, exchange and contract addresses are excluded.</p></li>
          <li><span>04</span><strong>Claim</strong><p>The remaining eligible balance is divided pro rata by snapshot weight in X Layer USDC, with dust and unclaimed amounts visible.</p></li>
        </ol>
        <p className="homes-budget-note">Wind-down status: not configured · funding deadline: not set · minimum viable target: not set · distributable balance: {usdc(snapshot.windDown.distributableUsdc)}</p>
      </section>

      <section className="homes-section" aria-labelledby="proof-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">No proof, no claim</p><h2 id="proof-heading">Public proof register.</h2></div>
          <p>Every empty field is shown as empty. Contract and venue status will move only after independent verification.</p>
        </div>
        <dl className="homes-proof">
          <div><dt>HOMES token contract</dt><dd>Live · <a href={HOMES_EXPLORER_URL} target="_blank" rel="noreferrer">{shortHomesAddress()} on the X Layer explorer ↗</a></dd></div>
          <div><dt>Venue market</dt><dd>XLaunch · HOMES/wSPCXx pool <a href={HOMES_GECKOTERMINAL_URL} target="_blank" rel="noreferrer">{shortHomesAddress(HOMES_POOL_ADDRESS)} ↗</a> · liquidity locked in the venue&apos;s locker, no withdraw path</dd></div>
          <div><dt>Creator fee-claim wallet</dt><dd>Published · <a href={HOMES_CREATOR_WALLET_EXPLORER_URL} target="_blank" rel="noreferrer">{shortHomesAddress(HOMES_CREATOR_WALLET)} ↗</a> · receives 60% of the venue&apos;s 1% swap fee; claims appear here with receipts before any amount is recognized</dd></div>
          <div><dt>Live mint verification</dt><dd>Block {mintVerification.block.toLocaleString("en-US")} · {mintVerification.totalSupply.tokens.toLocaleString("en-US")} HOMES · pool {mintVerification.knownHolders.wspcxxPool.percentOfSupply}% · creator {mintVerification.knownHolders.creatorWallet.percentOfSupply}% · <a href="https://github.com/kr8tiv-ai/aura-homes/blob/main/app/scripts/verify-homes-mint.mjs" target="_blank" rel="noreferrer">reproduce this read ↗</a></dd></div>
          <div><dt>Property-fund vault</dt><dd>Not deployed</dd></div>
          <div><dt>Staking + distribution</dt><dd>Coming later · design only</dd></div>
          <div><dt>Property holding trust</dt><dd>Not formed; no legal title held</dd></div>
          <div><dt>OKX listing</dt><dd>Not applied / not approved · a DEX pool is not an exchange listing</dd></div>
          <div><dt>Acquired properties</dt><dd>None</dd></div>
        </dl>
        <div className="homes-source-links">
          <a href={XLAUNCH_TOKEN_URL} target="_blank" rel="noreferrer">Buy HOMES on XLaunch ↗</a>
          <a href={HOMES_GECKOTERMINAL_URL} target="_blank" rel="noreferrer">GeckoTerminal pool ↗</a>
          <a href={HOMES_EXPLORER_URL} target="_blank" rel="noreferrer">Contract on the explorer ↗</a>
          <a href="https://www.okx.com/en-gb/help/x-layer-faq" target="_blank" rel="noreferrer">X Layer FAQ ↗</a>
          <Link href="/faq#homes-token">Read the HOMES FAQ</Link>
        </div>
      </section>

      <section className="homes-section" aria-labelledby="buy-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">Live on XLaunch</p><h2 id="buy-heading">How to buy HOMES.</h2></div>
          <p>
            Four steps, verified against the live venue. The Buy panel accepts OKB directly —
            XLaunch routes the swap into the wSPCXx-quoted pool for you.
          </p>
        </div>
        <ol className="homes-flow">
          <li><span>01</span><strong>Wallet</strong><p>Install OKX Wallet or MetaMask and add X Layer mainnet: chain ID {HOMES_TOKEN_CHAIN_ID}, RPC rpc.xlayer.tech, native coin OKB.</p></li>
          <li><span>02</span><strong>Get OKB for gas and the buy</strong><p>Withdraw OKB from OKX directly to the X Layer network, or bridge from another chain with the official X Layer bridge in OKX web3. Gas costs cents; the OKB you swap is the purchase.</p></li>
          <li><span>03</span><strong>Buy on the token page</strong><p>Open the HOMES page on XLaunch, connect your wallet, choose the Buy tab, pay in OKB (or wSPCXx), set slippage, confirm. The 1% venue fee applies to every swap.</p></li>
          <li><span>04</span><strong>Verify what you bought</strong><p>Check the contract address against the one published here — {shortHomesAddress()} — and the pool on GeckoTerminal. If an address differs, it is not HOMES.</p></li>
        </ol>
        <div className="homes-micro-liquidity">
          <strong>The facts, once.</strong>
          <p>
            Swaps are irreversible. HOMES is a micro-cap on a permissionless venue — it can go
            to zero, locked liquidity is not a price floor, and the wrapped-stock quote asset
            can be paused by its issuer. We publish every address above so you can verify
            instead of trust.
          </p>
        </div>
      </section>

      <section className="homes-section" aria-labelledby="launch-budget-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">What launch really costs</p><h2 id="launch-budget-heading">Gas is cheap. Trust is not.</h2></div>
          <p>X Layer contract calls are low-cost. Useful liquidity, independent contract review, monitoring, and a properly formed property-holding structure are the material costs.</p>
        </div>
        <div className="homes-launch-budgets">
          <article><span>Experiment</span><strong>$500–$2,500</strong><p>Standard ERC-20, permissionless pool, technical gas buffer and very shallow liquidity. Suitable for testing mechanics, not meaningful price discovery.</p></article>
          <article><span>Credible small launch</span><strong>$25k–$100k</strong><p>$10k–$50k liquidity plus independent contract review, multisig/timelock operations, monitoring and entity/trust readiness.</p></article>
          <article><span>OKX exchange listing</span><strong>Not publicly priced</strong><p>Separate application and review with no approval guarantee. An X Layer DEX pool or OKX Wallet visibility does not equal an OKX exchange listing.</p></article>
        </div>
        <p className="homes-budget-note">The launch happened at the Experiment tier: the founder chose XLaunch&apos;s wSPCXx-quoted market, superseding the earlier HOMES/USDC-first recommendation. The pool, locker, and wrapper risks are published in the register above; a deeper-liquidity market remains a later decision with its own receipts.</p>
        <div className="homes-micro-liquidity">
          <strong>$50 is micro-liquidity, not a public market.</strong>
          <p>At $25 USDC plus $25-equivalent HOMES, a $10 buy can move the AMM spot price by roughly 96% before fees. Aura would use that tier only for testnet or a clearly labeled experimental proof with no sale campaign, valuation claim, or broad distribution.</p>
          <ol>
            <li><span>$50</span>Testnet/demo or experimental proof</li>
            <li><span>$2k–$5k</span>Capped community pilot</li>
            <li><span>$10k+</span>Broader price discovery review</li>
          </ol>
        </div>
      </section>

      <section className="homes-section" aria-labelledby="launch-policy-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">Launch policy — design vs live</p><h2 id="launch-policy-heading">A launch people can inspect.</h2></div>
          <p>The DESIGN: a multisig trust treasury supplies and owns the liquidity, with allocation, vesting, caps and admin powers visible before the first transaction. The LIVE token took a different, simpler path — the venue locker holds the liquidity — and both are stated here side by side.</p>
        </div>
        <div className="homes-launch-policy">
          <article><span>{HOMES_TEAM_ALLOCATION_PERCENT}%</span><h3>Team at genesis — design</h3><p>Mint to labeled vesting wallets with a proposed 12-month cliff and 36-month linear release. The live mint has no vesting wallets; the verified distribution is in the register above.</p></article>
          <article><span>{HOMES_INITIAL_BUY_CAP_PERCENT}%</span><h3>Initial distribution cap</h3><p>Designed as a launch-window cap — and the venue enforced exactly this: XLaunch capped wallets at 2% for the launch window. Not embedded permanently in the ERC-20, where address splitting defeats it.</p></article>
          <article><span>Locker</span><h3>Who owns the liquidity</h3><p>Live today: XLaunch&apos;s locker contract holds the pool&apos;s liquidity with no withdraw path. The designed multisig trust treasury with a published withdrawal policy is a later build with its own receipts.</p></article>
          <article><span>Clean</span><h3>Plain token mechanics</h3><p>No transfer tax, hidden mint, blacklist, honeypot rule or owner-only liquidity exit. Privileged changes use multisig plus a public timelock.</p></article>
        </div>
      </section>

      <section className="homes-future" aria-labelledby="rental-heading">
        <p className="aura-label">The operating layer</p>
        <h2 id="rental-heading">From one transparent rental toward a decentralized stay network.</h2>
        <p>The intended holding structure is a decentralized property trust: a properly formed legal vehicle holds registered title while the on-chain ledger publishes community economics, votes, receipts and distributions. Aura would first prove one home—acquisition, build, booking, expenses, maintenance, reserves and guest operations—before expanding into owner-listed eco homes and an open rental marketplace.</p>
      </section>

      <section className="homes-future homes-future-launchpad" aria-labelledby="launchpad-heading">
        <p className="aura-label">Later rollout · not live</p>
        <h2 id="launchpad-heading">A launchpad for owner-led eco homes and unique stays.</h2>
        <p>Aura could eventually help independent owners prepare a complete real-world project case: the site, design-intent plans, build team, cost model, operating assumptions, evidence room, milestones and on-chain proof. A sponsor could then prepare a named project fund or community campaign for their own eco home, cabin or small stay concept. The tool would prepare and compare; it would not silently publish a raise, take custody or execute a transaction.</p>
        <p className="homes-future-boundary">Each future project would need a named sponsor, its own holding structure and rules, sourced land and cost evidence, documented risks, clear use of funds, an immutable funding window, and explicit participant confirmation. HOMES must prove its first property before Aura opens this path to third parties.</p>
      </section>

      <section className="homes-section homes-economics" aria-labelledby="project-pools-heading">
        <div className="homes-section-heading">
          <div><p className="aura-label">Launchpad design · later</p><h2 id="project-pools-heading">Support a stay without confusing the ledgers.</h2></div>
          <p>HOMES locking, project funding and market liquidity do different jobs. Aura would publish them as separate contracts and balances.</p>
        </div>
        <ol className="homes-flow homes-flow-three">
          <li><span>01</span><strong>Signal with HOMES</strong><p>A time-bound lock can signal support, rank interest or open a participation window for one named stay. It is not construction money.</p></li>
          <li><span>02</span><strong>Fund milestones in USDC</strong><p>A separate project vault receives confirmed contributions and releases only against published land, design and build milestones.</p></li>
          <li><span>03</span><strong>Keep liquidity liquid</strong><p>HOMES market liquidity remains independently accounted for. It cannot be presented as money available to buy land or build a home.</p></li>
        </ol>
      </section>
    </div>
  );
}

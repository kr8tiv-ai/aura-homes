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
  plannedHomesSnapshot,
} from "@/lib/homes/fund";

export const metadata = {
  title: "HOMES on X Layer — Aura Homes",
  description: "The planned HOMES property fund, fee ledger, first-property target, and revenue distribution design.",
};

const snapshot = plannedHomesSnapshot();
const serviceAllocation = allocateHomesFees(snapshot.fees.totalUsdc);
const tradingAllocation = allocateHomesTradingFees(snapshot.fees.totalUsdc);

function usdc(value: bigint): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(value) / 1_000_000);
}

const serviceAllocationRows = [
  { key: "propertyFund", label: "Property fund", detail: "Land, home acquisition, construction and funded reserves" },
  { key: "marketing", label: "Marketing", detail: "Measured acquisition and community growth" },
  { key: "operations", label: "Operations", detail: "Administration, reporting and project operations" },
  { key: "development", label: "Development", detail: "Product, contracts and integrations" },
  { key: "maintenance", label: "Maintenance", detail: "Infrastructure first; property upkeep once operating" },
] as const;

const tradingAllocationRows = [
  { key: "propertyFund", label: "Property fund", detail: "Escrowed toward the published land and home acquisition target" },
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
          <span>Planned · no token contract</span>
          <p>No sale, staking contract, exchange listing, property, fee receipt, or payout is live.</p>
        </aside>
      </header>

      <section className="homes-metrics" aria-label="HOMES verified totals">
        <article><span>Total recognized fees</span><strong>{usdc(snapshot.fees.totalUsdc)}</strong><small>No receipt hash</small></article>
        <article><span>Property fund balance</span><strong>{usdc(snapshot.propertyFund.balanceUsdc)}</strong><small>Escrow not deployed</small></article>
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
          <div><dt>HOMES token contract</dt><dd>Not deployed</dd></div>
          <div><dt>Property-fund escrow</dt><dd>Not deployed</dd></div>
          <div><dt>Staking + distribution</dt><dd>Coming later · design only</dd></div>
          <div><dt>Property holding trust</dt><dd>Not formed; no legal title held</dd></div>
          <div><dt>OKX listing</dt><dd>Not applied / not approved</dd></div>
          <div><dt>Proposed SpaceX pair</dt><dd>Exact third-party asset and contract unresolved; no affiliation claimed</dd></div>
          <div><dt>Acquired properties</dt><dd>None</dd></div>
        </dl>
        <div className="homes-source-links">
          <a href="https://www.okx.com/en-gb/help/how-can-i-get-my-project-listed-on-okx" target="_blank" rel="noreferrer">OKX listing process ↗</a>
          <a href="https://www.okx.com/en-gb/help/x-layer-faq" target="_blank" rel="noreferrer">X Layer FAQ ↗</a>
          <Link href="/faq#homes-token">Read the HOMES FAQ</Link>
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
        <p className="homes-budget-note">Recommended price path: HOMES/USDC as the auditable primary market. Any direct SPACEX pool remains blocked until its exact X Layer contract, ownership, liquidity, and lack of affiliation are verified.</p>
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
          <div><p className="aura-label">Protocol-owned liquidity</p><h2 id="launch-policy-heading">A launch people can inspect.</h2></div>
          <p>The decentralized property trust treasury supplies and owns the liquidity position. Team allocation, vesting, sale caps and administrative powers are visible before the first public transaction.</p>
        </div>
        <div className="homes-launch-policy">
          <article><span>{HOMES_TEAM_ALLOCATION_PERCENT}%</span><h3>Team at genesis</h3><p>Mint to labeled vesting wallets with a proposed 12-month cliff and 36-month linear release. The team does not buy against public participants.</p></article>
          <article><span>{HOMES_INITIAL_BUY_CAP_PERCENT}%</span><h3>Initial distribution cap</h3><p>Cap each participating address during the launch window. Do not embed a permanent max-wallet restriction in the ERC-20; address splitting defeats it and integrations can break.</p></article>
          <article><span>Trust</span><h3>Own the liquidity</h3><p>A multisig-controlled trust treasury seeds HOMES/USDC and owns the Uniswap V3 position NFT. A dedicated time-lock vault restricts principal withdrawal under a published policy.</p></article>
          <article><span>Clean</span><h3>Plain token mechanics</h3><p>No transfer tax, hidden mint, blacklist, honeypot rule or owner-only liquidity exit. Privileged changes use multisig plus a public timelock.</p></article>
        </div>
      </section>

      <section className="homes-future" aria-labelledby="rental-heading">
        <p className="aura-label">The operating layer</p>
        <h2 id="rental-heading">From one transparent rental to a decentralized stay network.</h2>
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

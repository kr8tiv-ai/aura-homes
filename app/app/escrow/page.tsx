"use client";

// ESCROW — wired to the LIVE AuraBuildEscrow on X Layer testnet (1952).
// Everything in the "live" panel is a chain read over the public RPC; the
// milestone schedule is computed through the agent pipeline from the open
// cost model and labeled as not-yet-on-chain (milestoneCount() is the test).
// Nothing on this page simulates a transaction.

import { useMemo } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import Link from "next/link";
import { budgetToMilestones, designBriefToBudget, questionnaireToDesignBrief } from "@agent/pipeline";
import LiveEscrowCard from "@/components/chain/LiveEscrowCard";
import { BASE_QUESTIONNAIRE, COST_MODEL } from "@/lib/concierge";
import { CHAIN_ID, FAUCET_URL, USDC_TESTNET, shortAddr } from "@/lib/contracts";
import { fmtSeconds, fmtUsdcUnits, useEscrowLive, useOnchainMilestones, useUsdcState } from "@/lib/hooks";
import RevealWords from "@/components/RevealWords";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

export default function EscrowPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const live = useEscrowLive();
  const onchain = useOnchainMilestones(live.milestoneCount);
  const usdc = useUsdcState(address);

  const rightChain = chainId === CHAIN_ID;
  const isHomeowner =
    !!address && !!live.homeowner && address.toLowerCase() === live.homeowner.toLowerCase();

  // The quoted milestone schedule, computed live through the agent pipeline
  // from data/alberta/cost-model.json — the SAME code path the concierge and
  // the agent CLI use. Never a fixture, so it cannot drift from the model.
  const plan = useMemo(() => {
    const brief = questionnaireToDesignBrief(BASE_QUESTIONNAIRE);
    const budget = designBriefToBudget(brief, COST_MODEL, BASE_QUESTIONNAIRE.contingencyRate);
    return budgetToMilestones(budget, BASE_QUESTIONNAIRE.projectName);
  }, []);

  const holdbackPct = live.holdbackBps !== undefined ? live.holdbackBps / 10_000 : 0.1;

  return (
    <div className="py-16">
      <div>
        <p className="aura-label mb-4">Milestone escrow</p>
        <RevealWords
          text="Build escrow"
          className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
        />
        <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          Funded in native USDC on X Layer. Releases need 2-of-3 approval; every release retains
          the statutory holdback until the lien period runs. The contract is deployed and live —
          the panel below reads it directly.
        </p>
      </div>

      {/* ------------------------------------------------ live chain state */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <LiveEscrowCard />

        {/* Wallet reality */}
        <div className="aura-panel p-6">
          <p className="aura-label">Your wallet</p>
          {isConnected ? (
            <div className="mt-3 space-y-3 text-xs leading-relaxed text-aura-text/80">
              <p className="font-mono">{shortAddr(address)}</p>
              {rightChain ? (
                <p>
                  Connected to X Layer testnet ({CHAIN_ID}). Native testnet USDC balance:{" "}
                  <span className="font-mono">{fmtUsdcUnits(usdc.balance)}</span>
                </p>
              ) : (
                <div className="space-y-2">
                  <p>
                    Wrong network — chain {chainId}. The escrow lives on X Layer testnet ({CHAIN_ID}).
                  </p>
                  <button
                    onClick={() => switchChain({ chainId: CHAIN_ID })}
                    disabled={switching}
                    className="rounded-md border border-aura-emerald px-4 py-2 text-xs font-medium uppercase tracking-label text-aura-emerald transition-colors hover:bg-aura-emerald/5 disabled:opacity-50"
                  >
                    {switching ? "Switching" : `Switch to ${CHAIN_ID}`}
                  </button>
                </div>
              )}
              {rightChain && usdc.loaded && (usdc.balance ?? BigInt(0)) === BigInt(0) && (
                <p className="text-aura-text/70">
                  Testnet funds needed: this wallet holds no testnet USDC (
                  <span className="font-mono">{shortAddr(USDC_TESTNET)}</span>). Gas OKB comes from
                  the{" "}
                  <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="text-aura-emerald underline">
                    OKX faucet
                  </a>
                  . Until funded, everything on this page stays read-only — and the reads are real.
                </p>
              )}
              {rightChain && !isHomeowner && (
                <p className="text-aura-text/70">
                  Honest limit: this escrow instance binds homeowner to the operator wallet{" "}
                  <span className="font-mono">{shortAddr(live.homeowner)}</span> (dev wiring). Funding
                  calls from other addresses would revert, so this page does not offer them.
                </p>
              )}
              <button
                onClick={() => disconnect()}
                className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label hover:border-aura-teal"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-relaxed text-aura-text/75">
                No wallet needed to verify anything — the live panel reads the chain without one.
                Connect to check your testnet USDC and, if you are the escrow&rsquo;s homeowner,
                run the deposit flow in the{" "}
                <Link href="/concierge" className="text-aura-emerald underline">
                  concierge
                </Link>
                .
              </p>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                  className="block w-full max-w-xs rounded-md border aura-hairline px-5 py-2.5 text-xs font-medium uppercase tracking-label transition-colors hover:border-aura-teal disabled:opacity-50"
                >
                  {isPending ? "Connecting" : `Connect ${connector.name}`}
                </button>
              ))}
              {connectors.length === 0 && (
                <p className="text-xs text-aura-text/70">No injected wallet detected.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ the buy flow CTA */}
      <div className="aura-panel mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-semibold">The buy flow lives in the concierge</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-aura-text/75">
            Home, parcel, land gate, quote, reservation deposit, refund window — end to end,
            against this contract.
          </p>
        </div>
        <Link
          href="/concierge"
          className="rounded-full bg-aura-ink px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
        >
          Open the concierge
        </Link>
      </div>

      {/* ------------------------------------------- on-chain milestones */}
      <div className="mt-16">
        <p className="aura-label mb-4">Milestones</p>
        <h2 className="font-display text-[1.45rem] font-medium tracking-[-0.015em]">
          The schedule, and what the chain holds
        </h2>
        {live.milestoneCount !== undefined && live.milestoneCount > 0 ? (
          <div className="mt-6 space-y-4">
            {onchain.milestones.map((m) => (
              <div key={m.id} className="aura-panel flex flex-wrap items-center gap-6 p-6">
                <div className="w-10 text-sm text-aura-violet">{String(m.id + 1).padStart(2, "0")}</div>
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-semibold">On-chain milestone {m.id}</p>
                  <p className="mt-1 text-xs text-aura-text/70">
                    {m.approvalCount} of 2 approvals
                    {m.released ? ` · released${m.holdbackReleased ? ", holdback released" : ", holdback retained"}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{fmtUsdcUnits(m.amount)}</p>
                  <p className="mt-1 text-xs tabular-nums text-aura-text/65">
                    holdback {fmtUsdcUnits(m.holdbackAmount)}
                  </p>
                </div>
                <div className="w-32 text-right text-xs uppercase tracking-label text-aura-text/70">
                  {m.released ? "Released" : m.funded ? "Funded" : "Awaiting funding"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-aura-text/70">
            Live read: milestoneCount() ={" "}
            <span className="font-mono">{live.milestoneCount ?? "…"}</span> — no milestones exist on
            chain yet, and this page says so rather than inventing them. The schedule below is the
            quoted plan for the 800 sqft reference build, computed through the same pipeline the
            agent runs.
          </p>
        )}
      </div>

      {/* ------------------------------------ computed schedule + holdback */}
      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-xs uppercase tracking-label text-aura-teal">
            Computed live from data/alberta/cost-model.json — not yet on chain
          </p>
          <p className="text-xs text-aura-text/65">
            Holdback {live.holdbackBps !== undefined ? `${live.holdbackBps / 100}%` : "10%"} per release
            {live.holdbackPeriodSeconds !== undefined
              ? `, matures ${fmtSeconds(live.holdbackPeriodSeconds)} after release (chain values)`
              : ""}
          </p>
        </div>
        <div className="mt-4 space-y-4">
          {plan.milestones.map((m) => {
            const holdback = Math.round(m.amountCad * holdbackPct);
            const netPct = ((m.amountCad - holdback) / m.amountCad) * 100;
            return (
              <div key={m.index} className="aura-panel p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="w-10 text-sm text-aura-violet">{String(m.index + 1).padStart(2, "0")}</div>
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="mt-1 text-xs text-aura-text/70">{m.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">{cad(m.amountCad)}</p>
                    <p className="mt-1 text-xs tabular-nums text-aura-text/65">
                      holdback {cad(holdback)} · net {cad(m.amountCad - holdback)}
                    </p>
                  </div>
                </div>
                {/* The holdback visualisation: what a release actually pays. */}
                <div
                  className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full"
                  role="img"
                  aria-label={`Release pays ${cad(m.amountCad - holdback)} now; ${cad(holdback)} retained as statutory holdback`}
                >
                  <div className="h-full bg-aura-emerald-bright" style={{ width: `${netPct}%` }} />
                  <div className="h-full bg-aura-violet" style={{ width: `${100 - netPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[10px] uppercase tracking-label text-aura-text/55">
                  <span>Paid to builder on release</span>
                  <span>
                    Retained {live.holdbackBps !== undefined ? `${live.holdbackBps / 100}%` : "10%"} —
                    releasable after{" "}
                    {live.holdbackPeriodSeconds !== undefined ? fmtSeconds(live.holdbackPeriodSeconds) : "60 days"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-aura-text/65">
          Milestone total {cad(plan.totalCad)} = budget MID to the dollar; total holdback{" "}
          {cad(plan.totalHoldbackCad)}. Approvals and releases are real contract calls
          (approveRelease, release, releaseHoldback) and appear above the moment milestones exist on
          chain.
        </p>
      </div>

      {/* ------------------------------------------------ card funding door */}
      <div className="mt-16">
        <p className="aura-label mb-4">Funding without crypto</p>
        <div className="aura-panel max-w-xl p-6">
          <p className="text-sm font-semibold">Card checkout</p>
          <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
            Honest status: the on-ramp integration (MoonPay/Transak-class partner) is pending —
            card checkout is not live yet. When it lands, a Visa or Mastercard payment settles as
            native USDC into this build&rsquo;s escrow with prices shown in CAD throughout.
          </p>
          <button
            disabled
            className="mt-4 rounded-full bg-aura-ink px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-label text-aura-paper opacity-40"
          >
            Continue with card
          </button>
          <p className="mt-3 text-[10px] uppercase tracking-label text-aura-violet">
            On-ramp integration pending
          </p>
        </div>
      </div>

      {/* Financing — teach the crypto-backed options honestly */}
      <div className="mt-16">
        <p className="aura-label mb-4">Financing</p>
        <h2 className="font-display text-[1.45rem] font-medium tracking-[-0.015em]">Borrowing against crypto, honestly</h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-aura-text/75">
          If you hold crypto and would rather borrow against it than sell it, these are the
          real options today — including the one that does not exist yet.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <a
            href="https://app.aave.com/"
            target="_blank"
            rel="noreferrer"
            className="aura-panel block p-6 transition-colors hover:border-aura-emerald"
          >
            <p className="text-sm font-semibold">Aave V3 on X Layer</p>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Borrow USDC against crypto collateral on the same chain the escrow lives on.
              Live now, roughly $85M TVL on X Layer; variable rates, liquidation risk is real.
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-label text-aura-emerald">Live · DeFi</p>
          </a>
          <a
            href="https://ledn.io/"
            target="_blank"
            rel="noreferrer"
            className="aura-panel block p-6 transition-colors hover:border-aura-emerald"
          >
            <p className="text-sm font-semibold">Ledn</p>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Toronto-based lender. BTC-collateral loans disbursed in USDC or CAD — a
              Canadian company, custodial, with published proof-of-reserves.
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-label text-aura-teal">Live · CeFi · Canada</p>
          </a>
          <a
            href="https://www.wealthsimple.com/"
            target="_blank"
            rel="noreferrer"
            className="aura-panel block p-6 transition-colors hover:border-aura-emerald"
          >
            <p className="text-sm font-semibold">Wealthsimple</p>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              No crypto-backed loans today — its line of credit is securities-only. We
              integrate the day they ship crypto collateral; until then it is the 0%-fee
              USDC on-ramp, nothing more.
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-label text-aura-violet">Not yet — verified Aug 2026</p>
          </a>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-label text-aura-text/65">
          Educational, not financial advice.
        </p>
      </div>

      <div className="mt-10 text-xs text-aura-text/65">
        <p className="aura-label mb-2">Settlement asset</p>
        <p className="font-mono">Native USDC — {USDC_TESTNET} (chain {CHAIN_ID})</p>
      </div>
    </div>
  );
}

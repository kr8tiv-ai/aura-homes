"use client";

// LABS · X LAYER PROOF OF LIFECYCLE — the live testnet demonstration that a
// build's milestone lifecycle can leave public, verifiable receipts.
//
// This content moved here from /escrow. The founder's call: "get rid of the
// escrow talk… it isn't a problem we're solving" — so this page frames the
// deployed contract as a proof-of-lifecycle LAB DEMO on X Layer testnet, not
// as a product promise. The mechanics below are unchanged and real:
// everything in the "live" panel is a chain read over the public RPC; the
// milestone schedule is computed through the agent pipeline from the open
// cost model and labeled as not-yet-on-chain (milestoneCount() is the test).
// Nothing on this page simulates a transaction, and nothing here holds real
// money.

import { useMemo } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { budgetToMilestones, designBriefToBudget, questionnaireToDesignBrief } from "@agent/pipeline";
import LiveEscrowCard from "@/components/chain/LiveEscrowCard";
import CryptoFinancingPanel from "@/components/CryptoFinancingPanel";
import { BASE_QUESTIONNAIRE, COST_MODEL } from "@/lib/concierge";
import { CHAIN_ID, FAUCET_URL, USDC_TESTNET, shortAddr } from "@/lib/contracts";
import { fmtSeconds, fmtUsdcUnits, useEscrowLive, useOnchainMilestones, useUsdcState } from "@/lib/hooks";
import RevealWords from "@/components/RevealWords";
import { Counter, GrowBar, Reveal, Stagger, StaggerItem } from "@/components/Reveal";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

// Counter restarts its rAF whenever `format` changes identity, and this page
// re-renders on every chain poll — so the count-up formatter is a module
// constant rather than an inline arrow. Same output as cad() for whole CAD.
const countCad = (n: number) => Math.round(n).toLocaleString("en-CA");

export default function XLayerProofLab() {
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
        <Reveal className="mb-4" y={10}>
          <p className="aura-label">Aura Labs &middot; X Layer testnet</p>
        </Reveal>
        <RevealWords
          text="Proof of lifecycle"
          className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
        />
        <Reveal className="mt-4" delay={0.12} y={12}>
          <p className="max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
            A lab demonstration, not a product feature: experimental contracts are deployed on X
            Layer testnet, but this public instance currently has zero milestones and zero home
            records. The live panel reads that empty state directly from the chain. Creation
            receipts prove deployment only; nothing here holds real money, proves physical work,
            or offers an escrow service.
          </p>
        </Reveal>
      </div>

      {/* ------------------------------------------------ live chain state */}
      <Stagger className="mt-10 grid gap-6 md:grid-cols-2">
        <StaggerItem className="h-full [&>*]:h-full">
          <LiveEscrowCard />
        </StaggerItem>

        {/* Wallet reality */}
        <StaggerItem className="h-full [&>*]:h-full">
          <div className="aura-panel p-6">
            <p className="aura-label">Your wallet</p>
            {isConnected ? (
              <div className="mt-3 space-y-3 text-xs leading-relaxed text-aura-text/80">
                <p className="font-mono">{shortAddr(address)}</p>
                {rightChain ? (
                  <p>
                    Connected to X Layer testnet ({CHAIN_ID}). Faucet-compatible test-token balance:{" "}
                    <span className="font-mono">{fmtUsdcUnits(usdc.balance)}</span>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      Wrong network — chain {chainId}. The demo contract lives on X Layer testnet ({CHAIN_ID}).
                    </p>
                    <button
                      onClick={() => switchChain({ chainId: CHAIN_ID })}
                      disabled={switching}
                      data-cursor="Switch"
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
                    <a
                      href={FAUCET_URL}
                      target="_blank"
                      rel="noreferrer"
                      data-cursor="Faucet"
                      className="text-aura-emerald underline"
                    >
                      OKX faucet
                    </a>
                    . Until funded, everything on this page stays read-only — and the reads are real.
                  </p>
                )}
                {rightChain && !isHomeowner && (
                  <p className="text-aura-text/70">
                    Honest limit: this demo instance binds homeowner to the operator wallet{" "}
                    <span className="font-mono">{shortAddr(live.homeowner)}</span> (dev wiring). Funding
                    calls from other addresses would revert, so this page does not offer them.
                  </p>
                )}
                <button
                  onClick={() => disconnect()}
                  data-cursor="Disconnect"
                  className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label hover:border-aura-teal"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-xs leading-relaxed text-aura-text/75">
                  No wallet needed to verify anything — the live panel reads the chain without one.
                  Connect to check your testnet USDC. This page remains read-only for ordinary
                  visitors; the historical transaction walkthrough is not part of Aura&rsquo;s
                  customer journey.
                </p>
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    disabled={isPending}
                    data-cursor="Connect"
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
        </StaggerItem>
      </Stagger>

      {/* ------------------------------------------- on-chain milestones */}
      <div className="mt-16">
        <Reveal y={16}>
          <p className="aura-label mb-4">Milestones</p>
          <h2 className="font-display text-[1.45rem] font-medium tracking-[-0.015em]">
            The schedule, and what the chain holds
          </h2>
        </Reveal>
        {live.milestoneCount !== undefined && live.milestoneCount > 0 ? (
          <Stagger className="mt-6 space-y-4">
            {onchain.milestones.map((m) => (
              <StaggerItem key={m.id}>
                <div className="aura-panel aura-panel-lift flex flex-wrap items-center gap-6 p-6">
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
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-3" delay={0.08} y={12}>
            <p className="max-w-xl text-xs leading-relaxed text-aura-text/70">
              Live read: milestoneCount() ={" "}
              <span className="font-mono">{live.milestoneCount ?? "…"}</span> — no milestones exist on
              chain yet, and this page says so rather than inventing them. The schedule below is the
              quoted plan for the 800 sqft reference build, computed through the same pipeline the
              agent runs.
            </p>
          </Reveal>
        )}
      </div>

      {/* ------------------------------------ computed schedule + holdback */}
      <div className="mt-8">
        <Reveal y={12}>
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
        </Reveal>
        <Stagger className="mt-4 space-y-4">
          {plan.milestones.map((m) => {
            const holdback = Math.round(m.amountCad * holdbackPct);
            const netPct = ((m.amountCad - holdback) / m.amountCad) * 100;
            return (
              <StaggerItem key={m.index}>
                <div className="aura-panel aura-panel-lift p-6">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="w-10 text-sm text-aura-violet">{String(m.index + 1).padStart(2, "0")}</div>
                    <div className="min-w-[220px] flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="mt-1 text-xs text-aura-text/70">{m.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">
                        <Counter value={m.amountCad} prefix="$" format={countCad} />
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-aura-text/65">
                        holdback {cad(holdback)} · net {cad(m.amountCad - holdback)}
                      </p>
                    </div>
                  </div>
                  {/* The holdback visualisation: what a release actually pays.
                      Each segment now draws itself from zero on entry — the
                      retained slice arrives a beat later, so the eye reads
                      "paid, then held back" rather than one static ribbon. */}
                  <div
                    className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-aura-ink/10"
                    role="img"
                    aria-label={`Release pays ${cad(m.amountCad - holdback)} now; ${cad(holdback)} retained as statutory holdback`}
                  >
                    <GrowBar pct={netPct} className="h-full bg-aura-emerald-bright" />
                    <GrowBar pct={100 - netPct} className="h-full bg-aura-violet" delay={0.28} />
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
              </StaggerItem>
            );
          })}
        </Stagger>
        <Reveal className="mt-4" y={10}>
          <p className="text-xs text-aura-text/65">
            Milestone total <Counter value={plan.totalCad} prefix="$" format={countCad} /> = budget MID
            to the dollar; total holdback{" "}
            <Counter value={plan.totalHoldbackCad} prefix="$" format={countCad} />. Approvals and
            releases are real contract calls (approveRelease, release, releaseHoldback) and appear
            above the moment milestones exist on chain.
          </p>
        </Reveal>
      </div>

      {/* ------------------------------------------------ card funding door */}
      <div className="mt-16">
        <Reveal className="mb-4" y={12}>
          <p className="aura-label">Funding without crypto</p>
        </Reveal>
        <Reveal delay={0.08} y={16}>
          <div className="aura-panel aura-panel-lift max-w-xl p-6">
            <p className="text-sm font-semibold">Card checkout</p>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Honest status: the on-ramp integration (MoonPay/Transak-class partner) is pending —
              card checkout is not live yet. No card partner, production settlement asset, or
              milestone-payment flow has been approved. The token used by this lab is a
              faucet-compatible test token with no monetary value.
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
        </Reveal>
      </div>

      {/* Financing — the shared education panel; it also renders on
          /how-crypto-works, the indexed page, so this lab is no longer its
          only (noindex) home. */}
      <div className="mt-16">
        <CryptoFinancingPanel />
      </div>

      <Reveal className="mt-10 text-xs text-aura-text/65" y={10}>
        <p className="aura-label mb-2">Settlement asset</p>
        <p className="font-mono">Faucet-compatible test token — {USDC_TESTNET} (chain {CHAIN_ID}) · no monetary value</p>
      </Reveal>
    </div>
  );
}

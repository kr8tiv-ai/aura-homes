"use client";

import { useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { USDC_ADDRESS } from "@/lib/chains";
import { useApproveRelease, useEscrowMilestones } from "@/lib/hooks";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

const statusColor: Record<string, string> = {
  Released: "text-aura-lime",
  Funded: "text-aura-teal",
  "Awaiting funding": "text-aura-text/65",
};

type FundingMethod = "card" | "usdc";

export default function EscrowPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { milestones, isStub } = useEscrowMilestones();
  const { approve } = useApproveRelease();
  const [method, setMethod] = useState<FundingMethod>("card");

  const usdc = USDC_ADDRESS[chainId];

  return (
    <div className="py-16">
      <div>
        <p className="aura-label mb-4">Milestone escrow</p>
        <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Build escrow</h1>
        <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          Funded in native USDC on X Layer. Releases need 2-of-3 approval; every release
          retains a 10 percent statutory holdback for 60 days.
        </p>
      </div>

      {/* Funding choice: card-first, wallet second */}
      <div className="mt-10">
        <h2 className="aura-label">How do you want to fund?</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          {/* Primary: pay with card */}
          <button
            type="button"
            onClick={() => setMethod("card")}
            aria-pressed={method === "card"}
            className={`aura-panel p-6 text-left transition-colors ${
              method === "card" ? "" : "opacity-60 hover:opacity-100"
            }`}
            style={method === "card" ? { borderColor: "rgba(16, 185, 129, 0.6)" } : undefined}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold">Pay with card</p>
              <span className="rounded border border-aura-emerald px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-aura-emerald">
                Recommended
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              No crypto needed. Pay in CAD with Visa or Mastercard; an on-ramp partner converts
              your payment to USDC on X Layer in-flow. No exchange account, no wallet setup, no
              seed phrases.
            </p>
          </button>

          {/* Secondary: existing wallet flow */}
          <button
            type="button"
            onClick={() => setMethod("usdc")}
            aria-pressed={method === "usdc"}
            className={`aura-panel p-6 text-left transition-colors ${
              method === "usdc" ? "" : "opacity-60 hover:opacity-100"
            }`}
            style={method === "usdc" ? { borderColor: "rgba(45, 212, 191, 0.6)" } : undefined}
          >
            <p className="text-sm font-semibold">I have USDC</p>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Already hold native USDC on X Layer? Connect your wallet and fund milestones
              directly from it.
            </p>
          </button>
        </div>

        {/* Selected method detail */}
        <div className="aura-panel mt-6 p-6">
          {method === "card" ? (
            <div className="max-w-xl space-y-4">
              <p className="text-sm font-semibold">Card checkout</p>
              <p className="text-xs leading-relaxed text-aura-text/75">
                Honest status: the on-ramp integration (MoonPay/Transak-class partner) is
                pending — card checkout is not live yet. When it lands, your Visa or Mastercard
                payment settles as native USDC into this build&rsquo;s escrow with prices shown
                in CAD throughout.
              </p>
              <button
                disabled
                className="rounded-full bg-aura-ink px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-label text-aura-paper opacity-40"
              >
                Continue with card
              </button>
              <p className="text-[10px] uppercase tracking-label text-aura-violet">
                On-ramp integration pending
              </p>
            </div>
          ) : (
            <div className="max-w-xl space-y-4">
              <p className="text-sm font-semibold">Wallet</p>
              {isConnected ? (
                <div className="space-y-3">
                  <p className="font-mono text-xs text-aura-text/80">
                    {address?.slice(0, 6)}&hellip;{address?.slice(-4)}
                  </p>
                  <p className="text-xs text-aura-text/70">Chain ID {chainId}</p>
                  <button
                    onClick={() => disconnect()}
                    className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label hover:border-aura-teal"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
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
          )}
        </div>
      </div>

      {isStub && (
        <p className="mt-10 text-xs uppercase tracking-label text-aura-violet">
          Preview data — contract reads land with the testnet deployment
        </p>
      )}

      <div className="mt-6 space-y-4">
        {milestones.map((m) => (
          <div key={m.index} className="aura-panel flex flex-wrap items-center gap-6 p-6">
            <div className="w-10 text-sm text-aura-violet">{String(m.index + 1).padStart(2, "0")}</div>
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-semibold">{m.name}</p>
              <p className="mt-1 text-xs text-aura-text/70">{m.description}</p>
            </div>
            <div className="text-right">
              <p className="text-sm tabular-nums">{cad(m.amountCad)}</p>
              <p className="mt-1 text-xs tabular-nums text-aura-text/65">
                holdback {cad(m.holdbackCad)}
              </p>
            </div>
            <div className={`w-36 text-right text-xs uppercase tracking-label ${statusColor[m.status]}`}>
              {m.status}
            </div>
            <button
              onClick={() => approve(m.index)}
              disabled={!isConnected || m.status === "Released"}
              className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label transition-colors hover:border-aura-emerald disabled:opacity-30"
            >
              Approve release
            </button>
          </div>
        ))}
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
        <p className="font-mono">
          Native USDC {usdc ? `— ${usdc}` : "— connect to an X Layer chain"}
        </p>
      </div>
    </div>
  );
}

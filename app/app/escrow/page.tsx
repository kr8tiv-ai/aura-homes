"use client";

import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { USDC_ADDRESS } from "@/lib/chains";
import { useApproveRelease, useEscrowMilestones } from "@/lib/hooks";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

const statusColor: Record<string, string> = {
  Released: "text-aura-lime",
  Funded: "text-aura-teal",
  "Awaiting funding": "text-aura-text/40",
};

export default function EscrowPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { milestones, isStub } = useEscrowMilestones();
  const { approve } = useApproveRelease();

  const usdc = USDC_ADDRESS[chainId];

  return (
    <div className="py-16">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="aura-label mb-4">Milestone escrow</p>
          <h1 className="text-3xl font-semibold">Build escrow</h1>
          <p className="mt-3 max-w-xl text-sm text-aura-text/60">
            Funded in native USDC on X Layer. Releases need 2-of-3 approval; every release
            retains a 10 percent statutory holdback for 60 days.
          </p>
        </div>

        <div className="aura-panel p-5 text-sm">
          {isConnected ? (
            <div className="space-y-3">
              <p className="aura-label">Wallet</p>
              <p className="font-mono text-xs text-aura-text/80">
                {address?.slice(0, 6)}&hellip;{address?.slice(-4)}
              </p>
              <p className="text-xs text-aura-text/50">Chain ID {chainId}</p>
              <button
                onClick={() => disconnect()}
                className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label hover:border-aura-teal"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="aura-label">Wallet</p>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                  className="block w-full rounded-md bg-aura-emerald px-5 py-2.5 text-xs font-medium uppercase tracking-label text-aura-bg disabled:opacity-50"
                >
                  {isPending ? "Connecting" : `Connect ${connector.name}`}
                </button>
              ))}
              {connectors.length === 0 && (
                <p className="text-xs text-aura-text/50">No injected wallet detected.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {isStub && (
        <p className="mt-8 text-xs uppercase tracking-label text-aura-violet">
          Preview data — contract reads land with the testnet deployment
        </p>
      )}

      <div className="mt-6 space-y-4">
        {milestones.map((m) => (
          <div key={m.index} className="aura-panel flex flex-wrap items-center gap-6 p-6">
            <div className="w-10 text-sm text-aura-violet">{String(m.index + 1).padStart(2, "0")}</div>
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-semibold">{m.name}</p>
              <p className="mt-1 text-xs text-aura-text/50">{m.description}</p>
            </div>
            <div className="text-right">
              <p className="text-sm tabular-nums">{cad(m.amountCad)}</p>
              <p className="mt-1 text-xs tabular-nums text-aura-text/40">
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

      <div className="mt-10 text-xs text-aura-text/40">
        <p className="aura-label mb-2">Settlement asset</p>
        <p className="font-mono">
          Native USDC {usdc ? `— ${usdc}` : "— connect to an X Layer chain"}
        </p>
      </div>
    </div>
  );
}

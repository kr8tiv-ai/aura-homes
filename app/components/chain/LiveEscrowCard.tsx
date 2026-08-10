"use client";

// The judge's proof panel: the deployed AuraBuildEscrow's state, read live
// from the X Layer testnet RPC with no wallet involved. Every number shown
// here is a chain read — if the RPC is unreachable the card says so instead
// of substituting a fixture.

import { CHAIN_ID, ESCROW_ADDRESS, REGISTRY_ADDRESS, oklinkAddress, shortAddr } from "@/lib/contracts";
import { fmtSeconds, fmtUsdcUnits, useEscrowLive } from "@/lib/hooks";
import { Counter, Stagger, StaggerItem } from "@/components/Reveal";

/* Counter re-runs its rAF whenever `format` changes identity, and this card
   re-renders on every 30 s refetch (and once a second while the concierge
   countdown ticks). Module scope keeps these stable, so a figure counts up
   exactly once instead of restarting under the reader. */
const asInt = (n: number) => Math.round(n).toLocaleString("en-CA");
const asPct = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-CA");
const asUsdc = (n: number) =>
  n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <StaggerItem className="flex items-baseline justify-between gap-4 py-1.5" y={8}>
      <span className="text-xs text-aura-text/65">{k}</span>
      <span className={`text-right text-xs ${mono ? "font-mono" : ""} text-aura-text/90`}>{v}</span>
    </StaggerItem>
  );
}

export default function LiveEscrowCard({ compact = false }: { compact?: boolean }) {
  const live = useEscrowLive();

  const sameRoles =
    live.homeowner && live.homeowner === live.builder && live.builder === live.arbiter;

  return (
    <div className="aura-panel aura-panel-lift p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="aura-label">On-chain escrow — live read</p>
        {live.loaded ? (
          <span className="rounded border border-aura-emerald px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-aura-emerald">
            Chain {CHAIN_ID}
          </span>
        ) : live.error ? (
          <span className="rounded border border-aura-violet px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-aura-violet">
            RPC unreachable
          </span>
        ) : (
          <span className="rounded border aura-hairline px-2 py-0.5 text-[10px] uppercase tracking-label text-aura-text/60">
            Reading
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-aura-text/65">
        AuraBuildEscrow at{" "}
        <a
          href={oklinkAddress(ESCROW_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          data-cursor="Verify"
          className="font-mono text-aura-emerald underline decoration-dotted underline-offset-2"
        >
          {shortAddr(ESCROW_ADDRESS)}
        </a>{" "}
        on X Layer testnet. Values below are fetched from the public RPC — no wallet, no fixture.
      </p>

      {live.error && !live.loaded ? (
        <p className="mt-4 text-xs leading-relaxed text-aura-violet">
          The RPC read failed, so there is nothing to show — this panel never substitutes sample
          data for chain data. Verify the contract directly on{" "}
          <a
            href={oklinkAddress(ESCROW_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            data-cursor="Verify"
            className="underline"
          >
            OKLink
          </a>
          .
        </p>
      ) : (
        <Stagger className="mt-3 divide-y divide-aura-ink/10" gap={0.045}>
          <Row k="Escrow state" v={live.loaded ? live.stateName : "…"} />
          <Row
            k="Statutory holdback"
            v={
              live.holdbackBps !== undefined ? (
                <>
                  <Counter value={live.holdbackBps / 100} format={asPct} suffix="%" /> (holdbackBps{" "}
                  {live.holdbackBps})
                </>
              ) : (
                "…"
              )
            }
          />
          <Row
            k="Holdback maturity"
            v={
              live.holdbackPeriodSeconds !== undefined
                ? `${fmtSeconds(live.holdbackPeriodSeconds)} after release`
                : "…"
            }
          />
          <Row
            k="Refund window (refundWindow())"
            v={
              live.refundWindowSeconds !== undefined ? (
                <>
                  {fmtSeconds(live.refundWindowSeconds)} (
                  <Counter value={live.refundWindowSeconds} format={asInt} suffix=" s" />)
                </>
              ) : (
                "…"
              )
            }
          />
          <Row
            k="Milestones on chain"
            v={
              live.milestoneCount === undefined ? (
                "…"
              ) : (
                <Counter value={live.milestoneCount} format={asInt} />
              )
            }
          />
          <Row
            k="Reservation deposit"
            v={
              live.depositAmount === undefined ? (
                "…"
              ) : live.depositAmount === BigInt(0) ? (
                "none placed yet"
              ) : (
                <>
                  <Counter
                    value={Number(live.depositAmount) / 1_000_000}
                    format={asUsdc}
                    suffix=" USDC"
                  />
                  {live.depositRefunded ? " (refunded)" : live.depositConverted ? " (converted)" : ""}
                </>
              )
            }
          />
          {live.refundDeadline !== undefined && live.refundDeadline > 0 && (
            <Row
              k="Refund deadline"
              v={new Date(live.refundDeadline * 1000).toISOString().replace(".000", "")}
              mono
            />
          )}
          {!compact && (
            <>
              <Row k="Homeowner" v={shortAddr(live.homeowner)} mono />
              <Row k="Builder" v={shortAddr(live.builder)} mono />
              <Row k="Arbiter" v={shortAddr(live.arbiter)} mono />
              <Row
                k="Registry build records"
                v={
                  live.registryNextTokenId === undefined ? (
                    "…"
                  ) : live.registryNextTokenId === 0 ? (
                    "0 minted — nothing recorded yet"
                  ) : (
                    <>
                      <Counter value={live.registryNextTokenId} format={asInt} /> minted
                    </>
                  )
                }
              />
            </>
          )}
        </Stagger>
      )}

      {sameRoles && (
        <p className="mt-3 text-[10px] uppercase tracking-label text-aura-violet">
          Dev wiring — homeowner, builder, and arbiter are all the deploy wallet on this instance
        </p>
      )}

      {!compact && (
        <p className="mt-3 text-[11px] text-aura-text/60">
          Registry:{" "}
          <a
            href={oklinkAddress(REGISTRY_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            data-cursor="Verify"
            className="font-mono underline decoration-dotted underline-offset-2"
          >
            {shortAddr(REGISTRY_ADDRESS)}
          </a>
          . Deployment record: docs/DEPLOYMENTS.md in the public repo.
        </p>
      )}
    </div>
  );
}

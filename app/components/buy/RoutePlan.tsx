"use client";

/* THE ROUTE.

   Three legs, and the page automates none of them. That is the point:
   Aura shows the hops, the fees, the custody, the KYC and the gaps, then
   hands you the link and gets out of the way. Nothing here simulates a
   transfer, quotes a rate, or moves a token.

   The legs are honest about their own seams — including the one that
   breaks: leg 1 can deliver a different USDC contract than leg 2 accepts,
   and both report the symbol "USDC". That is stated where it bites. */

import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import type { Provider, XRoute } from "./data";
import {
  BORROW_ROUTE_ID,
  CONVERT_ROUTE_ID,
  DEFAULT_ENTRY_ROUTE_ID,
  ENTRY_ROUTE_IDS,
  routeById,
  settlementAsset,
} from "./data";

/* The only two routes in the dataset with a first-party app a reader can
   actually open. Everything else is contract-level, an exchange screen
   inside an account, or a help article — so it gets its evidence link and
   an instruction, never an invented deep link. */
const APP_LINK: Record<string, { href: string; label: string }> = {
  "okx-dex-bridge": { href: "https://web3.okx.com/xlayer/bridge", label: "Open the OKX bridge" },
  "meson-btc": { href: "https://meson.fi/", label: "Open Meson" },
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="aura-label mb-1">{label}</p>
      <p className="text-xs leading-relaxed text-aura-text/75">{children}</p>
    </div>
  );
}

function LegCard({
  n,
  title,
  route,
  note,
}: {
  n: number;
  title: string;
  route: XRoute;
  note?: React.ReactNode;
}) {
  const app = APP_LINK[route.id];
  return (
    <div className="aura-panel aura-panel-lift p-7">
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="font-mono text-sm text-aura-violet">{String(n).padStart(2, "0")}</span>
        <div className="min-w-[14rem] flex-1">
          <p className="aura-label">{title}</p>
          <h3 className="mt-1.5 font-display text-[1.05rem] font-medium tracking-[-0.01em]">
            {route.name}
          </h3>
          <p className="mt-1.5 text-xs text-aura-text/65">
            {route.from} <span className="text-aura-teal">&rarr;</span> {route.to}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-2 border-t aura-hairline pt-5">
        {route.hops.map((hop, i) => (
          <li key={hop} className="flex gap-3 text-xs leading-relaxed text-aura-text/80">
            <span className="font-mono text-aura-teal">{i + 1}</span>
            <span>{hop}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-4 border-t aura-hairline pt-5 sm:grid-cols-2">
        <Fact label="Custody">{route.custody}</Fact>
        <Fact label="KYC">{route.kyc}</Fact>
        <Fact label="Fees">{route.feeEstimate}</Fact>
        <Fact label="Time">{route.timeEstimate}</Fact>
      </div>

      <div className="mt-5 rounded-lg bg-aura-sunken p-4">
        <p className="aura-label mb-2">What was actually verified</p>
        <p className="text-xs leading-relaxed text-aura-text/80">{route.verifiedAt}</p>
        {route.recordTruncated ? (
          <p className="mt-2 text-[0.68rem] uppercase leading-relaxed tracking-label text-aura-violet">
            This verification record arrived incomplete. The rest of it — including the evidence
            URL — is missing, and is not reconstructed here.
          </p>
        ) : null}
      </div>

      {note ? <div className="mt-5">{note}</div> : null}

      <div className="mt-5 border-t aura-hairline pt-5">
        <p className="text-xs leading-relaxed text-aura-text/70">
          <span className="font-medium text-aura-text">You do this leg yourself,</span> in your own
          wallet or account. This page does not run it, cannot run it, and never holds your funds.
          {route.embeddable ? (
            <>
              {" "}
              <span className="text-aura-text/55">Technical note: {route.embeddable}</span>
            </>
          ) : null}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          {app ? (
            <a
              href={app.href}
              target="_blank"
              rel="noreferrer"
              data-cursor="Open"
              className="rounded-full bg-aura-ink px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
            >
              {app.label}
            </a>
          ) : null}
          {route.evidenceUrl ? (
            <a
              href={route.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              data-cursor="Evidence"
              className="font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald underline underline-offset-4"
            >
              Read the evidence
            </a>
          ) : (
            <span className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/45">
              No evidence URL on record
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoutePlan({
  provider,
  entryRouteId,
  onEntryRoute,
}: {
  provider: Provider;
  entryRouteId: string;
  onEntryRoute: (id: string) => void;
}) {
  const entry = routeById(entryRouteId) ?? routeById(DEFAULT_ENTRY_ROUTE_ID)!;
  const convert = routeById(CONVERT_ROUTE_ID)!;
  const borrow = routeById(BORROW_ROUTE_ID)!;
  const settles = settlementAsset(provider);

  return (
    <div>
      <Reveal y={12}>
        <p className="aura-label">The route</p>
        <h2 className="mt-2 font-display text-[1.6rem] font-medium tracking-[-0.02em]">
          From USDC on X Layer to {provider.name}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
          {settles ? (
            <>
              {provider.name} names {settles} among the assets it takes, and {settles} is the only
              asset a verified route reaches from X Layer in one hop. So the plan is three legs:
              get onto X Layer, convert, then send it yourself. Aura runs none of them.
            </>
          ) : (
            <>
              No route can be planned. {provider.name} has never named a coin it accepts, so there
              is no destination asset to route into — the source calls it
              &ldquo;cryptocurrencies&rdquo; and stops there.
            </>
          )}
        </p>
      </Reveal>

      {settles ? (
        <Stagger className="mt-8 space-y-6">
          <StaggerItem>
            <div className="aura-panel p-6">
              <p className="aura-label mb-3">Leg 01 — choose how you arrive on X Layer</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Choose the entry route">
                {ENTRY_ROUTE_IDS.map((id) => {
                  const r = routeById(id);
                  if (!r) return null;
                  const on = r.id === entry.id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onEntryRoute(id)}
                      aria-pressed={on}
                      data-cursor="Choose"
                      className={
                        on
                          ? "rounded-full bg-aura-ink px-4 py-2 font-mono text-[0.6rem] uppercase tracking-label text-aura-paper"
                          : "rounded-full border aura-hairline px-4 py-2 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-emerald"
                      }
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-aura-text/70">
                Default is the OKX DEX bridge aggregator: non-custodial, no exchange account, and
                the rail X Layer&rsquo;s own bridge page sends people to.{" "}
                <span className="text-aura-violet">
                  If you are Canadian, read the KYC line before you pick the OKX exchange
                  withdrawal — OKX does not serve Canadian residents.
                </span>
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <LegCard n={1} title="Arrive on X Layer" route={entry} />
          </StaggerItem>

          <StaggerItem>
            <LegCard
              n={2}
              title={`Convert to ${settles}`}
              route={convert}
              note={
                <div className="rounded-lg border border-aura-violet/40 bg-aura-violet/[0.06] p-4">
                  <p className="aura-label mb-2 text-aura-violet">Where these two legs do not meet</p>
                  <p className="text-xs leading-relaxed text-aura-text/80">
                    Leg 1 and leg 2 do not necessarily mean the same token. Meson lists X Layer USDC
                    as the legacy bridged contract 0x74b7&hellip;6d22; Circle&rsquo;s CCTP mints the
                    native contract 0xB6CE&hellip;3061. Both report the symbol
                    &ldquo;USDC&rdquo; and are indistinguishable in a wallet. Nothing in this dataset
                    verifies how to convert one into the other on X Layer, so check the contract
                    address before you swap. That gap is real and it is not solved here.
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-aura-text/80">
                    Hard per-swap limits also apply: USDC min 1 / max 20,000, BTC min 0.0005 / max
                    0.1. A home does not fit in one swap.
                  </p>
                </div>
              }
            />
          </StaggerItem>

          <StaggerItem>
            <div className="aura-panel p-7">
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="font-mono text-sm text-aura-violet">03</span>
                <div className="min-w-[14rem] flex-1">
                  <p className="aura-label">Send it, and talk to them</p>
                  <h3 className="mt-1.5 font-display text-[1.05rem] font-medium tracking-[-0.01em]">
                    You do this one entirely on your own
                  </h3>
                </div>
              </div>
              <p className="mt-5 border-t aura-hairline pt-5 text-xs leading-relaxed text-aura-text/80">
                There is no automated last leg and this page will not pretend otherwise. Contact{" "}
                {provider.name} directly, agree terms in writing, get the receiving address from
                them on a channel you trust, and send a small test amount first.{" "}
                {provider.howToPay}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-aura-text/70">
                Aura is not a party to whatever you agree. It holds no funds, takes no deposit,
                offers no escrow over this purchase, and has no relationship with {provider.name}.
              </p>
              <a
                href={provider.url}
                target="_blank"
                rel="noreferrer"
                data-cursor="Contact"
                className="mt-5 inline-block rounded-full bg-aura-ink px-5 py-2.5 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
              >
                Contact {provider.name}
              </a>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="aura-panel p-7">
              <p className="aura-label mb-2">Optional — don&rsquo;t want to sell?</p>
              <h3 className="font-display text-[1.05rem] font-medium tracking-[-0.01em]">
                {borrow.name}
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-aura-text/75">
                Supply collateral on X Layer and borrow stables against it instead of selling.
                Liquidation risk is real and this is not financial advice. {borrow.kyc === "None" ? "No KYC." : borrow.kyc}{" "}
                {borrow.feeEstimate}
              </p>
              <p className="mt-3 text-[0.68rem] uppercase leading-relaxed tracking-label text-aura-violet">
                Record incomplete — no evidence URL survived in this dataset. Verify the market
                yourself before supplying anything.
              </p>
            </div>
          </StaggerItem>
        </Stagger>
      ) : (
        <Reveal y={12} className="mt-8">
          <div className="aura-panel p-7">
            <p className="aura-label mb-2">Nothing to route into</p>
            <p className="text-xs leading-relaxed text-aura-text/80">{provider.caveat}</p>
            <p className="mt-4 text-xs leading-relaxed text-aura-text/70">
              Ask them which coin, on which chain, to which address, and get it in writing before
              anything else. Until then there is no route to draw.
            </p>
            <a
              href={provider.url}
              target="_blank"
              rel="noreferrer"
              data-cursor="Contact"
              className="mt-5 inline-block rounded-full border aura-hairline px-5 py-2.5 font-mono text-[0.65rem] uppercase tracking-label transition-colors hover:border-aura-emerald"
            >
              Contact {provider.name}
            </a>
          </div>
        </Reveal>
      )}
    </div>
  );
}

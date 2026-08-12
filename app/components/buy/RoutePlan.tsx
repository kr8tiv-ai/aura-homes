"use client";

import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { changeNowReadiness } from "@/lib/marketplace/buyReadiness";
import type { Provider } from "./data";
import { BORROW_ROUTE_ID, CONVERT_ROUTE_ID, routeById, settlementAsset } from "./data";

const NATIVE_USDC_XLAYER = "0xB6CEceAB302E2E4948951eE7843FC24E92933061";
const LEGACY_USDC_XLAYER = "0x74b7F16337b8972027F6196A17a631aC6dE26d22";

function StepHeading({ n, eyebrow, title }: { n: number; eyebrow: string; title: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      <span className="font-mono text-sm text-aura-violet">{String(n).padStart(2, "0")}</span>
      <div className="min-w-[14rem] flex-1">
        <p className="aura-label">{eyebrow}</p>
        <h3 className="mt-1.5 font-display text-[1.05rem] font-medium tracking-[-0.01em]">
          {title}
        </h3>
      </div>
    </div>
  );
}

export default function RoutePlan({ provider }: { provider: Provider }) {
  const settles = settlementAsset(provider);
  const meson = routeById(CONVERT_ROUTE_ID)!;
  const borrow = routeById(BORROW_ROUTE_ID)!;
  const changeNow = changeNowReadiness(
    {
      partnerApiConfigured: false,
      exactPairVerified: false,
      quoteExpiresAtISO: null,
      recipientVerified: false,
      termsAccepted: false,
    },
    new Date(),
  );
  const guideQuestion = `Guide me through buying from ${provider.name} with native USDC on X Layer. Explain the ChangeNOW and manufacturer verification gates without moving funds.`;

  return (
    <div>
      <Reveal y={12}>
        <p className="aura-label">The guided route</p>
        <h2 className="mt-2 font-display text-[1.6rem] font-medium tracking-[-0.02em]">
          From native USDC on X Layer to {provider.name}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/75">
          This starts where you said the buyer starts: already holding native USDC on X Layer.
          It is a read-only mainnet route guide; Aura&rsquo;s own checkout remains X Layer testnet-only.
          No swap, bridge or manufacturer payment is created here, and no API key or recipient
          address is trusted from page copy.
        </p>
      </Reveal>

      {settles ? (
        <Stagger className="mt-8 space-y-6">
          <StaggerItem>
            <section className="aura-panel aura-panel-lift p-7">
              <StepHeading n={1} eyebrow="Prove the starting asset" title="The ticker is not enough" />
              <p className="mt-5 border-t aura-hairline pt-5 text-xs leading-relaxed text-aura-text/80">
                The intended source is native Circle USDC on X Layer mainnet (chain 196), contract{" "}
                <span className="break-all font-mono text-aura-emerald">{NATIVE_USDC_XLAYER}</span>.
                The legacy bridged token at{" "}
                <span className="break-all font-mono text-aura-violet">{LEGACY_USDC_XLAYER}</span>{" "}
                also reports “USDC”. A route is blocked until wallet chain, token contract, balance,
                destination asset, and recipient network are all exact.
              </p>
            </section>
          </StaggerItem>

          <StaggerItem>
            <section className="aura-panel aura-panel-lift p-7">
              <StepHeading n={2} eyebrow={`Convert to ${settles}`} title="Two candidates; neither is silently executable" />
              <div className="mt-5 grid gap-4 border-t aura-hairline pt-5 lg:grid-cols-2">
                <div className="rounded-lg border aura-hairline p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="aura-label">ChangeNOW partner path</p>
                      <p className="mt-2 text-sm font-medium">Not connected</p>
                    </div>
                    <span className="rounded-full border border-aura-violet px-3 py-1 font-mono text-[0.58rem] uppercase tracking-label text-aura-violet">
                      {changeNow.status.replaceAll("-", " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-aura-text/70">
                    ChangeNOW documents a partner API, cross-chain pairs, fixed and standard flows,
                    and a non-custodial service. Aura has no partner agreement or credential in this
                    static build, and X Layer native USDC → {settles} has not been returned by a live
                    currencies/estimate request. The site therefore does not invent a quote or deposit address.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {changeNow.blockers.map((blocker) => (
                      <li key={blocker} className="flex gap-2 text-[0.68rem] leading-relaxed text-aura-text/60">
                        <span className="text-aura-violet">·</span><span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-4 text-[0.62rem] uppercase tracking-label">
                    <a href="https://changenow.io/api" target="_blank" rel="noreferrer" className="text-aura-emerald underline underline-offset-4">Partner API</a>
                    <a href="https://changenow.io/terms-of-use/changenow-api" target="_blank" rel="noreferrer" className="text-aura-text/55 underline underline-offset-4">API terms</a>
                    <a href="https://changenow.io/terms-of-use" target="_blank" rel="noreferrer" className="text-aura-text/55 underline underline-offset-4">User terms</a>
                  </div>
                </div>

                <div className="rounded-lg border aura-hairline p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="aura-label">Meson direct path</p>
                      <p className="mt-2 text-sm font-medium">Legacy token only</p>
                    </div>
                    <span className="rounded-full border border-aura-violet px-3 py-1 font-mono text-[0.58rem] uppercase tracking-label text-aura-violet">
                      Not native USDC
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-aura-text/70">
                    {meson.name} was checked for X Layer → native BTC, but the relayer lists the
                    legacy bridged USDC contract—not the native Circle contract above. Its USDC
                    limit was 20,000 per swap and BTC 0.1 per swap at the evidence date. That is
                    not a safe automatic route for a home purchase and is shown only as a researched alternative.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-[0.62rem] uppercase tracking-label">
                    <a href="https://meson.fi/" target="_blank" rel="noreferrer" className="text-aura-emerald underline underline-offset-4">Open Meson</a>
                    {meson.evidenceUrl ? <a href={meson.evidenceUrl} target="_blank" rel="noreferrer" className="text-aura-text/55 underline underline-offset-4">Evidence record</a> : null}
                  </div>
                </div>
              </div>
              <p className="mt-5 rounded-lg bg-aura-sunken p-4 text-xs leading-relaxed text-aura-text/75">
                The likely partner architecture is native X Layer USDC → a verified outbound CCTP
                destination → a live ChangeNOW pair for {settles}. It does not become a route until
                the partner API confirms the exact contracts, limits, estimate, expiry and deposit
                instructions for that transaction. API credentials must stay server-side; this
                static, account-free app cannot safely contain them.
              </p>
            </section>
          </StaggerItem>

          <StaggerItem>
            <section className="aura-panel aura-panel-lift p-7">
              <StepHeading n={3} eyebrow="Pay the manufacturer" title="Invoice first, address second, test transfer third" />
              <p className="mt-5 border-t aura-hairline pt-5 text-xs leading-relaxed text-aura-text/80">
                Contact {provider.name}, confirm product availability and delivery in writing,
                reconcile the legal seller against the invoice, and verify the {settles} network,
                address and any memo on a second trusted channel. Send a small test amount before
                any milestone. {provider.howToPay}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-aura-text/70">
                Aura is not a party, holds no purchase funds,
                and has no relationship with {provider.name}. Tax, customs, code acceptance,
                warranty, installation and dispute recourse remain buyer due diligence.
              </p>
              <a href={provider.url} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-full bg-aura-ink px-5 py-2.5 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85">
                Contact {provider.name}
              </a>
              <Link href={`/concierge?ask=${encodeURIComponent(guideQuestion)}`} className="ml-4 mt-5 inline-block rounded-full border aura-hairline px-5 py-2.5 font-mono text-[0.65rem] uppercase tracking-label transition-colors hover:border-aura-emerald">
                Walk through with Aura
              </Link>
            </section>
          </StaggerItem>

          <StaggerItem>
            <section className="aura-panel p-7">
              <p className="aura-label mb-2">Optional research · borrowing is not payment magic</p>
              <h3 className="font-display text-[1.05rem] font-medium tracking-[-0.01em]">{borrow.name}</h3>
              <p className="mt-3 text-xs leading-relaxed text-aura-text/75">
                The dataset records an Aave X Layer market, but its source record is incomplete and
                no evidence URL survived. Liquidation, variable-rate, tax and smart-contract risk
                are material. Aura does not recommend or execute this path.
              </p>
            </section>
          </StaggerItem>
        </Stagger>
      ) : (
        <Reveal y={12} className="mt-8">
          <div className="aura-panel p-7">
            <p className="aura-label mb-2">Nothing to route into</p>
            <p className="text-xs leading-relaxed text-aura-text/80">{provider.caveat}</p>
            <p className="mt-4 text-xs leading-relaxed text-aura-text/70">
              Ask which asset, on which network, to which legal seller and invoice. Until the
              destination asset is named and independently confirmed, no conversion route exists.
            </p>
            <a href={provider.url} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-full border aura-hairline px-5 py-2.5 font-mono text-[0.65rem] uppercase tracking-label transition-colors hover:border-aura-emerald">
              Contact {provider.name}
            </a>
          </div>
        </Reveal>
      )}
    </div>
  );
}

"use client";

/* Dated links to external product documentation. This panel explains what
   to verify; it does not recommend a provider or turn an external product
   into an Aura financing promise. Re-check the sources when the date moves. */

import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";

export default function CryptoFinancingPanel() {
  return (
    <div>
      <Reveal y={16}>
        <p className="aura-label mb-4">External research</p>
        <h2 className="font-display text-[1.45rem] font-medium tracking-[-0.015em]">
          External financing research
        </h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-aura-text/75">
          These products sit outside Aura. Check eligibility, permitted use, rates, taxes,
          fees, collateral, liquidation rules, and custody terms before acting.
        </p>
        <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/60">
          Checked August 12, 2026
        </p>
      </Reveal>
      <Stagger className="mt-6 grid gap-6 md:grid-cols-3">
        <StaggerItem className="h-full">
          <article className="aura-panel h-full p-6">
            <h3 className="text-sm font-semibold">Aave V3 on X Layer</h3>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Aave&rsquo;s app exposes an X Layer market. Assets, collateral settings, rates,
              liquidity, and borrowing availability change with live market state. Review the
              market and liquidation rules before considering it.
            </p>
            <a
              href="https://app.aave.com/?marketName=proto_xlayer_v3"
              target="_blank"
              rel="noreferrer"
              data-cursor="Visit"
              className="mt-3 inline-flex min-h-11 items-center text-xs text-aura-emerald underline underline-offset-4"
            >
              Open the Aave X Layer market <span aria-hidden>&nbsp;&#8599;</span>
            </a>
            <p className="mt-2 text-xs uppercase tracking-label text-aura-emerald">
              External &middot; self-custodial
            </p>
          </article>
        </StaggerItem>
        <StaggerItem className="h-full">
          <article className="aura-panel h-full p-6">
            <h3 className="text-sm font-semibold">Ledn</h3>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Ledn documents Bitcoin-backed dollar loans, but availability and permitted purpose
              vary by location. Its eligibility page can restrict residential-property use. Ledn
              holds loan collateral in custody.
            </p>
            <a
              href="https://help.ledn.io/hc/en-us/p/eligibility"
              target="_blank"
              rel="noreferrer"
              data-cursor="Visit"
              className="mt-3 inline-flex min-h-11 items-center text-xs text-aura-emerald underline underline-offset-4"
            >
              Check Ledn eligibility <span aria-hidden>&nbsp;&#8599;</span>
            </a>
            <p className="mt-2 text-xs uppercase tracking-label text-aura-teal">
              External &middot; custodial
            </p>
          </article>
        </StaggerItem>
        <StaggerItem className="h-full">
          <article className="aura-panel h-full p-6">
            <h3 className="text-sm font-semibold">Wealthsimple</h3>
            <p className="mt-2 text-xs leading-relaxed text-aura-text/75">
              Wealthsimple documents fee-free conversions only between USD and USDC in a
              USD-denominated crypto account. CAD trades and other crypto activity can carry
              fees, and CAD-to-USD conversion has a foreign-exchange fee. This is not a
              crypto-backed home loan.
            </p>
            <a
              href="https://help.wealthsimple.com/hc/en-ca/articles/39491215024539-Trading-USD-with-your-Crypto-account"
              target="_blank"
              rel="noreferrer"
              data-cursor="Visit"
              className="mt-3 inline-flex min-h-11 items-center text-xs text-aura-emerald underline underline-offset-4"
            >
              Read Wealthsimple&rsquo;s USD and USDC fee details <span aria-hidden>&nbsp;&#8599;</span>
            </a>
            <p className="mt-2 text-xs uppercase tracking-label text-aura-violet">
              External &middot; account service
            </p>
          </article>
        </StaggerItem>
      </Stagger>
      <Reveal className="mt-4" y={10}>
        <p className="text-xs uppercase tracking-label text-aura-text/65">
          Education only. Aura does not arrange credit, determine suitability, or custody funds.
        </p>
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------------
   BUY — an honest home catalog.

   The other half of Aura is "design and build your own". This half shows
   the finished homes the research record can actually support: model and
   maker, what a price would even mean, where delivery is documented, and
   what still has to be asked. No number ranks a maker, no listing is
   invented, and payment options only exist beside a real written quote.

   Clean and bright on purpose: a browsing reader gets cards, filters and
   compare; the careful reader opens "Details and sources" and finds every
   date, link, caveat and unresolved question the researcher recorded.
--------------------------------------------------------------------- */

import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal } from "@/components/Reveal";
import HomeCatalog from "@/components/buy/HomeCatalog";
import LegacyResearch from "@/components/buy/LegacyResearch";

export const metadata = {
  title: "Choose a finished eco home — Aura Homes",
  description:
    "A catalog of finished home models mapped honestly from dated research: model and maker, price state, delivery regions, and sources. Aura facilitates; it does not sell.",
};

export default function BuyPage() {
  return (
    <div className="py-16">
      <Reveal y={10}>
        <p className="aura-label mb-4">The other path · choose, don&rsquo;t start from scratch</p>
      </Reveal>
      <RevealWords
        text="Choose a finished eco home"
        className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
      />
      <Reveal delay={0.08} y={12} className="mt-4">
        <p className="max-w-2xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          Every home below is a real model from a real maker, mapped from dated research — never
          dressed up beyond what the evidence says. Where the record has no price, the card says
          so and offers a quote request instead. Where delivery is unconfirmed, the card says ask
          the maker.
        </p>
      </Reveal>
      <Reveal delay={0.12} y={12} className="mt-4">
        <p className="max-w-2xl text-xs leading-relaxed text-aura-dim">
          Aura facilitates. It does not sell homes, broker them, or hold funds, and it has no
          relationship with any maker named here — every claim links to its dated source.
        </p>
      </Reveal>

      <HomeCatalog />

      <LegacyResearch />

      {/* THE BOUNDARY — said in full once, above the footer, where a reader
          who got this far is deciding whether to contact a maker. */}
      <Reveal y={14} className="mt-24">
        <div className="aura-panel p-7">
          <p className="aura-label mb-2">Before you contact a maker</p>
          <p className="max-w-3xl text-sm leading-relaxed text-aura-text/80">
            Aura is not a party to any purchase you make and carries no liability for it. Makers
            appear because a public claim or launch record supports them — that is the entire
            basis for inclusion, not a vetted-seller designation. Verify each claim at its source
            link before you act on it, and treat any payment instruction that arrives over email
            or chat as unverified until you have confirmed it by voice.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-aura-text/80">
            Payment today means the maker&rsquo;s own paperwork — cash or card on a written quote.
            Paying with X Layer USDC is a future path: no maker in this record accepts it
            directly, and Aura will show the two options side by side, with nothing hidden and
            nothing preselected, wherever a real quote makes them meaningful.
          </p>
          <p className="mt-4 text-[0.68rem] uppercase leading-relaxed tracking-label text-aura-faint">
            Not legal, financial, tax, or engineering advice · Research dated Aug 10, 2026
          </p>
        </div>
      </Reveal>

      <Reveal y={12} className="mt-12">
        <p className="max-w-2xl text-sm leading-relaxed text-aura-text/70">
          Buying is one of two paths. The other is building your own — priced line by line in the{" "}
          <Link
            href="/budget"
            data-cursor="Open"
            className="text-aura-emerald underline underline-offset-4"
          >
            Alberta cost model
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}

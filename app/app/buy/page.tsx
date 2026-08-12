/* ---------------------------------------------------------------------
   BUY — the second path.

   Aura's other half is "design and build your own". This is the half that
   says: you already hold crypto, somebody out there already sells homes
   for it, here is who they actually are and here is the route from USDC
   on X Layer to their hands.

   Every provider on this page was fetched, not searched. Every one of
   them carries the caveat that came back with it — including the one
   whose acceptance page is twelve years old, the one whose only working
   payment path is a $45 hoodie, and the one that has never named a coin.
   Aura facilitates; it is not the seller, and it has no relationship with
   any company named here.
--------------------------------------------------------------------- */

import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { GrowBar, Reveal } from "@/components/Reveal";
import BuyDirectory from "@/components/buy/BuyDirectory";

export const metadata = {
  title: "Choose a finished eco home — Aura Homes",
  description:
    "Compare evidence-backed eco-home makers, delivery regions, quote readiness and cash or crypto payment paths. Aura facilitates; it does not sell.",
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
          Compare what a maker offers, where it delivers, how current the evidence is, what still
          needs a quote, and whether payment can happen in cash or through an optional crypto path.
          This pilot is an evidence record, not a storefront: stale claims stay labelled, regional
          gaps stay visible, and refuted leads remain in the record.
        </p>
      </Reveal>

      {/* THE BOUNDARY — stated here, where the action is, not in the footer.
          The site already carries this line at the bottom of every page; on
          the one page that sends money somewhere it gets said again, first,
          and in full. */}
      <Reveal delay={0.12} y={14} className="mt-8">
        {/* No border-* utility here on purpose: globals.css re-declares
            .aura-panel's border-color after the utilities layer, so it would
            be dead code. The emerald rule below carries the emphasis. */}
        <div className="aura-panel p-7">
          <p className="aura-label mb-2">Read this before anything else</p>
          <div className="mb-4 h-0.5 w-16">
            <GrowBar pct={100} className="h-full bg-aura-emerald" />
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-aura-text/80">
            Aura facilitates. It does not sell homes, does not broker them, holds no custody of
            your funds at any point on this page, is not a party to any purchase you make, and
            carries no liability for it. It has{" "}
            <span className="font-medium text-aura-text">no relationship</span> — commercial,
            referral, or otherwise — with any company named here. They are listed because they are
            supported by a public acceptance claim or launch record. That is the entire basis for
            inclusion; it is not a vetted-seller designation.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-aura-text/80">
            Nothing on this page executes a transfer, quotes a rate, or takes a fee. Every leg of
            every route is something you do yourself, in your own wallet, with your own eyes on the
            address. Verify each claim at the source link on the card before you move any money —
            and treat a wallet address that arrives over email or chat as unverified until you have
            confirmed it by voice.
          </p>
          <p className="mt-4 text-[0.68rem] uppercase leading-relaxed tracking-label text-aura-text/55">
            Not legal, financial, tax, or engineering advice · Evidence dated Aug 10, 2026
          </p>
        </div>
      </Reveal>

      <BuyDirectory />

      <Reveal y={12} className="mt-20">
        <p className="max-w-2xl text-sm leading-relaxed text-aura-text/70">
          Buying is one of two paths. The other is building your own — priced line by line in the{" "}
          <Link
            href="/budget"
            data-cursor="Open"
            className="text-aura-emerald underline underline-offset-4"
          >
            Alberta cost model
          </Link>
          , funded through the{" "}
          <Link
            href="/escrow"
            data-cursor="Open"
            className="text-aura-emerald underline underline-offset-4"
          >
            milestone escrow
          </Link>
          , which is the only place on this site where Aura&rsquo;s own contract holds anything.
        </p>
      </Reveal>
    </div>
  );
}

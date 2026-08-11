/* ---------------------------------------------------------------------
   BUY — the second path.

   Aura's other half is "design and build your own". This is the half that
   says: you already hold crypto, somebody out there already sells homes
   for it, here is who they actually are and here is the route from USDC
   on X Layer to their hands.

   Every provider on this page was fetched, not searched. Every one of
   them carries the caveat that came back with it, including the two that
   are barely usable and the one whose acceptance page is twelve years
   old. Aura facilitates; it is not the seller, and it has no relationship
   with any company named here.
--------------------------------------------------------------------- */

import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { GrowBar, Reveal } from "@/components/Reveal";
import BuyDirectory from "@/components/buy/BuyDirectory";

export const metadata = {
  title: "Buy an eco home with crypto — Aura Homes",
  description:
    "Seven verified providers that accept crypto for homes, thirteen refuted leads, and the hop-by-hop route from USDC on X Layer to what they actually take. Aura facilitates; it does not sell.",
};

export default function BuyPage() {
  return (
    <div className="py-16">
      <Reveal y={10}>
        <p className="aura-label mb-4">The other path — buy, don&rsquo;t build</p>
      </Reveal>
      <RevealWords
        text="Buy an eco home with crypto"
        className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
      />
      <Reveal delay={0.08} y={12} className="mt-4">
        <p className="max-w-2xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          You hold crypto. Somewhere out there a company will take it for a building. This page is
          the list of the ones that verifiably do — with what each of them actually accepts, how
          the payment really happens, whether a Canadian can use them at all, and the route from
          USDC on X Layer to their hands. Also the thirteen leads that looked right and were not,
          because a directory that only publishes its wins is an advertisement.
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
            publicly documented as accepting crypto. That is the entire basis for their inclusion.
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

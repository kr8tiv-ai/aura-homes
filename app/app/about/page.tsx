import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal } from "@/components/Reveal";
import SocialShareLinks from "@/components/SocialShareLinks";

/* ABOUT — the approved global nav carries an About entry; this page gives it
   an honest destination. Short on purpose: who makes Aura, what it is, how
   the plan is labelled, and where the whole truth lives (the open repo). */

export const metadata = {
  title: "About — Aura Homes",
  description:
    "Aura Homes is an open-source (MIT) eco-home project workspace by KR8TIV AI — built in the open, with every plan labelled Today, Next, or Future.",
};

const REPO = "https://github.com/kr8tiv-ai/aura-homes";

export default function AboutPage() {
  return (
    <div className="py-24">
      <p className="aura-label mb-6">About</p>
      <RevealWords
        as="h1"
        text="Built in the open, labelled honestly."
        className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em] md:text-5xl"
      />
      <Reveal className="mt-6" delay={0.1} y={12}>
        <p className="max-w-2xl text-lg leading-relaxed text-aura-text/75">
          Aura Homes is a KR8TIV AI product: a workspace for planning an eco home — the design, the
          land, the costs, the team, the quotes, and the record — that runs in your browser and
          belongs to you. It is open source under the MIT licence from the first commit, and the
          repository publishes the whole truth, including what does not work yet.
        </p>
      </Reveal>

      <Reveal className="mt-12" y={12}>
        <div className="aura-panel max-w-2xl p-8">
          <p className="aura-label">How the plan is labelled</p>
          <p className="mt-3 text-sm leading-relaxed text-aura-text/75">
            Every capability on this site carries one of three words.{" "}
            {/* "on testnet where noted" was the whole chain story here, and it
                stopped being the whole story on August 13: $HOMES is live on X
                Layer MAINNET 196, while Aura's own escrow and registry are the
                things that stay on testnet under the recorded hold. On the page
                whose entire subject is that nothing is mislabelled, omitting
                the live half is its own kind of mislabelling. */}
            <span className="font-medium text-aura-emerald">Today</span>: working now — with the
            $HOMES token live on X Layer mainnet 196, and Aura&rsquo;s own contracts on testnet
            where noted. <span className="font-medium text-aura-teal">Next</span>: planned and
            being designed. <span className="font-medium text-aura-violet">Future</span>: a later
            idea that may change. Nothing labelled Next or Future is live, and no page is allowed
            to imply otherwise.
          </p>
        </div>
      </Reveal>

      <Reveal className="mt-8" y={12}>
        <div className="rounded-xl border border-aura-teal max-w-2xl p-8">
          <p className="aura-label text-aura-teal">The boundary</p>
          <p className="mt-3 text-sm leading-relaxed text-aura-text/75">
            Aura Homes facilitates. It does not sell homes, hold your funds, act as a party to any
            purchase or build contract, or provide legal, financial, or engineering advice. Designs
            are review-ready concepts, not permit sets — a licensed professional completes those.
          </p>
        </div>
      </Reveal>

      <Reveal y={10}>
        <p className="mt-12 text-sm text-aura-text/75">
          The full plan, line by line with statuses, lives in the open at{" "}
          <a
            href={`${REPO}/blob/main/docs/ROADMAP.md`}
            target="_blank"
            rel="noreferrer"
            data-cursor="Read"
            className="text-aura-emerald underline underline-offset-4"
          >
            docs/ROADMAP.md
          </a>
          {" "}— and the code at{" "}
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            data-cursor="Open"
            className="text-aura-emerald underline underline-offset-4"
          >
            github.com/kr8tiv-ai/aura-homes
          </a>
          . New here? Start with{" "}
          <Link href="/how-it-works" className="text-aura-emerald underline underline-offset-4" data-cursor="Read">
            how it works
          </Link>
          .
        </p>
      </Reveal>

      <Reveal className="mt-8" y={10}>
        <SocialShareLinks compact />
      </Reveal>
    </div>
  );
}

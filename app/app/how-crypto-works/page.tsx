import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, GrowBar } from "@/components/Reveal";

/* HOW CRYPTO WORKS — progressive plain-language explanations, in the approved
   order: wallets, USDC, gas, X Layer and OKX, public receipts and document
   hashes, what hashes do NOT prove, then the plans — HOMES, the property
   trust, the stay network, the launchpad — each carrying a Today / Next /
   Future label so nothing reads as live that is not. The FAQ keeps the crypto
   NUMBERS (fee splits, supply, payout design) as its own questions; this page
   links there instead of duplicating them. */

export const metadata = {
  title: "How crypto works — Aura Homes",
  description:
    "Wallets, USDC, gas, X Layer, public receipts and document hashes — and the planned HOMES ledger, property trust, stay network, and launchpad, each labelled Today, Next, or Future.",
};

type Status = { word: "Today" | "Next" | "Future"; tone: string; note: string };

const TODAY: Status = { word: "Today", tone: "border-aura-emerald text-aura-emerald", note: "working now" };
const NEXT: Status = { word: "Next", tone: "border-aura-teal text-aura-teal", note: "planned, being designed" };
const FUTURE: Status = { word: "Future", tone: "border-aura-violet text-aura-violet", note: "a later idea that may change" };

function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[0.62rem] uppercase tracking-label ${status.tone}`}
    >
      {status.word} &middot; {status.note}
    </span>
  );
}

const sections: Array<{
  n: string;
  name: string;
  status: Status | null;
  paras: string[];
  link?: { href: string; label: string; external?: boolean };
}> = [
  {
    n: "01",
    name: "Wallets",
    status: null,
    paras: [
      "A wallet is a pair of keys, not a place. The public half is an address — like a mailbox number you can safely give anyone. The private half is the only key that opens it; whoever holds the private key controls everything at that address, and there is no password reset.",
      "You do not need a wallet for Aura's normal tools. Designing a home, checking land fit, costing a build, and comparing quotes are ordinary web features. A wallet only matters if you choose to look at the on-chain side.",
    ],
  },
  {
    n: "02",
    name: "USDC",
    status: null,
    paras: [
      "USDC is a stablecoin: a token built to hold the value of one US dollar, issued by Circle and redeemable one-for-one. Where most crypto prices swing, a stablecoin is designed not to.",
      "That stability is the entire reason Aura plans around USDC. A build budget cannot ride a coin that moves ten percent in a weekend — money set aside for a foundation has to still be foundation money when the crew arrives.",
    ],
  },
  {
    n: "03",
    name: "Gas",
    status: null,
    paras: [
      "Every blockchain transaction pays a small fee, called gas, to the computers that process it. Gas is paid in the network's own coin — on X Layer that coin is OKB — and on a modern Layer 2 network it usually amounts to cents.",
      "Gas is why an address needs a sliver of the native coin even when everything it sends is USDC. Think of it as postage: separate from the contents of the envelope.",
    ],
  },
  {
    n: "04",
    name: "X Layer and OKX",
    status: null,
    paras: [
      "X Layer is an EVM-compatible Layer 2 blockchain in the OKX ecosystem — a network that settles transactions quickly and cheaply while inheriting security from Ethereum-style tooling. OKX is the exchange and developer ecosystem behind it.",
      "Aura's contract work runs on the X Layer testnet today: a rehearsal network whose tokens have no monetary value. Nothing Aura has deployed touches real money, and participation in the OKX developer program is not an OKX endorsement.",
    ],
    link: { href: "/faq#x-layer", label: "The FAQ's X Layer and OKX questions" },
  },
  {
    n: "05",
    name: "Public receipts and document hashes",
    status: TODAY,
    paras: [
      "A hash is a fingerprint of a file: feed a document through a standard formula and out comes a short string that changes completely if even one character of the document changes. Publish that fingerprint on a public chain and anyone, forever, can check that the copy in their hands matches the one that existed at that moment.",
      "This is the mechanism Aura demonstrates on testnet: project milestones and document fingerprints written where no one — including Aura — can quietly rewrite them. The lab page reads a live testnet contract and shows exactly what such receipts look like.",
    ],
    link: { href: "/labs/xlayer-proof", label: "See the proof-of-lifecycle lab (testnet)" },
  },
  {
    n: "06",
    name: "What hashes do not prove",
    status: null,
    paras: [
      "A hash proves one thing only: this exact file existed by that moment and has not changed since. It does not prove the file tells the truth. It does not prove work was done, or done well. It does not prove money moved, that a person consented, or even who wrote the document.",
      "A fraudulent invoice hashes just as cleanly as an honest one. Chain receipts stop silent edits and backdating — they do not replace inspections, contracts, professional review, or your own judgment. Any product that implies otherwise is overselling, and this one tries hard not to.",
    ],
  },
  {
    n: "07",
    name: "HOMES",
    status: NEXT,
    paras: [
      "HOMES is a planned X Layer token and public property ledger. The proposed model routes a share of recognized platform fees toward a first eco-property, with every balance and rule published on-chain.",
      "Today: no HOMES contract, sale, listing, fund balance, staking position, or payout exists. The ledger page shows verified zeroes instead of preview revenue, and the FAQ holds the proposed numbers — fee splits, supply, payout design — as separate questions rather than promises.",
    ],
    link: { href: "/faq#homes-token", label: "The FAQ's HOMES questions" },
  },
  {
    n: "08",
    name: "The property trust",
    status: NEXT,
    paras: [
      "The planned structure separates legal ownership from the public ledger: a properly formed trust or holding entity would hold each property's registered title in its own jurisdiction, while the on-chain side publishes the community economics — fees, reserves, approved actions, distributions.",
      "Today: the legal vehicle is not formed and Aura owns no property. Until formation and title documents can be evidenced, every screen that mentions the trust says so.",
    ],
  },
  {
    n: "09",
    name: "The user-owned stay network",
    status: FUTURE,
    paras: [
      "The future idea: an open network of eco-home stays where owners list, guests book without needing to learn crypto, and the operating evidence — bookings, cleaning, maintenance, reserves — settles transparently.",
      "First one real home has to work end to end, publicly. Aura will not call the network user-owned or decentralized while one team still controls every property and decision — that label has to be earned by the structure, not the pitch.",
    ],
  },
  {
    n: "10",
    name: "The RWA eco-stay launchpad",
    status: FUTURE,
    paras: [
      "The later idea: helping an independent sponsor prepare an eco home or unique stay as a transparent project — the land case, the plans, the team, the budget, the operating model, and the on-chain evidence room.",
      "No project would become a live raise without its own legal structure, disclosures, eligibility rules, custody path, risk review, and explicit human confirmations. Aura would not publish a campaign, hold funds, or execute anything in the background. Nothing about the launchpad exists today.",
    ],
    link: { href: "/homes#launchpad-heading", label: "The planned launchpad architecture" },
  },
];

export default function HowCryptoWorksPage() {
  return (
    <div className="py-24">
      <p className="aura-label mb-6">How crypto works</p>
      <RevealWords
        as="h1"
        text="The crypto side, one plain idea at a time."
        className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em] md:text-5xl"
      />
      <Reveal className="mt-6" delay={0.1} y={12}>
        <p className="max-w-2xl text-lg leading-relaxed text-aura-text/75">
          You do not need any of this to use Aura — the design, land, cost and team tools are
          ordinary web tools. This page explains the ideas Aura builds toward, in order, each in
          plain language. Where a claim is about Aura's own plans, it carries an honest label:{" "}
          <span className="font-medium text-aura-emerald">Today</span> means working now (on
          testnet where noted), <span className="font-medium text-aura-teal">Next</span> means
          planned and being designed, and{" "}
          <span className="font-medium text-aura-violet">Future</span> means a later idea that may
          change. Nothing labelled Next or Future is live.
        </p>
      </Reveal>

      <div className="mt-16">
        <Reveal y={10}>
          <p className="aura-label">From first principles</p>
          <div className="mt-3 h-px w-28 overflow-hidden rounded-full bg-aura-ink/10">
            <GrowBar pct={100} className="h-full bg-aura-emerald-bright" />
          </div>
        </Reveal>
        <Stagger className="mt-8 space-y-6">
          {sections.map((section) => (
            <StaggerItem key={section.n}>
              <section aria-labelledby={`crypto-${section.n}`} className="aura-panel p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-baseline gap-4">
                    <p className="font-mono text-xs text-aura-violet">{section.n}</p>
                    <h2 id={`crypto-${section.n}`} className="text-lg font-semibold">
                      {section.name}
                    </h2>
                  </div>
                  {section.status ? <StatusChip status={section.status} /> : null}
                </div>
                {section.paras.map((para) => (
                  <p key={para.slice(0, 32)} className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
                    {para}
                  </p>
                ))}
                {section.link ? (
                  <p className="mt-4">
                    <Link
                      href={section.link.href}
                      data-cursor="Open"
                      className="inline-flex min-h-11 items-center text-sm text-aura-emerald underline underline-offset-4"
                    >
                      {section.link.label} <span aria-hidden>&nbsp;&rarr;</span>
                    </Link>
                  </p>
                ) : null}
              </section>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <Reveal y={10}>
        <p className="mt-14 max-w-2xl text-sm text-aura-text/75">
          The numbers behind the plans — proposed fee splits, token supply, payout design — live as
          their own questions in{" "}
          <Link href="/faq" className="text-aura-emerald underline underline-offset-4" data-cursor="Read">
            the FAQ
          </Link>
          , kept separate from the product questions so neither pretends to be the other. For the
          practical side of a project, read{" "}
          <Link href="/how-it-works" className="text-aura-emerald underline underline-offset-4" data-cursor="Read">
            how it works
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}

import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { HOMES_EXPLORER_URL, HOMES_TOKEN_ADDRESS } from "@/lib/homes/token";

/* THE ROADMAP — one page, three arcs, one rule: nothing unbuilt is written in
   the present tense. The long-form record lives in docs/ROADMAP.md in the
   open repo; this page is the defined, readable version the story's end
   sheets point at (the founder's "everything is kind of scattered" fix).
   Labels reuse the Today/Next/Future vocabulary the crypto journey already
   taught. */

export const metadata = {
  title: "Roadmap — Aura Homes",
  description:
    "What runs today, what comes next, and the HOMES future — the three arcs of Aura Homes, honestly labelled. Nothing unbuilt is written in the present tense.",
};

const OKLINK = "https://www.oklink.com/x-layer-testnet/address";
const ESCROW = "0x4A777bf71d8809244c77A3c2b39ef68793A463b5";
const REGISTRY = "0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e";

const ARCS: Array<{
  n: string;
  chip: string;
  chipTone: string;
  title: string;
  lead: string;
  items: Array<{ text: string; href?: string; label?: string; external?: boolean }>;
}> = [
  {
    n: "01",
    chip: "Now",
    chipTone: "border-aura-emerald text-aura-emerald",
    title: "The project workspace",
    lead:
      "What runs today, on the open MIT repo, with the tests that prove it.",
    items: [
      { text: "A guided and pro editor over one durable project document — 3D, 2D plan, drawings, exports — with a 25-plan library whose every plan names its source and licence.", href: "/build", label: "Open the builder" },
      { text: "A demonstration land-fit pilot that evaluates sourced example rules and explains why a sample parcel may not fit. It is not a live listing or permit decision.", href: "/land", label: "Try the land-fit pilot" },
      { text: "An Alberta budget that reconciles to a published cost model to the dollar, with a DIY-or-hire toggle per line.", href: "/budget", label: "See the budget" },
      { text: "Contractor and manufacturer evidence workbenches for demonstration or user-supplied records, with source dates, visible expiries, and missing evidence shown.", href: "/contractors", label: "Check a team" },
      { text: `Experimental transaction-mechanics contracts are deployed on X Layer testnet 1952 — escrow ${ESCROW.slice(0, 6)}… and registry ${REGISTRY.slice(0, 6)}… — with zero milestones and zero home records. The lab proves transaction execution, not lifecycle facts.`, href: `${OKLINK}/${ESCROW}`, label: "Contract on OKLink", external: true },
      { text: `The HOMES token is live on X Layer mainnet 196 — launched on the XLaunch venue at ${HOMES_TOKEN_ADDRESS.slice(0, 6)}…, a micro-cap experiment with the buy path and every risk label on the ledger page.`, href: HOMES_EXPLORER_URL, label: "Token on the explorer", external: true },
    ],
  },
  {
    n: "02",
    chip: "Next",
    chipTone: "border-aura-teal text-aura-teal",
    title: "The locality hub",
    lead:
      "Planned and being designed: a giant hub with bridges across — rolled out locality by locality, Alberta first.",
    items: [
      { text: "Real listings with permissioned photos and full provenance — makers first, open land data beside them." },
      { text: "A regional cost basis beyond Alberta: public price indexes per region, every figure labelled with its source and date, never presented as a quote." },
      { text: "An evidence-backed, checkable contractor bench per trade, built from permitted public sources and partner records rather than scraped ratings." },
      { text: "Plot-of-land import: your parcel's setbacks, slope and services inside the editor, and a real site plan on sheet A1." },
      { text: "The internal concierge grows into a guide that reads your actual project and proposes next steps you confirm — it never acts alone." },
    ],
  },
  {
    n: "03",
    chip: "Future",
    chipTone: "border-aura-violet text-aura-violet",
    title: "The HOMES ecosystem",
    lead:
      "Published in full and honestly labelled: the HOMES token itself is live and listed under Now above; everything below is planned, and nothing here is an offer.",
    items: [
      { text: "A planned property-holding and governance model for real eco homes. The legal vehicle, participant rights, and fee rules still need jurisdiction-specific design." },
      { text: "A user-owned network of eco stays — the long-term story: an Airbnb its guests and hosts own." },
      { text: "An RWA launchpad where owners fund their own eco-stay projects, with receipts public by construction." },
      { text: "Every claim carries its label on the ledger page — zeros rendered honestly until something is real.", href: "/homes", label: "Read the HOMES ledger" },
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="py-10 sm:py-14">
      <header className="border-b aura-hairline pb-8">
        <Reveal y={8}>
          <p className="aura-label mb-3">Roadmap</p>
        </Reveal>
        <RevealWords
          text="Three arcs, honestly labelled."
          className="max-w-3xl font-display text-[clamp(2rem,4.5vw,3.6rem)] font-medium leading-[0.98] tracking-[-0.045em]"
        />
        <Reveal delay={0.08} y={10}>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-aura-text/72">
            The standing rule of this page: nothing unbuilt is written in the present tense.
            What runs is linked so you can use it; what is planned says planned; what is a
            later idea says so. The long-form version, with dates and evidence, lives in the
            open repo.
          </p>
        </Reveal>
      </header>

      <Stagger className="mt-10 space-y-10">
        {ARCS.map((arc) => (
          <StaggerItem key={arc.n}>
            <section aria-labelledby={`arc-${arc.n}`} className="grid gap-5 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,1fr)]">
              <div>
                <p aria-hidden className="font-mono text-[0.62rem] uppercase tracking-label text-aura-text/70">{arc.n}</p>
                <span className={`mt-2 inline-block rounded-full border px-3 py-1 font-mono text-[0.62rem] uppercase tracking-label ${arc.chipTone}`}>
                  {arc.chip}
                </span>
                <h2 id={`arc-${arc.n}`} className="mt-3 font-display text-[1.6rem] font-medium tracking-[-0.02em]">
                  {arc.title}
                </h2>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-aura-text/65">{arc.lead}</p>
              </div>
              <ul className="space-y-3">
                {arc.items.map((item) => (
                  <li key={item.text} className="rounded-xl border aura-hairline p-4">
                    <p className="text-sm leading-relaxed text-aura-text/85">{item.text}</p>
                    {item.href ? (
                      item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center text-xs text-aura-emerald underline underline-offset-4"
                        >
                          {item.label} <span aria-hidden>&nbsp;&#8599;</span>
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="mt-2 inline-flex min-h-11 items-center text-xs text-aura-emerald underline underline-offset-4"
                        >
                          {item.label} <span aria-hidden>&nbsp;&rarr;</span>
                        </Link>
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal y={10}>
        <p className="mt-14 max-w-2xl text-sm text-aura-text/75">
          The dated, evidence-linked version is{" "}
          <a
            href="https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/ROADMAP.md"
            target="_blank"
            rel="noreferrer"
            className="text-aura-emerald underline underline-offset-4"
          >
            docs/ROADMAP.md in the open repo
          </a>
          . For what the crypto side means in plain words, read{" "}
          <Link href="/how-crypto-works" className="text-aura-emerald underline underline-offset-4">
            how crypto works
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}

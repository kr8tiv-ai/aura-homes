import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, GrowBar } from "@/components/Reveal";

/* HOW IT WORKS — the practical lifecycle in plain language, for someone who
   has never planned a build and never touched crypto. Six stages, one
   boundary. Crypto is deliberately absent here; it has its own explainer at
   /how-crypto-works and stays an undertone on this side of the site. */

export const metadata = {
  title: "How it works — Aura Homes",
  description:
    "The practical lifecycle of an Aura project in plain language: design, land, costs, team, quotes, and handoff — with the boundary stated honestly.",
};

const stages = [
  {
    n: "01",
    name: "Design",
    body: "Answer plain questions about the home you want, or open the full editor and shape it yourself. Aura draws dimensioned, review-ready design intent with deterministic geometry checks. Those checks catch conflicts in the model; they are not building-code or permit checks. The package is stamped NOT FOR CONSTRUCTION because a licensed professional must review and complete it.",
    link: { href: "/build", label: "Design a home" },
  },
  {
    n: "02",
    name: "Land",
    body: "In today’s land fit pilot, compare that design with clearly labelled demonstration or user-supplied parcel facts — setbacks, orientation, slope and height. A fit score is a screening result that tells you what to check next; it is never a live listing, permit opinion or reason to buy.",
    link: { href: "/land", label: "Open the land fit pilot" },
  },
  {
    n: "03",
    name: "Costs",
    body: "See LOW, MID and HIGH cost ranges computed line by line from an open Alberta cost model — so the budget conversation starts honest instead of optimistic, and you can trace every number to its source.",
    link: { href: "/budget", label: "See the cost workspace" },
  },
  {
    n: "04",
    name: "Team",
    body: "Record the checks you perform for a contractor — registry, WCB, insurance, licence and project history — and keep supporting evidence with the project. Aura does not perform those checks for you or mark anyone as vetted; it shows what you recorded and, just as loudly, what is missing.",
    link: { href: "/contractors", label: "Check a contractor" },
  },
  {
    n: "05",
    name: "Quotes",
    body: "Send the same written scope to every bidder and compare the answers line by line. Quotes reconciled against one scope differ on price and approach — not on what was secretly left out.",
    link: { href: "/budget", label: "Compare quotes" },
  },
  {
    n: "06",
    name: "Handoff",
    body: "When you are ready to build, your drawings, decisions and records hand off to the licensed professionals who complete permits and construction. You own the project and every document in it — Aura keeps the record straight, not the hammer.",
    link: { href: "/projects", label: "Open my projects" },
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="py-24">
      <p className="aura-label mb-6">How it works</p>
      <RevealWords
        as="h1"
        text="One project, six honest stages."
        className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em] md:text-5xl"
      />
      <Reveal className="mt-6" delay={0.1} y={12}>
        <p className="max-w-2xl text-lg leading-relaxed text-aura-text/75">
          Aura Homes is a workspace that keeps an eco-home project together — the design, the land
          question, the costs, the team, the quotes, and the record of every decision. No account is
          needed to start, nothing here requires crypto, and every stage says plainly what it can
          and cannot do.
        </p>
      </Reveal>

      {/* ---- the lifecycle ---- */}
      <div className="mt-20">
        <Reveal y={10}>
          <p className="aura-label">The lifecycle</p>
          <div className="mt-3 h-px w-28 overflow-hidden rounded-full bg-aura-ink/10">
            <GrowBar pct={100} className="h-full bg-aura-emerald-bright" />
          </div>
        </Reveal>
        <Stagger className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => (
            <StaggerItem key={stage.n} className="h-full">
              <article className="aura-panel aura-panel-lift h-full p-8">
                <p className="font-mono text-xs text-aura-violet">{stage.n}</p>
                <h2 className="mt-4 text-lg font-semibold">{stage.name}</h2>
                <p className="mt-3 text-sm leading-relaxed text-aura-text/75">{stage.body}</p>
                <p className="mt-4">
                  <Link
                    href={stage.link.href}
                    data-cursor="Open"
                    className="inline-flex min-h-11 items-center text-sm text-aura-emerald underline underline-offset-4"
                  >
                    {stage.link.label} <span aria-hidden>&nbsp;&rarr;</span>
                  </Link>
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      {/* ---- the boundary, stated where the promise is made ---- */}
      <Reveal className="mt-16" y={12}>
        <section aria-labelledby="boundary-heading" className="rounded-xl border border-aura-teal p-8">
          <p className="aura-label text-aura-teal">The boundary</p>
          <h2 id="boundary-heading" className="mt-3 text-lg font-semibold">
            Aura facilitates. It is not a party to your project.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
            Aura Homes does not sell homes, hold your funds, act as a party to any purchase or build
            contract, or provide legal, financial, or engineering advice. Drawings are review-ready
            concepts, not permit sets — a licensed professional completes those. You own your
            project and the decisions in it.
          </p>
        </section>
      </Reveal>

      <Reveal y={10}>
        <p className="mt-14 text-sm text-aura-text/75">
          Wondering about the crypto side — wallets, USDC, the HOMES plans?{" "}
          <Link href="/how-crypto-works" className="text-aura-emerald underline underline-offset-4" data-cursor="Read">
            How crypto works
          </Link>{" "}
          explains it in the same plain language. For everything else, read{" "}
          <Link href="/faq" className="text-aura-emerald underline underline-offset-4" data-cursor="Read">
            the FAQ
          </Link>{" "}
          or{" "}
          <Link href="/" className="text-aura-emerald underline underline-offset-4" data-cursor="Watch">
            watch the scroll tour
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}

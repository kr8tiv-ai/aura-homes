import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, GrowBar, Counter } from "@/components/Reveal";

// The site tells the same rollout story as docs/ROADMAP.md — three arcs,
// honest labels on every one. If the roadmap changes, this page changes.
const arcs = [
  {
    n: "01",
    status: "In build",
    name: "The hackathon MVP",
    line: "Start with a brief, shape the home, match land, assemble the team, reconcile quotes, and prepare an optional X Layer testnet action.",
    detail:
      "The browser-first project and builder work locally without an account. Live data partners, contractor evidence, RFQs, quote reconciliation, and public-chain deployment remain staged work and are labelled where they appear.",
  },
  {
    n: "02",
    status: "Next",
    name: "The Locality Hub",
    line: "A giant hub with bridges across — rolled out locality by locality, Alberta counties first.",
    detail:
      "Design your own eco home (SIP sandwich panels, solar), source every material and contractor locally, and choose buy-versus-build. A vendor directory purchasable in USDC, with bridge-in guidance where vendors take CAD. Pay contractors, manage inventory, track the build, and discover the latest building technology — one hub per locality.",
  },
  {
    n: "03",
    status: "Later",
    name: "The RWA launchpad",
    line: "Help future owners prepare an eco home or unique stay, the land case, the plans, the operating model, and a transparent project-fund proposal.",
    detail:
      "HOMES would first prove one property end to end. A later launchpad could let independent sponsors assemble evidence and prepare their own project campaigns, but no project becomes a live raise without its own legal structure, disclosures, eligibility rules, custody path, risk review, and human confirmations.",
  },
] as const;

const pipeline = [
  { step: "01", name: "Brief", detail: "Household, location, budget, accessibility, utilities, timing, and land status" },
  { step: "02", name: "Design", detail: "Guided and Pro tools shape one portable design-intent document" },
  { step: "03", name: "Land", detail: "Sourced parcel evidence compared against the home and project requirements" },
  { step: "04", name: "Team", detail: "Evidence case files, comparable scopes, RFQs, and reconciled quotes" },
  { step: "05", name: "Handoff", detail: "Milestones, proof, optional testnet funding, commissioning, and home book" },
] as const;

export const metadata = {
  title: "Overview — Aura Homes",
  description:
    "Aura Homes now, next, and later: a private eco-home project workspace, locality marketplace, and planned RWA launchpad.",
};

export default function OverviewPage() {
  return (
    <div className="py-24">
      {/* The first screen is deliberately NOT faded in: label, headline and
          lede render at full opacity so the page is readable the instant it
          paints. Only the call-to-action row arrives, and it arrives fast. */}
      <p className="aura-label mb-6">One project, end to end</p>
      <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
        Design the home. <span className="text-aura-emerald">Find the land.</span> Build it for real.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-aura-text/70">
        A local-first workspace for moving an eco home from first brief to verified handoff.
      </p>

      <Stagger className="mt-10 flex gap-4">
        {/* the wrapper is the flex child now, so it carries `flex` and the
            link carries `inline-flex` — that keeps the two buttons the same
            height, which stretch used to do for free */}
        <StaggerItem y={8} className="flex">
          <Link
            href="/start"
            data-cursor="Design"
            className="inline-flex items-center rounded-full bg-aura-ink px-6 py-3 font-mono text-sm font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
          >
            Start a project
          </Link>
        </StaggerItem>
        <StaggerItem y={8} className="flex">
          <Link
            href="/escrow"
            data-cursor="Open"
            className="inline-flex items-center rounded-md border aura-hairline px-6 py-3 text-sm font-medium uppercase tracking-label transition-colors hover:border-aura-teal"
          >
            View escrow
          </Link>
        </StaggerItem>
      </Stagger>

      {/* ---- the rollout: the same arcs as docs/ROADMAP.md ---- */}
      <div className="mt-28">
        <Reveal y={10}>
          <p className="aura-label">The rollout</p>
          {/* the section rule draws itself: track on the ink ladder so it
              flips with the theme, fill on the emerald MARK step */}
          <div className="mt-3 h-px w-28 overflow-hidden rounded-full bg-aura-ink/10">
            <GrowBar pct={100} className="h-full bg-aura-emerald-bright" />
          </div>
        </Reveal>
        <RevealWords
          as="h2"
          text="One useful product now, with a measured path outward."
          className="mt-5 max-w-2xl text-3xl font-semibold leading-snug"
        />
        <Stagger className="mt-10 grid gap-6 md:grid-cols-3">
          {arcs.map((a) => (
            /* StaggerItem is the grid child now, so the card keeps its own
               equal-height stretch via h-full on both. */
            <StaggerItem key={a.n} className="h-full">
              <article className="aura-panel aura-panel-lift h-full p-8">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-xs text-aura-violet">
                    {/* prefix, not a format fn: this is a server component and
                        functions cannot cross into a client component */}
                    <Counter value={Number(a.n)} prefix="0" duration={0.8} />
                  </p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald">
                    {a.status}
                  </p>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{a.name}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-aura-text/90">{a.line}</p>
                <p className="mt-3 text-sm leading-relaxed text-aura-text/70">{a.detail}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.05} y={10}>
          <p className="mt-6 max-w-2xl text-sm text-aura-text/70">
            The full plan, with every line item and its status, lives in the open:{" "}
            <a
              href="https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/ROADMAP.md"
              target="_blank"
              rel="noreferrer"
              data-cursor="Read"
              className="text-aura-emerald underline underline-offset-4"
            >
              docs/ROADMAP.md
            </a>
            .
          </p>
        </Reveal>
      </div>

      {/* ---- the five-stage pipeline ---- */}
      <div className="mt-24">
        <Reveal y={10}>
          <p className="aura-label">The pipeline</p>
          <div className="mt-3 h-px w-28 overflow-hidden rounded-full bg-aura-ink/10">
            <GrowBar pct={100} className="h-full bg-aura-emerald-bright" />
          </div>
        </Reveal>
        {/* structure by hairline, not by box — and the old filled gutter was
            rgba(26,29,27,.12), a near-miss of --aura-border */}
        <Stagger className="mt-6 grid overflow-hidden rounded-lg border aura-hairline md:grid-cols-5">
          {pipeline.map((p, i) => (
            /* The fx-card and its borders stay on ONE element (the hover warms
               the border, so they cannot be split across the motion wrapper).
               `last:` selectors would match every cell once each is wrapped, so
               the divider is derived from the index instead — same render. */
            <StaggerItem key={p.step} y={10}>
              <div
                className={
                  i < pipeline.length - 1
                    ? "fx-card h-full border-b aura-hairline p-8 md:border-b-0 md:border-r"
                    : "fx-card h-full p-8"
                }
                data-fx=""
              >
                <p className="text-xs text-aura-violet">
                  <Counter value={Number(p.step)} prefix="0" duration={0.9} />
                </p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-label text-aura-text">
                  {p.name}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-aura-text/75">{p.detail}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <Reveal y={10}>
        <p className="mt-16 text-sm text-aura-text/75">
          Prefer the full story?{" "}
          <Link href="/" className="text-aura-emerald underline underline-offset-4" data-cursor="Watch">
            Watch the scroll tour
          </Link>
          {" "}— or read{" "}
          <Link href="/faq" className="text-aura-emerald underline underline-offset-4" data-cursor="Read">
            the FAQ
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}

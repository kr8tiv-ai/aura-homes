import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, GrowBar, Counter } from "@/components/Reveal";

// The site tells the same rollout story as docs/ROADMAP.md — two arcs,
// honest labels on every one. If the roadmap changes, this page changes.
const arcs = [
  {
    n: "01",
    status: "In build",
    name: "The hackathon MVP",
    line: "Buy a home with USDC on X Layer, with an agent that directs you to the land — the arc being built now.",
    detail:
      "The spine is real and tested: the escrow and registry contracts pass 10 of 10 tests, the land filter rejects real parcels for real bylaw reasons, and the budget reconciles to the open Alberta cost model to the dollar. The buy flow itself — catalog, order, deposit — is in build; testnet deployment waits on one human step, and escrow figures shown here run on fixtures until it lands.",
  },
  {
    n: "02",
    status: "Next",
    name: "The Locality Hub",
    line: "A giant hub with bridges across — rolled out locality by locality, Alberta counties first.",
    detail:
      "Design your own eco home (SIP sandwich panels, solar), source every material and contractor locally, and choose buy-versus-build. A vendor directory purchasable in USDC, with bridge-in guidance where vendors take CAD. Pay contractors, manage inventory, track the build, and discover the latest building technology — one hub per locality.",
  },
] as const;
/* THE TOKEN ARC IS GONE FROM THE SITE (Aug 10, 2026, founder's call).
   It read "The HOMES token — announced", and announcing a token is a promise
   whether or not the copy hedges the utility. There is no token, the build is
   what is being judged, and a roadmap card is not the place to carry a
   financial expectation the product has not earned yet. Nothing replaced it:
   inventing a third arc to keep the rhythm would be worse than shipping two
   honest ones. If an arc three returns it will be a product, not an asset. */

const pipeline = [
  { step: "01", name: "Land", detail: "Real parcels filtered against district bylaws, aquifers, grid distance, and septic soils" },
  { step: "02", name: "Design", detail: "AI architect turns your land and lifestyle into a buildable brief" },
  { step: "03", name: "Budget", detail: "Alberta-researched LOW / MID / HIGH costing, line by line" },
  { step: "04", name: "Escrow", detail: "Milestones funded in native USDC on X Layer with statutory holdback" },
  { step: "05", name: "Build", detail: "Releases on 2-of-3 approval; the build record anchored on-chain" },
] as const;

export const metadata = {
  title: "Overview — Aura Homes",
  description:
    "The rollout: the USDC buy arc in build, and the Locality Hub next — design your own eco home and source it locally.",
};

export default function OverviewPage() {
  return (
    <div className="py-24">
      {/* The first screen is deliberately NOT faded in: label, headline and
          lede render at full opacity so the page is readable the instant it
          paints. Only the call-to-action row arrives, and it arrives fast. */}
      <p className="aura-label mb-6">Off-grid, on-chain</p>
      <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
        Design it. <span className="text-aura-emerald">Fund it.</span> Build it.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-aura-text/70">
        AI-designed off-grid eco homes on X Layer, paid in USDC.
      </p>

      <Stagger className="mt-10 flex gap-4">
        {/* the wrapper is the flex child now, so it carries `flex` and the
            link carries `inline-flex` — that keeps the two buttons the same
            height, which stretch used to do for free */}
        <StaggerItem y={8} className="flex">
          <Link
            href="/design"
            data-cursor="Design"
            className="inline-flex items-center rounded-full bg-aura-ink px-6 py-3 font-mono text-sm font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
          >
            Start a design
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
          text="One story, two arcs — each one ships whole, not sliced."
          className="mt-5 max-w-2xl text-3xl font-semibold leading-snug"
        />
        {/* two columns, not three — a three-column grid with two cards leaves
            a hole where the token card used to be */}
        <Stagger className="mt-10 grid gap-6 md:grid-cols-2">
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

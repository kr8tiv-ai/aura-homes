import Link from "next/link";

// The site tells the same rollout story as docs/ROADMAP.md — three arcs,
// honest labels on every one. If the roadmap changes, this page changes.
const arcs = [
  {
    n: "01",
    status: "Live now",
    name: "The hackathon MVP",
    line: "Buy a home with USDC on X Layer, with an agent that directs you to the land.",
    detail:
      "The escrow and registry contracts are written and tested (10 of 10 passing); the land agent rejects real parcels for real bylaw reasons; this site is the storefront. Honest status: testnet deployment waits on one human step, and escrow figures shown here run on fixtures until it lands.",
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
    status: "Announced",
    name: "The HOMES token",
    line: "A token named HOMES will launch on X Layer as part of the phased rollout.",
    detail:
      "Its utility is deliberately undecided and will be announced as a phase of its own. There is no token in the hackathon build, and nothing launches before Canadian securities counsel — the research and the exact conditions are public in the repo.",
  },
] as const;

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
    "The rollout: buy a home with USDC on X Layer today, the Locality Hub next, and the HOMES token as its own phase.",
};

export default function OverviewPage() {
  return (
    <div className="py-24">
      <p className="aura-label mb-6">Off-grid, on-chain</p>
      <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
        Design it. <span className="text-aura-emerald">Fund it.</span> Build it.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-aura-text/70">
        AI-designed off-grid eco homes on X Layer, paid in USDC.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/design"
          className="rounded-full bg-aura-ink px-6 py-3 font-mono text-sm font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
        >
          Start a design
        </Link>
        <Link
          href="/escrow"
          className="rounded-md border aura-hairline px-6 py-3 text-sm font-medium uppercase tracking-label transition-colors hover:border-aura-teal"
        >
          View escrow
        </Link>
      </div>

      {/* ---- the rollout: the same three arcs as docs/ROADMAP.md ---- */}
      <div className="mt-28">
        <p className="aura-label">The rollout</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-snug">
          One story, three arcs — each one shipped, not sliced.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {arcs.map((a) => (
            <article key={a.n} className="aura-panel p-8">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-xs text-aura-violet">{a.n}</p>
                <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald">
                  {a.status}
                </p>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{a.name}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-aura-text/90">{a.line}</p>
              <p className="mt-3 text-sm leading-relaxed text-aura-text/70">{a.detail}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm text-aura-text/70">
          The full plan, with every line item and its status, lives in the open:{" "}
          <a
            href="https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/ROADMAP.md"
            target="_blank"
            rel="noreferrer"
            className="text-aura-emerald underline underline-offset-4"
          >
            docs/ROADMAP.md
          </a>
          .
        </p>
      </div>

      {/* ---- the five-stage pipeline ---- */}
      <div className="mt-24">
        <p className="aura-label">The pipeline</p>
        {/* structure by hairline, not by box — and the old filled gutter was
            rgba(26,29,27,.12), a near-miss of --aura-border */}
        <div className="mt-6 grid overflow-hidden rounded-lg border aura-hairline md:grid-cols-5">
          {pipeline.map((p) => (
            <div
              key={p.step}
              className="fx-card border-b aura-hairline p-8 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
              data-fx=""
            >
              <p className="text-xs text-aura-violet">{p.step}</p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-label text-aura-text">
                {p.name}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-aura-text/75">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-16 text-sm text-aura-text/75">
        Prefer the full story?{" "}
        <Link href="/" className="text-aura-emerald underline underline-offset-4">
          Watch the scroll tour
        </Link>
        {" "}— or read{" "}
        <Link href="/faq" className="text-aura-emerald underline underline-offset-4">
          the FAQ
        </Link>
        .
      </p>
    </div>
  );
}

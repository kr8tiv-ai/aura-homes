import Link from "next/link";

// The original landing content lives on: the pipeline strip and intro,
// kept reachable from the story's end card and the site nav.
const pipeline = [
  { step: "01", name: "Land", detail: "Real parcels filtered against district bylaws, aquifers, grid distance, and septic soils" },
  { step: "02", name: "Design", detail: "AI architect turns your land and lifestyle into a buildable brief" },
  { step: "03", name: "Budget", detail: "Alberta-researched LOW / MID / HIGH costing, line by line" },
  { step: "04", name: "Escrow", detail: "Milestones funded in native USDC on X Layer with statutory holdback" },
  { step: "05", name: "Build", detail: "Releases on 2-of-3 approval; the build record anchored on-chain" },
] as const;

export const metadata = {
  title: "Overview — Aura Homes",
  description: "The five-stage pipeline: land, design, budget, escrow, and build.",
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

      <div className="mt-28 grid gap-px overflow-hidden rounded-lg border aura-hairline bg-[rgba(26,29,27,0.12)] md:grid-cols-5">
        {pipeline.map((p) => (
          <div key={p.step} className="bg-aura-panel p-8">
            <p className="text-xs text-aura-violet">{p.step}</p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-label text-aura-text">
              {p.name}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-aura-text/75">{p.detail}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 text-sm text-aura-text/75">
        Prefer the full story?{" "}
        <Link href="/" className="text-aura-emerald underline underline-offset-4">
          Watch the scroll tour
        </Link>
        .
      </p>
    </div>
  );
}

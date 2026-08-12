import Link from "next/link";

import ContractorDirectory from "@/components/contractors/ContractorDirectory";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Check a contractor — Aura Homes",
  description:
    "Compare Alberta build-team evidence with transparent registry, WCB, insurance, licence, project-history, and review-source contributions.",
};

export default function ContractorsPage() {
  return (
    <div className="py-16">
      <Reveal y={12}>
        <p className="aura-label mb-4">Check a contractor · evidence you can reopen</p>
        <h1 className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">
          Build a shortlist without hiding the missing pieces
        </h1>
      </Reveal>
      <Reveal y={12} delay={0.08} className="mt-4">
        <p className="max-w-2xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          Add a company from a quote, registry search or referral, record the exact evidence you
          checked, and reopen every source behind the score. Fictional profiles are available only
          in explicit demo mode and can never enter a project shortlist.
        </p>
      </Reveal>

      <ContractorDirectory />

      <Reveal y={10} className="mt-14">
        <p className="max-w-2xl text-sm leading-relaxed text-aura-text/70">
          Start with the exact home and parcel requirements in{" "}
          <Link href="/land" className="text-aura-emerald underline underline-offset-4">land discovery</Link>.
          A contractor score never replaces references, a written scope, insurance certificates,
          engineering, permits, legal review, or milestone inspection.
        </p>
      </Reveal>
    </div>
  );
}

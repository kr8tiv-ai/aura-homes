/* The badge that stops an A-tier claim and a press clipping from looking
   identical. Emerald means the company's own live page said it and the
   page was fetched; violet means somebody else said it. The badge is the
   LINK to the evidence, so the claim and the proof are one object — you
   cannot read the tier without being one click from checking it. */

import { TIER_A, tierLabel, tierMeaning } from "./data";

export default function EvidenceBadge({
  tier,
  href,
  cursor = "Evidence",
}: {
  tier: string;
  href?: string | null;
  cursor?: string;
}) {
  const isA = tier === TIER_A;
  const skin = isA
    ? "border-aura-emerald/45 bg-aura-emerald/[0.07] text-aura-emerald"
    : "border-aura-violet/45 bg-aura-violet/[0.07] text-aura-violet";
  const body = (
    <>
      <span aria-hidden>{isA ? "◆" : "◇"}</span>
      {tierLabel(tier)}
    </>
  );
  const shell = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[0.6rem] uppercase tracking-label ${skin}`;

  if (!href) {
    return (
      <span className={shell} title={tierMeaning(tier)}>
        {body}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-cursor={cursor}
      title={`${tierMeaning(tier)} Opens the source.`}
      className={`${shell} underline-offset-4 transition-opacity hover:underline hover:opacity-80`}
    >
      {body}
    </a>
  );
}

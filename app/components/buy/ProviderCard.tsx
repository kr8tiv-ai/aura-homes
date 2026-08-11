"use client";

/* One provider, one card, nothing withheld.

   The order is deliberate: what they build, what they take, how payment
   actually happens, whether a Canadian can use them, what it costs to
   start — and then THE CAVEAT, which is the longest block on the card
   because it is the part that decides whether a reader should act. A
   directory that hides its caveats is a lead-gen page, not a record. */

import type { Provider } from "./data";
import { needsPhoneCheck, reachLabel, reachesCanada } from "./data";
import EvidenceBadge from "./EvidenceBadge";

const reachSkin: Record<string, string> = {
  yes: "text-aura-emerald",
  no: "text-aura-text/55",
  unverified: "text-aura-violet",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="aura-label mb-1.5">{label}</p>
      <p className="text-xs leading-relaxed text-aura-text/75">{children}</p>
    </div>
  );
}

export default function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: Provider;
  selected: boolean;
  onSelect: () => void;
}) {
  const reach = reachesCanada(provider);
  const callFirst = needsPhoneCheck(provider);

  return (
    <article
      /* Selection is an OUTLINE, not a border. globals.css re-declares
         .aura-panel's border-color in a raw rule after the utilities layer
         (the --fx-warm hover system), so a border-* utility here would
         compile and then silently lose on every hover-capable device.
         Outline is untouched by that rule and looks identical on touch. */
      className={`aura-panel aura-panel-lift flex h-full flex-col p-7${
        selected ? " outline outline-2 outline-offset-2 outline-aura-emerald" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[1.05rem] font-medium tracking-[-0.01em]">
            {provider.name}
          </h3>
          <p className="mt-1 text-xs text-aura-text/60">{provider.country}</p>
        </div>
        <EvidenceBadge
          tier={provider.evidenceTier}
          href={provider.evidenceUrl}
          cursor="Check"
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-aura-text/80">{provider.productType}</p>

      {/* what they take, in their own words */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {provider.assets.map((a) => (
          <span
            key={a}
            className="rounded-full border aura-hairline px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/70"
          >
            {a}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-4 border-t aura-hairline pt-5">
        <Field label="How payment happens">{provider.howToPay}</Field>
        <Field label="Entry price">{provider.priceFrom}</Field>
        <Field label={reachLabel[reach]}>
          <span className={reachSkin[reach]}>{provider.shipsTo}</span>
        </Field>
      </div>

      <blockquote className="mt-5 border-l-2 border-aura-teal/50 pl-4 text-xs italic leading-relaxed text-aura-text/70">
        &ldquo;{provider.quote}&rdquo;
      </blockquote>

      <div className="mt-5 rounded-lg bg-aura-sunken p-4">
        <p className="aura-label mb-2">The caveat</p>
        <p className="text-xs leading-relaxed text-aura-text/80">{provider.caveat}</p>
      </div>

      {callFirst ? (
        <p className="mt-4 text-[0.68rem] font-medium uppercase leading-relaxed tracking-label text-aura-violet">
          Confirm by phone before sending funds — this acceptance is not shown on the
          company&rsquo;s live site today.
        </p>
      ) : (
        <p className="mt-4 text-[0.68rem] uppercase leading-relaxed tracking-label text-aura-text/55">
          Verified on their own site. Still confirm the terms with them directly.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
        {/* An anchor, not a button: Lenis runs the real scroller, so a plain
            hash link is the one jump that is guaranteed to land. */}
        <a
          href="#route"
          onClick={onSelect}
          data-cursor="Route"
          className={
            selected
              ? "rounded-full bg-aura-ink px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper"
              : "rounded-full border aura-hairline px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/75 transition-colors hover:border-aura-emerald"
          }
        >
          {selected ? "Route shown below" : "Plan the route"}
        </a>
        <a
          href={provider.url}
          target="_blank"
          rel="noreferrer"
          data-cursor="Visit"
          className="font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald underline underline-offset-4"
        >
          Their site
        </a>
      </div>
    </article>
  );
}

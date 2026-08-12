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
import type { ProviderPurchaseReadiness } from "@/lib/marketplace/buyReadiness";
import type { ManufacturerInquiry } from "@/lib/project/manufacturerInquiry";

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
  readiness,
  selected,
  onSelect,
  projectState,
}: {
  provider: Provider;
  readiness: ProviderPurchaseReadiness;
  selected: boolean;
  onSelect: () => void;
  projectState: {
    hasProject: boolean;
    saved: boolean;
    busy: boolean;
    inquiry: ManufacturerInquiry | undefined;
    onToggle: () => void;
    onPrepare: () => void;
    onDownload?: () => void;
  };
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

      <div className="mt-4 rounded-lg border aura-hairline p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="aura-label">Purchase evidence</p>
            <p className={`mt-1 text-xs font-medium ${readiness.verdict === "ready-to-contact" ? "text-aura-emerald" : "text-aura-violet"}`}>
              {readiness.label}
            </p>
          </div>
          <p className="font-display text-xl tabular-nums">
            {readiness.score}<span className="text-xs text-aura-text/45">/100</span>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1" aria-label="Purchase evidence score contributions">
          {readiness.contributions.map((item) => (
            <div
              key={item.id}
              tabIndex={0}
              title={`${item.label}: ${item.detail}`}
              aria-label={`${item.label}: ${item.points} of ${item.possiblePoints}. ${item.detail}`}
            >
              <div className="h-1 overflow-hidden rounded-full bg-aura-ink/10">
                <div
                  className={`h-full ${item.state === "confirmed" ? "bg-aura-emerald" : item.state === "mismatch" ? "bg-aura-violet" : "bg-aura-teal"}`}
                  style={{ width: `${item.possiblePoints > 0 ? (item.points / item.possiblePoints) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1 truncate text-center font-mono text-[0.5rem] uppercase text-aura-text/45">
                {item.id}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.65rem] leading-relaxed text-aura-text/55">
          Product, destination, acceptance evidence, payment mechanics and price. Hover or focus
          a segment for its basis; the full caveat remains below.
        </p>
        <details className="mt-3 border-t aura-hairline pt-3">
          <summary className="cursor-pointer text-[0.62rem] uppercase tracking-label text-aura-emerald">
            Explain this score
          </summary>
          <div className="mt-3 space-y-3">
            {readiness.contributions.map((item) => (
              <div key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.68rem] font-medium">{item.label}</p>
                  <span className="font-mono text-[0.6rem] text-aura-text/50">{item.points}/{item.possiblePoints}</span>
                </div>
                <p className="mt-1 text-[0.65rem] leading-relaxed text-aura-text/60">{item.detail}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

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

      <div className="manufacturer-payment-choice" aria-label="Potential payment paths">
        <div><span>Cash or card</span><strong>Ask on the written quote</strong><p>Provider-native invoicing remains the simplest path when offered.</p></div>
        <div><span>X Layer USDC</span><strong>{provider.cryptoStatus === "current-live" ? "Conversion and recipient checks required" : "No verified direct path"}</strong><p>Aura never hides the swap, bridge, fee, asset network or recipient behind this option.</p></div>
      </div>
      <div className="manufacturer-project-actions">
        <div><span>{projectState.inquiry ? "Inquiry prepared" : projectState.saved ? "Saved research" : "Project marketplace"}</span><p>{projectState.inquiry ? `Bound to ${projectState.inquiry.designHash.slice(0, 12)}…` : "Shortlist evidence before asking for a quote."}</p></div>
        <div>
          <button type="button" disabled={!projectState.hasProject || projectState.busy} aria-pressed={projectState.saved} onClick={projectState.onToggle}>{!projectState.hasProject ? "Start a project to save" : projectState.busy ? "Saving…" : projectState.saved ? "Saved to project" : "Save to project"}</button>
          {projectState.saved && !projectState.inquiry ? <button type="button" disabled={projectState.busy} onClick={projectState.onPrepare}>Prepare quote request</button> : null}
          {projectState.inquiry && projectState.onDownload ? <button type="button" onClick={projectState.onDownload}>Download inquiry</button> : null}
        </div>
      </div>
    </article>
  );
}

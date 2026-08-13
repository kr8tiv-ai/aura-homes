"use client";

/* One researched maker model or concept, one card, the approved hierarchy:
   1 visual · 2 model + maker · 3 price state · 4 delivery state ·
   5 size + bedrooms · 6 actions. Everything longer-form — sources with
   dates, payment research, unresolved questions, the caveat — lives in
   the expandable "Details and sources" region below the actions, so a
   browsing reader gets a clean card and a careful reader loses nothing. */

import EvidenceBadge from "./EvidenceBadge";
import HomeVisual from "./HomeVisual";
import {
  CONSTRUCTION_LABELS,
  PAYMENT_WAIT_SENTENCE,
  bedroomsLine,
  deliveryStateFor,
  deliverySummary,
  paymentMethodOptions,
  priceLine,
  sizeLine,
  type FinishedHomeModel,
  type HomeProjectState,
  type TargetRegion,
} from "@/lib/marketplace/homeModels";
import { PROVIDERS, TIER_A } from "./data";

const ACTION_BUTTON =
  "min-h-11 rounded-full border aura-hairline px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/75 transition-colors hover:border-aura-emerald disabled:opacity-40";
const ACTION_BUTTON_ACTIVE =
  "min-h-11 rounded-full bg-aura-ink px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper";

export default function HomeCard({
  home,
  destination,
  expanded,
  onView,
  projectState,
  compare,
}: {
  home: FinishedHomeModel;
  destination: TargetRegion;
  expanded: boolean;
  onView: () => void;
  projectState: HomeProjectState & {
    busy: boolean;
    onSave: () => void;
    onRequestQuote: () => void;
    onDownloadInquiry?: () => void;
  };
  compare: {
    selected: boolean;
    full: boolean;
    onToggle: () => void;
  };
}) {
  const delivery = deliveryStateFor(home, destination);
  const payments = paymentMethodOptions(home, projectState.hasRealQuote);
  const detailsId = `home-details-${home.id}`;
  const evidence = home.sources[0];

  return (
    <article className="aura-panel aura-panel-lift flex h-full flex-col overflow-hidden">
      {/* 1 · the labelled illustrative visual */}
      <div data-slot="home-visual" className="p-3 pb-0">
        <HomeVisual home={home} />
      </div>

      <div className="flex flex-1 flex-col p-6">
        {/* 2 · model + maker identity */}
        <div data-slot="home-identity" className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 font-mono text-[0.58rem] uppercase tracking-label text-aura-emerald">
              {home.marketStatus === "current-maker-model" ? "Current maker model" : "Announced concept · shipping unverified"}
            </p>
            <h3 className="font-display text-[1.1rem] font-medium leading-snug tracking-[-0.01em]">
              {home.model}
            </h3>
            <p className="mt-1 text-xs text-aura-dim">
              {home.maker} · {home.makerCountry}
            </p>
          </div>
          <span className="rounded-full border aura-hairline px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-label text-aura-text/60">
            {CONSTRUCTION_LABELS[home.constructionType]}
          </span>
        </div>

        {/* 3 · price state */}
        <p data-slot="home-price" className="mt-4 text-sm leading-relaxed">
          {home.price.state === "published" ? (
            <span className="font-medium">{priceLine(home)}</span>
          ) : (
            <span className="text-aura-text/80">{priceLine(home)}</span>
          )}
        </p>

        {/* 4 · delivery state */}
        <div data-slot="home-delivery" className="mt-3 text-xs leading-relaxed text-aura-text/70">
          {destination === "any" ? (
            <p>{deliverySummary(home)}</p>
          ) : (
            <p>
              {delivery === "confirmed" ? (
                <span className="font-medium text-aura-emerald">Delivery documented for your destination.</span>
              ) : delivery === "ask-maker" ? (
                <span className="font-medium text-aura-violet">Delivery to your destination is an open question — ask the maker.</span>
              ) : (
                <span>Not available for your destination.</span>
              )}{" "}
              <span className="text-aura-dim">{deliverySummary(home)}</span>
            </p>
          )}
        </div>

        {/* 5 · size + bedrooms */}
        <dl data-slot="home-size" className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="aura-label">Size</dt>
            <dd className="mt-1 leading-relaxed text-aura-text/75">{sizeLine(home)}</dd>
          </div>
          <div>
            <dt className="aura-label">Bedrooms</dt>
            <dd className="mt-1 leading-relaxed text-aura-text/75">{bedroomsLine(home)}</dd>
          </div>
        </dl>

        {/* 6 · actions */}
        <div data-slot="home-actions" className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onView}
              aria-expanded={expanded}
              aria-controls={detailsId}
              data-cursor="Open"
              className={expanded ? ACTION_BUTTON_ACTIVE : ACTION_BUTTON}
            >
              View home
            </button>
            <button
              type="button"
              onClick={projectState.onSave}
              disabled={!projectState.hasProject || projectState.busy}
              aria-pressed={projectState.saved}
              data-cursor="Save"
              className={projectState.saved ? ACTION_BUTTON_ACTIVE : ACTION_BUTTON}
              title={projectState.hasProject ? undefined : "Start a project to save homes."}
            >
              {projectState.busy ? "Saving…" : projectState.saved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={compare.onToggle}
              disabled={!compare.selected && compare.full}
              aria-pressed={compare.selected}
              data-cursor="Compare"
              className={compare.selected ? ACTION_BUTTON_ACTIVE : ACTION_BUTTON}
            >
              {compare.selected ? "In compare" : compare.full ? "Compare full" : "Compare"}
            </button>
            <button
              type="button"
              onClick={projectState.onRequestQuote}
              disabled={!projectState.hasProject || projectState.busy || projectState.latestInquiry !== null}
              data-cursor="Quote"
              className={ACTION_BUTTON}
              title={projectState.hasProject ? undefined : "Start a project to request quotes."}
            >
              {projectState.latestInquiry ? "Quote request prepared" : "Request quote"}
            </button>
          </div>
          {!projectState.hasProject ? (
            <p className="mt-2 text-[0.65rem] leading-relaxed text-aura-dim">
              Saving and quote requests live inside a project — start one first.
            </p>
          ) : null}

          {/* payment paths: both options, side by side, ONLY once a real
              captured quote from this maker exists on the project */}
          {payments.length > 0 ? (
            <div className="manufacturer-payment-choice" aria-label="Payment options for this quote">
              {payments.map((option) => (
                <div key={option.id}>
                  <span>{option.label} · {option.horizon}</span>
                  <strong>
                    {option.availability === "unavailable" ? "Unavailable" : "Confirm on the written quote"}
                  </strong>
                  <p>{option.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[0.65rem] leading-relaxed text-aura-dim">{PAYMENT_WAIT_SENTENCE}</p>
          )}
        </div>

        {/* details and sources — the careful reader's layer */}
        <div id={detailsId} hidden={!expanded} className="mt-5 border-t aura-hairline pt-5">
          <p className="aura-label">Details and sources</p>

          <div className="mt-3 space-y-4 text-xs leading-relaxed text-aura-text/75">
            <div>
              <p className="font-medium text-aura-text">Customization</p>
              <p className="mt-1">{home.customization}</p>
            </div>

            <div>
              <p className="font-medium text-aura-text">What the price includes</p>
              <p className="mt-1">{home.price.note}</p>
            </div>

            <div>
              <p className="font-medium text-aura-text">Certifications</p>
              {home.certifications.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {home.certifications.map((certification) => (
                    <li key={certification.claim}>
                      {certification.claim} —{" "}
                      <a href={certification.sourceUrl} target="_blank" rel="noreferrer" className="text-aura-emerald underline underline-offset-4">
                        source
                      </a>{" "}
                      · dated {certification.datedISO.slice(0, 10)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">
                  No certification claims in the research record. Ask the maker for dated documents.
                </p>
              )}
            </div>

            <div>
              <p className="font-medium text-aura-text">Payment research</p>
              <p className="mt-1">{home.paymentResearch.cashCard}</p>
              <p className="mt-1">{home.paymentResearch.crypto}</p>
            </div>

            <div>
              <p className="font-medium text-aura-text">Unresolved questions</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {home.unresolved.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium text-aura-text">The researcher&rsquo;s caveat, verbatim</p>
              <p className="mt-1">{home.caveat}</p>
            </div>

            <div>
              <p className="font-medium text-aura-text">Sources</p>
              <ul className="mt-2 space-y-2">
                {home.sources.map((source) => (
                  <li key={source.url} className="flex flex-wrap items-center gap-2">
                    <a href={source.url} target="_blank" rel="noreferrer" data-cursor="Check" className="text-aura-emerald underline underline-offset-4">
                      {source.label}
                    </a>
                    <span className="font-mono text-[0.6rem] uppercase tracking-label text-aura-dim">
                      collected {source.collectedAtISO.slice(0, 10)} · expires {source.expiresAtISO.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
              {evidence ? (
                <div className="mt-2">
                  <EvidenceBadge tier={tierFor(home)} href={evidence.url} cursor="Check" />
                </div>
              ) : null}
            </div>

            <blockquote className="border-l-2 border-aura-teal/50 pl-4 italic text-aura-text/70">
              &ldquo;{home.quotedClaim}&rdquo;
            </blockquote>

            {projectState.latestInquiry ? (
              <div className="rounded-lg bg-aura-sunken p-4">
                <p className="font-medium text-aura-text">Quote request</p>
                <p className="mt-1">
                  Prepared and bound to design {projectState.latestInquiry.designHash.slice(0, 12)}… on{" "}
                  {projectState.latestInquiry.createdAtISO.slice(0, 10)}. Aura prepares the request;
                  you send it and the maker answers it.
                </p>
                {projectState.onDownloadInquiry ? (
                  <button
                    type="button"
                    onClick={projectState.onDownloadInquiry}
                    data-cursor="Save"
                    className={`mt-3 ${ACTION_BUTTON}`}
                  >
                    Download request
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function tierFor(home: FinishedHomeModel): string {
  return PROVIDERS.find((provider) => provider.name === home.legacyProviderName)?.evidenceTier ?? TIER_A;
}

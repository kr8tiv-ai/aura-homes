// Client glue for the concierge: builds the reducer's ConciergeContext from
// the SAME files the agent uses (agent/samples + data/alberta) — imported
// directly, never hand-mirrored — and parses free text into typed intents.
// The reducer itself lives in agent/src/concierge/reducer.ts and is imported
// as-is: ONE source of truth for every reply the page shows.

import type { ConciergeContext, ConciergeIntent } from "@agent/concierge/reducer";
import { CATALOG } from "@agent/concierge/catalog";
import type { ParcelListing, Questionnaire, RepoCostModel } from "@agent/types";
import costModelJson from "@data/alberta/cost-model.json";
import parcelsJson from "@samples/parcels.sample.json";
import questionnaireJson from "@samples/questionnaire.sample.json";

export const COST_MODEL = costModelJson as unknown as RepoCostModel;
export const PARCELS = parcelsJson as unknown as ParcelListing[];
export const BASE_QUESTIONNAIRE = questionnaireJson as unknown as Questionnaire;

/**
 * Builds the reducer context. `refundWindowHours` MUST come from the chain
 * (AuraBuildEscrow.refundWindow()) once the read lands — the deployed value is
 * 14 days while older docs narrated 72 hours, and the chain wins. While the
 * read is in flight the caller passes undefined and the UI labels the state.
 */
export function buildContext(now: Date, refundWindowHours?: number): ConciergeContext {
  return {
    now,
    parcels: PARCELS,
    questionnaire: BASE_QUESTIONNAIRE,
    costModel: COST_MODEL,
    fileTotalsExLand: COST_MODEL.totalsExLand,
    ...(refundWindowHours !== undefined ? { refundWindowHours } : {}),
  };
}

/** Maps free text onto a typed intent; anything unmatched becomes askAbout. */
export function parseIntent(text: string): ConciergeIntent {
  const t = text.trim().toLowerCase();

  // Direct home mentions (id, name fragments).
  for (const h of CATALOG) {
    const name = h.name.toLowerCase();
    if (t.includes(h.id) || t.includes(name)) return { type: "selectHome", homeId: h.id };
  }
  if (/\b(casita|folding|boxabl)\b/.test(t)) return { type: "selectHome", homeId: "casita-fold-375" };
  if (/\bsip\s*-?\s*1,?200\b/.test(t) || /\b1200\b/.test(t)) return { type: "selectHome", homeId: "aura-sip-1200" };
  if (/\bsip\s*-?\s*800\b/.test(t)) return { type: "selectHome", homeId: "aura-sip-800" };

  // Direct parcel mentions.
  for (const p of PARCELS) {
    if (t.includes(p.id) || t.includes(p.name.toLowerCase())) {
      return { type: "selectParcel", parcelId: p.id };
    }
  }
  if (/lakeside/.test(t)) return { type: "selectParcel", parcelId: "lsa-lakeside-estates" };
  if (/aspen/.test(t)) return { type: "selectParcel", parcelId: "lsa-aspen-road" };
  if (/sturgeon|range\s*rd/.test(t)) return { type: "selectParcel", parcelId: "sturgeon-range-rd" };
  if (/twp|572|hwy\s*33/.test(t)) return { type: "selectParcel", parcelId: "lsa-twp572-hwy33" };

  if (/(list|show|see|browse).*(home|house|catalog|model)/.test(t) || /^homes?$/.test(t)) {
    return { type: "listHomes" };
  }
  if (/(list|show|see|browse|find).*(parcel|land|lot)/.test(t) || /^(parcels?|land)$/.test(t)) {
    return { type: "listParcels" };
  }
  if (/\bquote\b|price it|how much for this/.test(t)) return { type: "requestQuote" };
  if (/(place|pay|fund|put down|send).*(deposit|reservation)|^buy\b|reserve it/.test(t)) {
    return { type: "placeDeposit" };
  }
  if (/(request|want|get|give).*(refund)|refund me|pull.*deposit.*back|walk away/.test(t)) {
    return { type: "requestRefund" };
  }
  if (/start.*(build|construction)|break ground/.test(t)) return { type: "startBuild" };
  if (/check.*(clock|window|time)|tick|status\??$/.test(t)) return { type: "tick" };

  return { type: "askAbout", question: text.trim() };
}

/** Human labels for the chips the chat offers at each stage. */
export interface Chip {
  label: string;
  intent: ConciergeIntent;
}

/**
 * Chips for the current order state. Note the state machine's shape: a home
 * chosen with no parcel keeps the derived status "browsing" (the land gate has
 * not run yet), so chips key off (status, hasHome) together.
 */
export function chipsForStatus(status: string, hasHome: boolean): Chip[] {
  switch (status) {
    case "browsing":
      if (hasHome) {
        return [
          { label: "Check parcels for this home", intent: { type: "listParcels" } },
          { label: "Try Lakeside Estates", intent: { type: "selectParcel", parcelId: "lsa-lakeside-estates" } },
          { label: "Try 37 Aspen Road", intent: { type: "selectParcel", parcelId: "lsa-aspen-road" } },
        ];
      }
      return [
        { label: "Show the three homes", intent: { type: "listHomes" } },
        { label: "Show the parcels", intent: { type: "listParcels" } },
        { label: "What does the price include", intent: { type: "askAbout", question: "What is included in the price?" } },
        { label: "Choose the Aura SIP 800", intent: { type: "selectHome", homeId: "aura-sip-800" } },
      ];
    case "parcelSelected":
      // Parcel passed, no home bound yet.
      return [
        { label: "Show the three homes", intent: { type: "listHomes" } },
        { label: "Choose the Aura SIP 800", intent: { type: "selectHome", homeId: "aura-sip-800" } },
        { label: "Choose the SIP 1200", intent: { type: "selectHome", homeId: "aura-sip-1200" } },
      ];
    case "homeSelected":
      // Home + passing parcel both bound.
      return [{ label: "Quote it", intent: { type: "requestQuote" } }];
    case "parcelRejected":
      return [
        { label: "Keep the home — try 37 Aspen Road", intent: { type: "selectParcel", parcelId: "lsa-aspen-road" } },
        { label: "Keep the land — switch to the SIP 1200", intent: { type: "selectHome", homeId: "aura-sip-1200" } },
      ];
    case "quoted":
      return [
        { label: "Place the deposit", intent: { type: "placeDeposit" } },
        { label: "How does the refund work", intent: { type: "askAbout", question: "How does the refund window work?" } },
      ];
    case "refundWindowOpen":
    case "depositPaid":
      return [
        { label: "Check the clock", intent: { type: "tick" } },
        { label: "Request the refund", intent: { type: "requestRefund" } },
      ];
    case "converted":
      return [{ label: "Start the build", intent: { type: "startBuild" } }];
    default:
      return [];
  }
}

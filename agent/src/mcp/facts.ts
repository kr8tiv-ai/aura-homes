// Structured Alberta facts table for the alberta_fact MCP tool.
// Drawn from docs/ALBERTA-PLAYBOOK.md (researched Aug 2026 against primary or
// cross-checked sources). Every fact carries its basis; time-sensitive items
// should be re-verified before use in a permit application.

export interface AlbertaFact {
  id: string;
  topic: string;
  fact: string;
  basis: string;
}

export const FACTS_DISCLAIMER =
  "Researched Aug 2026 against primary or cross-checked sources (docs/ALBERTA-PLAYBOOK.md). " +
  "Verify time-sensitive items before relying on them in a permit application. " +
  "This is teaching material, not legal or financial advice.";

export const ALBERTA_FACTS: AlbertaFact[] = [
  {
    id: "architect-required",
    topic: "Is an architect required?",
    fact:
      "No. Alberta exempts 1-4 unit dwellings of any size from requiring an architect. " +
      "Part 9 of the NBC 2023 Alberta Edition governs the build.",
    basis: "Alberta Architects Act exemption; NBC 2023 Alberta Edition Part 9.",
  },
  {
    id: "engineer-touchpoints",
    topic: "Where is a P.Eng required?",
    fact:
      "Only at touchpoints: roof trusses (P.Eng authentication mandatory since Mar 1, 2026, ships with " +
      "the truss order), the SIP system (via a CCMC listing such as Insulspan CCMC 13016-R, or a P.Eng " +
      "stamp), screw-pile foundations outside Part 9 prescriptive tables, and tall walls.",
    basis: "STANDATA 23-BCB-002 (trusses); CCMC 13016-R (Insulspan SIPs); NBC Part 9 scope.",
  },
  {
    id: "permit-set-designer",
    topic: "Who draws the permit set?",
    fact:
      "A residential designer finishes the AI's review-ready package into the permit set, typically " +
      "$1,200-2,700. No architect is involved.",
    basis: "docs/ALBERTA-PLAYBOOK.md permits table; Architects Act exemption for 1-4 unit dwellings.",
  },
  {
    id: "owner-builder-authorization",
    topic: "Owner Builder Authorization",
    fact:
      "Required to owner-build: $95 with home warranty, $750 without. Opting out of warranty puts a " +
      "no-sale-for-10-years caveat on title (in force since Dec 2025). Decision in about 14 business days.",
    basis: "Alberta New Home Buyer Protection Act owner-builder program; title caveat rule since Dec 2025.",
  },
  {
    id: "homeowner-trade-permits",
    topic: "Can the owner pull their own trade permits?",
    fact:
      "Yes - electrical, plumbing, gas, and the private sewage application, on a home they own and will " +
      "occupy (Leduc County confirms explicitly). Exceptions: solar PV and battery wiring requires a " +
      "licensed electrical contractor (CEC s.64); septic installation requires a certified installer; " +
      "well drilling is licensed work.",
    basis: "Leduc County safety codes confirmation; Canadian Electrical Code s.64; Private Sewage Standard of Practice.",
  },
  {
    id: "permit-stack",
    topic: "The permit stack and timeline",
    fact:
      "Development permit (about $231 in Leduc County), then building permit, then electrical/plumbing/" +
      "gas/private-sewage permits, then inspections. Typical rural approval runs 2-6 weeks.",
    basis: "Leduc County fee schedule; docs/ALBERTA-PLAYBOOK.md permit stack row.",
  },
  {
    id: "minimum-dwelling-size",
    topic: "Minimum dwelling size",
    fact:
      "Set at the DISTRICT level, never the county level. Lac Ste. Anne County's Agricultural district " +
      "floor is 592 sqft; its Country Residential district floor is 1,076 sqft. Verify the parcel's " +
      "district table in the land-use bylaw BEFORE buying.",
    basis: "Lac Ste. Anne County Land Use Bylaw district tables (verified Aug 2026).",
  },
  {
    id: "sip-lead-time",
    topic: "SIP kit lead time",
    fact:
      "12-20 weeks from approved drawings to panel delivery. Electrical chases are frozen at panel " +
      "fabrication; no plumbing in exterior SIP walls; drywall is required over interior SIP faces as a " +
      "15-minute fire barrier.",
    basis: "Alberta SIP suppliers (Insulspan, EnerSmart, Premier SIPS); docs/ALBERTA-PLAYBOOK.md build system.",
  },
  {
    id: "december-solar-yield",
    topic: "Edmonton December solar yield",
    fact:
      "About 1.3 kWh per kW per day in December - the number that sizes every off-grid system. Design " +
      "for it or fail in January: 8-12 kW array, 20-40 kWh LiFePO4, and an auto-start generator that is " +
      "not optional.",
    basis: "Edmonton-latitude insolation data; docs/ALBERTA-PLAYBOOK.md energy section.",
  },
  {
    id: "fdwr-cap",
    topic: "Glazing (FDWR) cap",
    fact:
      "Fenestration-and-door-to-wall ratio over 22% forces the paid energy-model (performance) path " +
      "instead of the NBC 9.36 prescriptive path.",
    basis: "NBC 2023 Alberta Edition 9.36 prescriptive limits.",
  },
  {
    id: "statutory-holdback",
    topic: "Statutory holdback",
    fact:
      "Alberta's Prompt Payment and Construction Lien Act sets a 10% statutory holdback on construction " +
      "payments. AuraBuildEscrow models it natively: every milestone release retains 10%, releasable " +
      "only after a 60-day holdback period.",
    basis: "Prompt Payment and Construction Lien Act (Alberta); AuraBuildEscrow contract defaults.",
  },
  {
    id: "gst-bare-land",
    topic: "GST on bare land",
    fact:
      "Bare land bought from a developer, corporation, or subdivider adds 5% GST; personal-use land from " +
      "an individual is generally exempt. That is a $10,000 swing on a $200,000 parcel - confirm the " +
      "seller's status before offering.",
    basis: "Excise Tax Act GST treatment of bare land; docs/ALBERTA-PLAYBOOK.md money section.",
  },
  {
    id: "greywater-reuse",
    topic: "Greywater reuse",
    fact:
      "Greywater is legally wastewater in Alberta and must run through the permitted sewage system. The " +
      "one legal reuse path is subsurface drip dispersal of treated effluent (SOP 8.5) - the spec'd eco " +
      "option is an Ecoflo-class peat/coco biofilter with drip dispersal.",
    basis: "Alberta Private Sewage Standard of Practice 2021, section 8.5.",
  },
  {
    id: "septic-certified-installer",
    topic: "Septic installation",
    fact:
      "A certified installer is mandatory - no DIY septic in Alberta. Conventional systems run $10-25K; " +
      "composting toilets do not remove the septic requirement in plumbed homes. Setbacks: 30 m from " +
      "wells, 15 m from watercourses (mounds), 90 m from property line for open discharge.",
    basis: "Alberta Private Sewage Standard of Practice 2021.",
  },
  {
    id: "water-options",
    topic: "Water source options and costs",
    fact:
      "Buried cistern (about 5 ft deep, $8-15K installed, hauled potable water roughly 1.5-3 cents/L) or " +
      "drilled well ($10-18K at $45-115/ft where the aquifer is reliable). Lac Ste. Anne groundwater is " +
      "unreliable - cistern country. AWG is a summer supplement only: condenser units cut off around " +
      "15 C / 30% RH and produce zero outdoors in an Alberta winter.",
    basis: "Alberta water-hauling and drilling market rates Aug 2026; AWG physics per feasibility study.",
  },
  {
    id: "deck-permit",
    topic: "Deck building permit",
    fact: "A deck under 24 inches in height needs no building permit.",
    basis: "NBC Part 9 / Alberta municipal practice; docs/ALBERTA-PLAYBOOK.md lifestyle section.",
  },
  {
    id: "wood-stove-wett",
    topic: "Wood stove insurance requirement",
    fact:
      "Insurers demand a WETT-inspected installation. Budget the inspection ($150-400) with the stove " +
      "install ($2,500-4,000 installed) and book them together to avoid a re-visit.",
    basis: "Canadian home-insurance underwriting practice; Alberta hearth-market pricing Aug 2026.",
  },
  {
    id: "grid-optional",
    topic: "Grid-optional feasibility",
    fact:
      "Grid-optional depends on a line passing the parcel - run the FortisAlberta Service Estimator " +
      "before buying land. A grid tie later goes through the Micro-generation Regulation; grid further " +
      "than about 1 km is treated as uneconomic to connect.",
    basis: "FortisAlberta Service Estimator; Alberta Micro-generation Regulation.",
  },
];

/** Case-insensitive lookup: exact id first, then keyword match over topic/fact/id. */
export function findFacts(id?: string, query?: string): AlbertaFact[] {
  if (id) {
    const exact = ALBERTA_FACTS.filter((f) => f.id === id.toLowerCase().trim());
    if (exact.length > 0) return exact;
  }
  const q = (query ?? id ?? "").toLowerCase().trim();
  if (!q) return [];
  const terms = q.split(/[^a-z0-9%.]+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const scored = ALBERTA_FACTS.map((f) => {
    const haystack = `${f.id} ${f.topic} ${f.fact}`.toLowerCase();
    const score = terms.filter((t) => haystack.includes(t)).length;
    return { f, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.f);
}

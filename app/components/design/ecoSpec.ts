/* THE AURA ECO SPEC — the part of the 02 · DESIGN questionnaire that is not
   a preference.

   The founder mandate is that every generated home reads as a true Aura
   eco-home, never a generic AI house. The service only has one channel from
   the questionnaire into the reasoning + rendering prompts: DesignRequest.notes
   (design-api/app/services/prompts.py, user_prompt() — "- Notes: {req.notes}").
   `material_keywords` is composed service-side from material/style/off_grid/
   climate_zone; the request model has no field for it, so this module does not
   pretend to send one. The eco spec therefore travels as a compact, construction-
   noun clause in `notes`.

   notes is capped at 500 characters by the service (models.py,
   max_length=500). The standard clause is reserved first and the owner's own
   free text is what gets trimmed — dropping "no concrete" to make room for a
   sentence about a mudroom would be exactly the wrong trade. The page shows
   the composed string and the dropped count, so nothing is silent. */

import type { ClimateZone, EcoMaterial, HomeStyle } from "@/lib/designApi";
import { formatFeetInches } from "@/lib/units";

/** design-api/app/models.py — DesignRequest.notes max_length. */
export const NOTES_MAX = 500;

/* ---------------------------------------------------------------- materials */

/** Wall thickness verbatim from design-api WALL_THICKNESS_MM — it is drawn,
 *  and it changes the net internal area, so the form states it up front. */
export const MATERIALS: ReadonlyArray<{
  id: EcoMaterial;
  label: string;
  wallMm: number;
  /** The construction noun that goes into the brief. */
  clause: string;
}> = [
  { id: "sip", label: "SIP structural panels", wallMm: 165, clause: "SIP structural panels" },
  { id: "clt", label: "CLT (5-ply)", wallMm: 128, clause: "CLT panels" },
  { id: "timber_frame", label: "Timber frame", wallMm: 190, clause: "timber frame" },
  { id: "rammed_earth", label: "Rammed earth", wallMm: 450, clause: "rammed earth walls" },
];

export const STYLES: ReadonlyArray<{ id: HomeStyle; label: string }> = [
  { id: "off_grid_cabin", label: "Off-grid cabin" },
  { id: "scandinavian_minimalist", label: "Scandinavian minimalist" },
  { id: "passive_solar", label: "Passive solar" },
  { id: "modern_aframe", label: "Modern A-frame" },
];

export const CLIMATE_ZONES: ReadonlyArray<{ id: ClimateZone; label: string }> = [
  { id: "4", label: "Zone 4" },
  { id: "5", label: "Zone 5" },
  { id: "6", label: "Zone 6" },
  { id: "7A", label: "Zone 7A — the Alberta pilot" },
  { id: "7B", label: "Zone 7B" },
  { id: "8", label: "Zone 8" },
];

export const materialWallMm = (m: EcoMaterial): number =>
  MATERIALS.find((x) => x.id === m)?.wallMm ?? 165;

export const materialLabel = (m: EcoMaterial): string =>
  MATERIALS.find((x) => x.id === m)?.label ?? m;

/* ------------------------------------------------------------- the eco spec */

export interface EcoItem {
  id: string;
  /** What the reader sees. */
  label: string;
  /** The honest sentence under it — limits included, not just the promise. */
  detail: string;
  /** The clause carried into `notes`, and from there into the brief. */
  clause: string;
}

/** On every Aura home. Not toggles — the checklist shows them checked and
 *  labelled STANDARD so the reader sees what an Aura home includes. */
export const ECO_STANDARD: ReadonlyArray<EcoItem> = [
  {
    id: "glazing",
    label: "Glass-forward, passive-solar orientation",
    detail:
      "Large south-facing triple-pane glazing oriented for winter gain — held to the 22% FDWR ceiling on the NBC 9.36 prescriptive path, which the service enforces rather than decorates.",
    clause: "south-facing triple-pane glass, passive-solar orientation",
  },
  {
    id: "piles",
    label: "No concrete — protected screw piles",
    detail:
      "Galvanized screw piles: reversible, minimal ground disturbance, no curing window. Hempcrete is non-structural infill only, where mass is wanted. The defensible claim is cement-free and reversible, never zero carbon.",
    clause: "no concrete; protected galvanized screw piles",
  },
  {
    id: "awg",
    label: "AWG atmospheric water generation",
    detail:
      "Standard on every home, and never the water plan: condensers cut off near 15 °C / 30% RH, so outdoor winter output in Alberta is zero litres. It is the summer producer (roughly 10–20 L/day, June to September); a cistern or well carries winter.",
    clause: "AWG atmospheric water generation",
  },
  {
    id: "power",
    label: "Solar array + battery",
    detail:
      "Roof-mounted array with LiFePO4 storage, off-grid by default with a grid-connect option below.",
    clause: "solar array with battery storage",
  },
  {
    id: "water",
    label: "Greywater + rainwater capture, off-grid septic",
    detail:
      "Rainwater capture and subsurface-drip greywater into an Ecoflo-class biofilter septic. Septic install is licensed work in Alberta.",
    clause: "greywater and rainwater capture, off-grid septic biofilter",
  },
  {
    id: "stove",
    label: "Wood stove",
    detail: "WETT-inspected — resilient heat that does not depend on the electrical system.",
    clause: "WETT-inspected wood stove",
  },
  {
    id: "outdoor",
    label: "Wood-fired hot tub and deck",
    detail:
      "On every home, and a costed first-class budget line rather than an afterthought.",
    clause: "wood-fired hot tub and deck",
  },
];

/** Genuinely optional — every one of these is a real choice, not a downgrade
 *  of the standard spec above. */
export const ECO_OPTIONS: ReadonlyArray<EcoItem> = [
  {
    id: "gridConnect",
    label: "Grid-connect option",
    detail: "Off-grid capable, wired ready for a utility tie-in where the service drop is close enough to be worth it.",
    clause: "grid-connect ready",
  },
  {
    id: "generator",
    label: "Auto-start generator backup",
    detail: "Not optional in an Alberta January if the array is the only source — the honest answer at −30 °C with four hours of sun.",
    clause: "auto-start generator backup",
  },
  {
    id: "hrv",
    label: "HRV",
    detail: "Heat-recovery ventilation. An airtight panel envelope needs mechanical fresh air, not a leaky one.",
    clause: "HRV ventilation",
  },
  {
    id: "hempcrete",
    label: "Hempcrete thermal-mass infill",
    detail: "Non-structural infill only, placed where thermal mass earns its weight. Never load-bearing, never a concrete substitute.",
    clause: "hempcrete non-structural mass infill",
  },
];

/* ------------------------------------------------------- the composed brief */

export interface ComposedNotes {
  /** Exactly the string posted as DesignRequest.notes. */
  notes: string;
  /** Characters of the owner's own text that would not fit the 500 cap. */
  dropped: number;
}

/**
 * Build the `notes` payload: the eco spec first, the owner's words after,
 * trimmed to the service's 500-character ceiling.
 */
export function composeNotes(
  material: EcoMaterial,
  chosenOptionIds: readonly string[],
  ownerText: string
): ComposedNotes {
  const clauses = [
    MATERIALS.find((m) => m.id === material)?.clause ?? "SIP structural panels",
    ...ECO_STANDARD.map((i) => i.clause),
    ...ECO_OPTIONS.filter((o) => chosenOptionIds.includes(o.id)).map((o) => o.clause),
  ];
  const base = `Aura eco standard: ${clauses.join("; ")}.`;
  const owner = ownerText.trim().replace(/\s+/g, " ");
  if (!owner) return { notes: base.slice(0, NOTES_MAX), dropped: 0 };

  const prefix = " Owner notes: ";
  const room = NOTES_MAX - base.length - prefix.length;
  if (room <= 0) return { notes: base.slice(0, NOTES_MAX), dropped: owner.length };
  if (owner.length <= room) return { notes: base + prefix + owner, dropped: 0 };
  return {
    notes: base + prefix + owner.slice(0, room),
    dropped: owner.length - room,
  };
}

/* ------------------------------------------------------------- formatting */

/** Feet-and-inches, the way the drawing's dimension strings read: 34'-6".
 *  Re-exported from lib/units so this module's many importers keep their
 *  path while the body lives in the one place all six formatters share. */
export const feetInches = (v: number): string => formatFeetInches(v);

export const sqft = (n: number): string => `${Math.round(n).toLocaleString("en-CA")} sq ft`;

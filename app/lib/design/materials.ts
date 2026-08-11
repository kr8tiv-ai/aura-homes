/* ---------------------------------------------------------------------
   THE ECO SPINE + THE BILL OF MATERIALS.

   A faithful browser port of `design-api/app/eco.py` and
   `design-api/app/materials.py`. The FastAPI service already runs this exact
   logic with NO API KEYS AT ALL; moving it into the browser is what lets the
   static site answer the 02 · DESIGN step with no server to fail during
   judging. The Python stays the source of truth — if the two ever disagree,
   the Python is right and this file is the bug.

   ── from eco.py ──────────────────────────────────────────────────────────
   Nothing generic is allowed through. Every design this pipeline emits is an
   off-grid Aura eco-home, and the constraints below are the repo's own
   standing doctrine — pulled from docs/VISION.md, docs/AI-HANDOFF.md and
   docs/research/FOUNDATIONS-NO-CONCRETE.md, not invented here:

     · NO CONCRETE, ever. Protected galvanized screw piles are the foundation
       standard. Grouted pile variants are excluded because they reintroduce
       cementitious material into the ground. Hempcrete is NON-STRUCTURAL
       infill only — never a foundation and never a structural wall.
     · AWG on every home, honestly labelled. Condenser cutoff is ~15 °C /
       30% RH, so outdoor winter output in zone 7A/7B/8 is ZERO litres. A
       cistern or well carries winter, always. The module ships anyway as the
       summer producer (10–20 L/day, June–September).
     · Glass-forward, but code-legal. FDWR ≤ 22% on the NBC 9.36 prescriptive
       path, oriented for winter solar gain.
     · Solar + LiFePO4 + an auto-start generator that is NOT optional in an
       Alberta January, plus a WETT-inspected wood stove.
     · Greywater to a subsurface-drip field; rainwater to the cistern.
     · SIP because the envelope is the enemy in zone 7A. Honest lead time is
       12–20 weeks and no software shortens a panel plant's queue.

   These are not decoration on the prompt — they drive wall thickness, the
   glazing budget, the systems that appear on the plan, and the materials list
   the procurement step prices in USDC.

   ── from materials.py ────────────────────────────────────────────────────
   Quantities come from the plan, not from a table of guesses: wall area from
   the envelope perimeter and storey height, roof area from the footprint and
   pitch, glazing from the actual window openings the layout engine placed,
   pile count from the footprint and an ~8 ft grid. That is what makes this a
   procurement input rather than a brochure.

   Prices are CAD ranges with a stated basis, matching the discipline in
   `data/alberta/cost-model.json` — ranges, never point estimates, and every
   line carries where the number came from.

   PURITY CONTRACT: no network, no Node APIs, no Math.random, no Date.now.
   Identical input gives identical output, forever.
--------------------------------------------------------------------- */

import type { ClimateZone, EcoMaterial } from "@/lib/designApi";

/* =====================================================================
   NUMERIC + FORMATTING HELPERS

   These exist only so the port produces byte-identical strings and numbers
   to the Python. They are not general-purpose utilities.
   ===================================================================== */

/**
 * Python's `round()` — round-half-to-EVEN, not JavaScript's round-half-up.
 *
 * `Math.round(2.5) === 3` but `round(2.5) == 2` in Python, and `Math.round`
 * additionally breaks negative ties the other way (`Math.round(-3.5) === -3`
 * vs Python's `-4`). Exact ties are rare in this arithmetic, but "rare" is
 * not "never" and this module's whole promise is that the browser and the
 * service agree on every digit.
 */
export function pyRound(value: number, digits = 0): number {
  const scale = 10 ** digits;
  const x = value * scale;
  const low = Math.floor(x);
  const frac = x - low;
  let r: number;
  if (frac > 0.5) r = low + 1;
  else if (frac < 0.5) r = low;
  else r = low % 2 === 0 ? low : low + 1; // the tie: pick the even neighbour
  return r / scale;
}

/**
 * Python's `f"{n:g}"` — 6 significant digits with trailing zeros stripped,
 * so `8.0` prints as "8" and `7.5` prints as "7.5" on the array labels.
 * Only ever fed system sizes (0–100), well inside the range where `:g`
 * stays in positional rather than exponent notation.
 */
function fmtG(n: number): string {
  return String(Number(n.toPrecision(6)));
}

/**
 * Python's `f"{n:,}"` thousands separator ("9000" -> "9,000"). Done with a
 * regex rather than `toLocaleString` so the output cannot drift with the
 * viewer's ICU data — a cistern label is part of a quoted document.
 */
function fmtThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Python's `str.title()` over an underscore-separated material key. */
function titleCase(s: string): string {
  return s
    .replace(/_/g, " ") // Python's str.replace swaps ALL occurrences
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/* =====================================================================
   MATERIALS — the structural choice, which is a geometry input
   ===================================================================== */

/**
 * The full material set the building-science tables cover.
 *
 * `EcoMaterial` (imported, frozen in `lib/designApi.ts`) is the four the
 * questionnaire offers. The service's tables also carry three the design
 * pipeline can reach internally, so this widens rather than redefines —
 * every `EcoMaterial` is a valid `EcoMaterialKey`.
 */
export type EcoMaterialKey =
  | EcoMaterial // "sip" | "rammed_earth" | "clt" | "timber_frame"
  | "bamboo"
  | "reclaimed_timber"
  | "hempcrete_infill"; // non-structural, paired with a frame

export const ECO_MATERIALS: readonly EcoMaterialKey[] = [
  "sip",
  "clt",
  "timber_frame",
  "rammed_earth",
  "bamboo",
  "reclaimed_timber",
  "hempcrete_infill",
];

/**
 * Structural wall thickness in mm. Real numbers — they change the plan, the
 * net internal area, and the price per square foot, which is why the wall is
 * modelled instead of drawn as a generic line. The packer insets the interior
 * envelope by this on all four sides.
 */
export const WALL_THICKNESS_MM: Readonly<Record<EcoMaterialKey, number>> = {
  sip: 165,
  clt: 128,
  timber_frame: 190,
  rammed_earth: 450,
  bamboo: 175,
  reclaimed_timber: 200,
  hempcrete_infill: 300, // timber frame + hempcrete infill
};

/** Effective R-value of the assembly, for the honest energy note on the sheet. */
export const WALL_R_VALUE: Readonly<Record<EcoMaterialKey, number>> = {
  sip: 40,
  clt: 28,
  timber_frame: 32,
  rammed_earth: 26, // mass, not resistance — needs an insulated core
  bamboo: 24,
  reclaimed_timber: 30,
  hempcrete_infill: 27,
};

/**
 * Interior partitions are the same everywhere — they are not structural.
 * (Mirrors `PARTITION_MM` in `design-api/app/models.py`, which is where the
 * layout engine reads it from; kept here because it is a wall-assembly fact,
 * not a schema detail.)
 */
export const PARTITION_MM = 90;

/**
 * Fenestration-and-door-to-wall ratio ceiling on the **NBC 9.36 prescriptive
 * path**. The design step already enforces this in the TypeScript pipeline;
 * the blueprint must not silently draw more glass than the code allows.
 */
export const FDWR_MAX = 0.22;

/** Materials that are NOT structural on their own and must carry a frame. */
export const NON_STRUCTURAL: ReadonlySet<EcoMaterialKey> =
  new Set<EcoMaterialKey>(["hempcrete_infill"]);

export type NonStructuralMaterial = "hempcrete_infill";
export type StructuralMaterial = Exclude<EcoMaterialKey, NonStructuralMaterial>;

/** Type guard so the BOM branch that needs a frame is checked, not assumed. */
export const isNonStructural = (m: EcoMaterialKey): m is NonStructuralMaterial =>
  NON_STRUCTURAL.has(m);

/** NBC zones where winter is the design case — 7A, 7B and 8. */
export const isColdZone = (zone: string): boolean =>
  zone.startsWith("7") || zone === "8";

/* =====================================================================
   THE OFF-GRID KIT
   ===================================================================== */

/** Which way the long glazed face points. Passive-solar wants south. */
export type Orientation =
  | "south"
  | "south_east"
  | "south_west"
  | "east"
  | "west"
  | "north";

/** The off-grid kit. Defaults are the Aura standard, not a blank slate. */
export interface EcoSystems {
  /** Atmospheric water generation — standard on every home. */
  awg: boolean;
  /** 0–30 kW. */
  solar_kw: number;
  /** 0–100 kWh. */
  battery_kwh: number;
  /** Auto-start; not optional in an Alberta January. */
  generator: boolean;
  /** WETT-inspected. */
  wood_stove: boolean;
  /** Biofilter + subsurface drip. */
  greywater: boolean;
  /** Roof catchment to the cistern. */
  rainwater: boolean;
  /** 0–40,000 L. */
  cistern_litres: number;
  composting_toilet: boolean;
  /** Wood-fired — a costed first-class line item. */
  hot_tub: boolean;
  deck: boolean;
  /** Heat-recovery ventilation; airtight envelopes need it. */
  hrv: boolean;
  /** Off-grid by default, grid-connectable forever. */
  grid_optional: boolean;
  /** Interior fit-out that should read as Aura rather than generic. */
  cork_flooring: boolean;
  reclaimed_interior: boolean;
  furniture_package: boolean;
}

/** The Aura standard kit — the Pydantic defaults, verbatim. */
export const DEFAULT_ECO_SYSTEMS: Readonly<EcoSystems> = Object.freeze({
  awg: true,
  solar_kw: 8.0,
  battery_kwh: 24.0,
  generator: true,
  wood_stove: true,
  greywater: true,
  rainwater: true,
  cistern_litres: 9000,
  composting_toilet: false,
  hot_tub: true,
  deck: true,
  hrv: true,
  grid_optional: true,
  cork_flooring: true,
  reclaimed_interior: true,
  furniture_package: false,
});

/** The numeric bounds Pydantic declares on `EcoSystems`. */
export const ECO_SYSTEM_LIMITS = Object.freeze({
  solar_kw: Object.freeze({ min: 0, max: 30 }),
  battery_kwh: Object.freeze({ min: 0, max: 100 }),
  cistern_litres: Object.freeze({ min: 0, max: 40000 }),
});

/**
 * Merge overrides onto the Aura standard.
 *
 * DELIBERATE DIFFERENCE FROM THE PYTHON, named rather than hidden: Pydantic
 * *rejects* an out-of-range value with a 422. This path is the browser
 * fallback whose entire reason for existing is that it never hard-fails, so
 * it CLAMPS to the same bounds instead of throwing. A caller that needs the
 * strict behaviour should validate against `ECO_SYSTEM_LIMITS` first.
 */
export function ecoSystems(overrides: Partial<EcoSystems> = {}): EcoSystems {
  const s = { ...DEFAULT_ECO_SYSTEMS, ...overrides };
  const L = ECO_SYSTEM_LIMITS;
  return {
    ...s,
    solar_kw: clamp(s.solar_kw, L.solar_kw.min, L.solar_kw.max),
    battery_kwh: clamp(s.battery_kwh, L.battery_kwh.min, L.battery_kwh.max),
    // integer field in the Pydantic model
    cistern_litres: Math.round(
      clamp(s.cistern_litres, L.cistern_litres.min, L.cistern_litres.max)
    ),
  };
}

export interface SiteContext {
  orientation: Orientation;
  /** Foundation is not a choice. It is screw piles, because no concrete. */
  readonly foundation: "protected_galvanized_screw_piles";
  tree_cover: boolean;
  snow_load: boolean;
}

export const SCREW_PILE_FOUNDATION = "protected_galvanized_screw_piles" as const;

export const DEFAULT_SITE_CONTEXT: Readonly<SiteContext> = Object.freeze({
  orientation: "south" as Orientation,
  foundation: SCREW_PILE_FOUNDATION,
  tree_cover: true,
  snow_load: true,
});

/**
 * Site context with overrides. `foundation` is `frozen=True` in the Pydantic
 * model, so it is re-asserted last here and cannot be overridden — there is
 * no code path in this product that pours concrete.
 */
export function siteContext(
  overrides: Partial<Omit<SiteContext, "foundation">> = {}
): SiteContext {
  return { ...DEFAULT_SITE_CONTEXT, ...overrides, foundation: SCREW_PILE_FOUNDATION };
}

/* =====================================================================
   RENDER VOCABULARY — exact construction nouns, never adjectives
   ===================================================================== */

export const MATERIAL_KEYWORDS: Readonly<Record<EcoMaterialKey, readonly string[]>> = {
  sip: [
    "structural insulated panel construction",
    "flush vertical shiplap cladding",
    "standing seam metal roof",
  ],
  clt: [
    "CLT panels",
    "exposed cross-laminated timber soffits",
    "visible finger-jointed lamellae",
    "blackened steel connections",
  ],
  timber_frame: [
    "exposed douglas fir post and beam frame",
    "mortise and tenon joinery",
    "charred shou sugi ban cedar cladding",
  ],
  rammed_earth: [
    "rammed earth walls",
    "visible horizontal lift lines",
    "ochre and sand stratification",
    "deep window reveals",
  ],
  bamboo: [
    "laminated bamboo panels",
    "visible bamboo node grain",
    "natural oiled finish",
  ],
  reclaimed_timber: [
    "reclaimed barnwood cladding",
    "weathered grey patina",
    "visible original nail holes",
    "salvaged douglas fir beams",
  ],
  hempcrete_infill: [
    "hempcrete infill between exposed timber studs",
    "lime plaster finish",
    "breathable wall assembly",
  ],
};

export const SYSTEM_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  solar: ["roof-mounted monocrystalline solar array", "no overhead power lines"],
  // "on a exterior" is copied verbatim from eco.py, typo included: the two
  // paths must emit the same prompt string or the renders diverge.
  awg: ["compact atmospheric water generator on a exterior equipment pad"],
  wood_stove: ["black steel wood stove flue through the roof"],
  hot_tub: ["wood-fired cedar hot tub", "cedar deck"],
  greywater: ["subsurface drip irrigation field", "no visible septic mound"],
  rainwater: ["roof catchment gutters to a buried cistern"],
  cork_flooring: ["cork flooring"],
  reclaimed_interior: ["reclaimed timber interior joinery"],
  screw_piles: [
    "elevated on galvanized screw piles",
    "no concrete foundation",
    "visible crawl space shadow",
  ],
  glass: [
    "triple-glazed windows",
    "black anodised aluminium frames",
    "fluted glass entry screen",
  ],
};

/**
 * Never allowed to appear. The first three are the eco tells that would make
 * a render wrong for this brand; the rest are the AI-render failure modes.
 */
export const NEGATIVE =
  "poured concrete foundation, concrete slab, cinder block, " +
  "asphalt shingles, vinyl siding, PVC windows, satellite dish, " +
  "overhead power lines, air conditioner unit, manicured lawn, " +
  "warped perspective, curved walls, impossible cantilever, melted mullions, " +
  "duplicated windows, misaligned roofline, illegible text, watermark, " +
  "signature, people, cars, oversaturated sky, lens flare, heavy vignette, " +
  "HDR halo, fisheye, cluttered decor, plastic sheen, cartoon, concept art";

/** The exact-noun vocabulary for one design. */
export function keywordsFor(
  material: EcoMaterialKey,
  systems: EcoSystems,
  site: SiteContext,
  zone: ClimateZone | string
): string[] {
  const kw: string[] = [...MATERIAL_KEYWORDS[material]];
  if (isNonStructural(material)) kw.unshift("exposed timber structural frame");
  kw.push(...SYSTEM_KEYWORDS.screw_piles); // always — no concrete, ever
  kw.push(...SYSTEM_KEYWORDS.glass);
  if (systems.solar_kw > 0) kw.push(...SYSTEM_KEYWORDS.solar);
  if (systems.awg) kw.push(...SYSTEM_KEYWORDS.awg);
  if (systems.wood_stove) kw.push(...SYSTEM_KEYWORDS.wood_stove);
  if (systems.hot_tub) kw.push(...SYSTEM_KEYWORDS.hot_tub);
  if (systems.greywater) kw.push(...SYSTEM_KEYWORDS.greywater);
  if (systems.rainwater) kw.push(...SYSTEM_KEYWORDS.rainwater);
  if (systems.cork_flooring) kw.push(...SYSTEM_KEYWORDS.cork_flooring);
  if (systems.reclaimed_interior) kw.push(...SYSTEM_KEYWORDS.reclaimed_interior);
  if (site.orientation.startsWith("south")) {
    kw.push("south-facing glazing band", "deep summer shading overhang");
  }
  if (isColdZone(zone)) {
    kw.push("snow on the ground", "bare birch and spruce", "cold climate detailing");
  }
  return kw;
}

/** Corrections the repo refuses to un-learn. Returned with every design. */
export function honestyNotes(systems: EcoSystems, zone: ClimateZone | string): string[] {
  const out: string[] = [];
  if (systems.awg && isColdZone(zone)) {
    out.push(
      "The atmospheric water generator produces roughly 10–20 L/day from June to " +
        "September and ZERO litres outdoors in winter — condenser cutoff is near " +
        "15 °C / 30% RH. The cistern or well carries the winter, always."
    );
  }
  if (systems.solar_kw > 0 && isColdZone(zone)) {
    out.push(
      "December solar yield in this zone is about 1.3 kWh/kW/day — a 70–77% collapse. " +
        "The generator is not optional and the wood stove is the heat of last resort."
    );
  }
  if (!systems.generator && systems.grid_optional) {
    out.push(
      "No generator selected. Off-grid in an Alberta January without one is a real risk."
    );
  }
  out.push(
    "Foundation is protected galvanized screw piles — cement-free, minimal-disturbance " +
      "and reversible. Not 'zero carbon': the steel carries embodied carbon and we say so."
  );
  return out;
}

/* =====================================================================
   BILL OF MATERIALS — derived from the solved geometry
   ===================================================================== */

/** Unused by the BOM arithmetic (which is imperial throughout), but declared
 *  in materials.py beside WALL_HEIGHT_FT and kept so the two files match. */
export const FT2_PER_M2 = 10.7639;

/** Storey height assumed by the wall-area take-off, feet. */
export const WALL_HEIGHT_FT = 9.0;

export type Category =
  | "foundation"
  | "shell"
  | "roof"
  | "glazing"
  | "energy"
  | "water"
  | "waste"
  | "interior"
  | "outdoor"
  | "mechanical";

/**
 * One priced line. Field names stay snake_case because this is the same
 * object the FastAPI service serialises — the two must be interchangeable
 * on the wire without a translation layer.
 */
export interface LineItem {
  key: string;
  label: string;
  category: Category;
  qty: number;
  unit: string;
  cad_low: number;
  cad_mid: number;
  cad_high: number;
  basis: string;
  /**
   * Owner-buildable per Alberta rules — solar wiring, septic install and
   * well drilling are licensed work and are marked false.
   */
  owner_buildable: boolean;
  /** Suppliers that plausibly carry it, by procurement tag (see procurement.py). */
  supplier_tags: string[];
}

export interface BillOfMaterials {
  items: LineItem[];
  cad_low: number;
  cad_mid: number;
  cad_high: number;
  notes: string[];
}

/** The `mid_total` property from the Pydantic model. */
export const midTotal = (item: LineItem): number => item.cad_mid;

/** The `by_category` property — grouping preserves BOM order within a group. */
export function byCategory(bom: BillOfMaterials): Record<string, LineItem[]> {
  const out: Record<string, LineItem[]> = {};
  for (const i of bom.items) (out[i.category] ??= []).push(i);
  return out;
}

/** Totals are quoted to the nearest $50 — a range this wide has no business
 *  reporting dollars and cents. */
const roundTotal = (v: number, step = 50.0): number => pyRound(v / step) * step;

/** Shell rate card: [low, mid, high] CAD per sq ft of wall, basis, tags. */
type ShellRate = readonly [number, number, number, string, readonly string[]];

const SHELL_RATES: Readonly<Record<StructuralMaterial, ShellRate>> = {
  sip: [
    30,
    42,
    55,
    "SIP kit incl. panels, splines, sealant; 12–20 week lead time from approved drawings.",
    ["sip", "panels"],
  ],
  clt: [46, 62, 84, "CLT panel package, CNC-cut, delivered.", ["clt", "timber"]],
  timber_frame: [
    26,
    36,
    48,
    "Post-and-beam frame + insulated infill assembly.",
    ["timber", "lumber"],
  ],
  rammed_earth: [
    52,
    74,
    105,
    "Stabilised rammed earth with insulated core; formwork and labour dominate.",
    ["rammed_earth", "natural_building"],
  ],
  bamboo: [34, 47, 63, "Laminated structural bamboo panels, imported.", ["bamboo", "panels"]],
  reclaimed_timber: [
    28,
    44,
    68,
    "Salvaged structural timber; price swings on availability.",
    ["reclaimed", "timber"],
  ],
};

export interface BuildBomArgs {
  width_ft: number;
  depth_ft: number;
  gross_sq_ft: number;
  /** Windows the layout engine actually placed — not a rule of thumb. */
  window_count: number;
  /** Their glazed area, sq ft. Subtracted from the wall take-off. */
  glazing_sq_ft: number;
  material: EcoMaterialKey;
  systems: EcoSystems;
  storeys?: number;
}

/** Derive the BOM from solved geometry. */
export function buildBom({
  width_ft,
  depth_ft,
  gross_sq_ft,
  window_count,
  glazing_sq_ft,
  material,
  systems,
  storeys = 1,
}: BuildBomArgs): BillOfMaterials {
  const items: LineItem[] = [];
  const notes: string[] = [];

  const perimeter = 2 * (width_ft + depth_ft);
  const wall_area = perimeter * WALL_HEIGHT_FT * storeys - glazing_sq_ft;
  const footprint = width_ft * depth_ft;
  const roof_area = footprint * 1.18; // 6:12 pitch + overhangs

  type NewItem = Omit<LineItem, "owner_buildable" | "supplier_tags"> &
    Partial<Pick<LineItem, "owner_buildable" | "supplier_tags">>;
  const add = (item: NewItem): void => {
    items.push({ owner_buildable: true, supplier_tags: [], ...item });
  };

  // ---- FOUNDATION — screw piles, never concrete
  const piles = Math.max(9, Math.ceil(footprint / 64)); // ~8ft grid
  add({
    key: "screw_piles",
    label: "Protected galvanized screw piles, installed",
    category: "foundation",
    qty: piles,
    unit: "piles",
    cad_low: piles * 380,
    cad_mid: piles * 520,
    cad_high: piles * 700,
    basis:
      "AC228-compliant galvanized helical piles, Alberta installed rate $380–700/pile. " +
      "Grouted variants excluded — they reintroduce cementitious material.",
    owner_buildable: false,
    supplier_tags: ["piles", "steel"],
  });

  // ---- SHELL
  if (isNonStructural(material)) {
    add({
      key: "timber_frame",
      label: "Structural timber frame (carries the infill)",
      category: "shell",
      qty: pyRound(wall_area, 0),
      unit: "sq ft wall",
      cad_low: wall_area * 14,
      cad_mid: wall_area * 19,
      cad_high: wall_area * 26,
      basis: "Post-and-beam frame required — hempcrete is non-structural infill only.",
      supplier_tags: ["timber", "lumber"],
    });
    add({
      key: "hempcrete",
      label: "Hempcrete infill + lime plaster",
      category: "shell",
      qty: pyRound(wall_area, 0),
      unit: "sq ft wall",
      cad_low: wall_area * 16,
      cad_mid: wall_area * 24,
      cad_high: wall_area * 34,
      basis: "Hemp hurd + lime binder, cast in situ between studs.",
      supplier_tags: ["hempcrete", "natural_building"],
    });
  } else {
    const [lo, mid, hi, basis, tags] = SHELL_RATES[material];
    add({
      key: "shell",
      // Python's .title() over the raw key, so "sip" reads "Sip" and
      // "rammed_earth" reads "Rammed Earth". Ported as-is, not prettified.
      label: `${titleCase(material)} shell kit + erection`,
      category: "shell",
      qty: pyRound(wall_area, 0),
      unit: "sq ft wall",
      cad_low: wall_area * lo,
      cad_mid: wall_area * mid,
      cad_high: wall_area * hi,
      basis,
      supplier_tags: [...tags],
    });
  }

  // ---- ROOF
  add({
    key: "roof",
    label: "Standing seam metal roof + underlayment",
    category: "roof",
    qty: pyRound(roof_area, 0),
    unit: "sq ft",
    cad_low: roof_area * 9,
    cad_mid: roof_area * 13,
    cad_high: roof_area * 18,
    basis: "Metal roof $8–15/sq ft installed; required for the rainwater catchment.",
    supplier_tags: ["roofing", "steel"],
  });

  // ---- GLAZING
  if (window_count) {
    add({
      key: "windows",
      label: "Triple-glazed windows, black anodised frames",
      category: "glazing",
      qty: window_count,
      unit: "units",
      cad_low: window_count * 900,
      cad_mid: window_count * 1350,
      cad_high: window_count * 1800,
      // The 22% is the NBC 9.36 prescriptive FDWR ceiling — see FDWR_MAX.
      basis: "Zone 7A triple-pane $900–1,800/window. Glass-forward but FDWR ≤ 22%.",
      supplier_tags: ["windows", "glazing"],
    });
  }
  add({
    key: "doors",
    label: "Insulated exterior doors",
    category: "glazing",
    qty: 2,
    unit: "units",
    cad_low: 1400,
    cad_mid: 2200,
    cad_high: 3200,
    basis: "Entry + secondary egress.",
    supplier_tags: ["doors"],
  });

  // ---- ENERGY
  if (systems.solar_kw > 0) {
    const kw = systems.solar_kw;
    add({
      key: "solar",
      label: `Solar array, ${fmtG(kw)} kW`,
      category: "energy",
      qty: kw,
      unit: "kW",
      cad_low: kw * 2100,
      cad_mid: kw * 2700,
      cad_high: kw * 3400,
      basis:
        "Off-grid array incl. racking + MPPT. Wiring is licensed work (CEC s.64).",
      owner_buildable: false,
      supplier_tags: ["solar", "electrical"],
    });
  }
  if (systems.battery_kwh > 0) {
    const k = systems.battery_kwh;
    add({
      key: "battery",
      label: `LiFePO4 battery bank, ${fmtG(k)} kWh`,
      category: "energy",
      qty: k,
      unit: "kWh",
      cad_low: k * 430,
      cad_mid: k * 560,
      cad_high: k * 720,
      basis: "Cold-rated LiFePO4 with heated enclosure.",
      owner_buildable: false,
      supplier_tags: ["battery", "solar"],
    });
  }
  if (systems.generator) {
    add({
      key: "generator",
      label: "Auto-start backup generator",
      category: "energy",
      qty: 1,
      unit: "unit",
      cad_low: 4500,
      cad_mid: 7200,
      cad_high: 11000,
      basis:
        "Not optional in an Alberta January — December yield collapses 70–77%.",
      owner_buildable: false,
      supplier_tags: ["generator", "electrical"],
    });
  }
  if (systems.wood_stove) {
    add({
      key: "wood_stove",
      label: "Wood stove + WETT-inspected chimney",
      category: "energy",
      qty: 1,
      unit: "unit",
      cad_low: 3200,
      cad_mid: 5000,
      cad_high: 7500,
      basis: "WETT inspection required for insurance.",
      supplier_tags: ["stove", "hearth"],
    });
  }

  // ---- WATER
  if (systems.awg) {
    add({
      key: "awg",
      label: "Atmospheric water generator (summer producer)",
      category: "water",
      qty: 1,
      unit: "unit",
      cad_low: 3500,
      cad_mid: 5000,
      cad_high: 8000,
      basis:
        "Standard on every Aura home. 10–20 L/day Jun–Sep; ZERO outdoors in winter.",
      supplier_tags: ["awg", "water"],
    });
  }
  if (systems.cistern_litres > 0) {
    const L = systems.cistern_litres;
    add({
      key: "cistern",
      label: `Buried cistern, ${fmtThousands(L)} L + pump and filtration`,
      category: "water",
      qty: 1,
      unit: "system",
      cad_low: 8000,
      cad_mid: 12000,
      cad_high: 18000,
      basis: "Poly tank, never concrete. Carries winter water.",
      owner_buildable: false,
      supplier_tags: ["cistern", "water"],
    });
  }
  if (systems.rainwater) {
    add({
      key: "rainwater",
      label: "Rainwater catchment — gutters, first-flush, filtration",
      category: "water",
      qty: 1,
      unit: "system",
      cad_low: 2200,
      cad_mid: 3600,
      cad_high: 5400,
      basis: "Roof catchment to the cistern; metal roof makes it potable-capable.",
      supplier_tags: ["water", "roofing"],
    });
  }

  // ---- WASTE
  add({
    key: "septic",
    label: systems.composting_toilet
      ? "Composting toilet + greywater biofilter"
      : "Ecoflo-class septic + greywater biofilter, subsurface drip",
    category: "waste",
    qty: 1,
    unit: "system",
    cad_low: !systems.composting_toilet ? 12000 : 6500,
    cad_mid: !systems.composting_toilet ? 18000 : 10000,
    cad_high: !systems.composting_toilet ? 28000 : 15000,
    basis:
      "Certified installer by law. Greywater to subsurface drip irrigation, SOP 8.5.",
    owner_buildable: false,
    supplier_tags: ["septic", "water"],
  });

  // ---- MECHANICAL
  if (systems.hrv) {
    add({
      key: "hrv",
      label: "Heat-recovery ventilator + ducting",
      category: "mechanical",
      qty: 1,
      unit: "system",
      cad_low: 3200,
      cad_mid: 4800,
      cad_high: 7000,
      basis: "An airtight envelope requires mechanical ventilation.",
      supplier_tags: ["hvac"],
    });
  }
  add({
    key: "plumbing_electrical",
    label: "Plumbing + electrical rough-in and finish",
    category: "mechanical",
    qty: pyRound(gross_sq_ft, 0),
    unit: "sq ft",
    cad_low: gross_sq_ft * 14,
    cad_mid: gross_sq_ft * 20,
    cad_high: gross_sq_ft * 28,
    basis:
      "Homeowner may pull their own permits under an Owner Builder Authorization.",
    supplier_tags: ["plumbing", "electrical"],
  });

  // ---- INTERIOR
  add({
    key: "interior",
    label: "Interior fit-out — kitchen, bath, partitions, finishes",
    category: "interior",
    qty: pyRound(gross_sq_ft, 0),
    unit: "sq ft",
    cad_low: gross_sq_ft * 26,
    cad_mid: gross_sq_ft * 42,
    cad_high: gross_sq_ft * 66,
    basis: "Owner-buildable. Ranges swing hardest here.",
    supplier_tags: ["interior", "millwork"],
  });
  if (systems.cork_flooring) {
    add({
      key: "cork",
      label: "Cork flooring",
      category: "interior",
      // 0.8 — wet rooms and mechanical do not get cork.
      qty: pyRound(gross_sq_ft * 0.8, 0),
      unit: "sq ft",
      cad_low: gross_sq_ft * 0.8 * 7,
      cad_mid: gross_sq_ft * 0.8 * 10,
      cad_high: gross_sq_ft * 0.8 * 14,
      basis: "Renewable, warm underfoot, quiet. Harvested without felling the tree.",
      supplier_tags: ["flooring", "cork"],
    });
  }
  if (systems.reclaimed_interior) {
    add({
      key: "reclaimed_interior",
      label: "Reclaimed timber interior joinery",
      category: "interior",
      qty: 1,
      unit: "package",
      cad_low: 3500,
      cad_mid: 6500,
      cad_high: 12000,
      basis: "Salvaged stock; availability drives price.",
      supplier_tags: ["reclaimed", "millwork"],
    });
  }
  if (systems.furniture_package) {
    add({
      key: "furniture",
      label: "Furniture package (eco-sourced)",
      category: "interior",
      qty: 1,
      unit: "package",
      cad_low: 8000,
      cad_mid: 16000,
      cad_high: 32000,
      basis: "Optional. FSC/reclaimed sourcing.",
      supplier_tags: ["furniture"],
    });
  }

  // ---- OUTDOOR
  if (systems.hot_tub || systems.deck) {
    add({
      key: "tub_deck",
      label: "Wood-fired cedar hot tub + deck",
      category: "outdoor",
      qty: 1,
      unit: "package",
      cad_low: 8000,
      cad_mid: 14000,
      cad_high: 22000,
      basis:
        "A first-class costed line item, not an afterthought. Deck $25–45/sq ft; " +
        "no permit under 24in height.",
      supplier_tags: ["hot_tub", "lumber"],
    });
  }

  const sum = (pick: (i: LineItem) => number): number =>
    items.reduce((a, i) => a + pick(i), 0);

  const lo = roundTotal(sum((i) => i.cad_low));
  const mid = roundTotal(sum((i) => i.cad_mid));
  const hi = roundTotal(sum((i) => i.cad_high));

  notes.push(
    "Ranges with a basis, never point estimates. Excludes land, permits, design " +
      "fees and contingency — those live in data/alberta/cost-model.json."
  );
  if (material === "sip") {
    notes.push(
      "SIP lead time is 12–20 weeks from approved drawings. Order at week zero."
    );
  }

  return { items, cad_low: lo, cad_mid: mid, cad_high: hi, notes };
}

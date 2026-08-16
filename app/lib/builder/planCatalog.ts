/**
 * Curated concept plans that enter the exact same BuilderDocument pipeline as
 * a blank-slate design. External work only appears when its reuse terms are
 * explicit and permit commercial use. Attribution and change notices are
 * repeated in the instantiated HomeSpec notes so they survive save, share,
 * export and later edits.
 *
 * These are editable design-intent studies, never permit or construction
 * drawings. The source links remain the authority for any third-party plan.
 */

import { builderDocumentFromLegacySpec, type BuilderDocument } from "./document";
import {
  glazedAreaSqFt,
  groundFootprintSqFt,
  totalFloorAreaSqFt,
  type HomeSpec,
  type Opening,
  type RoofForm,
  type Volume,
  type Wall,
} from "./spec";
import { buildBom, ecoSystems } from "@/lib/design/materials";
import type { EcoMaterial } from "@/lib/designApi";

export type PlanSource =
  | {
      kind: "aura-authored";
      name: "Aura Homes";
      url: string;
      license: "MIT";
      licenseUrl: string;
      attribution: string;
      changes: string;
      shareAlike: false;
      relationship: "original";
    }
  | {
      kind: "licensed-adaptation";
      name: string;
      url: string;
      license: string;
      licenseUrl: string;
      attribution: string;
      changes: string;
      shareAlike: true;
      relationship: "dimensional-adaptation" | "system-informed-study";
    }
  /** US-government plan sets (17 USC 105) and other verified public-domain
   *  work. No licence survives to pass on — shareAlike is structurally false —
   *  but the provenance chain is recorded exactly as carefully as a licence,
   *  because "public domain" claimed without evidence is how a catalog ends up
   *  shipping somebody's copyrighted drawings. Every entry names where the
   *  rights statement was read and what Aura changed. */
  | {
      kind: "public-domain-adaptation";
      name: string;
      url: string;
      license: string;
      licenseUrl: string;
      attribution: string;
      changes: string;
      shareAlike: false;
      relationship: "dimensional-adaptation" | "system-informed-study";
    };

export interface PlanTemplate {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  bestFor: string;
  bedrooms: number;
  bathrooms: number;
  sleeping: string;
  storeys: 1 | 2;
  tags: readonly string[];
  features: readonly string[];
  /** How honestly the shared Alberta BOM represents this design's intended
   *  construction. A proxy is still useful for scale, but must never read as
   *  a steel/polycarbonate quote. */
  costBasis?: PlanCostBasis;
  source: PlanSource;
  spec: HomeSpec;
}

export interface PlanCostBasis {
  status: "modelled" | "proxy";
  label: string;
  note: string;
}

export interface PlanTemplateEstimate {
  currency: "CAD";
  jurisdiction: "Alberta pilot";
  areaSqFt: number;
  footprintSqFt: number;
  /** How much `footprintSqFt` — and, for a single-storey plan, `areaSqFt` with
   *  it — over-reports, because overlapping volumes are summed rather than
   *  unioned. 0 for the great majority of the library. Never silently
   *  subtracted: the published number and its error are both shown, because a
   *  number that quietly changed would be a different lie. */
  footprintOverlapSqFt: number;
  low: number;
  mid: number;
  high: number;
  lineItems: number;
  assumptions: string[];
  costBasis: PlanCostBasis;
}

const AURA_REPO = "https://github.com/kr8tiv-ai/aura-homes";
const AURA_LICENSE = `${AURA_REPO}/blob/main/LICENSE`;
const MODELLED_COST_BASIS: PlanCostBasis = {
  status: "modelled",
  label: "Modelled Aura basis",
  note: "The range uses the material and systems selected in this editable concept.",
};

const auraSource = (): PlanSource => ({
  kind: "aura-authored",
  name: "Aura Homes",
  url: AURA_REPO,
  license: "MIT",
  licenseUrl: AURA_LICENSE,
  attribution: "Original editable concept by Aura Homes.",
  changes: "No third-party plan geometry was copied.",
  shareAlike: false,
  relationship: "original",
});

const opening = (
  id: string,
  wall: Opening["wall"],
  kind: Opening["kind"],
  widthFt: number,
  heightFt: number,
  offsetFt: number,
  sillFt = kind === "window" ? 3 : 0,
): Opening => ({ id, wall, kind, widthFt, heightFt, offsetFt, sillFt });

interface VolumeInput {
  id?: string;
  name?: string;
  width: number;
  depth: number;
  x?: number;
  z?: number;
  rotation?: number;
  storeys?: 1 | 2;
  height?: number;
  roof?: RoofForm;
  pitch?: number;
  glass?: boolean;
  /** Hand-authored openings replace the default pattern entirely. The
   *  default gave every plan the same south glazing + door + two side
   *  windows — fine for a first library, but twenty identical elevations is
   *  how a catalog stops reading as choice. Plans that are ABOUT their
   *  openings (the Nordic lantern walls especially) author them here. */
  openings?: Opening[];
  /** Eave overhang in feet. Every plan in the library used the same 1.5 until
   *  PL03, which is a real design variable left constant: geometry.ts projects
   *  `roof.overhangFt` on all four sides into `boundsWithRoof`, and toPlan.ts
   *  prints it on the drawing note, so the number is load-bearing rather than
   *  decorative. A plan whose SHADING STRATEGY is the roof states the depth
   *  here and in its notes, and tests/plan-catalog.spec.ts checks the two
   *  against each other and against the roof geometry.ts actually draws. */
  overhang?: number;
  /** Which way a shed or saltbox slope falls. geometry.ts defaults a shed to
   *  "s" (array in the sun) and a saltbox to "n" (long slope on the weather
   *  side) — but the `volume()` helper below has always written "s" onto BOTH
   *  forms, so the library's two saltboxes, `hearth-accessible` and
   *  `saltbox-nord`, have overridden geometry.ts's "n" since long before PL03.
   *  That override is load-bearing rather than incidental: saltbox-nord's own
   *  summary is a long slope carrying down over the glazed elevation, and the
   *  glazed elevation is the south one, so a saltbox left at geometry.ts's
   *  default would drop its long slope on the blank wall.
   *
   *  What PL03 added is the first use of this INPUT. A courtyard needs its
   *  roofs to fall AWAY from the court and no pitch will do that, so plans
   *  where the fall direction is the idea now state it per volume instead of
   *  inheriting the helper's one answer for the whole library. */
  facing?: Wall;
}

function volume(input: VolumeInput): Volume {
  const id = input.id ?? "main";
  const width = input.width;
  const depth = input.depth;
  const glassWidth = Math.max(3, Math.min(width * 0.42, 14));
  const glassOffset = Math.max(0.6, width * 0.08);
  const doorOffset = Math.max(glassOffset + glassWidth + 0.5, width - 3.8);
  const sideWindowOffset = Math.max(1, depth / 2 - 2);
  const openings: Opening[] = input.openings ?? [
    opening(`${id}-glass`, "s", input.glass === false ? "window" : "glazing-wall", glassWidth, input.glass === false ? 4 : 8, glassOffset, input.glass === false ? 3 : 0),
    opening(`${id}-door`, "s", "door", Math.min(3, width * 0.28), 6.8, Math.min(doorOffset, width - 3.1)),
    opening(`${id}-east`, "e", "window", Math.min(4, depth * 0.35), 4, sideWindowOffset),
    opening(`${id}-west`, "w", "window", Math.min(4, depth * 0.35), 4, sideWindowOffset),
  ];

  return {
    id,
    name: input.name ?? "Main house",
    widthFt: width,
    depthFt: depth,
    x: input.x ?? 0,
    z: input.z ?? 0,
    rotationDeg: input.rotation ?? 0,
    storeys: input.storeys ?? 1,
    wallHeightFt: input.height ?? 9.5,
    roof: {
      form: input.roof ?? "gable",
      pitchDeg: input.pitch ?? (input.roof === "shed" ? 18 : input.roof === "flat" ? 2 : 35),
      overhangFt: input.overhang ?? 1.5,
      ...(input.facing
        ? { facing: input.facing }
        : input.roof === "shed" || input.roof === "saltbox"
          ? { facing: "s" as const }
          : {}),
    },
    openings,
  };
}

interface SpecInput {
  title: string;
  material?: EcoMaterial;
  volumes: Volume[];
  notes: string;
  deck?: { width: number; depth: number; hotTub?: boolean } | null;
  slope?: HomeSpec["siting"]["slope"];
}

function spec(input: SpecInput): HomeSpec {
  return {
    version: 1,
    name: input.title,
    material: input.material ?? "sip",
    climateZone: "7A",
    volumes: input.volumes,
    deck:
      input.deck === null
        ? null
        : {
            wall: "s",
            widthFt: input.deck?.width ?? Math.min(input.volumes[0]?.widthFt ?? 16, 18),
            depthFt: input.deck?.depth ?? 8,
            hotTub: input.deck?.hotTub ?? false,
          },
    siting: { frontFacesDeg: 180, slope: input.slope ?? "flat" },
    notes: input.notes,
  };
}

function original(
  value: Omit<PlanTemplate, "source" | "spec"> & { material?: EcoMaterial; volumes: Volume[]; notes: string; deck?: SpecInput["deck"]; slope?: SpecInput["slope"] },
): PlanTemplate {
  return {
    ...value,
    source: auraSource(),
    spec: spec({
      title: value.title,
      material: value.material,
      volumes: value.volumes,
      notes: value.notes,
      deck: value.deck,
      slope: value.slope,
    }),
  };
}

function adapted(
  value: Omit<PlanTemplate, "spec"> & { material?: EcoMaterial; volumes: Volume[]; notes: string; deck?: SpecInput["deck"]; slope?: SpecInput["slope"] },
): PlanTemplate {
  const notice = `${value.source.attribution} ${value.source.changes} Licensed ${value.source.license}: ${value.source.licenseUrl}. Source: ${value.source.url}.`;
  return {
    ...value,
    spec: spec({
      title: value.title,
      material: value.material,
      volumes: value.volumes,
      notes: `${notice}\n\n${value.notes}`,
      deck: value.deck,
      slope: value.slope,
    }),
  };
}

/** Same shape as `adapted`, different sentence in the embedded notice: public
 *  domain is stated as a provenance fact rather than as a licence grant. */
function publicDomain(
  value: Omit<PlanTemplate, "spec"> & { material?: EcoMaterial; volumes: Volume[]; notes: string; deck?: SpecInput["deck"]; slope?: SpecInput["slope"] },
): PlanTemplate {
  const notice = `${value.source.attribution} ${value.source.changes} Rights: ${value.source.license} (${value.source.licenseUrl}). Source: ${value.source.url}.`;
  return {
    ...value,
    spec: spec({
      title: value.title,
      material: value.material,
      volumes: value.volumes,
      notes: `${notice}\n\n${value.notes}`,
      deck: value.deck,
      slope: value.slope,
    }),
  };
}

export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  original({
    id: "northern-micro",
    title: "Northern Micro",
    kicker: "288 sq ft · one level",
    summary: "A calm one-room cabin with a real service wall, generous south light and no loft ladder.",
    bestFor: "A first cabin, backyard suite or solo retreat",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Studio / Murphy bed",
    storeys: 1,
    tags: ["under 400 sq ft", "studio", "cold climate"],
    features: ["Single-level living", "South glazing", "Simple gable shell"],
    volumes: [volume({ width: 12, depth: 24 })],
    deck: { width: 12, depth: 6 },
    notes: "Aura-authored compact studio concept. Keep sleeping, cooking and wet-room clearances explicit during professional design.",
  }),
  original({
    id: "spruce-workstay",
    title: "Spruce Workstay",
    kicker: "320 sq ft · live / work",
    summary: "A wider micro-home that gives a desk, a compact kitchen and a real bathroom their own zones.",
    bestFor: "Remote work, a guest suite or a short-stay cabin",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Studio / convertible",
    storeys: 1,
    tags: ["under 400 sq ft", "studio", "work from home"],
    features: ["Shed roof for solar", "Covered entry", "Flexible open room"],
    volumes: [volume({ width: 16, depth: 20, roof: "shed", pitch: 16 })],
    deck: { width: 14, depth: 7 },
    notes: "Aura-authored live/work concept with a south-facing shed roof. Array yield still requires a site-specific solar study.",
  }),
  original({
    id: "ridge-a-frame",
    title: "Ridge A-Frame",
    kicker: "600 sq ft · dramatic shell",
    summary: "The familiar steep silhouette, edited into a practical main floor instead of relying on an unusable novelty loft.",
    bestFor: "Mountain or forest stays with a strong arrival moment",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One main-floor bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "a-frame"],
    features: ["Tall glazed end", "Snow-shedding roof", "Main-floor sleeping"],
    volumes: [volume({ width: 20, depth: 30, roof: "a-frame", pitch: 52, height: 8.5 })],
    deck: { width: 18, depth: 9, hotTub: true },
    slope: "gentle",
    notes: "Aura-authored A-frame design-intent study. The roof-to-foundation thrust path must be engineered for the site.",
  }),
  original({
    id: "meadow-one",
    title: "Meadow One",
    kicker: "672 sq ft · one bedroom",
    summary: "A compact everyday home with an accessible bedroom, useful storage and a broad sheltered terrace.",
    bestFor: "Full-time living for one or two people",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "accessible"],
    features: ["No-step plan intent", "Deep south deck", "Compact wet core"],
    volumes: [volume({ width: 24, depth: 28, roof: "gable", pitch: 32 })],
    deck: { width: 20, depth: 10 },
    notes: "Aura-authored one-bedroom concept. Clearances are design intent until an accessibility professional and local reviewer confirm them.",
  }),
  original({
    id: "lakeside-l",
    title: "Lakeside L",
    kicker: "876 sq ft · two wings",
    summary: "Living and sleeping wings meet at one hinge, making a sheltered outdoor room without adding a complex roof valley.",
    bestFor: "A private one-bedroom home or premium short stay",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One bedroom + flexible nook",
    storeys: 1,
    tags: ["800–1,200 sq ft", "one bedroom", "multi-volume"],
    features: ["Sheltered court", "Separate quiet wing", "Two simple roofs"],
    volumes: [
      volume({ id: "living", name: "Living wing", width: 26, depth: 24 }),
      volume({ id: "sleep", name: "Sleeping wing", width: 14, depth: 18, x: 20, z: 3, rotation: 90, glass: false }),
    ],
    deck: { width: 22, depth: 11, hotTub: true },
    notes: "Aura-authored two-volume concept. The connecting threshold and roof drainage require explicit detailing in professional drawings.",
  }),
  original({
    id: "hearth-accessible",
    title: "Hearth Accessible",
    kicker: "896 sq ft · barrier-aware",
    summary: "A generous one-storey shell sized for wider circulation, a roll-in wet room and a social kitchen.",
    bestFor: "Ageing in place, multigenerational visits or mobility needs",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two main-floor bedrooms",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "accessible"],
    features: ["One storey", "Wider planning bands", "Central social space"],
    volumes: [volume({ width: 28, depth: 32, roof: "saltbox", pitch: 30 })],
    deck: { width: 22, depth: 10 },
    notes: "Aura-authored barrier-aware concept, not a certified accessible design. Door forces, turning radii and fixtures need professional confirmation.",
  }),
  original({
    id: "forest-cluster",
    title: "Forest Cluster",
    kicker: "912 sq ft · home + studio",
    summary: "A main cabin and smaller flex wing that can become an office, guest room or later rental suite.",
    bestFor: "Phased builds and people who need work separated from home",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "One bedroom + guest studio",
    storeys: 1,
    tags: ["800–1,200 sq ft", "phased build", "multi-volume"],
    features: ["Build in phases", "Separate studio", "Simple repeatable shells"],
    volumes: [
      volume({ id: "home", name: "Home", width: 24, depth: 26 }),
      volume({ id: "studio", name: "Studio", width: 16, depth: 18, x: 20, z: 2, roof: "shed", pitch: 15, glass: false }),
    ],
    deck: { width: 20, depth: 10 },
    notes: "Aura-authored phased cluster concept. The smaller volume needs its own egress, services and use classification reviewed.",
  }),
  original({
    id: "north-family-two",
    title: "North Family Two",
    kicker: "1,536 sq ft · two storeys",
    summary: "A compact family footprint that spends area vertically and keeps the roof and foundation deliberately simple.",
    bestFor: "A three-bedroom family home on a tighter parcel",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["1,200+ sq ft", "three bedroom", "two storey"],
    features: ["Compact footprint", "Simple stair core", "Family-sized programme"],
    volumes: [volume({ width: 24, depth: 32, storeys: 2, height: 9, roof: "gable", pitch: 34 })],
    deck: { width: 20, depth: 9 },
    notes: "Aura-authored two-storey concept. The current legacy shell does not model the intermediate floor or stair opening; those require graph editing and professional design.",
  }),
  original({
    id: "cedar-courtyard",
    title: "Cedar Courtyard",
    kicker: "1,088 sq ft · paired cabins",
    summary: "Two modest bars face a shared terrace, separating social life from quiet rooms while keeping every span ordinary.",
    bestFor: "A two-bedroom property designed around outdoor living",
    bedrooms: 2,
    bathrooms: 2,
    sleeping: "Two private bedroom suites",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "courtyard"],
    features: ["Outdoor room", "Private sleeping bar", "Repeatable construction"],
    volumes: [
      volume({ id: "social", name: "Social cabin", width: 20, depth: 28 }),
      volume({ id: "quiet", name: "Quiet cabin", width: 16, depth: 33, x: 18, z: 2, glass: false }),
    ],
    deck: { width: 20, depth: 12, hotTub: true },
    notes: "Aura-authored paired-cabin concept. Site circulation and fire separation between volumes must be resolved locally.",
  }),
  adapted({
    id: "open-timber-studio",
    title: "Open Timber Studio",
    kicker: "194 sq ft · open-system study",
    summary: "A small insulated timber cassette studio using the published 6 × 3 m community scale as a starting envelope.",
    bestFor: "A garden office, creative studio or one-room retreat",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Day studio / occasional guest",
    storeys: 1,
    tags: ["under 400 sq ft", "open source", "timber cassette"],
    features: ["CNC-friendly concept", "Short spans", "Open-system source"],
    source: {
      kind: "licensed-adaptation",
      name: "WikiHouse / Open Systems Lab",
      url: "https://www.wikihouse.cc/design/what-is-wikihouse",
      license: "CC-BY-SA-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution: "Informed by the WikiHouse Skylark200 open timber framing system maintained by Open Systems Lab.",
      changes: "Aura created an independent 6 × 3 m concept envelope; it does not reproduce a chassis, CNC file or construction detail and is not endorsed by WikiHouse.",
      shareAlike: true,
      relationship: "system-informed-study",
    },
    material: "timber_frame",
    volumes: [volume({ width: 19.685, depth: 9.8425, roof: "shed", pitch: 12 })],
    deck: { width: 12, depth: 5 },
    notes: "Use the current source block library and an appointed structural engineer before developing this as a WikiHouse chassis.",
  }),
  adapted({
    id: "libertiny-study",
    title: "Liber’Tiny Study",
    kicker: "165 sq ft · towable precedent",
    summary: "A dimensional study of Entropie’s documented 6 × 2.55 m tiny house, simplified into Aura’s editable shell.",
    bestFor: "Learning from a built, openly documented European tiny house",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One sleeping loft (not modelled)",
    storeys: 1,
    tags: ["under 400 sq ft", "open source", "towable precedent"],
    features: ["Built precedent", "Open documentation", "Compact wet core"],
    source: {
      kind: "licensed-adaptation",
      name: "Association Entropie",
      url: "https://tinyhouse.asso-entropie.fr/manuel-auto-construction/",
      license: "CC-BY-SA-2.0-FR",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/fr/",
      attribution: "Based on Liber’Tiny by Association Entropie, Christophe André and Nolwenn Le Nir.",
      changes: "Aura converted only the published exterior dimensions into a simplified cold-climate HomeSpec; the loft, trailer, assemblies and plan details are not reproduced.",
      shareAlike: true,
      relationship: "dimensional-adaptation",
    },
    material: "timber_frame",
    volumes: [volume({ width: 19.685, depth: 8.366, roof: "gable", pitch: 38, height: 10.8 })],
    deck: null,
    notes: "The source plan set is marked beta. Aura does not model the trailer, road limits, loft or French structural study; use the source documents and local professionals.",
  }),
  adapted({
    id: "open-farmhouse-study",
    title: "Open Farmhouse Study",
    kicker: "1,024 sq ft · grow-over-time precedent",
    summary: "A simplified 16 × 32 ft, two-storey massing study of Jay Osborne’s open-source American Farmhouse.",
    bestFor: "A compact house that can be personalized and expanded over time",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two bedrooms upstairs",
    storeys: 2,
    tags: ["800–1,200 sq ft", "open source", "two storey"],
    features: ["Small footprint", "Complete source drawing set", "Expandable precedent"],
    source: {
      kind: "licensed-adaptation",
      name: "Jay Osborne / FreeFarmhouse.com",
      url: "https://www.freefarmhouse.com/",
      license: "CC-BY-SA (source version not stated)",
      licenseUrl: "https://www.freefarmhouse.com/uploads/b/244cd9c0-4894-11ea-8aad-9b21e8eb84db/American%20Farmhouse%20-%20Jay%20Osborne%20-%20eBook.pdf",
      attribution: "Based on the American Farmhouse open-source house template by Jay Osborne, FreeFarmhouse.com.",
      changes: "Aura retained only the published 16 × 32 ft, two-storey envelope and replaced the assemblies, openings and deck with an independent Alberta concept model.",
      shareAlike: true,
      relationship: "dimensional-adaptation",
    },
    material: "timber_frame",
    volumes: [volume({ width: 16, depth: 32, storeys: 2, height: 8.5, roof: "gable", pitch: 38, glass: false })],
    deck: { width: 14, depth: 7 },
    notes: "Consult the source drawing set for the original design. Aura’s model is a dimensional adaptation, not those construction drawings and not an architectural service.",
  }),

  /* ------------------------------------------------------------------------
     The 2026 provenance sweep (docs/research/PLAN-LIBRARY-SOURCES.md and
     data/plans/candidates.json). Six of these re-author USDA Cooperative Farm
     Building Plan Exchange sets — federal plan sets whose scans carry the
     National Agricultural Library's "not in copyright" statement — and two
     are Aura originals filling the styles the sweep could not clear. Every
     adaptation names its plan number, the page the rights statement was read
     on, and exactly what Aura changed. */
  publicDomain({
    id: "postcard-a-frame",
    title: "Postcard A-Frame",
    kicker: "576 sq ft · USDA 6003 (1966)",
    summary: "The classic government A-frame with its outdoor deck, re-authored on the published 24 × 24 ft envelope with a fully glazed south gable.",
    bestFor: "A lake or forest stay with the silhouette everyone recognizes",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "Main-floor sleeping",
    storeys: 1,
    tags: ["400–800 sq ft", "a-frame", "public domain"],
    features: ["Published 24 × 24 envelope", "Original deck kept", "Glazed gable end"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Cooperative Farm Building Plan Exchange",
      url: "https://archive.org/details/aframecabin1093unit",
      license: "US Government work (17 USC 105); the National Agricultural Library scan's rights statement reads \"not in copyright\"",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on A-Frame Cabin, Plan Exchange No. 6003 (October 1966–68 series), United States Department of Agriculture; sheets also mirrored by NDSU Extension.",
      changes: "Aura kept the published 24 × 24 ft footprint and deck, glazed the south gable end, and re-based the shell on cold-climate SIP assumptions; the original rafter, foundation and specification sheets are not reproduced.",
      shareAlike: false,
      relationship: "dimensional-adaptation",
    },
    volumes: [volume({ width: 24, depth: 24, roof: "a-frame", pitch: 54, height: 8 })],
    deck: { width: 16, depth: 8 },
    notes: "The two-sheet federal drawing set remains the authority for the original design. The A-frame thrust path and snow load must be engineered for the site.",
  }),
  publicDomain({
    id: "timberline-a-frame",
    title: "Timberline A-Frame",
    kicker: "792 sq ft · USDA 5965",
    summary: "The family-sized A-frame — 22 × 36 ft with a dormitory loft and enclosed stairs in the source set, re-authored as a long glazed-gable hall.",
    bestFor: "A larger A-frame stay that sleeps a family, not just a couple",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Main-floor bedroom + dormitory loft (loft not modelled)",
    storeys: 1,
    tags: ["400–800 sq ft", "a-frame", "public domain"],
    features: ["Published 22 × 36 envelope", "Real stairs in the source", "Long snow-shedding ridge"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Cooperative Farm Building Plan Exchange",
      url: "https://www.ag.ndsu.edu/aben-plans/5965.pdf",
      license: "US Government work (17 USC 105); the same USDA A-frame series is verified \"not in copyright\" on the National Agricultural Library scan of Misc. Pub. 981",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on A-Frame Cabin, Plan Exchange No. 5965 (22 × 36 ft with loft and enclosed stairs, double 2 × 6 rafters), United States Department of Agriculture; sheets served by NDSU Extension.",
      changes: "Aura kept the published 22 × 36 ft footprint and roof form, glazed the south gable, and left the loft and stair unmodelled in the legacy shell; the three-sheet structural set is not reproduced.",
      shareAlike: false,
      relationship: "dimensional-adaptation",
    },
    volumes: [volume({ width: 22, depth: 36, roof: "a-frame", pitch: 55, height: 8 })],
    deck: { width: 16, depth: 9 },
    slope: "gentle",
    notes: "The dormitory loft and enclosed stair exist in the source sheets but not in this massing model — they need graph editing and professional design.",
  }),
  publicDomain({
    id: "solstice-cottage",
    title: "Solstice Cottage",
    kicker: "468 sq ft · USDA 7148 (1983)",
    summary: "A federal passive-solar cottage from 1983 — 18 × 26 ft, one bedroom, designed to heat itself with its south face before that was fashionable.",
    bestFor: "A genuinely solar-tempered small home with a documented lineage",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "passive solar", "public domain"],
    features: ["Published 18 × 26 envelope", "One south collecting aperture", "High north vent, small end windows"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Cooperative Farm Building Plan Exchange",
      url: "https://www.ag.ndsu.edu/aben-plans/7148.pdf",
      license: "US Government work (17 USC 105) via the USDA Plan Exchange series provenance recorded in NDSU Extension's index",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on the 1-Bedroom Passive Solar Cottage, Plan Exchange No. 7148 (1983 revision), United States Department of Agriculture; sheets served by NDSU Extension.",
      changes: "Aura kept the published 18 × 26 ft footprint and south-collecting intent, and re-based the envelope on SIP assumptions. The elevation is Aura's, not the source's: the federal window schedule is not reproduced, so the south aperture, the high north vent and the two end windows are Aura's reading of the intent rather than the 1983 sheets' numbers. The original solar storage details are not reproduced and are worth reading.",
      shareAlike: false,
      relationship: "dimensional-adaptation",
    },
    /* DRAWN TO ITS OWN ARGUMENT, and the reason is a defect this record used to
       be. A passive-solar cottage whose whole summary is its south face was
       carrying the library's DEFAULT openings — the same south glazing wall,
       door and two side windows every generic plan starts with — which made it
       indistinguishable from `meadow-one` on every axis the anti-padding rule
       can see, and made the summary a sentence the drawing did not support.
       The south wall now carries one aperture rather than a generic glazing
       band, the north wall carries a single opening set above head height
       instead of nothing, and the ends carry small windows. That is a SHAPE
       and only a shape: nothing in this build computes a solar gain, an air
       change or a heat loss, so the drawing supports the summary's DESCRIPTION
       of the 1983 intent and supports no claim about performance. */
    volumes: [
      volume({
        width: 18,
        depth: 26,
        roof: "gable",
        pitch: 35,
        openings: [
          opening("sun-wall-s", "s", "glazing-wall", 11, 7.5, 1.5, 0.5),
          opening("door-s", "s", "door", 3, 6.8, 14),
          opening("vent-n", "n", "window", 3, 2, 7.5, 6.5),
          opening("win-e", "e", "window", 3, 3.5, 9),
          opening("win-w", "w", "window", 3, 3.5, 14),
        ],
      }),
    ],
    deck: { width: 14, depth: 7 },
    notes: "The elevation is drawn to the plan's own argument rather than to the library default: one south aperture doing the collecting, one north vent set high, and a small window on each end. That is a shape and nothing more. Passive-solar performance is a site fact, not a plan fact: orientation, shading and thermal mass need a professional energy check before the lineage becomes a claim, and nothing in this build calculates a solar gain or a heat loss to support one.",
  }),
  publicDomain({
    id: "bunkhouse-loft",
    title: "Bunkhouse Loft",
    kicker: "480 sq ft · USDA 6013 (1968)",
    summary: "A cabin built around a dormitory loft — the federal ancestor of every mezzanine tiny home, re-authored as a group-stay bunkhouse.",
    bestFor: "Hosts who sleep six friends, a retreat crew or a family of cousins",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "Main floor + dormitory loft (loft not modelled)",
    storeys: 1,
    tags: ["400–800 sq ft", "group stays", "public domain"],
    features: ["Dormitory-loft programme", "Eight-sheet source set", "Simple gable shell"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Cooperative Farm Building Plan Exchange",
      url: "https://archive.org/details/cabinwithdormito1074unit",
      license: "US Government work (17 USC 105); the National Agricultural Library scan's rights statement reads \"not in copyright\"",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on Cabin with Dormitory Loft, Plan Exchange No. 6013 (March 1968), United States Department of Agriculture.",
      changes: "Aura took the programme — an open cabin under a sleeping loft — and authored a new 20 × 24 ft envelope for it; the source dimensions, loft framing and specification sheets are not traced.",
      shareAlike: false,
      relationship: "system-informed-study",
    },
    material: "timber_frame",
    volumes: [volume({ width: 20, depth: 24, roof: "gable", pitch: 42, height: 10 })],
    deck: { width: 14, depth: 8 },
    notes: "The loft, its ladder or stair, and its egress are not in this massing model. Group-sleeping occupancy classification is a local code question — ask early.",
  }),
  publicDomain({
    id: "prairie-dwelling",
    title: "Prairie Dwelling",
    kicker: "768 sq ft · USDA 7176 (1967)",
    summary: "A complete two-bedroom farm dwelling from the federal exchange, re-authored as an entry-level everyday eco home.",
    bestFor: "A first full-time family home at a disciplined budget",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "public domain"],
    features: ["Two-bedroom programme", "Eight-sheet source set", "Ordinary spans throughout"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Cooperative Farm Building Plan Exchange",
      url: "https://archive.org/details/2bedroomfarmdwel1042unit",
      license: "US Government work (17 USC 105); the National Agricultural Library scan's rights statement reads \"not in copyright\"",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on the 2-Bedroom Farm Dwelling, Plan Exchange No. 7176 (January 1967), United States Department of Agriculture.",
      changes: "Aura took the compact two-bedroom programme and authored a new 24 × 32 ft envelope with a south glazing wall; the source room layout and working drawings are not traced.",
      shareAlike: false,
      relationship: "system-informed-study",
    },
    material: "timber_frame",
    volumes: [volume({ width: 24, depth: 32, roof: "gable", pitch: 32 })],
    deck: { width: 18, depth: 9 },
    notes: "The 1967 working drawings remain worth reading for their economy. Aura’s envelope is a fresh concept, not a tracing, and needs full professional design.",
  }),
  publicDomain({
    id: "beltsville-farmhouse",
    title: "Beltsville Farmhouse",
    /* 1,292 until PL03, when a gate started comparing every card's published
       area against its own geometry: this envelope is 26×38 + 14×22 = 1,296,
       and the card had been four square feet light since it was authored. The
       geometry is the authority, so the number moved. */
    kicker: "1,296 sq ft · USDA 7161 (1965)",
    summary: "The three-bedroom farmhouse designed around the Beltsville energy-saving kitchen-workroom — federal efficiency research, sixty years early.",
    bestFor: "A family home with the deepest eco-design lineage in the library",
    bedrooms: 3,
    bathrooms: 1.5,
    sleeping: "Three enclosed bedrooms",
    storeys: 1,
    tags: ["1,200+ sq ft", "three bedroom", "public domain"],
    features: ["Energy-research lineage", "Kitchen-workroom wing", "Single-storey family plan"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Agricultural Research Service",
      url: "https://archive.org/details/3bedroomfarmhous993unit",
      license: "US Government work (17 USC 105); the National Agricultural Library scan's rights statement reads \"not in copyright\"",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on the 3-Bedroom Farmhouse with the Beltsville Energy-Saving Kitchen-Workroom, Plan Exchange No. 7161 (May 1965), USDA Agricultural Research Service.",
      changes: "Aura kept the programme — three bedrooms beside a working kitchen-workroom wing — and authored a new two-volume envelope for it; the 1965 room geometry and eight working sheets are not traced.",
      shareAlike: false,
      relationship: "system-informed-study",
    },
    material: "timber_frame",
    volumes: [
      volume({ id: "house", name: "Main house", width: 26, depth: 38 }),
      volume({ id: "workroom", name: "Kitchen-workroom wing", width: 14, depth: 22, x: 20, z: 4, roof: "shed", pitch: 14, glass: false }),
    ],
    deck: { width: 20, depth: 10 },
    notes: "The Beltsville kitchen-workroom studies measured steps saved per meal — the original research is a genuinely good read before a professional replans the wing.",
  }),
  original({
    id: "boreal-longhouse",
    title: "Boreal Longhouse",
    kicker: "704 sq ft · SIP bar",
    summary: "One long SIP bar under one south-facing shed roof: every room on the light side, every service on the quiet side, no corridor.",
    bestFor: "A modern panelized build that goes up fast and sheds snow one way",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two bedrooms at the quiet end",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "sip panel"],
    features: ["Single-plane solar roof", "Panel-friendly 16 ft spans", "Rooms on the light side"],
    volumes: [volume({ width: 44, depth: 16, roof: "shed", pitch: 14 })],
    deck: { width: 22, depth: 9 },
    notes: "Aura-authored SIP longhouse concept. Panel layout, point loads at openings and the long-wall wind case are the engineer’s first three questions — bring them early.",
  }),
  /* ------------------------------------------------------------------------
     The Nordic square set — the founder's ask by name: "Nordic models …
     polycarbonate glosses … a little bit more square." No cleared source
     exists for the style (PLAN-LIBRARY-SOURCES § 6), so these three are
     Aura originals, and they are the first plans to AUTHOR their openings:
     lantern glazing bands, clerestories and corner entries instead of the
     library's default elevation. The polycarbonate is stated intent — the
     cost engine prices these glazing areas on its current basis, and the
     translucent material itself arrives with the render tier. */
  original({
    id: "fjell-cube",
    title: "Fjell Cube",
    kicker: "400 sq ft · square lantern",
    summary: "A 20 × 20 flat-roofed cube with two full-height glazing bands — the square Nordic lantern, sized as a first building.",
    bestFor: "A design-forward studio, guest cube or backcountry stay",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Studio / sleeping loft intent (loft not modelled)",
    storeys: 1,
    tags: ["under 400 sq ft", "nordic square", "polycarbonate intent"],
    features: ["True square plan", "Two lantern walls", "Parapet flat roof"],
    costBasis: {
      status: "proxy",
      label: "SIP + glazing proxy",
      note: "This planning range uses Aura's SIP and glazing inputs; polycarbonate fabrication and detailing require supplier quotes.",
    },
    volumes: [
      volume({
        width: 20,
        depth: 20,
        roof: "flat",
        height: 12,
        openings: [
          opening("glass-s", "s", "glazing-wall", 14, 11, 3),
          opening("glass-e", "e", "glazing-wall", 10, 11, 4),
          opening("door-w", "w", "door", 3, 6.8, 2),
          opening("win-n", "n", "window", 4, 4, 13, 4.5),
        ],
      }),
    ],
    deck: { width: 14, depth: 8 },
    notes: "Aura-authored Nordic square concept. The two glazing bands are drawn as glazing walls and priced as such; the polycarbonate skin is design intent until the render material lands. Parapet drainage needs real detailing.",
  }),
  original({
    id: "lys-lantern",
    title: "Lys Lantern",
    kicker: "676 sq ft · clerestory square",
    summary: "A 26 × 26 near-flat square that lights itself twice: a south glazing wall for the view, north clerestories for even day-light.",
    bestFor: "A two-bedroom home that reads as a pavilion, not a box",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "nordic square", "polycarbonate intent"],
    features: ["Clerestory north light", "18 ft glazing wall", "Square services core"],
    costBasis: {
      status: "proxy",
      label: "SIP + glazing proxy",
      note: "This planning range uses Aura's SIP and glazing inputs; polycarbonate fabrication and detailing require supplier quotes.",
    },
    volumes: [
      volume({
        width: 26,
        depth: 26,
        roof: "flat",
        pitch: 2,
        height: 11,
        openings: [
          opening("glass-s", "s", "glazing-wall", 18, 10.5, 4),
          opening("cler-n1", "n", "window", 6, 2.5, 3, 7.5),
          opening("cler-n2", "n", "window", 6, 2.5, 17, 7.5),
          opening("door-e", "e", "door", 3, 6.8, 3),
          opening("win-e", "e", "window", 5, 4, 12),
          opening("win-w", "w", "window", 5, 4, 12),
        ],
      }),
    ],
    deck: { width: 20, depth: 9 },
    notes: "Aura-authored Nordic square concept. Clerestory heights assume the 11 ft wall; a professional confirms glazing ratios against NBC 9.36 before this becomes a permit set.",
  }),
  original({
    id: "bastu-pavilion",
    title: "Bastu Pavilion",
    kicker: "720 sq ft · house + sauna",
    summary: "A glazed shed-roof main square with a small flat-roofed sauna wing across a shared deck — the Nordic pair, drawn honestly.",
    bestFor: "An eco stay whose second building IS the amenity",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "nordic square", "sauna wing"],
    features: ["Two-building court", "Corner glazing bands", "Sauna-ready wing"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "house",
        name: "Main pavilion",
        width: 24,
        depth: 24,
        roof: "shed",
        pitch: 6,
        height: 11.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 16, 10, 4),
          opening("glass-w", "w", "glazing-wall", 9, 10, 6),
          opening("door-e", "e", "door", 3, 6.8, 3),
          opening("win-n", "n", "window", 4, 4, 16, 4),
        ],
      }),
      volume({
        id: "sauna",
        name: "Sauna wing",
        width: 12,
        depth: 12,
        x: 20,
        z: 4,
        roof: "flat",
        height: 9,
        openings: [
          opening("door-s", "s", "door", 2.6, 6.8, 2),
          opening("win-w", "w", "window", 2, 2, 5, 4.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 9, hotTub: true },
    notes: "Aura-authored Nordic pair. The sauna wing needs its own ventilation, stove clearances and occupancy review; the shared deck's structure spans two foundations and is the engineer's first question.",
  }),
  publicDomain({
    id: "lakeview-a-frame",
    title: "Lakeview A-Frame",
    kicker: "528 sq ft · USDA 5964 (1963)",
    summary: "The original lakeside A-frame — the 22 × 24 ft federal plan every modern A-frame quietly imitates, with its loft in the source sheets.",
    bestFor: "The classic weekend cabin, from the plan that started the shape",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "Main floor + loft (loft not modelled)",
    storeys: 1,
    tags: ["400–800 sq ft", "a-frame", "public domain"],
    features: ["Published 22 × 24 envelope", "The 1963 original", "Three-sheet source set"],
    source: {
      kind: "public-domain-adaptation",
      name: "USDA Cooperative Farm Building Plan Exchange",
      url: "https://www.ag.ndsu.edu/aben-plans/5964.pdf",
      license: "US Government work (17 USC 105); USDA Misc. Pub. 981 (Nov 1964, plans 5964/5965) carries the National Agricultural Library scan's statement \"not in copyright\"",
      licenseUrl: "https://www.usa.gov/government-works",
      attribution: "Based on A-Frame Cabin, Plan Exchange No. 5964 (22 × 24 ft with loft, double 2 × 6 rafters at 4 ft), United States Department of Agriculture; sheets served by NDSU Extension.",
      changes: "Aura kept the published 22 × 24 ft footprint and roof form, glazed the south gable end, and left the loft unmodelled in the legacy shell; the three-sheet structural set is not reproduced.",
      shareAlike: false,
      relationship: "dimensional-adaptation",
    },
    volumes: [volume({ width: 22, depth: 24, roof: "a-frame", pitch: 55, height: 8 })],
    deck: { width: 14, depth: 8 },
    slope: "gentle",
    notes: "The 1963 sheets remain the authority for the original. The A-frame thrust path and the loft's egress are professional questions before anything is built.",
  }),
  publicDomain({
    id: "wilson-court",
    title: "Wilson Court",
    kicker: "892 sq ft · bungalow court",
    summary: "An L of two modest bars around a sheltered court — the California bungalow-court idea from Wilson's 1910 book, re-authored as a cold-climate eco home.",
    bestFor: "Courtyard living where the outdoor room is the point",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["800–1,200 sq ft", "courtyard", "public domain"],
    features: ["Sheltered court", "Two ordinary spans", "Period-honest lineage"],
    source: {
      kind: "public-domain-adaptation",
      name: "The Bungalow Book, Henry L. Wilson",
      url: "https://archive.org/details/TheBungalowBookAShortSketchOfTheEvolutionOfTheBungalowFromIts",
      license: "Public Domain Mark 1.0 (Internet Archive designation; pre-1931 US publication, c. 1910)",
      licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      attribution: "Programme informed by the courtyard bungalow designs in The Bungalow Book (c. 1910) by Henry L. Wilson, the Los Angeles plan-book publisher who popularized the type.",
      changes: "Aura took the courtyard-court PROGRAMME — two low bars holding an outdoor room — and authored a new two-volume envelope for a cold climate; no period drawing is traced and no 1910 assembly survives into this concept.",
      shareAlike: false,
      relationship: "system-informed-study",
    },
    material: "timber_frame",
    volumes: [
      volume({ id: "living", name: "Living bar", width: 18, depth: 34, roof: "gable", pitch: 26 }),
      volume({ id: "sleeping", name: "Sleeping bar", width: 14, depth: 20, x: 16, z: 7, rotation: 90, glass: false }),
    ],
    deck: { width: 16, depth: 12 },
    notes: "Wilson sold plans by mail a century before the internet; the lineage is the point. The court's wind exposure and snow-drift behaviour are site questions a professional answers.",
  }),
  original({
    id: "lightframe-pavilion",
    title: "Lightframe Pavilion",
    kicker: "600 sq ft · glass-and-frame study",
    summary: "A flat-roofed pavilion drawn for the steel-and-polycarbonate look — deep glazing on the long south face, services in a solid back band.",
    bestFor: "A design-forward stay or studio that wants to read as a lantern",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "steel + polycarbonate", "design forward"],
    features: ["Lantern glazing band", "Solid service spine", "Parapet flat roof"],
    costBasis: {
      status: "proxy",
      label: "Timber/SIP proxy",
      note: "The current range uses timber/SIP shell inputs; steel frame and polycarbonate packages require project-specific engineering and supplier quotes.",
    },
    volumes: [volume({ width: 30, depth: 20, roof: "flat", height: 11 })],
    deck: { width: 24, depth: 10 },
    notes: "Aura-authored concept for a steel portal frame with polycarbonate glazing. The cost engine prices this shell on its timber/SIP Alberta basis until a steel basis lands — treat the range as a floor, and have the frame engineered as steel from day one.",
  }),

  /* ==========================================================================
     THE NORDIC GLASS SET — thirty Aura originals, August 2026.

     The founder's ask was "thirty more modern Nordic looking models with lots
     of glass and cool modern features". Every one of these is authored from
     first principles (PLAN-LIBRARY-SOURCES § 6: no cleared Nordic-modern
     source exists), so they carry Aura's own licence and no third-party
     redistribution question.

     THE RULE THAT SHAPED THEM. `FDWR_MAX` (lib/design/materials.ts) is 0.22 —
     the NBC 9.36 PRESCRIPTIVE fenestration-and-door-to-wall ceiling, not a
     legal maximum. The builder REPORTS `modelledGlazingRatio` against it and
     never clamps it, and the readout says in its own words that this is a
     comparison, not a code check. So a glass-forward house is a legitimate
     thing to draw here. What is not legitimate is drawing thirty of them and
     saying nothing: eight of these thirty model above 22%, and each of those
     eight names its own ratio in `notes`, names the compliance path it would
     take, and says what the glass costs in a zone 7A winter. A spec assertion
     in tests/plan-catalog.spec.ts holds that, including the stated percentage
     against the computed one, so the disclosure cannot rot away from the
     geometry.

     The rest sit under the ceiling on purpose. A library where every plan is
     over the line is not glass-forward, it is one idea repeated — the
     disciplined plans (Nordlys Atelier, Kompakt Passiv, Skodde Cabin) are the
     argument that makes the aggressive ones mean something.
     ====================================================================== */

  original({
    id: "glasrum-studio",
    title: "Glasrum Studio",
    kicker: "308 sq ft · one glass wall",
    summary: "A garden room with one glazed elevation and three walls that carry no glass at all — warmth bought by leaving windows out where there is no sun.",
    bestFor: "A backyard studio, garden office or reading room",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Day studio / occasional guest",
    storeys: 1,
    tags: ["under 400 sq ft", "studio", "nordic modern", "urban infill"],
    features: ["One glazed elevation", "Blind service wall", "Shallow shed roof"],
    material: "timber_frame",
    volumes: [
      volume({
        width: 14,
        depth: 22,
        roof: "shed",
        pitch: 16,
        height: 10.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 9.5, 1),
          opening("door-e", "e", "door", 3, 6.8, 2),
          opening("slot-w1", "w", "window", 1.5, 6, 6, 2.5),
          opening("slot-w2", "w", "window", 1.5, 6, 9, 2.5),
        ],
      }),
    ],
    deck: { width: 12, depth: 7 },
    notes: "Aura-authored garden-room concept. The north wall carries the services, the storage and no glass, which is what pays for the south wall being all of it — modelled glazing stays under the 22% prescriptive ceiling. If this ever becomes a sleeping suite, egress, heating and a plumbing connection all become permit questions a professional must answer.",
  }),
  original({
    id: "hjorne-perch",
    title: "Hjørne Perch",
    kicker: "320 sq ft · corner glass",
    summary: "A small flat-roofed room whose two view walls meet at an open corner, drawn for a site too steep to build anything larger on.",
    bestFor: "A steep lot, a lookout cabin or a one-room retreat",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Studio / convertible",
    storeys: 1,
    tags: ["under 400 sq ft", "studio", "nordic modern", "steep site"],
    features: ["Two-sided corner glazing", "Parapet flat roof", "Minimal foundation footprint"],
    volumes: [
      volume({
        width: 16,
        depth: 20,
        roof: "flat",
        height: 11,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 10.5, 2),
          opening("glass-e", "e", "glazing-wall", 12, 10.5, 4),
          opening("door-w", "w", "door", 3, 6.8, 3),
          opening("win-n", "n", "window", 3, 3.5, 6, 5.5),
        ],
      }),
    ],
    deck: { width: 14, depth: 8 },
    slope: "steep",
    notes: "Aura-authored corner-glazing concept. Modelled glazing is 33% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, deliberately. A plan like this goes to permit on the performance path, where better glazing, a thicker envelope and tighter airtightness buy the glass back; on the prescriptive path it does not pass. The heat-loss cost is real and lands every January. Two glazed walls meeting at a corner also delete the corner post: the structure moves into the roof and the floor, and that is the engineer's first question, before the view is.",
  }),
  original({
    id: "nordlys-atelier",
    title: "Nordlys Atelier",
    kicker: "360 sq ft · north light",
    summary: "A maker's room lit by a high north clerestory band rather than a view window — steady light all day, and very little of the wall given to glass.",
    bestFor: "A painter, photographer or anyone who needs light without glare",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Day studio",
    storeys: 1,
    tags: ["under 400 sq ft", "studio", "nordic modern", "work from home"],
    features: ["North clerestory band", "Glare-free working light", "Low glazing ratio"],
    material: "timber_frame",
    volumes: [
      volume({
        width: 18,
        depth: 20,
        roof: "shed",
        pitch: 20,
        height: 11,
        openings: [
          opening("cler-n1", "n", "window", 5, 3, 1, 7.5),
          opening("cler-n2", "n", "window", 5, 3, 6.5, 7.5),
          opening("cler-n3", "n", "window", 5, 3, 12, 7.5),
          opening("door-s", "s", "door", 3, 6.8, 2),
          opening("win-s", "s", "window", 6, 4.5, 8),
          opening("win-e", "e", "window", 3, 5, 8, 2.5),
        ],
      }),
    ],
    deck: { width: 12, depth: 6 },
    notes: "Aura-authored north-light concept, and the counter-argument inside this set: north glass is the most expensive glass in zone 7A, so this plan buys only 45 sq ft of it, high up, where it does the work a studio actually needs. Modelled glazing is well under the prescriptive ceiling. The shed roof falls south, which is what makes the north wall tall enough for the band — check the clerestory head height against the roof structure with a professional before ordering units.",
  }),
  original({
    id: "vindfang-cabin",
    title: "Vindfang Cabin",
    kicker: "308 sq ft · cabin + airlock",
    summary: "A one-room cabin with a separate unheated entry lobby bolted to its side — the small Nordic move that lets the main room be mostly glass.",
    bestFor: "A cold-site cabin where the door opens straight into weather",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One sleeping alcove",
    storeys: 1,
    tags: ["under 400 sq ft", "one bedroom", "nordic modern", "cold climate"],
    features: ["Airlock entry volume", "Glazed main room", "Two simple roofs"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "cabin",
        name: "Cabin",
        width: 14,
        depth: 18,
        roof: "gable",
        pitch: 36,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 10, 9.5, 2),
          opening("door-e", "e", "door", 2.8, 6.8, 8),
          opening("win-w", "w", "window", 3, 4, 7),
          opening("win-n", "n", "window", 3, 3, 5.5, 5),
        ],
      }),
      volume({
        id: "vindfang",
        name: "Entry lobby",
        width: 7,
        depth: 8,
        x: 10.5,
        z: -5,
        roof: "flat",
        height: 8,
        openings: [
          opening("door-out", "s", "door", 3, 6.8, 2),
          opening("door-in", "w", "door", 2.8, 6.8, 2),
          opening("win-n", "n", "window", 2, 2, 2.5, 5),
        ],
      }),
    ],
    deck: { width: 12, depth: 6 },
    notes: "Aura-authored airlock concept. The lobby is the reason the main room can be glazed: nobody dumps a cubic metre of −30 °C air into the living space every time they come in with wood. Modelled glazing stays under the prescriptive ceiling. The lobby is drawn as a conditioned volume because the model has no other category — if it is built unheated, its area, its cost line and its energy model all change, and an energy advisor should be the one to say so.",
  }),
  original({
    id: "takterrass-micro",
    title: "Takterrass Micro",
    kicker: "256 sq ft · roof terrace",
    summary: "A square flat-roofed micro home that puts its outdoor room on top instead of beside it, for a lot with no yard left to give.",
    bestFor: "A tight urban infill lot, laneway site or rooftop-view stay",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Studio / Murphy bed",
    storeys: 1,
    tags: ["under 400 sq ft", "studio", "nordic modern", "urban infill"],
    features: ["Roof terrace intent", "Square parapet shell", "Full-height south glass"],
    volumes: [
      volume({
        width: 16,
        depth: 16,
        roof: "flat",
        height: 10.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 11, 10, 2.5),
          opening("win-w", "w", "window", 4, 4, 6),
          opening("door-e", "e", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 3, 3, 10, 4),
          opening("win-n", "n", "window", 2.5, 2.5, 6.75, 6),
        ],
      }),
    ],
    deck: { width: 12, depth: 7 },
    notes: "Aura-authored roof-terrace concept, modelled at 21% glazing — under the prescriptive ceiling with very little room left. The terrace is design intent: this shell models a flat roof and a parapet, not an occupied roof. Occupied-roof live load, guard height, the stair or ladder that reaches it and the waterproofing warranty are all professional questions, and they are the ones that decide whether the idea survives contact with a budget.",
  }),
  original({
    id: "ljus-ribbon",
    title: "Ljus Ribbon",
    kicker: "476 sq ft · light ribbon",
    summary: "A long thin bar lit by one continuous band of window rather than one tall wall of it — the same daylight, a third of the heat loss.",
    bestFor: "A narrow lot, a shelterbelt edge, or anyone tired of glare",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "nordic modern", "passive solar"],
    features: ["Horizontal ribbon glazing", "Deep eave shading", "Single-plane solar roof"],
    volumes: [
      volume({
        width: 34,
        depth: 14,
        roof: "shed",
        pitch: 14,
        height: 10,
        openings: [
          opening("ribbon-1", "s", "window", 9, 5, 2, 3.5),
          opening("ribbon-2", "s", "window", 9, 5, 12.5, 3.5),
          opening("ribbon-3", "s", "window", 9, 5, 23, 3.5),
          opening("door-w", "w", "door", 3, 6.8, 5),
          opening("win-n1", "n", "window", 4, 3, 6, 5.5),
          opening("win-n2", "n", "window", 4, 3, 24, 5.5),
          opening("win-e", "e", "window", 3, 4, 5),
        ],
      }),
    ],
    deck: { width: 20, depth: 8 },
    notes: "Aura-authored ribbon-glazing concept. A 5 ft band at a 3'-6\" sill catches the same winter sun as a full-height wall and is far easier to shade in July, because a 1'-6\" eave actually reaches the head of it. Modelled glazing sits under the prescriptive ceiling. The long south wall wants a real structural header strategy over three openings in a row — bring that to the engineer before the elevations get pretty.",
  }),
  original({
    id: "saltbox-nord",
    title: "Saltbox Nord",
    kicker: "528 sq ft · deep-eave saltbox",
    summary: "A saltbox turned so its long slope carries down over the glazed elevation, making the summer-shading answer part of the roof instead of an add-on.",
    bestFor: "An exposed site where the roof has to do the shading",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "passive solar"],
    features: ["Long shading slope", "Full-height south glazing", "Snow-shedding form"],
    volumes: [
      volume({
        width: 24,
        depth: 22,
        roof: "saltbox",
        pitch: 30,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 16, 10, 3),
          opening("door-s", "s", "door", 3, 6.8, 20),
          opening("win-e1", "e", "window", 4, 4, 4),
          opening("win-e2", "e", "window", 4, 4, 13),
          opening("win-w", "w", "window", 4, 4, 9),
          opening("win-n", "n", "window", 3, 3, 10, 5.5),
        ],
      }),
    ],
    deck: { width: 20, depth: 10 },
    notes: "Aura-authored saltbox concept. Modelled glazing is 24% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling. The compliance route is the trade-off path or a full performance model, where the long slope's shading and a better glazing package buy the extra glass back; the honest cost is winter heat loss through 160 sq ft of south wall, and the honest payment is the solar gain the same wall collects between October and March. The long carried-down slope needs its snow-slide zone kept clear of the entry, which is a siting decision, not a drawing one.",
  }),
  original({
    id: "stegvis-slope",
    title: "Stegvis Slope",
    kicker: "572 sq ft · stepped on slope",
    summary: "Two volumes stepping down the grade at different eave heights, so the site is followed instead of flattened and the step itself becomes a light slot.",
    bestFor: "A sloped lot where a single level would mean a retaining wall",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "steep site"],
    features: ["Stepped roofline", "Two eave heights", "Reduced excavation intent"],
    volumes: [
      volume({
        id: "upper",
        name: "Upper volume",
        width: 20,
        depth: 16,
        roof: "shed",
        pitch: 12,
        height: 11,
        openings: [
          opening("glass-s", "s", "glazing-wall", 13, 10, 3),
          opening("door-w", "w", "door", 3, 6.8, 6),
          opening("win-n", "n", "window", 4, 3.5, 8, 6),
          opening("win-w", "w", "window", 3, 4, 11),
        ],
      }),
      volume({
        id: "lower",
        name: "Lower volume",
        width: 18,
        depth: 14,
        x: 19,
        z: 1,
        roof: "shed",
        pitch: 12,
        height: 9,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 8.5, 3),
          opening("win-n", "n", "window", 4, 3, 7, 5),
          opening("win-e", "e", "window", 3, 4, 5),
        ],
      }),
    ],
    deck: { width: 16, depth: 8 },
    slope: "steep",
    notes: "Aura-authored stepped concept, modelled at 21% glazing — under the prescriptive ceiling. The two-foot difference in eave height is the whole idea: it lets the upper roof clear the lower one and puts daylight into the back of the plan. This shell does not model the internal level change, its stair or its guard; on a steep lot the foundation, the drainage behind the upper volume and the slope stability are the professional questions that come before any of the architecture.",
  }),
  original({
    id: "vinterhage-house",
    title: "Vinterhage",
    kicker: "716 sq ft · house + sunspace",
    summary: "A solid square house with a glazed winter garden attached to its south face, buffering the living rooms behind a room made almost entirely of glass.",
    bestFor: "A gardener, a solar-tempered home, or a long Alberta shoulder season",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "nordic modern", "passive solar"],
    features: ["Glazed winter garden", "Buffered south face", "No exposed deck to maintain"],
    costBasis: {
      status: "proxy",
      label: "Conditioned-shell proxy",
      note: "The sunspace is priced here as a conditioned SIP shell with glazing. A tempered, unconditioned winter garden is a different build and a different number — get a glazing supplier and an energy advisor on it before trusting this range.",
    },
    volumes: [
      volume({
        id: "house",
        name: "Main house",
        width: 24,
        depth: 24,
        roof: "gable",
        pitch: 34,
        height: 9.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 9, 6),
          opening("door-s", "s", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 4, 4, 10),
          opening("win-w", "w", "window", 4, 4, 10),
          opening("win-n", "n", "window", 3, 3, 10.5, 5.5),
        ],
      }),
      volume({
        id: "sunspace",
        name: "Winter garden",
        width: 14,
        depth: 10,
        x: 0,
        z: 17,
        roof: "flat",
        height: 9,
        openings: [
          opening("glass-s", "s", "glazing-wall", 10, 8.5, 0.5),
          opening("door-s", "s", "door", 3, 6.8, 10.8),
          opening("glass-e", "e", "glazing-wall", 8, 8.5, 1),
          opening("glass-w", "w", "glazing-wall", 8, 8.5, 1),
        ],
      }),
    ],
    deck: null,
    notes: "Aura-authored winter-garden concept. Modelled glazing is 28% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, because the sunspace is counted here as conditioned floor area with three glazed walls. The compliance route is a performance model in which the winter garden is treated for what it is: a buffer that is allowed to swing cold, separated from the house by an insulated wall and a real door. Get that separation wrong and this becomes the most expensive room in the building to heat. Condensation, summer overheating and night-time heat loss through 221 sq ft of glass all need an energy advisor, not an assumption.",
  }),
  original({
    id: "vann-edge",
    title: "Vann Edge",
    kicker: "480 sq ft · water-edge bar",
    summary: "A long shallow bar with three glazed bays on the water side and a service wall behind — every room touches the view, nothing wastes depth.",
    bestFor: "A lake, river or ridge lot where one direction is the whole reason",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "nordic modern", "waterfront"],
    features: ["Three glazed bays", "Shallow one-room depth", "Blind service wall"],
    volumes: [
      volume({
        width: 30,
        depth: 16,
        roof: "flat",
        height: 11,
        openings: [
          opening("glass-1", "s", "glazing-wall", 8, 10.5, 1.5),
          opening("glass-2", "s", "glazing-wall", 8, 10.5, 11),
          opening("glass-3", "s", "glazing-wall", 8, 10.5, 20.5),
          opening("door-w", "w", "door", 3, 6.8, 6),
          opening("win-e", "e", "window", 3, 4, 6),
          opening("win-n1", "n", "window", 3, 2.5, 5, 7),
          opening("win-n2", "n", "window", 3, 2.5, 22, 7),
        ],
      }),
    ],
    deck: { width: 24, depth: 10, hotTub: true },
    slope: "gentle",
    notes: "Aura-authored waterfront concept. Modelled glazing is 28% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling. This one goes to permit on the performance path: triple-pane units with a low-conductance frame, a thicker envelope on the three solid sides and airtightness testing are what buy 252 sq ft of glass back. The cost is a heat-loss line that never goes away, and the payment is that a 16 ft deep bar needs no internal corridor. Shoreline setbacks, flood elevation and riparian rules decide this plan long before the glazing does — check them first.",
  }),
  original({
    id: "nordvend-house",
    title: "Nordvend House",
    kicker: "480 sq ft · north-view lot",
    summary: "The awkward lot solved honestly: the view is north and the sun is south, so the view gets a glass wall and the sun gets a clerestory over it.",
    bestFor: "A lot whose best outlook faces exactly the wrong way",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "passive solar"],
    features: ["North view wall", "South clerestory band", "Split light strategy"],
    volumes: [
      volume({
        width: 24,
        depth: 20,
        roof: "shed",
        pitch: 18,
        height: 11,
        openings: [
          opening("glass-n", "n", "glazing-wall", 12, 10, 6),
          opening("cler-s1", "s", "window", 6, 3, 2, 7.5),
          opening("cler-s2", "s", "window", 6, 3, 9, 7.5),
          opening("cler-s3", "s", "window", 6, 3, 16, 7.5),
          opening("door-e", "e", "door", 3, 6.8, 3),
          opening("win-e", "e", "window", 4, 4, 10),
          opening("win-w", "w", "window", 4, 4, 8),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored north-view concept, modelled at 21% glazing — under the prescriptive ceiling by a margin thin enough to disappear if the view wall grows. Say the uncomfortable part plainly: 120 sq ft of north glass in zone 7A is a heat-loss decision, not a style choice. It is paid for here by keeping the total glazing area small, by putting the solar gain on a high south clerestory instead of a second view wall, and by a glazing spec that has to be triple-pane rather than optional. An energy advisor should model this one before the window order is placed.",
  }),
  original({
    id: "jordmur-house",
    title: "Jordmur House",
    kicker: "560 sq ft · rammed-earth mass",
    summary: "South glass paired with a rammed-earth interior wall that takes the day's gain and gives it back at night — mass used as a battery, not as a look.",
    bestFor: "A solar-tempered home for people who want thermal mass done properly",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "thermal mass"],
    features: ["Rammed-earth mass wall", "Direct-gain south glazing", "Single-plane solar roof"],
    material: "rammed_earth",
    volumes: [
      volume({
        width: 28,
        depth: 20,
        roof: "shed",
        pitch: 16,
        height: 10.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 16, 10, 5),
          opening("door-s", "s", "door", 3, 6.8, 23),
          opening("win-e", "e", "window", 3, 4, 8),
          opening("win-w", "w", "window", 3, 4, 8),
          opening("win-n1", "n", "window", 3, 2.5, 6, 7),
          opening("win-n2", "n", "window", 3, 2.5, 19, 7),
        ],
      }),
    ],
    deck: { width: 20, depth: 9 },
    notes: "Aura-authored thermal-mass concept, modelled at 20% glazing — under the prescriptive ceiling. The warning belongs in the plan and not in a footnote: in zone 7A, mass on the outside of the insulation is a heat sink pointing at the sky. Rammed earth here is an interior element inside an insulated envelope, and the wall assembly, the insulation position and the seismic and moisture detailing all need a structural engineer who has actually built one. Mass without sun is just weight.",
  }),
  original({
    id: "badstue-retreat",
    title: "Badstue Retreat",
    kicker: "648 sq ft · bathhouse first",
    summary: "The bathhouse is the main building and the sleeping cabin is the annexe — a stay organized around heat, cold water and a long view out of both.",
    bestFor: "A wellness short-stay where the amenity is the product",
    bedrooms: 1,
    bathrooms: 2,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "nordic modern", "sauna wing"],
    features: ["Bathhouse as main volume", "Two-sided glazing", "Cold-plunge deck intent"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "bath",
        name: "Bathhouse",
        width: 20,
        depth: 18,
        roof: "flat",
        height: 10.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 14, 10, 3),
          opening("glass-w", "w", "glazing-wall", 10, 10, 4),
          opening("win-n1", "n", "window", 2.5, 2, 3, 7),
          opening("win-n2", "n", "window", 2.5, 2, 14, 7),
          opening("door-e", "e", "door", 3, 6.8, 3),
        ],
      }),
      volume({
        id: "cabin",
        name: "Sleeping cabin",
        width: 16,
        depth: 18,
        x: 19,
        z: 2,
        roof: "shed",
        pitch: 14,
        height: 9.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 9, 9, 3),
          opening("door-w", "w", "door", 2.8, 6.8, 6),
          opening("win-e", "e", "window", 3, 4, 6),
          opening("win-n", "n", "window", 3, 3, 6, 5),
        ],
      }),
    ],
    deck: { width: 16, depth: 10, hotTub: true },
    notes: "Aura-authored bathhouse-first concept. Modelled glazing is 24% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling. The route is the trade-off or performance path, paid for with a better glazing package and a tighter envelope on the solid walls; the heat-loss cost is concentrated in the bathhouse, which is also the room that runs hottest and wettest. That combination is the real risk here: glass, steam and −30 °C outside is a condensation and vapour-control problem that a mechanical designer and a sauna installer have to solve together, along with stove clearances, ventilation and drainage.",
  }),
  original({
    id: "kompakt-passiv",
    title: "Kompakt Passiv",
    kicker: "676 sq ft · compact form",
    summary: "The lowest-surface shape the library can draw, with glass only where it earns its keep — the plan that argues against the rest of this set.",
    bestFor: "A cold site, a tight energy budget or a low-maintenance home",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "passive solar"],
    features: ["Near-square form factor", "Glass only on the sun side", "Simple gable shell"],
    volumes: [
      volume({
        width: 26,
        depth: 26,
        roof: "gable",
        pitch: 35,
        height: 9.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 14, 9, 6),
          opening("door-s", "s", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 3, 3.5, 11),
          opening("win-w", "w", "window", 3, 3.5, 11),
          opening("win-n", "n", "window", 2.5, 2.5, 12, 6),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    /* THE SENTENCE THAT MOVED, AND WHY (PL03). This note used to claim a
       near-square plan "has the least exterior wall per square foot of
       anything else in this library". PL03 built the measurement to support
       its own courtyard plan and the superlative turned out to be false under
       BOTH readings: per square foot of FLOOR, north-family-two (0.073) and
       four other two-storey plans beat it; per square foot of FOOTPRINT,
       hearth-accessible (0.134) beats its 0.154. What IS true is the
       comparison the plan was really making, so that is what it now says, and
       tests/plan-catalog.spec.ts holds the ratio against the geometry. */
    notes: "Aura-authored compact concept, modelled at 16% glazing — comfortably under the prescriptive ceiling, which is the point. A near-square plan spends far less wall on the same floor area than the courtyards and clusters in this library: Atriumgård carries a little over twice as much exterior wall per square foot of floor as this plan does, and every foot of that wall loses heat. Every window that is not on the south face is a hole in the same advantage. The one big glazed wall still needs a summer-shading answer; the 35° gable's eave is not deep enough on its own, so budget for an overhang, a shade or planting.",
  }),
  original({
    id: "hytte-lodge",
    title: "Hytte Lodge",
    kicker: "680 sq ft · group lodge",
    summary: "One long hall with a glazed gallery down the sun side and four sleeping alcoves tucked along the back wall — a cabin sized for a crew.",
    bestFor: "Retreat hosts, ski crews and families who arrive eight at a time",
    bedrooms: 2,
    bathrooms: 2,
    sleeping: "Two bedrooms + four bunk alcoves",
    storeys: 1,
    tags: ["400–800 sq ft", "group stays", "nordic modern", "two bedroom"],
    features: ["Glazed south gallery", "Four bunk alcoves", "Single long span"],
    material: "timber_frame",
    volumes: [
      volume({
        width: 34,
        depth: 20,
        roof: "shed",
        pitch: 14,
        height: 11,
        openings: [
          opening("glass-1", "s", "glazing-wall", 10, 10.5, 2),
          opening("glass-2", "s", "glazing-wall", 10, 10.5, 14),
          opening("door-s", "s", "door", 3, 6.8, 28),
          opening("win-n1", "n", "window", 3, 3, 3, 6),
          opening("win-n2", "n", "window", 3, 3, 11, 6),
          opening("win-n3", "n", "window", 3, 3, 19, 6),
          opening("win-n4", "n", "window", 3, 3, 27, 6),
          opening("win-e", "e", "window", 4, 4, 8),
          opening("win-w", "w", "window", 4, 4, 8),
        ],
      }),
    ],
    deck: { width: 24, depth: 10, hotTub: true },
    notes: "Aura-authored group-stay concept. Modelled glazing is 23% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, and the trade-off path is the route: a better glazing package and a tighter envelope pay for the gallery. The heat-loss cost is offset in use rather than in physics — a lodge is occupied in bursts and can be set back hard between them. Group sleeping is an occupancy classification question in most Alberta municipalities: ask the authority having jurisdiction early, because it can change the egress, the alarms and the plumbing count.",
  }),
  original({
    id: "galleri-bungalow",
    title: "Galleri Bungalow",
    kicker: "720 sq ft · glass colonnade",
    summary: "A long single-storey bungalow whose south face is six tall narrow glass panels in a rhythm, rather than one uninterrupted wall.",
    bestFor: "A three-bedroom home that wants light in every room, not one",
    bedrooms: 3,
    bathrooms: 2,
    sleeping: "Three enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "three bedroom", "nordic modern", "accessible"],
    features: ["Six-bay glass colonnade", "One room deep", "No-step plan intent"],
    material: "timber_frame",
    volumes: [
      volume({
        width: 40,
        depth: 18,
        roof: "gable",
        pitch: 28,
        height: 10,
        openings: [
          opening("bay-1", "s", "glazing-wall", 3, 9.5, 2),
          opening("bay-2", "s", "glazing-wall", 3, 9.5, 8),
          opening("bay-3", "s", "glazing-wall", 3, 9.5, 14),
          opening("bay-4", "s", "glazing-wall", 3, 9.5, 20),
          opening("bay-5", "s", "glazing-wall", 3, 9.5, 26),
          opening("bay-6", "s", "glazing-wall", 3, 9.5, 32),
          opening("door-s", "s", "door", 3, 6.8, 36.5),
          opening("win-n1", "n", "window", 3.5, 3, 4, 6),
          opening("win-n2", "n", "window", 3.5, 3, 14, 6),
          opening("win-n3", "n", "window", 3.5, 3, 24, 6),
          opening("win-n4", "n", "window", 3.5, 3, 34, 6),
          opening("win-e", "e", "window", 4, 4, 7),
          opening("win-w", "w", "window", 4, 4, 7),
        ],
      }),
    ],
    deck: { width: 24, depth: 10 },
    notes: "Aura-authored colonnade concept, modelled at 21% glazing — under the prescriptive ceiling, and lower than one continuous wall of the same height would be. Six narrow bays put daylight into six rooms instead of one, and the solid piers between them are where the structure, the insulation and the furniture all go. The no-step intent and the door clearances here are design intent only; an accessibility professional and the local reviewer confirm them.",
  }),
  original({
    id: "drivhus-home",
    title: "Drivhus Home",
    kicker: "728 sq ft · house + growing room",
    summary: "A compact home with a glazed growing room on its warm side — food, a solar buffer and a place to be outside in April, in one volume.",
    bestFor: "Gardeners, off-grid households and a long growing ambition",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "food growing"],
    features: ["Attached growing room", "Shared thermal wall", "Two shed roofs"],
    costBasis: {
      status: "proxy",
      label: "Conditioned-shell proxy",
      note: "The growing room is priced here as a conditioned shell with glazing. A greenhouse is a different building — different glazing, different ventilation, different foundation — and needs a supplier quote before this range means anything.",
    },
    volumes: [
      volume({
        id: "house",
        name: "Main house",
        width: 22,
        depth: 24,
        roof: "shed",
        pitch: 16,
        height: 10.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 10, 3),
          opening("door-s", "s", "door", 3, 6.8, 17),
          opening("win-e", "e", "window", 4, 4, 6),
          opening("win-w", "w", "window", 4, 4, 10),
          opening("win-n", "n", "window", 4, 3, 9, 6),
        ],
      }),
      volume({
        id: "grow",
        name: "Growing room",
        width: 10,
        depth: 20,
        x: 17,
        z: 0,
        roof: "shed",
        pitch: 14,
        height: 9,
        openings: [
          opening("glass-s", "s", "glazing-wall", 8, 8.5, 1),
          opening("glass-e", "e", "glazing-wall", 16, 8.5, 2),
          opening("win-n", "n", "window", 6, 4, 2, 4),
          opening("door-w", "w", "door", 2.8, 6.8, 8),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored growing-room concept. Modelled glazing is 26% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, because a greenhouse counted as conditioned floor area will always read that way. The compliance route is a performance model that treats the growing room as an unconditioned or tempered space separated from the house by an insulated wall. Built the other way — heated to living temperature all winter — this is the single most expensive room in the library, and the heat-loss number is not close. Ventilation, summer overheating and irrigation drainage need a greenhouse supplier, not a house builder.",
  }),
  original({
    id: "vindly-court",
    title: "Vindly Court",
    kicker: "756 sq ft · wind-sheltered L",
    summary: "An L whose closed back is turned into the prevailing northwest wind, putting the glass and the outdoor room in the pocket behind it.",
    bestFor: "Open prairie and foothill sites with nothing upwind for miles",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "courtyard"],
    features: ["Wind-shadow courtyard", "Closed weather elevation", "Two simple gables"],
    volumes: [
      volume({
        id: "living",
        name: "Living bar",
        width: 30,
        depth: 14,
        roof: "gable",
        pitch: 30,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 16, 9.5, 8),
          opening("door-s", "s", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 4, 4, 5),
          opening("win-w", "w", "window", 4, 4, 5),
          opening("win-n1", "n", "window", 3, 2.5, 6, 7),
          opening("win-n2", "n", "window", 3, 2.5, 21, 7),
        ],
      }),
      volume({
        id: "sleeping",
        name: "Sleeping wing",
        width: 14,
        depth: 24,
        x: -14,
        z: 19,
        roof: "gable",
        pitch: 30,
        height: 10,
        openings: [
          opening("glass-e", "e", "glazing-wall", 12, 9.5, 6),
          opening("door-e", "e", "door", 2.8, 6.8, 1),
          opening("win-n", "n", "window", 3, 3, 5.5, 5.5),
          opening("win-w1", "w", "window", 3, 4, 8),
          opening("win-w2", "w", "window", 3, 4, 15),
        ],
      }),
    ],
    deck: { width: 14, depth: 8 },
    notes: "Aura-authored wind-shelter concept, modelled at 21% glazing — under the prescriptive ceiling. The reason for the L is not the shape, it is the pocket: on an exposed prairie site the difference between the windward and leeward face of a building is worth more comfort than most of the envelope upgrades on the same budget. Snow drifts where wind slows down, which means the courtyard will collect it — plan the drift and the entry accordingly with someone who knows the site.",
  }),
  original({
    id: "gardstun-court",
    title: "Gårdstun Court",
    kicker: "796 sq ft · three-sided court",
    summary: "Three low volumes around an open court, each glazed toward the middle and closed to the outside — the farmyard plan, drawn small and modern.",
    bestFor: "A two-bedroom home whose best room has no roof",
    bedrooms: 2,
    bathrooms: 2,
    sleeping: "Two private bedroom wings",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "nordic modern", "courtyard"],
    features: ["Three volumes, one court", "Inward-facing glazing", "Private sleeping wings"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "living",
        name: "Living bar",
        width: 26,
        depth: 14,
        roof: "gable",
        pitch: 30,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 16, 9.5, 5),
          opening("door-s", "s", "door", 3, 6.8, 1.5),
          opening("win-e", "e", "window", 4, 4, 5),
          opening("win-w", "w", "window", 4, 4, 5),
          opening("win-n", "n", "window", 4, 3, 11, 6),
        ],
      }),
      volume({
        id: "east",
        name: "East wing",
        width: 12,
        depth: 18,
        x: 15,
        z: 13,
        roof: "shed",
        pitch: 14,
        height: 9.5,
        openings: [
          opening("glass-w", "w", "glazing-wall", 10, 9, 4),
          opening("door-s", "s", "door", 2.8, 6.8, 2),
          opening("win-n", "n", "window", 3, 3, 4.5, 5.5),
          opening("win-e", "e", "window", 2, 4, 7),
        ],
      }),
      volume({
        id: "west",
        name: "West wing",
        width: 12,
        depth: 18,
        x: -15,
        z: 13,
        roof: "shed",
        pitch: 14,
        height: 9.5,
        openings: [
          opening("glass-e", "e", "glazing-wall", 10, 9, 4),
          opening("door-s", "s", "door", 2.8, 6.8, 7),
          opening("win-n", "n", "window", 3, 3, 4.5, 5.5),
          opening("win-w", "w", "window", 2, 4, 7),
        ],
      }),
    ],
    deck: { width: 18, depth: 8 },
    notes: "Aura-authored courtyard concept, modelled at 21% glazing — under the prescriptive ceiling. Three volumes means three foundations, three roofs and three times the exterior wall of one box holding the same area, and that cost is what buys the court. Say it before somebody discovers it in a quote. The two wings need their own heat, their own egress and a covered route between them in January; the roof drainage where three forms meet an open court is the detail that decides whether this ages well.",
  }),
  original({
    id: "verksted-house",
    title: "Verksted House",
    kicker: "844 sq ft · home + workshop",
    summary: "A glazed two-bedroom home beside a full-height workshop with a real overhead door — for the household whose trade pays the mortgage.",
    bestFor: "A tradesperson, a maker, or anyone with a truck and tools",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "nordic modern", "work from home"],
    features: ["10 ft overhead door", "Separated workshop volume", "Glazed living end"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "house",
        name: "Main house",
        width: 22,
        depth: 22,
        roof: "gable",
        pitch: 32,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 13, 9.5, 3),
          opening("door-s", "s", "door", 3, 6.8, 18),
          opening("win-e1", "e", "window", 4, 4, 5),
          opening("win-e2", "e", "window", 4, 4, 13),
          opening("win-w", "w", "window", 4, 4, 9),
          opening("win-n", "n", "window", 4, 3, 9, 6),
        ],
      }),
      volume({
        id: "shop",
        name: "Workshop",
        width: 18,
        depth: 20,
        x: 21,
        z: 0,
        roof: "shed",
        pitch: 12,
        height: 10.5,
        openings: [
          opening("overhead-s", "s", "door", 10, 9, 4),
          opening("win-e", "e", "window", 5, 4, 7, 4),
          opening("win-n", "n", "window", 5, 4, 6.5, 4),
          opening("door-w", "w", "door", 3, 6.8, 3),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored live/work concept, modelled at 13% glazing — the lowest in this set, because a workshop with one overhead door and two high windows drags the ratio down honestly. The shop is drawn as a conditioned volume; if it is heated only when in use, its energy model and its cost line both change. A workshop attached to a dwelling raises fire separation, ventilation and use-classification questions in every Alberta municipality, and a commercial trade run out of it raises more. Ask before framing, not after.",
  }),
  original({
    id: "bro-breezeway",
    title: "Bro Breezeway",
    kicker: "844 sq ft · glazed link",
    summary: "A living volume and a sleeping volume joined by a narrow glazed link that is both the entry and a slot of daylight straight through the house.",
    bestFor: "Households who want quiet and social genuinely separated",
    bedrooms: 2,
    bathrooms: 2,
    sleeping: "Two enclosed bedrooms in their own volume",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "nordic modern", "multi-volume"],
    features: ["Glazed connecting link", "Acoustic separation", "Three simple roofs"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "living",
        name: "Living volume",
        width: 20,
        depth: 22,
        roof: "gable",
        pitch: 32,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 14, 9.5, 3),
          opening("door-w", "w", "door", 3, 6.8, 8),
          opening("win-n", "n", "window", 4, 4, 8),
          opening("win-w", "w", "window", 4, 4, 14),
        ],
      }),
      volume({
        id: "link",
        name: "Glazed link",
        width: 7,
        depth: 12,
        x: 13.5,
        z: 0,
        roof: "flat",
        height: 9.5,
        openings: [
          /* 3.6 + 2.5 across a 7 ft wall, with the door starting at 4.2 and a
             0.3 ft return at the end. The first version put a 4 ft glazing
             wall at 0.5 and the door at 4.2, which overlapped by 0.3 ft — a
             door and a pane of glass in the same piece of wall. Nothing caught
             it: the openings-fit-their-wall assertion checks each opening
             against the run, never against its neighbour. That gate exists
             now, below this file in plan-catalog.spec.ts. */
          opening("glass-s", "s", "glazing-wall", 3.6, 9, 0.4),
          opening("door-s", "s", "door", 2.5, 6.8, 4.2),
          opening("glass-n", "n", "glazing-wall", 5.5, 9, 0.75),
        ],
      }),
      volume({
        id: "sleeping",
        name: "Sleeping volume",
        width: 16,
        depth: 20,
        x: 25,
        z: 0,
        roof: "gable",
        pitch: 32,
        height: 10,
        openings: [
          opening("win-s", "s", "window", 6, 5, 5),
          opening("win-e", "e", "window", 4, 4, 8),
          opening("win-w", "w", "window", 4, 4, 8),
          opening("win-n", "n", "window", 3, 3, 6.5, 5.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored linked-volume concept, modelled at 17% glazing — under the prescriptive ceiling. The link is glazed on both faces so the house has a view through it, and it is deliberately the smallest heated volume on the site: a glass corridor is a thermal weak point, and keeping it 7 ft wide is what keeps it affordable. Where three roofs meet two junctions, flashing and snow are the detail that matters most; that is a professional drawing, not a massing decision.",
  }),
  original({
    id: "atelje-house",
    title: "Ateljé House",
    kicker: "924 sq ft · home + atelier",
    summary: "A glazed two-bedroom home beside a tall north-lit studio with a wide door for moving work in and finished pieces out.",
    bestFor: "An artist, furniture maker or anyone whose work needs a room",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "nordic modern", "work from home"],
    features: ["North studio clerestory", "8 ft work door", "Separated studio volume"],
    material: "timber_frame",
    volumes: [
      volume({
        id: "home",
        name: "Main house",
        width: 24,
        depth: 22,
        roof: "gable",
        pitch: 32,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 14, 9.5, 3),
          opening("door-s", "s", "door", 3, 6.8, 19),
          opening("win-e", "e", "window", 4, 4, 6),
          opening("win-w1", "w", "window", 4, 4, 6),
          opening("win-w2", "w", "window", 4, 4, 14),
          opening("win-n", "n", "window", 4, 3, 10, 6),
        ],
      }),
      volume({
        id: "studio",
        name: "Atelier",
        width: 18,
        depth: 22,
        x: 22,
        z: 0,
        roof: "shed",
        pitch: 16,
        height: 11,
        openings: [
          opening("cler-n1", "n", "window", 6, 4, 1, 6.5),
          opening("cler-n2", "n", "window", 6, 4, 8, 6.5),
          opening("cler-n3", "n", "window", 3, 4, 14.5, 6.5),
          opening("work-door", "s", "door", 8, 8, 5),
          opening("win-e", "e", "window", 4, 5, 8),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored artist-house concept, modelled at 15% glazing — under the prescriptive ceiling, because studio light comes from a high band rather than a wall. North light is steady and shadowless and it is also the coldest orientation in Alberta; keeping the band small and high is what makes it affordable. An 8 ft work door needs a real header and a threshold that survives snow, and a studio with solvents, dust or a kiln has ventilation and fire-separation requirements a professional must specify.",
  }),
  original({
    id: "slekt-house",
    title: "Slekt House",
    kicker: "944 sq ft · two front doors",
    summary: "A family house and a self-contained suite under one roof language, each with its own entry, so a household can change shape without moving.",
    bestFor: "Multigenerational living, a returning adult child, or rental income",
    bedrooms: 3,
    bathrooms: 2,
    sleeping: "Two bedrooms + a one-bedroom suite",
    storeys: 1,
    tags: ["800–1,200 sq ft", "three bedroom", "nordic modern", "multi-volume"],
    features: ["Independent suite entry", "Shared roof language", "Single-storey throughout"],
    volumes: [
      volume({
        id: "main",
        name: "Main house",
        width: 26,
        depth: 24,
        roof: "gable",
        pitch: 32,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 15, 9.5, 4),
          opening("door-s", "s", "door", 3, 6.8, 21),
          opening("win-e1", "e", "window", 4, 4, 5),
          opening("win-e2", "e", "window", 4, 4, 14),
          opening("win-w1", "w", "window", 4, 4, 6),
          opening("win-w2", "w", "window", 4, 4, 14),
          opening("win-n", "n", "window", 4, 3, 11, 6),
        ],
      }),
      volume({
        id: "suite",
        name: "Suite",
        width: 16,
        depth: 20,
        x: 22,
        z: -1,
        roof: "shed",
        pitch: 14,
        height: 9.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 9, 9, 2),
          opening("door-s", "s", "door", 2.8, 6.8, 12),
          opening("win-e", "e", "window", 3, 4, 6),
          opening("win-n", "n", "window", 3, 3, 6.5, 5.5),
          opening("win-w", "w", "window", 3, 4, 8),
        ],
      }),
    ],
    deck: { width: 20, depth: 10 },
    notes: "Aura-authored multigenerational concept, modelled at 20% glazing — under the prescriptive ceiling. Two front doors is a zoning question before it is an architectural one: secondary suites have their own rules for ceiling height, egress windows, separate heating, fire separation and parking, and they differ by municipality. Confirm the suite is permitted on the parcel before any of this is drawn further, because that answer changes the plan and not just the paperwork.",
  }),
  original({
    id: "massiv-clt",
    title: "Massiv CLT",
    kicker: "960 sq ft · mass timber, two storeys",
    summary: "A two-storey mass-timber box with stacked south glazing and a flat roof sized for an array — panels up in days, finishes left exposed.",
    bestFor: "A fast panelized build where the structure is the finish",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["800–1,200 sq ft", "three bedroom", "nordic modern", "two storey"],
    features: ["Exposed CLT structure", "Stacked south glazing", "Array-ready flat roof"],
    material: "clt",
    volumes: [
      volume({
        width: 20,
        depth: 24,
        storeys: 2,
        roof: "flat",
        height: 9.5,
        openings: [
          opening("glass-s-lower", "s", "glazing-wall", 12, 9, 4),
          opening("glass-s-upper", "s", "glazing-wall", 12, 8, 4, 10.5),
          opening("door-s", "s", "door", 3, 6.8, 0.5),
          opening("win-e-lower", "e", "window", 4, 4, 6),
          opening("win-e-upper", "e", "window", 4, 4, 6, 12),
          opening("win-w-lower", "w", "window", 4, 4, 14),
          opening("win-w-upper", "w", "window", 4, 4, 14, 12),
          opening("win-n-lower", "n", "window", 4, 3, 8, 3),
          opening("win-n-upper", "n", "window", 4, 3, 8, 12.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored mass-timber concept, modelled at 18% glazing — under the prescriptive ceiling. Stacking the glazing on one face keeps the panel layout simple: every opening lands in the same two panels rather than scattering across the wall. This shell does not model the intermediate floor, the stair or the stair opening — those need graph editing and professional design. CLT also needs its exposure period, its moisture management during erection and its acoustic separation between storeys specified by someone who has supplied it before.",
  }),
  original({
    id: "smalhus-infill",
    title: "Smalhus Infill",
    kicker: "1,024 sq ft · narrow infill",
    summary: "A 16 ft wide two-storey house that takes all its light from the two short ends, because on an infill lot the long walls belong to the neighbours.",
    bestFor: "A narrow city lot, a laneway parcel or a skinny gap in a block",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["800–1,200 sq ft", "three bedroom", "nordic modern", "urban infill"],
    features: ["16 ft width", "Glazed at both ends", "Minimal side-wall openings"],
    volumes: [
      volume({
        width: 16,
        depth: 32,
        storeys: 2,
        roof: "gable",
        pitch: 38,
        height: 9,
        openings: [
          opening("glass-s-lower", "s", "glazing-wall", 12, 8.5, 2),
          opening("glass-s-upper", "s", "glazing-wall", 12, 7, 2, 10),
          opening("door-n", "n", "door", 3, 6.8, 6.5),
          opening("glass-n-upper", "n", "glazing-wall", 10, 8, 3, 9.5),
          opening("win-n-lower", "n", "window", 4, 4, 11),
          opening("win-e-lower", "e", "window", 3, 3.5, 8),
          opening("win-e-upper", "e", "window", 3, 3.5, 8, 12),
          opening("win-w-lower", "w", "window", 3, 3.5, 20),
          opening("win-w-upper", "w", "window", 3, 3.5, 20, 12),
        ],
      }),
    ],
    deck: { width: 14, depth: 8 },
    notes: "Aura-authored infill concept, modelled at 19% glazing — under the prescriptive ceiling. On a narrow lot the side walls are usually within a limiting distance, which caps how much unprotected opening they may carry; that is why almost all of the glass here is on the two ends. Confirm the limiting distance, the permitted opening area and the spatial separation requirements for the actual parcel with a professional, because they can force a fire-rated wall and delete the side windows entirely.",
  }),
  original({
    id: "tarn-house",
    title: "Tårn House",
    kicker: "1,044 sq ft · bar + tower",
    summary: "A single-storey living bar with a two-storey sleeping tower at one end — height only where it earns something, and a terrace on the bar's roof.",
    bestFor: "A view lot where one room deserves to be up high",
    bedrooms: 3,
    bathrooms: 2,
    sleeping: "Three bedrooms in the tower",
    storeys: 2,
    tags: ["800–1,200 sq ft", "three bedroom", "nordic modern", "two storey"],
    features: ["Mixed one and two storey", "Full-height tower glazing", "Roof terrace intent"],
    material: "clt",
    volumes: [
      volume({
        id: "bar",
        name: "Living bar",
        width: 26,
        depth: 18,
        x: -2,
        z: 0,
        roof: "shed",
        pitch: 14,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 15, 9.5, 4),
          opening("door-s", "s", "door", 3, 6.8, 21),
          opening("win-n1", "n", "window", 4, 3, 6, 6),
          opening("win-n2", "n", "window", 4, 3, 16, 6),
          opening("win-w", "w", "window", 4, 4, 7),
        ],
      }),
      volume({
        id: "tower",
        name: "Sleeping tower",
        width: 16,
        depth: 18,
        x: 19,
        z: 0,
        storeys: 2,
        roof: "flat",
        height: 9.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 10, 18, 3),
          opening("win-e-lower", "e", "window", 4, 4, 6),
          opening("win-e-upper", "e", "window", 4, 4, 6, 12),
          opening("win-n-upper", "n", "window", 4, 3, 6, 12.5),
          opening("win-n-lower", "n", "window", 4, 4, 6),
        ],
      }),
    ],
    deck: { width: 20, depth: 10 },
    notes: "Aura-authored mixed-height concept, modelled at 19% glazing — under the prescriptive ceiling. Putting the second storey only where the view is keeps the roof, the stair and the heated volume small, and it gives the bar's roof to the tower as a terrace. The full-height tower glazing is two storeys of unbroken glass: its structure, its guard at the upper floor and its cleaning access are all real questions, and the terrace needs occupied-roof live load and guard height before it is anything but an intention.",
  }),
  original({
    id: "trappetarn-house",
    title: "Trappetårn House",
    kicker: "1,120 sq ft · glazed stair tower",
    summary: "A quiet two-storey house with its stair pulled out into a small glazed tower, so the circulation is the lantern and the rooms stay calm.",
    bestFor: "A family home that wants one dramatic move and nineteen sensible ones",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["800–1,200 sq ft", "three bedroom", "nordic modern", "two storey"],
    features: ["Glazed stair tower", "Stair pulled out of the plan", "Calm room elevations"],
    material: "clt",
    volumes: [
      volume({
        id: "house",
        name: "Main house",
        width: 20,
        depth: 24,
        storeys: 2,
        roof: "gable",
        pitch: 34,
        height: 9.5,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 9, 4),
          opening("win-s-upper", "s", "window", 5, 4, 4, 11),
          opening("door-s", "s", "door", 3, 6.8, 0.5),
          opening("win-e-lower", "e", "window", 4, 4, 6),
          opening("win-e-upper", "e", "window", 4, 4, 6, 12),
          opening("win-w-lower", "w", "window", 4, 4, 14),
          opening("win-w-upper", "w", "window", 4, 4, 14, 12),
          opening("win-n-upper", "n", "window", 4, 3, 8, 12.5),
          opening("win-n-lower", "n", "window", 4, 4, 8),
        ],
      }),
      volume({
        id: "stair",
        name: "Stair tower",
        width: 8,
        depth: 10,
        x: 14,
        z: -4,
        storeys: 2,
        roof: "flat",
        height: 9.5,
        openings: [
          opening("glass-e", "e", "glazing-wall", 6, 18, 1),
          opening("glass-s", "s", "glazing-wall", 6, 18, 1),
          opening("door-n", "n", "door", 3, 6.8, 2.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored stair-tower concept, modelled at 19% glazing — under the prescriptive ceiling, even though 216 sq ft of the glass is in a volume 8 ft wide. Pulling the stair out buys usable floor area in both storeys and gives the house a lit route between them. This shell does not model the stair, its landings or the floor opening — those need graph editing and professional design, and a two-storey glazed shaft is a solar-gain and stack-effect problem in summer that wants an opening vent at the top.",
  }),
  original({
    id: "hjornetomt-house",
    title: "Hjørnetomt House",
    kicker: "1,152 sq ft · corner lot",
    summary: "A corner-lot house that keeps the street level solid and puts its glass on the upper floor, above the fence line and out of the sightlines.",
    bestFor: "A corner parcel with two public frontages and no privacy",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["800–1,200 sq ft", "three bedroom", "nordic modern", "urban infill"],
    features: ["Upper-floor glazing", "Solid street level", "Two-frontage plan"],
    volumes: [
      volume({
        width: 24,
        depth: 24,
        storeys: 2,
        roof: "flat",
        height: 9.5,
        openings: [
          opening("glass-s-upper", "s", "glazing-wall", 14, 8, 5, 10.5),
          opening("win-s-lower", "s", "window", 4, 4, 5),
          opening("door-s", "s", "door", 3, 6.8, 15.5),
          opening("glass-e-upper", "e", "glazing-wall", 12, 8, 6, 10.5),
          opening("win-e-lower", "e", "window", 3, 3, 6, 4),
          opening("win-w-lower", "w", "window", 4, 4, 8),
          opening("win-w-upper", "w", "window", 4, 4, 8, 12),
          opening("win-n-upper", "n", "window", 4, 3, 10, 12.5),
          opening("win-n-lower", "n", "window", 4, 4, 10),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes: "Aura-authored corner-lot concept, modelled at 16% glazing — under the prescriptive ceiling. The move is vertical, not stylistic: at street level on two frontages, glass is a privacy problem and a security one, so the ground floor takes small high windows and the view goes upstairs where nothing looks in. Corner parcels usually carry two front-yard setbacks and a sight-triangle at the intersection; confirm both before assuming this footprint fits.",
  }),
  original({
    id: "gavl-lantern",
    title: "Gavl Lantern",
    kicker: "1,320 sq ft · double-height gable",
    summary: "A steep gable with its whole south end glazed floor to ridge over a double-height living room — the biggest glass move in the library, drawn as a family house.",
    bestFor: "A family home with one room that people remember",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["1,200+ sq ft", "three bedroom", "nordic modern", "two storey"],
    features: ["Full-height gable glazing", "Double-height living volume", "Steep snow-shedding roof"],
    volumes: [
      volume({
        width: 22,
        depth: 30,
        storeys: 2,
        roof: "gable",
        pitch: 40,
        height: 9,
        openings: [
          opening("glass-s", "s", "glazing-wall", 17, 17.5, 2.5),
          opening("door-e", "e", "door", 3, 6.8, 3),
          opening("win-e-lower", "e", "window", 4, 4, 10),
          opening("win-e-upper", "e", "window", 4, 4, 10, 12),
          opening("win-e-end", "e", "window", 5, 4, 20),
          opening("win-w-lower", "w", "window", 4, 4, 6),
          opening("win-w-upper", "w", "window", 4, 4, 6, 12),
          opening("win-w-end", "w", "window", 5, 4, 18),
          opening("win-n-lower", "n", "window", 5, 4, 8.5),
          opening("win-n-upper", "n", "window", 5, 4, 8.5, 12.5),
        ],
      }),
    ],
    deck: { width: 20, depth: 10, hotTub: true },
    notes: "Aura-authored double-height concept, and the most aggressive plan in the set. Modelled glazing is 24% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling. It goes to permit on the performance path, where a high-performance glazing package, a thicker envelope on the other three walls and measured airtightness buy the gable back. The costs are specific and worth stating: a gable window of nearly 300 sq ft loses heat all winter, a double-height room stratifies unless the heating is designed for it, and a south gable at this size will overheat in July without external shading or a deep overhang. None of that is a reason not to build it; all of it is a reason to have an energy advisor on it from the first sketch.",
  }),
  original({
    id: "skodde-cabin",
    title: "Skodde Cabin",
    kicker: "396 sq ft · shuttered glass",
    summary: "A small gabled cabin with a big south window and insulated shutters that close over it — the old answer to the oldest problem with glass.",
    bestFor: "An off-grid or seasonal cabin that sits empty in the cold",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["under 400 sq ft", "one bedroom", "nordic modern", "off grid"],
    features: ["Insulated shutter intent", "South glazing wall", "Lockable when empty"],
    material: "timber_frame",
    volumes: [
      volume({
        width: 22,
        depth: 18,
        roof: "gable",
        pitch: 34,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 15, 9.5, 3.5),
          opening("door-s", "s", "door", 3, 6.8, 18.8),
          opening("win-e", "e", "window", 3, 4, 7),
          opening("win-w", "w", "window", 3, 4, 7),
          opening("win-n", "n", "window", 3, 2.5, 9.5, 6.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 8 },
    notes: "Aura-authored shuttered-glass concept, modelled at 22% glazing — just under the prescriptive ceiling, and that is the honest framing: shutters do not change the ratio, because the ratio is an area calculation. What they change is the night-time and unoccupied heat loss, which for a cabin that is empty five days a week is the number that actually matters. Shutters that are hard to close do not get closed — the hardware, the tracks and the ice on them are the design problem, and they need a real detail, not a note.",
  }),

  /* ==========================================================================
     THE SECOND GLASS WAVE — seventeen Aura originals, August 2026 (PL03).

     The founder asked for "cooler ones, more glass ... beautiful stunning
     designs that are modern and eco friendly". PL01 answered the first half of
     that with thirty; this wave answers the rest, and the number is seventeen
     rather than thirty ON PURPOSE.

     WHY SEVENTEEN. The anti-padding gate is measurable now (`paddedPlanPairs`)
     but it is still conditional, and a verifier has already defeated its
     predecessor twice — once with a one-foot nudge, once with a single letter
     in a prose field. So the count is a judgement call and judgement is what
     was applied: every plan below had to answer "what does this building know
     that no other plan in the library knows?" in one sentence, before it was
     drawn. Seventeen ideas passed. The ones that did not are named in
     docs/research/PLAN-LIBRARY-SOURCES.md § 11.2 with the reason, because a
     rejected idea recorded is worth more than a thirtieth plan shipped.

     WHAT IS NEW IN THE ENGINE, AND WHY IT IS NOT DECORATION. Two `volume()`
     inputs land with this wave: `overhang` (every one of the previous 55 plans
     used 1.5 ft, so the roof's own shading power was a constant nobody could
     spend) and `facing` (a courtyard's roofs have to fall away from the court;
     no pitch achieves that). Both reach geometry.ts — `boundsWithRoof` grows
     with the overhang, and the shed fall direction is read from `facing` — and
     tests/plan-catalog.spec.ts asserts both against the engine rather than
     trusting the field to have been read.

     THE GLASS RULE IS UNCHANGED AND STRICTER IN PRACTICE. `FDWR_MAX` is 0.22,
     the NBC 9.36 PRESCRIPTIVE ceiling and not a legal maximum; the builder
     reports `modelledGlazingRatio` and never clamps it. Five of these
     seventeen model above the ceiling, and each of the five names the ceiling,
     states its own ratio to within a point of its geometry, names the
     compliance path and says what the glass costs in a zone 7A winter — the
     same sentence shape the eight PL01 plans use, held by the same gate.
     ====================================================================== */

  original({
    id: "jordhus-berm",
    title: "Jordhus Berm",
    kicker: "540 sq ft · earth-sheltered",
    summary:
      "Three walls held against an earth berm and one wall given entirely to glass — the cheapest insulation in Alberta is the ground you are already standing on.",
    bestFor: "An exposed site, an off-grid budget, or anyone tired of the wind",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "earth sheltered", "cold climate"],
    features: ["Bermed on three sides", "One full-height south glass wall", "High vents in both gable ends"],
    costBasis: {
      status: "proxy",
      label: "Bermed-wall proxy",
      note: "An earth-bermed wall is a structural retaining wall with waterproofing and drainage behind it, not a SIP panel. The Alberta BOM prices the shell it knows, so treat this range as a floor and get a quote from a foundation supplier plus an engineer's scope for the retaining and waterproofing work before believing any of it.",
    },
    volumes: [
      volume({
        width: 30,
        depth: 18,
        roof: "gable",
        pitch: 30,
        height: 10,
        openings: [
          opening("glass-s", "s", "glazing-wall", 22, 9, 4),
          opening("door-s", "s", "door", 3, 6.8, 26.5),
          opening("vent-e", "e", "window", 2, 2, 8, 7.5),
          opening("vent-w", "w", "window", 2, 2, 8, 7.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 8 },
    notes:
      "Aura-authored earth-sheltered concept, modelled at 21% glazing — under the 22% prescriptive ceiling, with almost all of it on one wall. The berm is the whole argument: earth against three walls holds them near ground temperature instead of −30 °C, so the same glass on the fourth wall costs less to run than it would on an exposed box. What it costs instead is a structural retaining wall, a waterproofing system and drainage that has to keep working for fifty years, and none of that is modelled here. The two 2 ft vents high in the gable ends are the only openings above the berm line; a room with one exposure needs mechanical ventilation designed for it, not an opening window.",
  }),
  original({
    id: "lysrygg-monitor",
    title: "Lysrygg Monitor",
    kicker: "1,140 sq ft · monitor roof",
    summary:
      "Two low wings either side of a tall central spine glazed on both long faces — daylight arrives in the middle of a deep plan instead of dying six feet from a window.",
    bestFor: "A deep plan, a north-facing lot, or a family that wants one big room",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "clerestory", "multi-volume"],
    features: ["Raised clerestory spine", "Wing roofs fall away from the spine", "Light from above, not across"],
    volumes: [
      volume({
        id: "wing-s",
        name: "South wing",
        width: 30,
        depth: 14,
        z: 12,
        height: 8.5,
        roof: "shed",
        pitch: 12,
        facing: "s",
        openings: [
          opening("glass-s", "s", "glazing-wall", 14, 8, 3),
          opening("door-s", "s", "door", 3, 6.8, 22),
          opening("win-e", "e", "window", 4, 4, 5),
          opening("win-w", "w", "window", 4, 4, 5),
        ],
      }),
      volume({
        id: "spine",
        name: "Clerestory spine",
        width: 30,
        depth: 10,
        height: 13,
        roof: "gable",
        pitch: 20,
        openings: [
          opening("cler-n1", "n", "window", 8, 3, 1.5, 9.5),
          opening("cler-n2", "n", "window", 8, 3, 11, 9.5),
          opening("cler-n3", "n", "window", 8, 3, 20.5, 9.5),
          opening("cler-s1", "s", "window", 8, 3, 1.5, 9.5),
          opening("cler-s2", "s", "window", 8, 3, 11, 9.5),
          opening("cler-s3", "s", "window", 8, 3, 20.5, 9.5),
        ],
      }),
      volume({
        id: "wing-n",
        name: "North wing",
        width: 30,
        depth: 14,
        z: -12,
        height: 8.5,
        roof: "shed",
        pitch: 12,
        facing: "n",
        openings: [
          opening("win-n1", "n", "window", 5, 4, 4, 3.5),
          opening("win-n2", "n", "window", 5, 4, 21, 3.5),
          opening("win-e", "e", "window", 3, 4, 5),
          opening("win-w", "w", "window", 3, 4, 5),
        ],
      }),
    ],
    deck: { width: 20, depth: 9 },
    notes:
      "Aura-authored monitor-roof concept, modelled at 14% glazing — a long way under the ceiling, which is the point being made. Six clerestory panes set 9'-6\" up put usable light into the middle of a 38 ft deep plan, and a wall of glass at eye level cannot do that no matter how big it is. The two wing roofs fall AWAY from the spine on purpose, so the building never creates the two valleys a monitor otherwise invites; those junctions are still the detail that decides whether this ages well, and they are a professional's drawing rather than a massing decision. Clerestory glass is also the hardest glass in a house to shade, to clean and to reach — say that to yourself before the third pane goes in, because it loses heat at night like any other glass and you cannot hang a curtain over it.",
  }),
  original({
    id: "vertikal-tower",
    title: "Vertikal Tower",
    kicker: "576 sq ft · two storeys on 288",
    summary:
      "The smallest footprint in the library that still holds a two-storey home: one room stacked on another, with the south face glazed on both floors.",
    bestFor: "An expensive urban lot, an infill parcel, or a small site with a view",
    bedrooms: 1,
    bathrooms: 1.5,
    sleeping: "One bedroom upstairs",
    storeys: 2,
    tags: ["400–800 sq ft", "one bedroom", "two storey", "urban infill"],
    features: ["288 sq ft of ground", "Glazed south face on both floors", "Flat roof and parapet"],
    volumes: [
      volume({
        width: 16,
        depth: 18,
        storeys: 2,
        height: 9.5,
        roof: "flat",
        openings: [
          opening("glass-s", "s", "glazing-wall", 13, 8.5, 1.5),
          opening("glass-s-upper", "s", "glazing-wall", 13, 8, 1.5, 10),
          opening("door-e", "e", "door", 3, 6.8, 3),
          opening("win-e-upper", "e", "window", 5, 5, 3, 12),
          opening("win-w", "w", "window", 4, 5, 7),
          opening("win-w-upper", "w", "window", 4, 5, 7, 12),
          opening("win-n-upper", "n", "window", 4, 4, 6, 12),
        ],
      }),
    ],
    deck: { width: 12, depth: 6 },
    notes:
      "Aura-authored vertical-infill concept. Modelled glazing is 23% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, and the reason is arithmetic rather than ambition: a 16 × 18 ft plan has very little wall to spread glass over, so two ordinary glazed elevations put it over the line. The route is the performance path, where a better glazing package and a tighter envelope buy it back. The costs are specific. A small building loses heat through its skin faster per square foot of floor than a large one, so the envelope has to be better here than on a bungalow of the same glazing ratio. This shell does not model the intermediate floor, the stair or the stair opening — those need graph editing and professional design. And two storeys of glass facing a street needs a privacy answer at ground level that a curtain is not.",
  }),
  original({
    id: "bakgate-adu",
    title: "Bakgate ADU",
    kicker: "1,056 sq ft · suite over a garage",
    summary:
      "The Edmonton back lane, answered: two parking bays and a workshop underneath, a one-bedroom suite with a glazed gable to the lane above.",
    bestFor: "A laneway suite, a rental on a lot you already own, or family nearby",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One bedroom upstairs",
    storeys: 2,
    tags: ["800–1,200 sq ft", "one bedroom", "two storey", "secondary suite"],
    features: ["Garage and workshop below", "Glazed gable to the lane", "9 ft overhead door"],
    costBasis: {
      status: "proxy",
      label: "Garage-below proxy",
      note: "The Alberta BOM prices every square foot as conditioned living space and half of this building is an unheated garage, so the range is high by an amount only a supplier quote on the overhead door, the slab and the fire-separation assembly can settle.",
    },
    volumes: [
      volume({
        width: 22,
        depth: 24,
        storeys: 2,
        height: 9,
        roof: "gable",
        pitch: 32,
        openings: [
          opening("overhead-s", "s", "door", 9, 8, 2),
          opening("door-s", "s", "door", 3, 6.8, 13),
          opening("glass-s-upper", "s", "glazing-wall", 12, 7.5, 5, 9.5),
          opening("glass-n-upper", "n", "glazing-wall", 8, 8, 7, 9.5),
          opening("win-n", "n", "window", 4, 4, 2),
          opening("win-e-upper", "e", "window", 4, 4, 4, 12),
          opening("win-e-upper2", "e", "window", 4, 4, 15, 12),
          opening("win-w-upper", "w", "window", 4, 4, 4, 12),
          opening("win-w-upper2", "w", "window", 4, 4, 15, 12),
        ],
      }),
    ],
    deck: null,
    notes:
      "Aura-authored laneway-suite concept, modelled at 14% glazing — under the ceiling, because the ground floor is a garage and a garage does not want windows. Two things are modelled dishonestly here and both are stated rather than buried: the model counts the garage as conditioned floor area, so the published area and the cost range are both bigger than the home you would actually live in; and the fire separation between a garage and a dwelling above it is a real assembly with a real cost this shell does not draw. A secondary suite is a zoning question before it is an architectural one — height limits, lane setbacks, parking, and whether a suite is permitted at all differ by municipality, so confirm the parcel before this goes any further.",
  }),
  original({
    id: "hyttetun-cluster",
    title: "Hyttetun",
    kicker: "756 sq ft · hall + three bunkies",
    summary:
      "One heated hall to cook, eat and sit in, and three small sleeping cabins you walk to — the Nordic yard arrangement, which heats only the room you are standing in.",
    bestFor: "A family compound, a guiding operation, or a build done in stages",
    bedrooms: 3,
    bathrooms: 1.5,
    sleeping: "Three separate sleeping cabins",
    storeys: 1,
    tags: ["400–800 sq ft", "three bedroom", "multi-volume", "phased build"],
    features: ["Shared hall holds the only kitchen", "Three 120 sq ft sleeping cabins", "Build the hall first"],
    volumes: [
      volume({
        id: "hall",
        name: "Hall",
        width: 22,
        depth: 18,
        height: 11,
        roof: "gable",
        pitch: 34,
        openings: [
          opening("glass-s", "s", "glazing-wall", 16, 9.5, 3),
          opening("door-s", "s", "door", 3, 6.8, 19),
          opening("win-e", "e", "window", 4, 4, 7),
          opening("win-w", "w", "window", 4, 4, 7),
          opening("win-n", "n", "window", 5, 4, 8, 4),
        ],
      }),
      volume({
        id: "bunk-a",
        name: "Bunkie A",
        width: 10,
        depth: 12,
        x: -16,
        z: -16,
        height: 8.5,
        roof: "shed",
        pitch: 14,
        openings: [
          opening("glass-s", "s", "glazing-wall", 6, 7, 2),
          opening("door-e", "e", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 2, 3, 7, 4),
        ],
      }),
      volume({
        id: "bunk-b",
        name: "Bunkie B",
        width: 10,
        depth: 12,
        z: -16,
        height: 8.5,
        roof: "shed",
        pitch: 14,
        openings: [
          opening("glass-s", "s", "glazing-wall", 6, 7, 2),
          opening("door-e", "e", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 2, 3, 7, 4),
        ],
      }),
      volume({
        id: "bunk-c",
        name: "Bunkie C",
        width: 10,
        depth: 12,
        x: 16,
        z: -16,
        height: 8.5,
        roof: "shed",
        pitch: 14,
        openings: [
          opening("glass-s", "s", "glazing-wall", 6, 7, 2),
          opening("door-e", "e", "door", 3, 6.8, 2),
          opening("win-e", "e", "window", 2, 3, 7, 4),
        ],
      }),
    ],
    deck: { width: 18, depth: 10, hotTub: true },
    notes:
      "Aura-authored cluster concept, modelled at 17% glazing across four volumes. The idea is a heating strategy rather than a style: the hall carries the glass, the kitchen and the heat, and each bunkie is small enough to warm in twenty minutes and cheap enough to leave cold. The model does not know that — it counts all four volumes as conditioned floor area, so both the published area and the cost range assume you heat everything all winter. Four volumes also means four foundations, four roofs, four times the flashing, and a walk between the bed and the bathroom in January. That walk is the design. It is also exactly why this plan is the wrong one for anyone with limited mobility, and no amount of drawing fixes that.",
  }),
  original({
    id: "karnapp-bay",
    title: "Karnapp Bay",
    kicker: "568 sq ft · one projecting bay",
    summary:
      "An ordinary one-bedroom bar with all of its view glass gathered into a single 8 ft bay that steps out of the east wall and sees three ways at once.",
    bestFor: "A view that arrives from one corner, or a small home that wants one great seat",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "multi-volume", "nordic modern"],
    features: ["48 sq ft glazed bay", "Three glazed faces in one place", "Punched windows everywhere else"],
    volumes: [
      volume({
        width: 26,
        depth: 20,
        height: 9.5,
        roof: "gable",
        pitch: 34,
        openings: [
          opening("win-s", "s", "window", 4, 5, 1.5, 2.5),
          opening("door-s", "s", "door", 3, 6.8, 20.5),
          opening("win-n1", "n", "window", 4, 4, 4, 3.5),
          opening("win-n2", "n", "window", 4, 4, 18, 3.5),
          opening("win-e", "e", "window", 3, 4, 8),
          opening("win-w", "w", "window", 3, 4, 8),
        ],
      }),
      volume({
        id: "bay",
        name: "Bay",
        width: 8,
        depth: 6,
        x: 17,
        height: 8,
        roof: "flat",
        openings: [
          opening("glass-bay-e", "e", "glazing-wall", 5, 7.5, 0.5),
          opening("glass-bay-n", "n", "glazing-wall", 6, 7.5, 1),
          opening("glass-bay-s", "s", "glazing-wall", 6, 7.5, 1),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes:
      "Aura-authored bay concept, modelled at 19% glazing — under the ceiling, and concentrated rather than spread. Glass gathered into one projecting box sees north-east through south-east; the same area laid flat along a wall sees one direction and reads as a strip. What the bay costs is worth saying plainly: 48 sq ft of floor wrapped in three walls and its own roof is the most expensive floor area in the building per square foot, and that floor is the coldest surface in the house unless the cantilever or the foundation under it is insulated and detailed properly. A bay also loses heat on three sides at once. Get the detail from a professional; it is the difference between a favourite seat and a draught nobody sits in.",
  }),
  original({
    id: "midtglass-longhouse",
    title: "Midtglass Longhouse",
    kicker: "924 sq ft · glazed in the middle",
    summary:
      "Two solid end volumes for sleeping and a taller glazed hall between them, lit from both long sides — the glass is where people gather, not where they sleep.",
    bestFor: "A household that wants one bright room and genuinely dark bedrooms",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two bedrooms, one in each end",
    storeys: 1,
    tags: ["800–1,200 sq ft", "two bedroom", "multi-volume", "cross-lit"],
    features: ["Cross-lit central hall", "Solid sleeping ends", "Three volumes, three simple roofs"],
    volumes: [
      volume({
        id: "hall",
        name: "Hall",
        width: 20,
        depth: 22,
        height: 12,
        roof: "gable",
        pitch: 24,
        openings: [
          opening("glass-s", "s", "glazing-wall", 18, 11, 1),
          opening("glass-n", "n", "glazing-wall", 18, 11, 1),
        ],
      }),
      volume({
        id: "end-w",
        name: "West end",
        width: 11,
        depth: 22,
        x: -15.5,
        height: 9,
        roof: "gable",
        pitch: 34,
        openings: [
          opening("win-s", "s", "window", 3, 4, 4, 3.5),
          opening("win-n", "n", "window", 3, 4, 4, 3.5),
          opening("win-w", "w", "window", 3, 4, 9, 3.5),
        ],
      }),
      volume({
        id: "end-e",
        name: "East end",
        width: 11,
        depth: 22,
        x: 15.5,
        height: 9,
        roof: "gable",
        pitch: 34,
        openings: [
          opening("win-s", "s", "window", 3, 4, 4, 3.5),
          opening("win-n", "n", "window", 3, 4, 4, 3.5),
          opening("door-e", "e", "door", 3, 6.8, 5),
          opening("win-e", "e", "window", 3, 4, 13, 3.5),
        ],
      }),
    ],
    deck: { width: 18, depth: 9 },
    notes:
      "Aura-authored cross-lit concept, modelled at 21% glazing — under the ceiling, which is the argument rather than an accident. 468 sq ft of glass sounds extravagant until you notice that the two ends carry seven small windows between them: bedrooms need darkness and privacy more than they need a view, and not glazing them is exactly what pays for glazing the hall. The costs are real. A room glazed on both long sides has nothing to hold the gain and will swing hot in the afternoon and cold at night unless the floor is doing that work. The north glass is a straight heat-loss line that only a good glazing package makes tolerable. And three volumes at two eave heights means two junctions, which is where the flashing goes and where the snow ends up.",
  }),
  original({
    id: "atriumgard",
    title: "Atriumgård",
    kicker: "680 sq ft · four bars, one court",
    summary:
      "Four narrow bars closed around a sheltered court, every room glazed inward and nearly blind outward — the courtyard house built for wind rather than for heat.",
    bestFor: "An exposed prairie site, or a household that wants outdoor space it can use",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two bedrooms in separate bars",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "courtyard", "multi-volume"],
    features: ["264 sq ft sheltered court", "Every roof falls away from the court", "Glass inward, small windows out"],
    volumes: [
      volume({
        id: "bar-n",
        name: "North bar",
        width: 22,
        depth: 10,
        z: -11,
        height: 9.5,
        roof: "shed",
        pitch: 14,
        facing: "n",
        openings: [
          opening("glass-court", "s", "glazing-wall", 16, 9, 3),
          opening("win-out", "n", "window", 4, 3.5, 9, 5),
        ],
      }),
      volume({
        id: "bar-s",
        name: "South bar",
        width: 22,
        depth: 10,
        z: 11,
        height: 9.5,
        roof: "shed",
        pitch: 14,
        facing: "s",
        openings: [
          opening("glass-court", "n", "glazing-wall", 16, 9, 3),
          opening("door-out", "s", "door", 3, 6.8, 2),
          opening("win-out", "s", "window", 5, 4, 13),
        ],
      }),
      volume({
        id: "bar-w",
        name: "West bar",
        width: 10,
        depth: 12,
        x: -16,
        height: 9.5,
        roof: "shed",
        pitch: 14,
        facing: "w",
        openings: [
          opening("glass-court", "e", "glazing-wall", 9, 9, 1.5),
          opening("win-out", "w", "window", 3, 3.5, 4, 5),
        ],
      }),
      volume({
        id: "bar-e",
        name: "East bar",
        width: 10,
        depth: 12,
        x: 16,
        height: 9.5,
        roof: "shed",
        pitch: 14,
        facing: "e",
        openings: [
          opening("glass-court", "w", "glazing-wall", 9, 9, 1.5),
          opening("win-out", "e", "window", 3, 3.5, 4, 5),
        ],
      }),
    ],
    deck: { width: 16, depth: 8 },
    notes:
      "Aura-authored courtyard concept. Modelled glazing is 25% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, because four bars facing a court have four inward elevations to glaze. The route is the performance path: a better glazing package and a tighter envelope on the eight outward walls are what buy the court back. Two costs, both real and both measured rather than asserted. No plan in this library over 400 sq ft carries more exterior wall per square foot of floor than this one — a little over twice what the near-square Kompakt Passiv carries — and every foot of that wall loses heat whether there is glass in it or not; the court is bought with wall area, not with glazing. And all four roofs are pitched to fall AWAY from the court on purpose, because a court that four roofs drain into is a snow trap with a drain in the middle of it.",
  }),
  original({
    id: "soltak-offgrid",
    title: "Soltak Off-Grid",
    kicker: "680 sq ft · roof for panels",
    summary:
      "A single 35° south roof with almost nothing in the wall below it: the plan in this wave that spends its south face on electricity instead of on view.",
    bestFor: "An off-grid site, a solar-first budget, or the coldest lot you own",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "off grid", "passive solar"],
    features: ["One unbroken 35° south roof plane", "Small punched windows only", "No glass on the cold walls"],
    volumes: [
      volume({
        width: 34,
        depth: 20,
        height: 9,
        roof: "shed",
        pitch: 35,
        facing: "s",
        openings: [
          opening("win-s1", "s", "window", 4, 5, 3, 2.5),
          opening("win-s2", "s", "window", 4, 5, 15, 2.5),
          opening("win-s3", "s", "window", 4, 5, 27, 2.5),
          opening("door-s", "s", "door", 3, 6.8, 9.5),
          opening("win-n1", "n", "window", 2.5, 4, 6, 4),
          opening("win-n2", "n", "window", 2.5, 4, 25, 4),
          opening("win-e", "e", "window", 3, 4, 8),
          opening("win-w", "w", "window", 3, 4, 8),
        ],
      }),
    ],
    deck: { width: 18, depth: 8 },
    notes:
      "Aura-authored off-grid concept, modelled at 11% glazing — the deliberate counter-argument to the rest of this wave. A single unbroken plane facing south sheds snow well and carries an array without a penetration in the middle of it, and every window cut into the wall underneath is a hole in the envelope that array exists to keep small. Two honest limits. This codebase models no array yield, tilt optimum, shading or generation whatsoever — the roof is drawn, the electricity is not, and only a site-specific solar study says whether the idea pays on your lot. And 11% glazing is a dark house on a December afternoon: it loses very little heat and it gains very little light, and if that trade sounds wrong to you then this is not your plan and several others in this wave are.",
  }),
  original({
    id: "skrent-walkout",
    title: "Skrent Walk-Out",
    kicker: "1,232 sq ft · hillside walk-out",
    summary:
      "A two-storey box pushed into a slope: earth against the uphill walls, both floors opening downhill through glass, and a second storey that the grade pays for.",
    bestFor: "A steep lot where levelling a pad would cost more than the house",
    bedrooms: 3,
    bathrooms: 2.5,
    sleeping: "Three bedrooms upstairs",
    storeys: 2,
    tags: ["1,200+ sq ft", "three bedroom", "two storey", "steep site"],
    features: ["Walk-out lower floor", "Glass on one elevation only", "Uphill walls carry none"],
    costBasis: {
      status: "proxy",
      label: "Walk-out foundation proxy",
      note: "A walk-out lower storey is a concrete foundation wall doing structural retaining work on three sides, and the Alberta BOM prices a SIP shell instead. The range is a floor; the difference belongs in a quote from a foundation supplier and in a geotechnical engineer's scope.",
    },
    volumes: [
      volume({
        width: 28,
        depth: 22,
        storeys: 2,
        height: 9,
        roof: "shed",
        pitch: 16,
        facing: "s",
        openings: [
          opening("glass-s", "s", "glazing-wall", 18, 8.5, 2),
          opening("glass-s-upper", "s", "glazing-wall", 18, 8, 2, 9.5),
          opening("door-s", "s", "door", 3, 6.8, 21),
          opening("win-s-upper", "s", "window", 5, 4, 21, 10),
          opening("win-e", "e", "window", 4, 4, 4),
          opening("win-e-upper", "e", "window", 4, 4, 4, 12),
          opening("win-w-upper", "w", "window", 4, 4, 4, 12),
          opening("win-n-upper", "n", "window", 4, 3.5, 6, 12),
        ],
      }),
    ],
    deck: { width: 18, depth: 10, hotTub: true },
    slope: "steep",
    notes:
      "Aura-authored hillside concept, modelled at 21% glazing — under the ceiling, and worth understanding why rather than just noting it. Two full floors of glass on one elevation is a lot of glass, but a two-storey box has twice the wall to measure it against, so a plan that looks far more glazed than a bungalow can sit under the same line. The uphill walls carry none of it deliberately: below grade there is nothing to see and a great deal of heat to lose. What the slope gives you is a second storey and a lower floor that opens onto grade; what it charges you is a retaining foundation, drainage behind the uphill walls, and a geotechnical opinion on whether the slope is stable at all. That opinion comes before the architecture, not after it.",
  }),
  original({
    id: "dobbelgavl-bar",
    title: "Dobbelgavl",
    kicker: "612 sq ft · glazed at both ends",
    summary:
      "A narrow bar with both gable ends given entirely to glass and both long sides left almost solid — morning light at one end, evening at the other, nothing for the neighbours.",
    bestFor: "A treed lot, a narrow parcel, or a view that runs along the axis",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    tags: ["400–800 sq ft", "one bedroom", "nordic modern", "narrow lot"],
    features: ["Two full-height glazed ends", "Solid long elevations", "Steep 38° gable"],
    volumes: [
      volume({
        width: 18,
        depth: 34,
        height: 9.5,
        roof: "gable",
        pitch: 38,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 9.5, 3),
          opening("glass-n", "n", "glazing-wall", 12, 9.5, 3),
          opening("win-e1", "e", "window", 4, 4, 8),
          opening("win-e2", "e", "window", 4, 4, 22),
          opening("win-w1", "w", "window", 4, 4, 8),
          opening("win-w2", "w", "window", 4, 4, 22),
          opening("door-e", "e", "door", 3, 6.8, 14),
        ],
      }),
    ],
    deck: { width: 14, depth: 8 },
    notes:
      "Aura-authored double-gable concept. Modelled glazing is 30% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, and the highest ratio anywhere in this library. It goes to permit on the performance path, where triple glazing with a low-conductance frame, a thicker envelope on the two long walls and measured airtightness are what buy two glass ends back. Say the cost out loud: a north gable of glass loses heat every hour of every winter night and gives nothing back, and the only reason to accept that here is that the long sides — the walls facing the neighbours and the prevailing wind — carry four small windows between them. Two structural notes for the engineer, early: a full-height glazed gable end needs a header and a lateral system that glass cannot provide, and the triangle above the glazing in this model is wall, not glass.",
  }),
  original({
    id: "solvegg-house",
    title: "Solvegg",
    kicker: "520 sq ft · glass you cannot see through",
    summary:
      "A rammed-earth mass wall set behind south glazing with an air gap between them — a solar collector that looks like a window and is not one.",
    bestFor: "A sunny site, a patient owner, and anyone who likes a building that explains itself",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    material: "rammed_earth",
    tags: ["400–800 sq ft", "one bedroom", "thermal mass", "passive solar"],
    features: ["Trombe wall across the south face", "One real view window", "Rammed-earth mass behind the glass"],
    volumes: [
      volume({
        width: 26,
        depth: 20,
        height: 10,
        roof: "gable",
        pitch: 30,
        openings: [
          opening("trombe-s", "s", "glazing-wall", 16, 8.5, 0.5),
          opening("win-s", "s", "window", 4, 5, 17, 2.5),
          opening("door-s", "s", "door", 3, 6.8, 22),
          opening("win-n1", "n", "window", 3, 3.5, 5, 4.5),
          opening("win-n2", "n", "window", 3, 3.5, 18, 4.5),
          opening("win-e", "e", "window", 4, 4, 8),
          opening("win-w", "w", "window", 4, 4, 8),
        ],
      }),
    ],
    deck: null,
    notes:
      "Aura-authored Trombe-wall concept. Modelled glazing is 23% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, and this is the plan where that number needs the most explaining, because most of the glass here is not a window. A Trombe wall is glazing hung a few inches in front of a dark mass wall: the sun heats the mass, the mass releases it after dark, and you cannot see through any of it. The builder has exactly one category for glass and counts it anyway, which is why the ratio reads high and why there is no deck on the south face — that face is a collector, not a patio. The compliance route is a full performance model, which is also the only place the wall gets credit for what it does. The costs are unforgiving: without night insulation the same assembly runs backwards after dark and loses heat all night, it will overheat a small room in the shoulder seasons unless it is vented, and it needs winter sun on it — one spruce to the south and it is a cold wall with glass in front of it.",
  }),
  original({
    id: "skogsrom-cabin",
    title: "Skogsrom",
    kicker: "616 sq ft · eleven narrow slots",
    summary:
      "No picture window anywhere: eleven tall narrow openings that frame trunks vertically and put light on both long walls of a forest cabin.",
    bestFor: "A dense treed lot where a wall of glass would look at bark",
    bedrooms: 1,
    bathrooms: 1,
    sleeping: "One enclosed bedroom",
    storeys: 1,
    material: "timber_frame",
    tags: ["400–800 sq ft", "one bedroom", "forest site", "nordic modern"],
    features: ["Eleven glazing slots, none wider than 2'-6\"", "Light on both long walls", "Steep 40° gable"],
    volumes: [
      volume({
        width: 22,
        depth: 28,
        height: 10.5,
        roof: "gable",
        pitch: 40,
        openings: [
          opening("slot-e1", "e", "window", 2, 8, 2, 1.5),
          opening("slot-e2", "e", "window", 2, 8, 7, 1.5),
          opening("slot-e3", "e", "window", 2, 8, 12, 1.5),
          opening("slot-e4", "e", "window", 2, 8, 17, 1.5),
          opening("slot-e5", "e", "window", 2, 8, 22, 1.5),
          opening("slot-w1", "w", "window", 2, 8, 4, 1.5),
          opening("slot-w2", "w", "window", 2, 8, 13, 1.5),
          opening("slot-w3", "w", "window", 2, 8, 22, 1.5),
          opening("slot-s1", "s", "window", 2.5, 9, 3, 0.75),
          opening("slot-s2", "s", "window", 2.5, 9, 8, 0.75),
          opening("door-s", "s", "door", 3, 6.8, 14),
          opening("slot-n", "n", "window", 2, 8, 10, 1.5),
        ],
      }),
    ],
    deck: { width: 14, depth: 8 },
    notes:
      "Aura-authored forest concept, modelled at 18% glazing. In dense spruce a picture window frames bark; eleven tall narrow openings frame the trunks the way you actually see them, and putting them on both long walls means the room is lit from two sides instead of blown out on one. The honest counter-cost is that this is the expensive way to buy 189 sq ft of glass: eleven openings is eleven headers, eleven sets of flashing and eleven thermal bridges, and one large unit of the same area would cost less to buy and less to install and would lose less heat around its edges. What the difference buys is light without glare, and walls you can still put furniture against.",
  }),
  original({
    id: "familie-fire",
    title: "Familie Fire",
    kicker: "1,752 sq ft · four bedrooms",
    summary:
      "The first four-bedroom plan in the library: a plain two-storey family box with a single-storey glazed dining pavilion pushed out to the east, so the best room is not inside the big box.",
    bestFor: "A family of five or six, or a household running two home offices",
    bedrooms: 4,
    bathrooms: 2.5,
    sleeping: "Four bedrooms upstairs",
    storeys: 2,
    tags: ["1,200+ sq ft", "four bedroom", "two storey", "multi-volume"],
    features: ["Four bedrooms upstairs", "192 sq ft glazed pavilion", "Deliberately plain two-storey core"],
    volumes: [
      volume({
        width: 26,
        depth: 30,
        storeys: 2,
        height: 9,
        roof: "gable",
        pitch: 34,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 8.5, 3),
          opening("glass-s-upper", "s", "glazing-wall", 12, 8, 3, 9.5),
          opening("door-s", "s", "door", 3, 6.8, 20),
          opening("win-n1", "n", "window", 5, 4, 4),
          opening("win-n-upper1", "n", "window", 4, 4, 4, 12),
          opening("win-n-upper2", "n", "window", 4, 4, 18, 12),
          opening("door-w", "w", "door", 3, 6.8, 4),
          opening("win-w", "w", "window", 4, 4, 12),
          opening("win-w-upper1", "w", "window", 4, 4, 12, 12),
          opening("win-w-upper2", "w", "window", 4, 4, 22, 12),
          opening("win-e-upper1", "e", "window", 4, 4, 20, 12),
          opening("win-e-upper2", "e", "window", 4, 4, 25, 12),
        ],
      }),
      volume({
        id: "pavilion",
        name: "Dining pavilion",
        width: 16,
        depth: 12,
        x: 21,
        z: 6,
        height: 11,
        roof: "flat",
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 10, 2),
          opening("glass-e", "e", "glazing-wall", 8, 10, 2),
          opening("win-n", "n", "window", 6, 5, 5),
        ],
      }),
    ],
    deck: { width: 18, depth: 10, hotTub: true },
    notes:
      "Aura-authored family concept, modelled at 21% glazing — under the ceiling. The move is to keep the two-storey box plain and cheap and spend the difference on one 192 sq ft room glazed on two sides, because a family house gets its character from one good room rather than from a complicated envelope. Three things this drawing does not do. It does not model the intermediate floor, the stair or the stair opening — those need graph editing and professional design. Four bedrooms upstairs means four bedroom egress windows, which have minimum openable dimensions this model never checks. And a flat pavilion roof meeting a two-storey wall is exactly where snow slides and drifts collect: that junction wants a real detail, a bigger drain than it looks like it needs, and a professional's eye on the ice.",
  }),
  original({
    id: "skygge-veranda",
    title: "Skygge Veranda",
    kicker: "616 sq ft · four-foot eave",
    summary:
      "A wide south glass wall under a four-foot overhang — the plan whose summer-shading answer is the roof itself rather than a note telling you to buy blinds.",
    bestFor: "A south-facing lot that cooks in July",
    bedrooms: 2,
    bathrooms: 1,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    tags: ["400–800 sq ft", "two bedroom", "passive solar", "summer shading"],
    features: ["4 ft eave, drawn not promised", "20 ft south glazing wall", "Shade in July, sun in December"],
    volumes: [
      volume({
        width: 28,
        depth: 22,
        height: 10,
        roof: "gable",
        pitch: 30,
        overhang: 4,
        openings: [
          opening("glass-s", "s", "glazing-wall", 20, 9, 2),
          opening("door-s", "s", "door", 3, 6.8, 23),
          opening("win-n1", "n", "window", 4, 4, 5, 4),
          opening("win-n2", "n", "window", 4, 4, 19, 4),
          opening("win-e", "e", "window", 4, 4, 9),
          opening("win-w", "w", "window", 4, 4, 9),
        ],
      }),
    ],
    deck: { width: 20, depth: 10 },
    notes:
      "Aura-authored deep-eave concept. Modelled glazing is 24% of the modelled wall area — above the 22% NBC 9.36 prescriptive ceiling, taken on the trade-off path with a better glazing package and a tighter envelope on the solid walls. The eave is what makes the glass defensible rather than decorative: at 53.5°N the sun stands about 60° above the horizon at noon on 21 June and about 13° at noon on 21 December, so a 4 ft overhang throws roughly 6.9 ft of shade down the wall in midsummer and about 0.9 ft at midwinter — most of a 9 ft glazing wall when shade is wanted, almost none of it when it is not. Two limits, stated rather than implied. That is hand geometry at solar noon, not a shading simulation: this codebase has no sun-path model at all, and none of it addresses the low morning and evening sun of a July afternoon. And the model draws the 4 ft eave on all four sides, where a real drawing would carry it deep on the south and ordinary elsewhere — the extra framing, the wind uplift and the snow it holds are all real costs. The glass still loses heat all night in January; an eave does nothing about that.",
  }),
  original({
    id: "bygata-workshop",
    title: "Bygata Live/Work",
    kicker: "1,320 sq ft · shop below, home above",
    summary:
      "A flat-roofed two-storey street building with a 16 ft glazed shopfront on the ground floor and a two-bedroom home stacked over it.",
    bestFor: "A trades business, a studio practice, or an eco-village main street",
    bedrooms: 2,
    bathrooms: 2,
    sleeping: "Two bedrooms upstairs",
    storeys: 2,
    tags: ["1,200+ sq ft", "two bedroom", "two storey", "live work"],
    features: ["16 ft glazed shopfront", "Separate yard entrance", "Flat roof and parapet"],
    costBasis: {
      status: "proxy",
      label: "Dwelling-rate proxy",
      note: "The Alberta BOM prices this as a house. A commercial ground floor carries different structure, a different fire and exiting standard and different mechanical loads, so the range is a starting point until a supplier and a designer who work in that occupancy quote it properly.",
    },
    volumes: [
      volume({
        width: 22,
        depth: 30,
        storeys: 2,
        height: 10,
        roof: "flat",
        openings: [
          opening("shopfront-n", "n", "glazing-wall", 16, 9.5, 3),
          opening("door-n", "n", "door", 3, 7, 19),
          opening("glass-n-upper", "n", "glazing-wall", 12, 7.5, 3, 10.5),
          opening("win-n-upper", "n", "window", 4, 5, 16, 12),
          opening("door-s", "s", "door", 3, 6.8, 2),
          opening("win-s", "s", "window", 5, 4, 8),
          opening("glass-s-upper", "s", "glazing-wall", 10, 7.5, 6, 10.5),
          opening("win-e-upper1", "e", "window", 3, 4, 10, 12),
          opening("win-e-upper2", "e", "window", 3, 4, 22, 12),
          opening("win-w-upper1", "w", "window", 3, 4, 10, 12),
          opening("win-w-upper2", "w", "window", 3, 4, 22, 12),
        ],
      }),
    ],
    deck: { width: 12, depth: 8 },
    notes:
      "Aura-authored live/work concept, modelled at 19% glazing. A shopfront is the one place in a cold climate where a big pane pays for itself in something other than daylight, and it is also the coldest square metre in the building: a full-height glazed wall at the sidewalk loses heat, catches every draught the door lets in, and needs a real entrance detail rather than one door in a hole. Mixed use is a zoning and building-code question before it is an architectural one — permitted use, the occupancy separation between the shop and the dwelling above it, exiting, and an accessible entrance at the street all change the plan and not just the paperwork. Confirm them for the actual parcel first; they can delete the shopfront.",
  }),
  original({
    id: "modulhus",
    title: "Modulhus",
    kicker: "864 sq ft · everything on a 2 ft grid",
    summary:
      "A CLT plan drawn to the panel: every opening starts and stops on a two-foot line, because a header that lands mid-panel costs more than a window that moves six inches.",
    bestFor: "A prefabricated build, a short site season, or anyone pricing panels",
    bedrooms: 2,
    bathrooms: 1.5,
    sleeping: "Two enclosed bedrooms",
    storeys: 1,
    material: "clt",
    tags: ["800–1,200 sq ft", "two bedroom", "mass timber", "prefab"],
    features: ["Every opening on a 2 ft grid", "Single-storey CLT shell", "24 × 36 ft panel-friendly box"],
    volumes: [
      volume({
        width: 24,
        depth: 36,
        height: 11,
        roof: "gable",
        pitch: 26,
        openings: [
          opening("glass-s", "s", "glazing-wall", 12, 10, 4),
          opening("door-s", "s", "door", 4, 7, 18),
          opening("win-n1", "n", "window", 4, 4, 4, 4),
          opening("win-n2", "n", "window", 4, 4, 16, 4),
          opening("win-e1", "e", "window", 4, 6, 6, 2),
          opening("win-e2", "e", "window", 4, 6, 26, 2),
          opening("win-w1", "w", "window", 4, 6, 6, 2),
          opening("win-w2", "w", "window", 4, 6, 26, 2),
        ],
      }),
    ],
    deck: { width: 18, depth: 8 },
    notes:
      "Aura-authored mass-timber concept, modelled at 19% glazing. The discipline IS the design: every opening in this plan begins and ends on a two-foot line, and a test asserts it, because the moment one window slides six inches off the grid it crosses a panel joint and the saving that made CLT worth choosing goes straight into a header. What that discipline does not do is make the building cheap on its own — CLT is bought by the cubic metre, needs a crane and a prepared site, needs its exposure period and moisture managed during erection, and needs an acoustic and fire strategy from a supplier who has done it before. This shell draws a single-storey box; the panel layout, the connections and the roof diaphragm are the supplier's engineering, not this drawing's.",
  }),
] as const;

/* ===========================================================================
   THE ANTI-PADDING RULE, MADE MEASURABLE

   The library's first design rule is "real designs, not permutations". Until
   now that rule was enforced by an EXACT dimension-string comparison, which a
   verifier broke in one line: it added a 56th plan that was an existing plan
   with `widthFt` 14 -> 15 and everything else identical, and every gate stayed
   green. An exact-duplicate check catches nothing anybody would actually ship.

   WHAT THE MEASUREMENT ACTUALLY SHOWED. Geometric closeness alone CANNOT
   separate padding from honest work in this library, and it is worth writing
   down why rather than pretending otherwise. Scored as the largest single
   normalised move between two massings, the nudged clone lands at 0.067 — and
   these REAL, honestly-authored pairs land at or below it:

       0.056  open-farmhouse-study ~ smalhus-infill   (same 16x32 two-storey box)
       0.083  postcard-a-frame     ~ lakeview-a-frame (USDA 6003 vs USDA 5964)
       0.086  meadow-one           ~ kompakt-passiv   (672 vs 676 sq ft)

   Any distance threshold that rejects the clone rejects two federal plan sets
   and a licensed adaptation with it. So distance is NOT the rule.

   THE RULE THAT DOES SEPARATE THEM. Those honest neighbours are close in size
   and different in kind: different elevations, different programmes, different
   materials, different roofs. The clone is a copy — nudging one dimension
   changes NONE of that. So the property is structural, and distance is not
   part of it:

       Two plans must differ on at least one STRUCTURAL axis — elevation
       composition, programme, material, or roof form. Prose deliberately does
       not count: a padder can rewrite a summary in a minute, and cannot give a
       nudged copy a real elevation without designing one.

   WHY DISTANCE IS NOT IN THE RULE AT ALL, WHICH IS A CORRECTION. The rule used
   to read "near-identical in size AND nothing structural to tell them apart",
   and the AND was doing damage nobody had measured. A plan could then earn its
   place by padding HARDER: get far enough from your twin in feet and the
   structural test was never reached. The old note here said that across the
   library exactly one pair — `meadow-one ~ solstice-cottage` — differed on no
   structural axis. That was true when it was written at 55 plans and false by
   the time it was read: at 72 there were THREE such pairs, because
   `jordhus-berm` had joined them, and all three were being acquitted by
   distance alone. Using a measurement the paragraph above proves CANNOT
   separate padding from honest work to hand out acquittals was the same error
   in the opposite direction, so it is gone. The library now measures ZERO
   pairs that differ on no structural axis, which is the number the rule is
   worth anything at.

   WHAT CHANGED IN THE CATALOGUE TO GET THERE, because the honest half of the
   answer is that two of those three pairs were the gate not looking rather
   than the plans being clones. `jordhus-berm`'s vents sit 7.5 ft up, above its
   earth berm, and the elevation signature knew only "window on the east wall";
   it now records a sill BAND, and the bermed house reads as the different
   building it always was. `solstice-cottage` was the real finding: a federal
   passive-solar cottage whose entire argument is its south face, drawn with
   the library's generic default openings. It has been given the elevation its
   own summary describes.

   STATED LIMIT: this compares plans with the same VOLUME COUNT. Padding by
   bolting an extra shed onto a copy is a different shape and is not caught
   here; the exact-signature and elevation-variety guards in the spec are what
   stand in front of that, and it is named as an open edge rather than implied
   to be covered.
   ======================================================================== */

/** The largest single normalised design move a ONE-DIMENSION NUDGE produces —
 *  0.067 for the verifier's 14 ft plan re-listed at 15 ft, and 0.25 for the
 *  widest-apart pair the library ever had with nothing structural to tell it
 *  apart. 0.2 sits between them.
 *
 *  IT IS NOT A VERDICT THRESHOLD ANY MORE, and the name is kept only because
 *  it is what the figure measures. `paddedPlanPairs` does not consult it: a
 *  pair is padding when nothing structural separates it, at any distance. What
 *  the number still does is let tests/plan-catalog.spec.ts prove its
 *  counterexamples are the shapes it says they are — that the caught clone
 *  really is a nudge, and that the far-apart clone really is not. */
export const PLAN_NUDGE_DISTANCE = 0.2;

/** Axes a dimension nudge cannot fake. Prose is excluded on purpose. */
export type PlanStructuralAxis = "elevation" | "programme" | "material" | "roof";

export interface PlanPairVerdict {
  a: string;
  b: string;
  /** largest single normalised move between the two massings; 1 means "not
   *  comparable" (different volume counts) */
  massingDistance: number;
  structuralAxes: PlanStructuralAxis[];
  /** near-identical massing AND nothing structural to tell them apart */
  padding: boolean;
}

const relativeGap = (a: number, b: number): number => {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale < 1e-9 ? 0 : Math.abs(a - b) / scale;
};

/** Every massing decision in one volume, each normalised to 0..1 so a 1 ft
 *  change on a 14 ft wall and a 1 ft change on a 40 ft wall are not treated as
 *  the same size of design move. */
function volumeMoves(a: Volume, b: Volume, scaleFt: number): number[] {
  const sameRoof = a.roof.form === b.roof.form;
  return [
    relativeGap(a.widthFt, b.widthFt),
    relativeGap(a.depthFt, b.depthFt),
    Math.abs(a.x - b.x) / scaleFt,
    Math.abs(a.z - b.z) / scaleFt,
    Math.abs(a.rotationDeg - b.rotationDeg) / 180,
    a.storeys === b.storeys ? 0 : 1,
    relativeGap(a.wallHeightFt, b.wallHeightFt),
    sameRoof ? 0 : 1,
    sameRoof ? relativeGap(a.roof.pitchDeg, b.roof.pitchDeg) : 1,
  ];
}

const spanFt = (plan: PlanTemplate): number =>
  Math.max(1, ...plan.spec.volumes.map((v) => Math.max(v.widthFt, v.depthFt)));

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

/**
 * How far apart two plans are as BUILDINGS: the largest single normalised move
 * needed to turn one massing into the other, under the volume pairing most
 * favourable to the claim that they are the same design. Returns 1 when the
 * plans do not have the same number of volumes.
 *
 * Taking the LARGEST move rather than the sum is deliberate. A plan earns its
 * place by making at least one real design decision differently; ten rounding
 * differences do not add up to one.
 */
export function planMassingDistance(a: PlanTemplate, b: PlanTemplate): number {
  const left = a.spec.volumes;
  const right = b.spec.volumes;
  if (left.length !== right.length || left.length === 0) return 1;
  const scaleFt = Math.max(spanFt(a), spanFt(b));
  /* Volume ORDER is an authoring accident, so the pairing must not decide the
     verdict. Up to four volumes every pairing is tried and the most similar
     one wins (the reading hardest on the library); beyond that the count of
     permutations stops being cheap and a stable canonical sort is used. */
  const orders =
    right.length <= 4
      ? permutations([...right])
      : [[...right].sort((p, q) => q.widthFt * q.depthFt - p.widthFt * p.depthFt)];
  const ordered =
    right.length <= 4
      ? left
      : [...left].sort((p, q) => q.widthFt * q.depthFt - p.widthFt * p.depthFt);

  let best = Infinity;
  for (const order of orders) {
    let worst = 0;
    for (let i = 0; i < order.length; i++) {
      for (const move of volumeMoves(ordered[i], order[i], scaleFt)) worst = Math.max(worst, move);
    }
    best = Math.min(best, worst);
  }
  return Math.min(1, best);
}

/* WHERE AN OPENING STARTS IS A DESIGN DECISION; ITS EXACT SILL IS NOT.
   Three bands, because the signature has to survive two opposite attacks. Exact
   sills would let a padder buy an acquittal by dropping one window an inch, and
   would split a design drawn at 3 ft from the same design drawn at 3.25 ft. No
   sill at all was the state this gate shipped in, and it could not tell a
   clerestory from a window: "east wall, window" was the whole of what it knew.

   The bands are the three things a sill can mean. Below 1 ft the opening starts
   at the floor — a door, or a wall given to glass. Between 1 and 5 ft it is a
   window you look out of standing up. At 5 ft and above it is a clerestory or a
   vent: light and air, not a view. */
const SILL_FLOOR_FT = 1;
const SILL_HIGH_FT = 5;
const sillBand = (sillFt: number): "floor" | "sill" | "high" =>
  sillFt < SILL_FLOOR_FT ? "floor" : sillFt < SILL_HIGH_FT ? "sill" : "high";

/** Which walls carry which kinds of opening, and at what height each one
 *  starts — the shape of the elevation, not its dimensions.
 *
 *  A width nudge slides a default opening along its wall and resizes it, and
 *  changes nothing here, which is exactly the point: a plan that wants to be
 *  counted as a different design has to be drawn as one.
 *
 *  THE SILL BAND IS WHY `jordhus-berm` IS NOT READ AS A CLONE. It is an
 *  earth-sheltered box whose only openings above the berm line are two 2 ft
 *  vents 7.5 ft up; `meadow-one` is a generic cottage with punched windows at
 *  3 ft. Without the band those two elevations were the same string, and the
 *  bermed house was indistinguishable from a cottage of another size — a real
 *  difference the gate simply was not looking at. */
const elevationComposition = (plan: PlanTemplate): string =>
  plan.spec.volumes
    .map((v) =>
      v.openings
        .map((o) => `${o.wall}:${o.kind}@${sillBand(o.sillFt)}`)
        .sort()
        .join(","),
    )
    .sort()
    .join(" || ");

const roofForms = (plan: PlanTemplate): string =>
  plan.spec.volumes
    .map((v) => v.roof.form)
    .sort()
    .join(",");

/* `sleeping` IS PROSE, AND IT IS A KNOWN WEAKNESS IN THIS SIGNATURE.
   A fresh-context verifier defeated the padding gate with one character: a
   byte-copy of an existing plan, width nudged by a foot, and a single "s"
   appended to this sentence ("occasional guest" -> "occasional guests"). The
   clone was acquitted on the `programme` axis.

   Removing it was tried and REVERTED, because it is also doing real work.
   Dropping `sleeping` immediately collided `postcard-a-frame` (576 sq ft,
   USDA 6003, 1966) with `lakeview-a-frame` (528 sq ft, USDA 5964, 1963) —
   two adaptations of two DIFFERENT federal drawings whose genuine difference
   is that one has a loft. That difference is architectural; it simply happens
   to be recorded in prose. A gate that rejects two honest public-domain
   adaptations to catch a hypothetical padder is the worse trade, and this
   node's own contract said so: pin the weaker property rather than fail
   honest work.

   So the weaker property is pinned, and the hole is named here rather than
   left for someone to rediscover. The real fix is structured sleeping data —
   a loft is a fact about a building and deserves a field, not a sentence. */
const programme = (plan: PlanTemplate): string =>
  `${plan.bedrooms}/${plan.bathrooms}/${plan.sleeping}/${plan.storeys}`;

/** The axes on which two plans are genuinely different buildings. */
export function planStructuralAxes(a: PlanTemplate, b: PlanTemplate): PlanStructuralAxis[] {
  const axes: PlanStructuralAxis[] = [];
  if (elevationComposition(a) !== elevationComposition(b)) axes.push("elevation");
  if (programme(a) !== programme(b)) axes.push("programme");
  if (a.spec.material !== b.spec.material) axes.push("material");
  if (roofForms(a) !== roofForms(b)) axes.push("roof");
  return axes;
}

/**
 * Every pair that is one plan wearing another plan's dimensions. Empty is the
 * healthy answer; anything in it names both ids, how close they are and the
 * fact that nothing structural separates them.
 *
 * DISTANCE NO LONGER ACQUITS, and that is the change this function most needs
 * a reader to notice. It used to require BOTH a near-identical massing and no
 * structural difference, which quietly meant a plan could earn its place by
 * padding harder: `meadow-one`, `solstice-cottage` and `jordhus-berm` were
 * three one-bedroom SIP gables with the same elevation string and the same
 * programme, and all three were acquitted purely by sitting more than
 * PLAN_NUDGE_DISTANCE apart in size. Using a measurement the block above
 * proves CANNOT separate padding from honest work to hand out acquittals was
 * the error in both directions. Two plans that differ on no structural axis
 * differ only in dimensions, and differing only in dimensions is the
 * definition of the thing this rule exists to reject.
 */
export function paddedPlanPairs(
  plans: readonly PlanTemplate[] = PLAN_TEMPLATES,
): PlanPairVerdict[] {
  const verdicts: PlanPairVerdict[] = [];
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      /* The stated limit, enforced rather than implied: a different NUMBER of
         volumes is a different building, and this rule compares massings of
         the same shape. Padding by bolting an extra shed onto a copy is a
         different move and is still not caught here. */
      if (plans[i].spec.volumes.length !== plans[j].spec.volumes.length) continue;
      const structuralAxes = planStructuralAxes(plans[i], plans[j]);
      if (structuralAxes.length > 0) continue;
      verdicts.push({
        a: plans[i].id,
        b: plans[j].id,
        massingDistance: planMassingDistance(plans[i], plans[j]),
        structuralAxes,
        padding: true,
      });
    }
  }
  return verdicts;
}

/* ===========================================================================
   THE OVER-REPORT, SAID OUT LOUD

   `groundFootprintSqFt` SUMS volume footprints instead of unioning them —
   deliberately, and spec.ts says so. lib/builder/geometry.ts has computed the
   consequence all along as `SiteSummary.overlapAreaSqFt`, documented in its own
   words as "how much groundFootprintSqFt over-reports", and nothing outside the
   3D readout ever read it. Three catalogue plans overlap in plan: lakeside-l by
   28 sq ft, wilson-court by 42, gårdstun-court by 12 + 12. Their published
   areas — and the cost ranges priced off those areas — are that much too big,
   in front of somebody making a budget decision.

   These are not redrawn. The overlap is a real, deliberate feature of an L-plan
   whose wings meet at a hinge, and quietly shrinking three plans would hide the
   general problem rather than fix it. It is REPORTED instead, on the estimate
   the catalogue card shows, with the number in it.

   WHY THIS IS COMPUTED HERE INSTEAD OF CALLED FROM geometry.ts: geometry.ts
   imports `three`, and this module is pulled into the plan-catalogue client
   bundle. The clip below is exact only for quarter-turn rotations, which is all
   the library uses. Both facts are ASSERTED in tests/plan-catalog.spec.ts —
   every plan's number is cross-checked against summarizeHome's, and every
   rotation is checked to be a quarter turn — so this cannot drift away from the
   authority, and the day a plan is drawn at 30 degrees the pin goes red instead
   of the number quietly going wrong.
   ======================================================================== */

interface PlanRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

function planRect(v: Volume): PlanRect {
  const quarterTurned = Math.abs(Math.round(v.rotationDeg / 90)) % 2 === 1;
  const width = quarterTurned ? v.depthFt : v.widthFt;
  const depth = quarterTurned ? v.widthFt : v.depthFt;
  return { x0: v.x - width / 2, x1: v.x + width / 2, z0: v.z - depth / 2, z1: v.z + depth / 2 };
}

/** How much this plan's published footprint over-reports the ground it covers. */
export function planFootprintOverlapSqFt(plan: PlanTemplate): number {
  const rects = plan.spec.volumes.map(planRect);
  let total = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const x = Math.min(rects[i].x1, rects[j].x1) - Math.max(rects[i].x0, rects[j].x0);
      const z = Math.min(rects[i].z1, rects[j].z1) - Math.max(rects[i].z0, rects[j].z0);
      if (x > 0 && z > 0) total += x * z;
    }
  }
  return total;
}

function findTemplate(id: string): PlanTemplate {
  const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`Unknown Aura plan template: ${id}`);
  return plan;
}

export function instantiatePlanTemplate(id: string): BuilderDocument {
  const source = findTemplate(id);
  const cloned = JSON.parse(JSON.stringify(source.spec)) as HomeSpec;
  const document = builderDocumentFromLegacySpec(cloned);
  return {
    ...document,
    planOrigin: {
      templateId: source.id,
      templateTitle: source.title,
      costBasis: { ...(source.costBasis ?? MODELLED_COST_BASIS) },
    },
  };
}

function boundsOf(specification: HomeSpec): { width: number; depth: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const item of specification.volumes) {
    const radians = (item.rotationDeg * Math.PI) / 180;
    const c = Math.abs(Math.cos(radians));
    const s = Math.abs(Math.sin(radians));
    const halfW = (item.widthFt * c + item.depthFt * s) / 2;
    const halfD = (item.widthFt * s + item.depthFt * c) / 2;
    minX = Math.min(minX, item.x - halfW);
    maxX = Math.max(maxX, item.x + halfW);
    minZ = Math.min(minZ, item.z - halfD);
    maxZ = Math.max(maxZ, item.z + halfD);
  }
  return {
    width: Number.isFinite(maxX - minX) ? maxX - minX : 0,
    depth: Number.isFinite(maxZ - minZ) ? maxZ - minZ : 0,
  };
}

function systemsFor(specification: HomeSpec) {
  const area = totalFloorAreaSqFt(specification);
  const scale = area < 350 ? 0.42 : area < 800 ? 0.7 : 1;
  return ecoSystems({
    solar_kw: Math.round(8 * scale * 2) / 2,
    battery_kwh: Math.round(24 * scale),
    cistern_litres: Math.round((9000 * scale) / 500) * 500,
    deck: specification.deck !== null,
    hot_tub: specification.deck?.hotTub ?? false,
  });
}

export function estimatePlanTemplate(id: string): PlanTemplateEstimate {
  const plan = findTemplate(id);
  const specification = plan.spec;
  const area = totalFloorAreaSqFt(specification);
  const footprint = groundFootprintSqFt(specification);
  const bounds = boundsOf(specification);
  const aspect = bounds.depth > 0 ? Math.max(0.4, Math.min(2.5, bounds.width / bounds.depth)) : 1;
  const equivalentWidth = Math.sqrt(Math.max(footprint, 1) * aspect);
  const equivalentDepth = Math.max(footprint, 1) / equivalentWidth;
  /* Reported on the glazing line's label, never multiplied by a price — the
     glazing line is priced on `glazedAreaSqFt` below. Counting a full-height
     glazing wall as one priced unit was the BQ02 defect; see the GLAZING block
     in lib/design/materials.ts. */
  const windowCount = specification.volumes.reduce(
    (sum, item) => sum + item.openings.filter((candidate) => candidate.kind !== "door").length,
    0,
  );
  const doorCount = specification.volumes.reduce(
    (sum, item) => sum + item.openings.filter((candidate) => candidate.kind === "door").length,
    0,
  );
  const bom = buildBom({
    width_ft: equivalentWidth,
    depth_ft: equivalentDepth,
    gross_sq_ft: area,
    window_count: windowCount,
    glazing_sq_ft: glazedAreaSqFt(specification),
    door_count: doorCount,
    material: specification.material,
    systems: systemsFor(specification),
    storeys: plan.storeys,
  });

  const overlap = planFootprintOverlapSqFt(plan);

  return {
    currency: "CAD",
    jurisdiction: "Alberta pilot",
    areaSqFt: area,
    footprintSqFt: footprint,
    footprintOverlapSqFt: overlap,
    low: bom.cad_low,
    mid: bom.cad_mid,
    high: bom.cad_high,
    lineItems: bom.items.length,
    costBasis: plan.costBasis ?? MODELLED_COST_BASIS,
    assumptions: [
      "Aura’s Alberta pilot material, installed shell and appropriately scaled off-grid systems ranges.",
      "Concept geometry only; multi-volume shells use an equivalent-footprint perimeter for this first comparison.",
      /* The over-report is stated where the money is, not buried in a 3D
         readout nobody opens before comparing plans. */
      ...(overlap > 0.01
        ? [
            `This plan's volumes overlap by ${Math.round(overlap)} sq ft where they meet, and Aura sums volume footprints rather than unioning them — so the ${Math.round(footprint)} sq ft footprint above, and the range priced from it, are ${Math.round(overlap)} sq ft too big. The ground actually covered is about ${Math.round(footprint - overlap)} sq ft.`,
          ]
        : []),
      "Excludes land, permits, professional design, unknown site work, taxes, financing and contingency.",
      "Replace this planning range with current supplier and contractor quotes before making a purchase decision.",
    ],
  };
}

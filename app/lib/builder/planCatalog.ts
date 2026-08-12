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
  source: PlanSource;
  spec: HomeSpec;
}

export interface PlanTemplateEstimate {
  currency: "CAD";
  jurisdiction: "Alberta pilot";
  areaSqFt: number;
  footprintSqFt: number;
  low: number;
  mid: number;
  high: number;
  lineItems: number;
  assumptions: string[];
}

const AURA_REPO = "https://github.com/kr8tiv-ai/aura-homes";
const AURA_LICENSE = `${AURA_REPO}/blob/main/LICENSE`;

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
}

function volume(input: VolumeInput): Volume {
  const id = input.id ?? "main";
  const width = input.width;
  const depth = input.depth;
  const glassWidth = Math.max(3, Math.min(width * 0.42, 14));
  const glassOffset = Math.max(0.6, width * 0.08);
  const doorOffset = Math.max(glassOffset + glassWidth + 0.5, width - 3.8);
  const sideWindowOffset = Math.max(1, depth / 2 - 2);
  const openings: Opening[] = [
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
      overhangFt: 1.5,
      ...(input.roof === "shed" || input.roof === "saltbox" ? { facing: "s" as const } : {}),
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
] as const;

function findTemplate(id: string): PlanTemplate {
  const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`Unknown Aura plan template: ${id}`);
  return plan;
}

export function getPlanTemplate(id: string): PlanTemplate {
  return findTemplate(id);
}

export function instantiatePlanTemplate(id: string): BuilderDocument {
  const source = findTemplate(id);
  const cloned = JSON.parse(JSON.stringify(source.spec)) as HomeSpec;
  return builderDocumentFromLegacySpec(cloned);
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
  const windowCount = specification.volumes.reduce(
    (sum, item) => sum + item.openings.filter((candidate) => candidate.kind !== "door").length,
    0,
  );
  const bom = buildBom({
    width_ft: equivalentWidth,
    depth_ft: equivalentDepth,
    gross_sq_ft: area,
    window_count: windowCount,
    glazing_sq_ft: glazedAreaSqFt(specification),
    material: specification.material,
    systems: systemsFor(specification),
    storeys: plan.storeys,
  });

  return {
    currency: "CAD",
    jurisdiction: "Alberta pilot",
    areaSqFt: area,
    footprintSqFt: footprint,
    low: bom.cad_low,
    mid: bom.cad_mid,
    high: bom.cad_high,
    lineItems: bom.items.length,
    assumptions: [
      "Aura’s Alberta pilot material, installed shell and appropriately scaled off-grid systems ranges.",
      "Concept geometry only; multi-volume shells use an equivalent-footprint perimeter for this first comparison.",
      "Excludes land, permits, professional design, unknown site work, taxes, financing and contingency.",
      "Replace this planning range with current supplier and contractor quotes before making a purchase decision.",
    ],
  };
}

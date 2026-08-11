/* ===========================================================================
   THE SEMANTIC EXPORT — ifcJSON, and the linked-data layer over it.

   glTF hands over a SHAPE. This file hands over a BUILDING: this is a wall, it
   is 165 mm of SIP with an R-40 assembly, it has an opening in it, that
   opening is filled by a window, and all of it hangs on storey 1 of a building
   on a site. `exportSpec.ts` writes the shape; this writes the meaning.

   A SIBLING, NOT A REPLACEMENT. Another module writes IFC4 SPF (the .ifc
   STEP file) via web-ifc — that is the PROFESSIONAL handoff, the thing a
   building department, an architect on Revit or ArchiCAD, and a quantity
   surveyor actually open. This one is the WEB-NATIVE handoff: JSON that a
   browser parses with `JSON.parse`, that `jq` filters, that a graph store
   ingests, and that costs zero bytes of WebAssembly to produce. They serve
   different readers and both should ship. Neither is a substitute for the
   other and this file never claims to be.

   ─────────────────────────────────────────────────────────────────────────
   WHAT ifcJSON ACTUALLY IS, AS OF 11 AUGUST 2026 — CHECKED, NOT REMEMBERED
   ─────────────────────────────────────────────────────────────────────────

   ifcJSON is a JSON encoding of IFC developed at
   github.com/buildingsmart-community/ifcJSON. Read its own words before
   trusting anything built on it:

   · IT IS NOT A PUBLISHED STANDARD. The repository README says the initial
     standard "will be developed based on IFC4 and more specifically IFC4.3".
     Future tense. The repository's last push was April 2024. There is no
     buildingSMART Final Standard for ifcJSON to conform to, so the honest
     word for this export is CANDIDATE, and that is the word the UI should
     use on the button.
   · IFC5 IS GOING SOMEWHERE ELSE. buildingSMART's IFC5 work
     (github.com/buildingSMART/IFC5-development) is a component/layer model
     with its own JSON encoding published at ifcx.dev. It is NOT ifcJSON-4
     with a new version number. A file written today against ifcJSON-4 is a
     file written against IFC4, and IFC5 will want a conversion, not a bump.
   · THE SPECIFICATION CONTRADICTS ITSELF IN THREE PLACES, and the reference
     implementation resolves all three. Where they disagree this file follows
     the IMPLEMENTATION, because a file that only satisfies prose converts to
     nothing:

       1. IDENTIFIERS. §2.5 says globalId is "a UUID according to RFC 4122".
          The JSON-schema snippet in §3 says `"maxLength": 22` — which is the
          base64 IFC GUID, a different thing entirely. The reference reader
          (`file_converters/ifcjson/to_ifcopenshell.py`) calls
          `ifcopenshell.guid.compress(uuid.UUID(uuidString).hex)`, so it
          requires a parseable RFC-4122 UUID. THIS FILE WRITES UUIDs.
       2. REFERENCES. §2.5 shows a reference as a bare globalId STRING
          (`"ownerHistory": "6d79...")`. Every sample file in the same
          repository, and the reference reader's `getAttributeObject`, use the
          OBJECT form `{"type": "IfcOwnerHistory", "ref": "6d79..."}` — the
          reader only follows a reference when the value is a dict containing
          `ref`. A bare string is silently passed through as a literal.
          THIS FILE WRITES THE OBJECT FORM.
       3. PROPERTY VALUES. §2.10 shows `"nominalValue": {"type": "IfcBoolean",
          "booleanValue": true}`. The sample files and the reader's
          `INCLUDE_ATTRIBUTES = ['value']` use `"value"`. THIS FILE WRITES
          `value`.

     None of that is a complaint. It is the reason this comment exists: a
     format still finding its shape is one you write against with your eyes
     open, and the three choices above are the difference between a file that
     round-trips and a file that looks right.

   WHERE THIS FILE DELIBERATELY DIVERGES FROM THE REFERENCE SAMPLES, ONCE:

   · NO IfcOwnerHistory. It carries a creation timestamp, and the export
     contract in `exportSpec.ts` is that the same spec produces BYTE-IDENTICAL
     files forever — no `Date.now()`, anywhere. IfcOwnerHistory is optional on
     IfcRoot in IFC4, and ifcJSON §2.1 relaxes required entities further, so
     the honest trade is: lose an authorship record nobody filled in, keep a
     diffable export. There is no timestamp in the header either, for the same
     reason, and the header says so.
   · LOCAL PLACEMENTS ARE REFERENCED, NOT NESTED. The samples nest the whole
     `placementRelTo` chain inside every element, which duplicates the storey's
     placement into every wall that sits on it. §2.5 explicitly encourages
     "a broader use of this globalId, to enable referencing between objects",
     and the reference reader resolves `{ref}` by globalId regardless of the
     referenced entity's type. So each IfcLocalPlacement is written once, at
     the top level, and referenced. One placement, one definition — the same
     rule the rest of this codebase keeps about derived quantities.
   · NO INVERSE ATTRIBUTES. The samples echo `decomposes`, `containsElements`,
     `isDecomposedBy`, `voidsElements` and `hasFillings` onto the objects. All
     five are INVERSE attributes in the EXPRESS schema, derivable from the
     IfcRel* objects that are already in `data`, and the reference reader
     discards them (they are not in `entity.get_info()`). Writing an edge
     twice is how two halves of a file start disagreeing about a house.

   ─────────────────────────────────────────────────────────────────────────
   THE LINKED-DATA LAYER — and why it is a separate document, not a sprinkle
   ─────────────────────────────────────────────────────────────────────────

   ifcJSON is JSON. It is not LINKED data: nothing in it is a global
   identifier, and its keys are IFC attribute names rather than ontology
   terms. Bolting an `@context` onto the ifcJSON document would not fix that —
   a JSON-LD processor would walk the `data` array and mint garbage triples
   out of `sweptArea` and `directionRatios`.

   So the bundle is one JSON-LD 1.1 document with two honest layers:

     {
       "@context": { bot, aura, xsd, … },
       "@id":      "urn:aura:home:<slug>",
       "@graph":   [ … the BOT topology … ],
       "ifcJSON":  { … the complete ifcJSON document, untouched … }
     }

   `ifcJSON` is declared in the context as `{"@type": "@json"}` — JSON-LD
   1.1's literal-JSON datatype. That is the exact tool for this: it tells a
   processor "this value is opaque JSON, do not interpret it", so the BOT
   graph loads cleanly and the ifcJSON payload survives byte-for-byte. A
   reader that only wants IFC takes `doc.ifcJSON`; `exportIfcJson()` also
   writes that inner document on its own, as a plain `.ifcjson` file.

   WHY BOT AND NOT BRICK. The Building Topology Ontology (W3C Linked Building
   Data CG, namespace https://w3id.org/bot#, status: PUBLIC DRAFT — it is not
   a W3C Recommendation and this file does not pretend otherwise) models
   exactly what a home has: Site → Building → Storey → Space, elements
   contained in zones, and Interfaces where a zone meets an element. Brick
   models HVAC plant, meters and sensor POINTS. An unbuilt off-grid house has
   an 8 kW array and a wood stove on a bill of materials and not one sensor
   point in existence, so a Brick graph here would be empty scaffolding
   pretending to be an integration. `BRICK_EXTENSION_POINT` below documents
   precisely where it attaches on the day there is a live system to describe,
   and emits nothing until then.

   IRIs. Instances are URNs (`urn:aura:home:<slug>:…`) because this is a
   static export with no server and no /id/ route — a URN makes no promise to
   dereference, which is the truth. The Aura vocabulary IRI
   (`https://aurahomes.fun/ns/aura#`) is a namespace for our own terms; there
   is NO ontology document published at it today, and a reader should treat
   Aura terms as local rather than as an alignment we have not done.

   ─────────────────────────────────────────────────────────────────────────
   THE RULES THIS FILE KEEPS
   ─────────────────────────────────────────────────────────────────────────

   · ZERO NEW DEPENDENCIES. JSON, arithmetic, and the modules already here.
   · DETERMINISTIC. No Math.random, no Date.now. GlobalIds are RFC 9562
     UUIDv8 values derived by hash from a stable key string — see `auraGuid`.
   · spec.ts OWNS EVERY DERIVED QUANTITY. Areas come from `totalFloorAreaSqFt`
     / `groundFootprintSqFt` / `glazedAreaSqFt`, ridge from `ridgeHeightFt`,
     wall area and the glazing ratio from `toPlan.ts`, which is the one place
     they are defined. Nothing is recomputed inline.
   · IT DOES NOT IMPORT `geometry.ts`, and therefore does not pull `three`
     into any bundle that only wants an export. Two facts that live there are
     mirrored here under NAMED DEPARTURES below, with the cross-reference.
   · PROVEN, NOT ASSUMED. `roundTripReport()` writes the file, parses it back
     into a HomeSpec through the same `validateHomeSpec` gate the share links
     use, and additionally re-derives every dimension from the emitted
     IfcExtrudedAreaSolid geometry and IfcLocalPlacement chain to check that
     the property sets and the geometry tell the same story.

   ─────────────────────────────────────────────────────────────────────────
   MEASURED — Node 24, 11 August 2026. Not estimated.
   ─────────────────────────────────────────────────────────────────────────

     defaultSpec()                      0 spec differences
     (1 volume, SIP, gable, 4 openings) 32 cross-checks, 17 of them from solids
                                        0 failures, max error 0 ft
                                        106 IFC entities, 23 BOT nodes
                                        94.0 kB .ifcjson / 113.8 kB .jsonld

     Two-volume L-plan                  0 spec differences
     (rammed earth 450 mm, 2-storey     58 cross-checks, 30 of them from solids
      wing rotated 90 deg, shed roof    0 failures, max error 0 ft
      facing W, 7 openings, deck +      202 IFC entities, 51 BOT nodes
      hot tub, accented name/notes)     183.9 kB .ifcjson / 222.5 kB .jsonld

   Both round-trip EXACTLY: every field came back identical, not merely close.
   Also verified on the L-plan: two runs are byte-identical; all 202 globalIds
   are well-formed UUIDv8 with zero collisions; zero dangling `ref`s.

   AND THE CHECKS CAN FAIL, which is the part worth proving. Widening one
   wall's `xDim` by 0.5 m is caught as `wall[main:n].runFt: props 34 vs solid
   35.6404`. Editing one `WallHeightFt` property to 12 is caught as
   `volumes[main].wallHeightFt: props 12 vs solid 9.5`. A foreign ifcJSON file
   with no Aura property sets is refused by name rather than half-read. And an
   export written with `geometry: false` reports `solidChecksRun: 0` rather
   than a healthy-looking pass over solids that are not there.

   THE FILES ARE BIG, and that is a choice rather than an accident: two-space
   indentation with one coordinate per line is most of the weight. It is a
   format whose entire point is that a person can open it and read it, so it
   is written to be read. The glTF is the small one.

   NOT A PERMIT SET. Same sentence as every other export in this builder:
   massing and layout, not a structural design, not a code check.
   =========================================================================== */

import {
  glazedAreaSqFt,
  groundFootprintSqFt,
  ridgeHeightFt,
  SPEC_VERSION,
  totalFloorAreaSqFt,
  type Deck,
  type HomeSpec,
  type Opening,
  type OpeningKind,
  type RoofForm,
  type Siting,
  type Volume,
  type Wall,
} from "./spec";
import { validateHomeSpec } from "./share";
import {
  EXPORT_DISCLAIMER,
  FEET_TO_METRES,
  exportFilename,
  type ExportArtifact,
} from "./exportSpec";
import { modelledGlazingRatio, modelledWallAreaSqFt } from "./toPlan";
import {
  FDWR_MAX,
  SCREW_PILE_FOUNDATION,
  WALL_R_VALUE,
  WALL_THICKNESS_MM,
  ecoSystems,
  honestyNotes,
  type EcoSystems,
} from "@/lib/design/materials";
/* The unit constant the packer converts wall thickness with. Imported from the
   module that owns it — exactly as `toPlan.ts` does — rather than restated,
   because a second copy of 304.8 is a second thing that can drift. */
import { MM_PER_FT } from "@/lib/design/layout";
import type { EcoMaterial } from "@/lib/designApi";

/* ===========================================================================
   NAMED DEPARTURES — the two facts mirrored from geometry.ts

   `lib/builder/geometry.ts` imports `three` at module scope. Importing it
   here would drag a 600 kB 3D library into any page that merely offers a
   download, so these two rules are restated instead of imported. Both are
   documented invariants in that file's header rather than incidental
   implementation, which is what makes mirroring them defensible — but if
   either ever changes there, it must change here, and the round-trip report
   will NOT catch it because both halves of this module would move together.
   =========================================================================== */

/**
 * The BUILT length of a wall, feet — `geometry.ts`'s `wallRunFt`, restated.
 *
 * The n and s walls run the full width. The e and w walls butt INTO them, so
 * they are two wall thicknesses shorter than `depthFt`. That is what makes the
 * four walls a corner rather than four overlapping boxes, and it is why the
 * IFC walls written here have the same lengths as the ones on screen.
 */
function wallRunFt(v: Volume, wall: Wall, thicknessFt: number): number {
  return wall === "n" || wall === "s"
    ? v.widthFt
    : Math.max(0.5, v.depthFt - 2 * thicknessFt);
}

/** Structural wall thickness in FEET — `geometry.ts`'s `wallThicknessFt`. */
function wallThicknessFt(material: EcoMaterial): number {
  return WALL_THICKNESS_MM[material] / MM_PER_FT;
}

/**
 * Nominal floor-deck depth, feet. `geometry.ts` calls this `FLOOR_SLAB_FT`.
 *
 * The HomeSpec carries no slab thickness — it is not a field a person drags —
 * so this exists only so an IfcSlab is a solid rather than a zero-height
 * extrusion. It is a massing figure, not a structural one, and the property
 * set on every slab says so in words.
 */
const FLOOR_SLAB_FT = 0.75;

/** Nominal deck framing depth, feet. `geometry.ts`'s `DECK_SLAB_FT`. Same
 *  caveat: the spec has no deck thickness and this is not a joist size. */
const DECK_SLAB_FT = 0.25;

/* ===========================================================================
   NAMESPACES AND IDENTIFIERS
   =========================================================================== */

/** buildingSMART's ifcJSON document version, as written by the reference
 *  converter (IFC2JSON_python) in every sample file in the specification
 *  repository. Not a version of this exporter. */
export const IFCJSON_VERSION = "0.0.1";

/** The IFC schema the entity names below belong to. IFC4, not IFC4.3 and not
 *  IFC5: every entity, attribute and enumeration value used here is one this
 *  file has checked against IFC4. */
export const IFC_SCHEMA_IDENTIFIER = "IFC4";

/** Written into the ifcJSON header so a recipient knows what made the file. */
export const ORIGINATING_SYSTEM = "Aura Homes builder — semantic export";

/** Building Topology Ontology. W3C Linked Building Data CG PUBLIC DRAFT, not
 *  a Recommendation. */
export const BOT_NS = "https://w3id.org/bot#";

/** Aura's own vocabulary. NOTHING IS SERVED AT THIS IRI TODAY — it namespaces
 *  our local terms and makes no alignment claim. */
export const AURA_NS = "https://aurahomes.fun/ns/aura#";

/** Instance IRIs. A URN, because a static export has no /id/ route and a
 *  promise to dereference we cannot keep is worse than no promise. */
export const AURA_URN_PREFIX = "urn:aura:home:";

/* ---------------------------------------------------------------------------
   DETERMINISTIC GLOBAL IDs

   IFC wants a globally unique id per rooted object and ifcJSON's reference
   reader wants that id to parse as an RFC 4122 UUID. `crypto.randomUUID()`
   would satisfy both and would destroy the export contract: the same house
   would write a different file every time and nobody could diff two versions
   of their own home.

   So the ids are DERIVED. A 128-bit digest of a stable key string, formatted
   in the 8-4-4-4-12 layout with the version nibble set to 8 and the variant
   bits to 0b10 — which is RFC 9562 UUIDv8, the version reserved precisely for
   "custom, vendor-defined" generation. It is a real UUID, it parses with
   `uuid.UUID()`, and it is a pure function of the key.

   The hash is FNV-1a with four different offset bases, each run through
   murmur3's finalizer. It is NOT a cryptographic hash and is not used as one:
   nothing here depends on collision resistance against an adversary, only on
   two different keys in one file not colliding. Keys are structured
   (`wall:main:1:s`), so collisions would require a genuine hash accident
   across a few hundred short strings.
   --------------------------------------------------------------------------- */

function fnv1a32(text: string, basis: number): number {
  let h = basis >>> 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h = (h ^ (code & 0xff)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h = (h ^ ((code >>> 8) & 0xff)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** murmur3's fmix32 — avalanche, so one changed character changes everything. */
function fmix32(input: number): number {
  let h = input >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h >>> 0;
}

const hex8 = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");

/**
 * A deterministic RFC 9562 UUIDv8 for a stable key.
 *
 * Exported because the JSON-LD layer needs to point at the same objects the
 * ifcJSON layer defines, and both derive their ids from the same key strings.
 */
export function auraGuid(key: string): string {
  const words = [
    fmix32(fnv1a32(key, 0x811c9dc5)),
    fmix32(fnv1a32(`${key}`, 0x01234567)),
    fmix32(fnv1a32(`${key}`, 0x89abcdef)),
    fmix32(fnv1a32(`${key}`, 0xfedcba98)),
  ];
  const chars = (hex8(words[0]) + hex8(words[1]) + hex8(words[2]) + hex8(words[3])).split("");
  chars[12] = "8"; // version 8 — custom / vendor-defined
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16); // variant 10xx
  const h = chars.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * ASCII slug for a URN segment.
 *
 * `exportSpec.ts` keeps its own for FILENAMES — deliberately not shared: a
 * filename may change its rules (length caps, reserved words) without
 * silently rewriting every IRI in every file already published.
 */
function urnSlug(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "home";
}

/* ===========================================================================
   UNITS AND THE COORDINATE MAPPING
   =========================================================================== */

/** Nanometre resolution on written metres. 1e-9 m is 3.3e-9 ft: far below
 *  anything in this system, and it keeps `10.363200000000001` out of the file
 *  without changing a single dimension. */
const round9 = (n: number): number => Math.round(n * 1e9) / 1e9;

/** Feet to metres, at exactly 0.3048 — `exportSpec.ts` owns the constant. */
const M = (ft: number): number => round9(ft * FEET_TO_METRES);

/** Metres back to feet, quantised to 1e-4 ft (0.0012 inches).
 *
 *  The same tolerance `share.ts` already quantises share links to, and for the
 *  same reason: it is below the resolution of every control in the builder and
 *  below the thickness of a drawn line, so it removes float noise from a
 *  round-trip without moving anything a person entered. */
const FT = (metres: number): number => Math.round((metres / FEET_TO_METRES) * 1e4) / 1e4;

const DEG_TO_RAD = Math.PI / 180;

/* ---------------------------------------------------------------------------
   THE FRAME CHANGE, written down once.

   `geometry.ts` builds in a three.js frame: +X east, +Y UP, +Z SOUTH, and
   y = 0 is finished floor. IFC is Z-up with the conventional plan frame +X
   east, +Y NORTH. So:

       X_ifc = x_three
       Y_ifc = -z_three
       Z_ifc = y_three

   A volume's own frame is (u, v, w): u along its width, v along its depth
   toward its local north, w up. `Volume.rotationDeg` is a bearing CLOCKWISE
   from north, so in the IFC plan frame the volume's local axes are

       local +u  ->  ( cos β, -sin β )
       local +v  ->  ( sin β,  cos β )

   which is one IfcAxis2Placement3D per volume with `refDirection` = local +u
   and the default axis (0,0,1). Every wall, slab, space and opening below is
   authored in (u, v, w) and placed relative to that single placement — the
   same "the site frame is decided once" rule geometry.ts keeps, so there is
   exactly one place a sign error could live and it is this comment's subject.

   Sanity check, kept because it is the thing that goes wrong: at β = 90° (a
   home turned a quarter turn clockwise) local +v maps to (1, 0), i.e. the
   volume's north face now looks east. That is what a clockwise quarter turn
   does.
   --------------------------------------------------------------------------- */

/** The volume's local +u axis as an IFC plan direction. */
function localUAxis(rotationDeg: number): [number, number] {
  const b = rotationDeg * DEG_TO_RAD;
  return [round9(Math.cos(b)), round9(-Math.sin(b))];
}

/** The inverse: a bearing in degrees from a written refDirection. */
function bearingFromUAxis(dx: number, dy: number): number {
  const deg = Math.atan2(-dy, dx) / DEG_TO_RAD;
  return Math.round(((deg % 360) + 360) % 360 * 1e4) / 1e4;
}

/**
 * Wall geometry in the volume's own (u, v) plan frame.
 *
 * `origin` is the wall band's CENTRE — the point an IfcRectangleProfileDef is
 * centred on — and `run` is the direction `Opening.offsetFt` is measured
 * along, which spec.ts defines as left-to-right seen from OUTSIDE.
 */
interface WallPlan {
  /** centre of the wall band, volume-local feet */
  centre: [number, number];
  /** unit run direction, volume-local */
  run: [number, number];
  /** unit outward normal, volume-local */
  out: [number, number];
  runFt: number;
}

function wallPlan(v: Volume, wall: Wall, t: number): WallPlan {
  const halfW = v.widthFt / 2;
  const halfD = v.depthFt / 2;
  const runFt = wallRunFt(v, wall, t);
  switch (wall) {
    case "n":
      return { centre: [0, halfD - t / 2], run: [-1, 0], out: [0, 1], runFt };
    case "s":
      return { centre: [0, -(halfD - t / 2)], run: [1, 0], out: [0, -1], runFt };
    case "e":
      return { centre: [halfW - t / 2, 0], run: [0, 1], out: [1, 0], runFt };
    default:
      return { centre: [-(halfW - t / 2), 0], run: [0, -1], out: [-1, 0], runFt };
  }
}

/** Recover which wall a written refDirection belongs to. Exact — the four run
 *  vectors are the four axis directions and nothing in between. */
function wallFromRun(dx: number, dy: number): Wall | null {
  const tol = 1e-6;
  if (Math.abs(dx + 1) < tol && Math.abs(dy) < tol) return "n";
  if (Math.abs(dx - 1) < tol && Math.abs(dy) < tol) return "s";
  if (Math.abs(dx) < tol && Math.abs(dy - 1) < tol) return "e";
  if (Math.abs(dx) < tol && Math.abs(dy + 1) < tol) return "w";
  return null;
}

/* ===========================================================================
   THE ifcJSON DOCUMENT SHAPE
   =========================================================================== */

/** One entity, or a reference to one. `ref` and `globalId` are called out
 *  because the whole file turns on them; everything else is IFC attribute
 *  names in lowerCamelCase, per ifcJSON §2.7. */
export interface IfcJsonEntity {
  type: string;
  globalId?: string;
  ref?: string;
  [key: string]: unknown;
}

/**
 * The document. The four header keys are exactly the ones the reference
 * reader inspects (`type` must be `"ifcJSON"`, `data` must be present);
 * `timeStamp` is deliberately absent — see the header comment.
 */
export interface IfcJsonDocument {
  type: "ifcJSON";
  version: string;
  schemaIdentifier: string;
  originatingSystem: string;
  data: IfcJsonEntity[];
}

const ref = (type: string, globalId: string): IfcJsonEntity => ({ type, ref: globalId });

/* ===========================================================================
   OPTIONS
   =========================================================================== */

export interface SemanticExportOptions {
  /**
   * The off-grid kit to describe.
   *
   * A HomeSpec has NO systems field — the massing model knows how big the
   * boxes are, not what is in them — so the default is the Aura standard kit
   * from `lib/design/materials.ts`, and the property set that carries it says
   * "standard kit, not a per-home selection" in its own description.
   */
  systems?: Partial<EcoSystems>;
  /**
   * Write IfcExtrudedAreaSolid bodies. Default true.
   *
   * `false` produces a semantically complete model with placements and
   * property sets and no solids — smaller, and enough for a data reader that
   * only wants the topology. The round-trip's geometry cross-check is skipped
   * when it is off, and the report says so rather than passing vacuously.
   */
  geometry?: boolean;
}

/* ===========================================================================
   THE BUILDER
   =========================================================================== */

interface Ctx {
  spec: HomeSpec;
  slug: string;
  systems: EcoSystems;
  withGeometry: boolean;
  /** structural wall thickness, feet */
  t: number;
  /** globally shared storey elevations, feet above finished floor of storey 1 */
  storeyElevationFt: number[];
  data: IfcJsonEntity[];
  /** BOT nodes, accumulated alongside so the two layers cannot drift */
  graph: JsonLdNode[];
}

const guidOf = (ctx: Ctx, key: string): string => auraGuid(`${ctx.slug}|${key}`);
const iriOf = (ctx: Ctx, key: string): string => `${AURA_URN_PREFIX}${ctx.slug}:${key}`;

function push(ctx: Ctx, entity: IfcJsonEntity): IfcJsonEntity {
  ctx.data.push(entity);
  return entity;
}

/* ---------------------------------------------------------------------------
   geometry helpers — every solid in this file is one extruded rectangle
   --------------------------------------------------------------------------- */

/** An IfcAxis2Placement3D at a point, optionally with a plan direction. */
function axis2(
  xFt: number,
  yFt: number,
  zFt: number,
  refDirection?: [number, number],
): IfcJsonEntity {
  const p: IfcJsonEntity = {
    type: "IfcAxis2Placement3D",
    location: { type: "IfcCartesianPoint", coordinates: [M(xFt), M(yFt), M(zFt)] },
  };
  if (refDirection) {
    p.axis = { type: "IfcDirection", directionRatios: [0, 0, 1] };
    p.refDirection = {
      type: "IfcDirection",
      directionRatios: [refDirection[0], refDirection[1], 0],
    };
  }
  return p;
}

/** A top-level, referenceable IfcLocalPlacement. */
function placement(
  ctx: Ctx,
  key: string,
  xFt: number,
  yFt: number,
  zFt: number,
  relTo: string | null,
  refDirection?: [number, number],
): string {
  const id = guidOf(ctx, `placement:${key}`);
  const e: IfcJsonEntity = {
    type: "IfcLocalPlacement",
    globalId: id,
    relativePlacement: axis2(xFt, yFt, zFt, refDirection),
  };
  if (relTo) e.placementRelTo = ref("IfcLocalPlacement", relTo);
  push(ctx, e);
  return id;
}

/**
 * A body representation: one rectangle, extruded up.
 *
 * `IfcRectangleProfileDef` is centred on the placement origin, so `xDimFt` and
 * `yDimFt` are the full extents and the caller positions the CENTRE. The
 * extrusion runs +Z from the placement's own origin, which is why every
 * element's placement Z is its base and never its middle.
 */
function extrudedBox(
  ctx: Ctx,
  xDimFt: number,
  yDimFt: number,
  heightFt: number,
): IfcJsonEntity | null {
  if (!ctx.withGeometry) return null;
  if (xDimFt <= 0 || yDimFt <= 0 || heightFt <= 0) return null;
  return {
    type: "IfcProductDefinitionShape",
    representations: [
      {
        type: "IfcShapeRepresentation",
        contextOfItems: ref("IfcGeometricRepresentationContext", guidOf(ctx, "context")),
        representationIdentifier: "Body",
        representationType: "SweptSolid",
        items: [
          {
            type: "IfcExtrudedAreaSolid",
            sweptArea: {
              type: "IfcRectangleProfileDef",
              profileType: "AREA",
              xDim: M(xDimFt),
              yDim: M(yDimFt),
            },
            position: axis2(0, 0, 0),
            extrudedDirection: { type: "IfcDirection", directionRatios: [0, 0, 1] },
            depth: M(heightFt),
          },
        ],
      },
    ],
  };
}

/* ---------------------------------------------------------------------------
   property sets

   Aura's own values are IfcReal / IfcText / IfcBoolean / IfcInteger with the
   UNIT IN THE PROPERTY NAME (`WidthFt`, `PitchDeg`, `AreaSqFt`). That is
   deliberate: `IfcLengthMeasure` means "in the project's length unit", which
   is metres here, so typing a feet value as a length measure would be a unit
   lie inside a file. Standard psets (Pset_WallCommon.ThermalTransmittance) use
   the proper typed measure in proper SI.
   --------------------------------------------------------------------------- */

type PropValue =
  | { kind: "text"; value: string }
  | { kind: "real"; value: number }
  | { kind: "int"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "measure"; ifcType: string; value: number };

const txt = (value: string): PropValue => ({ kind: "text", value });
const real = (value: number): PropValue => ({ kind: "real", value: round9(value) });
const int = (value: number): PropValue => ({ kind: "int", value: Math.round(value) });
const bool = (value: boolean): PropValue => ({ kind: "bool", value });
const measure = (ifcType: string, value: number): PropValue => ({
  kind: "measure",
  ifcType,
  value: round9(value),
});

function nominal(v: PropValue): IfcJsonEntity {
  switch (v.kind) {
    case "text":
      return { type: "IfcText", value: v.value };
    case "real":
      return { type: "IfcReal", value: v.value };
    case "int":
      return { type: "IfcInteger", value: v.value };
    case "bool":
      return { type: "IfcBoolean", value: v.value };
    default:
      return { type: v.ifcType, value: v.value };
  }
}

interface PropSpec {
  name: string;
  description?: string;
  props: ReadonlyArray<readonly [string, PropValue]>;
}

/** Write a property set and attach it to one or more objects. */
function attachPset(
  ctx: Ctx,
  key: string,
  objects: ReadonlyArray<{ type: string; globalId: string }>,
  set: PropSpec,
): void {
  if (objects.length === 0) return;
  const psetId = guidOf(ctx, `pset:${key}`);
  const pset: IfcJsonEntity = {
    type: "IfcPropertySet",
    globalId: psetId,
    name: set.name,
    hasProperties: set.props.map(([name, value]) => ({
      type: "IfcPropertySingleValue",
      name,
      nominalValue: nominal(value),
    })),
  };
  if (set.description) pset.description = set.description;
  push(ctx, pset);
  push(ctx, {
    type: "IfcRelDefinesByProperties",
    globalId: guidOf(ctx, `rel:pset:${key}`),
    relatedObjects: objects.map((o) => ref(o.type, o.globalId)),
    relatingPropertyDefinition: ref("IfcPropertySet", psetId),
  });
}

/* ===========================================================================
   THE SPATIAL SPINE
   =========================================================================== */

/**
 * Storey elevations for the whole home.
 *
 * Storeys are a property of the BUILDING, and volumes may disagree about
 * `wallHeightFt`. Storey 2 is therefore placed at the TALLEST two-storey
 * volume's wall height, and each volume's own placement carries the
 * difference, so a shorter volume's upper floor still lands where it really
 * is. Usually every volume agrees and the correction is exactly zero.
 */
function storeyElevations(spec: HomeSpec): number[] {
  const twoStorey = spec.volumes.filter((v) => v.storeys === 2);
  const second = twoStorey.reduce((m, v) => Math.max(m, v.wallHeightFt), 0);
  return twoStorey.length > 0 ? [0, second] : [0];
}

function emitSpine(ctx: Ctx): void {
  const { spec } = ctx;

  const contextId = guidOf(ctx, "context");
  push(ctx, {
    type: "IfcGeometricRepresentationContext",
    /* Not an IfcRoot subtype, so a globalId is not schema-mandated — ifcJSON
       §2.5 explicitly encourages one anyway "to enable referencing between
       objects", and the reference sample files do exactly this. */
    globalId: contextId,
    contextType: "Model",
    coordinateSpaceDimension: 3,
    precision: 1e-5,
    worldCoordinateSystem: axis2(0, 0, 0),
    /* +Y is north by the mapping documented above, so true north is (0,1).
       Stated rather than omitted: an importer that assumes otherwise rotates
       the whole site, and orientation is the one thing a passive-solar home
       cannot afford to have guessed. */
    trueNorth: { type: "IfcDirection", directionRatios: [0, 1] },
  });

  const projectId = guidOf(ctx, "project");
  push(ctx, {
    type: "IfcProject",
    globalId: projectId,
    name: spec.name,
    longName: spec.name,
    description: EXPORT_DISCLAIMER,
    phase: "Massing and layout study",
    representationContexts: [ref("IfcGeometricRepresentationContext", contextId)],
    /* Metres, not millimetres. The reference samples use MILLI METRE; this
       file uses plain METRE so the two model exports agree with each other —
       `exportSpec.ts` converts the glTF at exactly 0.3048 m/ft and a recipient
       who opens the .glb and the .ifcjson side by side should not find one of
       them a thousand times the size of the other.

       `dimensions` (IfcDimensionalExponents) is omitted from each unit: it is
       derivable from the unit type, ifcJSON §2.1 relaxes required entities,
       and the reference reader lists it in EXCLUDE_ATTRIBUTES. */
    unitsInContext: {
      type: "IfcUnitAssignment",
      units: [
        { type: "IfcSIUnit", unitType: "LENGTHUNIT", name: "METRE" },
        { type: "IfcSIUnit", unitType: "AREAUNIT", name: "SQUARE_METRE" },
        { type: "IfcSIUnit", unitType: "VOLUMEUNIT", name: "CUBIC_METRE" },
        { type: "IfcSIUnit", unitType: "PLANEANGLEUNIT", name: "RADIAN" },
      ],
    },
  });

  const sitePlacement = placement(ctx, "site", 0, 0, 0, null);
  const siteId = guidOf(ctx, "site");
  push(ctx, {
    type: "IfcSite",
    globalId: siteId,
    name: "Site",
    objectPlacement: ref("IfcLocalPlacement", sitePlacement),
    compositionType: "ELEMENT",
  });

  const buildingPlacement = placement(ctx, "building", 0, 0, 0, sitePlacement);
  const buildingId = guidOf(ctx, "building");
  push(ctx, {
    type: "IfcBuilding",
    globalId: buildingId,
    name: spec.name,
    objectPlacement: ref("IfcLocalPlacement", buildingPlacement),
    compositionType: "ELEMENT",
  });

  push(ctx, {
    type: "IfcRelAggregates",
    globalId: guidOf(ctx, "rel:aggregate:project"),
    name: "ProjectContainer",
    relatingObject: ref("IfcProject", projectId),
    relatedObjects: [ref("IfcSite", siteId)],
  });
  push(ctx, {
    type: "IfcRelAggregates",
    globalId: guidOf(ctx, "rel:aggregate:site"),
    name: "SiteContainer",
    relatingObject: ref("IfcSite", siteId),
    relatedObjects: [ref("IfcBuilding", buildingId)],
  });

  const storeyIds: string[] = [];
  ctx.storeyElevationFt.forEach((elevationFt, i) => {
    const n = i + 1;
    const p = placement(ctx, `storey:${n}`, 0, 0, elevationFt, buildingPlacement);
    const id = guidOf(ctx, `storey:${n}`);
    storeyIds.push(id);
    push(ctx, {
      type: "IfcBuildingStorey",
      globalId: id,
      name: `Storey ${n}`,
      longName: n === 1 ? "Ground floor" : `Floor ${n}`,
      objectPlacement: ref("IfcLocalPlacement", p),
      compositionType: "ELEMENT",
      elevation: M(elevationFt),
    });
  });
  push(ctx, {
    type: "IfcRelAggregates",
    globalId: guidOf(ctx, "rel:aggregate:building"),
    name: "BuildingContainer",
    relatingObject: ref("IfcBuilding", buildingId),
    relatedObjects: storeyIds.map((id) => ref("IfcBuildingStorey", id)),
  });

  /* --- the spec's own facts, as property sets --------------------------- */

  attachPset(ctx, "homespec", [{ type: "IfcProject", globalId: projectId }], {
    name: "Aura_HomeSpec",
    description:
      "The Aura HomeSpec this file was written from. Aura-local property set — " +
      "not a buildingSMART Pset.",
    props: [
      ["SpecVersion", int(SPEC_VERSION)],
      ["HomeName", txt(spec.name)],
      ["Material", txt(spec.material)],
      ["ClimateZone", txt(spec.climateZone)],
      ["Notes", txt(spec.notes)],
      ["Generator", txt(ORIGINATING_SYSTEM)],
      ["Disclaimer", txt(EXPORT_DISCLAIMER)],
    ],
  });

  const notes = honestyNotes(ctx.systems, spec.climateZone);
  attachPset(ctx, "honesty", [{ type: "IfcProject", globalId: projectId }], {
    name: "Aura_Honesty",
    description:
      "Corrections this project refuses to un-learn, from lib/design/materials.ts. " +
      "They travel inside the file so a recipient who never saw the web page still gets them.",
    props: notes.map((n, i) => [`Note${i + 1}`, txt(n)] as const),
  });

  attachPset(ctx, "siting", [{ type: "IfcSite", globalId: siteId }], {
    name: "Aura_Siting",
    description:
      "Siting from the HomeSpec. FrontFacesDeg is a compass bearing clockwise from " +
      "north; 180 is due south.",
    props: [
      ["FrontFacesDeg", real(spec.siting.frontFacesDeg)],
      ["Slope", txt(spec.siting.slope)],
      ["Foundation", txt(SCREW_PILE_FOUNDATION)],
      [
        "FoundationNote",
        txt(
          "Protected galvanized screw piles — no concrete, ever. The priced pile COUNT " +
            "lives in the bill of materials (lib/design/materials.ts buildBom), not here: " +
            "the HomeSpec does not define it and this file will not invent it.",
        ),
      ],
    ],
  });

  const wallAreaSqFt = modelledWallAreaSqFt(spec);
  const glazingRatio = modelledGlazingRatio(spec);
  attachPset(ctx, "envelope", [{ type: "IfcBuilding", globalId: buildingId }], {
    name: "Aura_Envelope",
    description:
      "Envelope figures, every one taken from the module that defines it rather than " +
      "recomputed here.",
    props: [
      ["TotalFloorAreaSqFt", real(totalFloorAreaSqFt(spec))],
      ["GroundFootprintSqFt", real(groundFootprintSqFt(spec))],
      ["GlazedAreaSqFt", real(glazedAreaSqFt(spec))],
      ["ModelledWallAreaSqFt", real(wallAreaSqFt)],
      ["ModelledGlazingRatio", real(glazingRatio)],
      ["FdwrPrescriptiveCeiling", real(FDWR_MAX)],
      [
        "FdwrNote",
        txt(
          `ModelledGlazingRatio is glazedAreaSqFt over a ROUGH wall area (perimeter x wall ` +
            `height x storeys, no deduction where volumes meet) — lib/builder/toPlan.ts owns ` +
            `both definitions. It is a comparison against the ${(FDWR_MAX * 100).toFixed(0)}% ` +
            `NBC 9.36 prescriptive FDWR ceiling, NOT a code check and NOT the FDWR the plan ` +
            `engine prints, which measures the packer's own windows against the envelope the ` +
            `packer solved.`,
        ),
      ],
      ["TallestRidgeHeightFt", real(spec.volumes.reduce((m, v) => Math.max(m, ridgeHeightFt(v)), 0))],
      ["VolumeCount", int(spec.volumes.length)],
    ],
  });

  const s = ctx.systems;
  attachPset(ctx, "systems", [{ type: "IfcBuilding", globalId: buildingId }], {
    name: "Aura_Systems",
    description:
      "The Aura STANDARD off-grid kit, not a per-home selection: a HomeSpec has no " +
      "systems field, so these are the defaults from lib/design/materials.ts unless a " +
      "caller overrode them.",
    props: [
      ["OffGrid", bool(s.grid_optional)],
      ["SolarKw", real(s.solar_kw)],
      ["BatteryKwh", real(s.battery_kwh)],
      ["Generator", bool(s.generator)],
      ["WoodStove", bool(s.wood_stove)],
      ["Hrv", bool(s.hrv)],
      ["AtmosphericWaterGenerator", bool(s.awg)],
      ["CisternLitres", int(s.cistern_litres)],
      ["Rainwater", bool(s.rainwater)],
      ["Greywater", bool(s.greywater)],
      ["CompostingToilet", bool(s.composting_toilet)],
      ["HotTub", bool(s.hot_tub)],
      ["CorkFlooring", bool(s.cork_flooring)],
      ["ReclaimedInterior", bool(s.reclaimed_interior)],
    ],
  });

  /* --- the BOT layer for the spine ------------------------------------- */

  ctx.graph.push({
    "@id": iriOf(ctx, "site"),
    "@type": "bot:Site",
    label: "Site",
    hasBuilding: [{ "@id": iriOf(ctx, "building") }],
    "aura:ifcGlobalId": siteId,
    "aura:frontFacesDeg": spec.siting.frontFacesDeg,
    "aura:slope": spec.siting.slope,
    "aura:foundation": SCREW_PILE_FOUNDATION,
  });
  ctx.graph.push({
    "@id": iriOf(ctx, "building"),
    "@type": "bot:Building",
    label: spec.name,
    hasStorey: ctx.storeyElevationFt.map((_, i) => ({ "@id": iriOf(ctx, `storey:${i + 1}`) })),
    "aura:ifcGlobalId": buildingId,
    "aura:material": spec.material,
    "aura:climateZone": spec.climateZone,
    "aura:totalFloorAreaSqFt": round9(totalFloorAreaSqFt(spec)),
    "aura:groundFootprintSqFt": round9(groundFootprintSqFt(spec)),
    "aura:glazedAreaSqFt": round9(glazedAreaSqFt(spec)),
    "aura:modelledWallAreaSqFt": round9(wallAreaSqFt),
    "aura:modelledGlazingRatio": round9(glazingRatio),
    "aura:fdwrPrescriptiveCeiling": FDWR_MAX,
    "aura:honestyNote": notes,
  });
  ctx.storeyElevationFt.forEach((elevationFt, i) => {
    ctx.graph.push({
      "@id": iriOf(ctx, `storey:${i + 1}`),
      "@type": "bot:Storey",
      label: `Storey ${i + 1}`,
      hasSpace: [],
      containsElement: [],
      "aura:ifcGlobalId": storeyIds[i],
      "aura:elevationFt": round9(elevationFt),
    });
  });
}

/** The BOT storey node, so elements can be appended to it as they are made. */
function storeyNode(ctx: Ctx, n: number): JsonLdNode {
  const iri = iriOf(ctx, `storey:${n}`);
  const node = ctx.graph.find((g) => g["@id"] === iri);
  /* Cannot be missing — `emitSpine` writes every storey before any element —
     but returning a detached node beats a crash inside a download. */
  return node ?? { "@id": iri, "@type": "bot:Storey", hasSpace: [], containsElement: [] };
}

const asNodeList = (node: JsonLdNode, key: string): JsonLdRef[] => {
  const existing = node[key];
  if (Array.isArray(existing)) return existing as JsonLdRef[];
  const fresh: JsonLdRef[] = [];
  node[key] = fresh;
  return fresh;
};

/* ===========================================================================
   MATERIAL — the layer thickness that makes this a BUILDING and not a box
   =========================================================================== */

function emitMaterial(ctx: Ctx, wallIds: string[]): void {
  if (wallIds.length === 0) return;
  const { spec, t } = ctx;
  const mm = WALL_THICKNESS_MM[spec.material];
  const r = WALL_R_VALUE[spec.material];

  push(ctx, {
    type: "IfcRelAssociatesMaterial",
    globalId: guidOf(ctx, "rel:material"),
    name: "Wall assembly",
    relatedObjects: wallIds.map((id) => ref("IfcWall", id)),
    relatingMaterial: {
      /* An IfcMaterialLayerSetUsage, not a bare IfcMaterial: the point of this
         export is that a wall is 165 mm of a NAMED assembly with a stated side
         and offset, which is the thing a takeoff, an energy model and a clash
         check all need and which a colour cannot carry. */
      type: "IfcMaterialLayerSetUsage",
      forLayerSet: {
        type: "IfcMaterialLayerSet",
        layerSetName: `${spec.material} structural wall`,
        materialLayers: [
          {
            type: "IfcMaterialLayer",
            material: { type: "IfcMaterial", name: spec.material },
            layerThickness: M(t),
            isVentilated: false,
            name: `${spec.material} structural layer`,
            description: `${mm} mm, from lib/design/materials.ts WALL_THICKNESS_MM`,
            category: "LoadBearing",
          },
        ],
      },
      /* AXIS2 is the wall's own thickness direction; the extrusion below is
         centred on the reference line, so the layer set starts a half
         thickness to its negative side. */
      layerSetDirection: "AXIS2",
      directionSense: "POSITIVE",
      offsetFromReferenceLine: M(-t / 2),
    },
  });

  /* R-value is imperial (h·ft²·°F/BTU). Pset_WallCommon wants
     ThermalTransmittance in W/m²K, so it is converted rather than mislabelled:
     R_SI = R_IP x 0.176110183628, U = 1 / R_SI. The imperial figure the repo
     actually reasons in is kept beside it, in the Aura pset, under its own
     name. Both numbers, one source. */
  const rSi = r * 0.176110183628;
  const u = rSi > 0 ? 1 / rSi : 0;

  attachPset(
    ctx,
    "wallcommon",
    wallIds.map((id) => ({ type: "IfcWall", globalId: id })),
    {
      name: "Pset_WallCommon",
      props: [
        ["IsExternal", bool(true)],
        ["LoadBearing", bool(true)],
        ["ThermalTransmittance", measure("IfcThermalTransmittanceMeasure", u)],
      ],
    },
  );
  attachPset(
    ctx,
    "wallassembly",
    wallIds.map((id) => ({ type: "IfcWall", globalId: id })),
    {
      name: "Aura_WallAssembly",
      description:
        "The envelope figures this repo reasons in. ThicknessMm and RValueImperial are " +
        "the source numbers; Pset_WallCommon.ThermalTransmittance beside them is the SI " +
        "conversion of the same assembly.",
      props: [
        ["Material", txt(spec.material)],
        ["ThicknessMm", real(mm)],
        ["RValueImperial", real(r)],
        ["RValueSi", real(rSi)],
        [
          "AssemblyNote",
          txt(
            "Effective R-value of the assembly for an honest energy note, not a certified " +
              "whole-wall value from a hot-box test. Nominal, and to be confirmed by the " +
              "panel manufacturer.",
          ),
        ],
      ],
    },
  );
}

/* ===========================================================================
   VOLUMES — walls, openings, fillers, slabs, spaces, roofs
   =========================================================================== */

interface EmittedElement {
  type: string;
  globalId: string;
  iri: string;
}

function emitVolumes(ctx: Ctx): void {
  const { spec, t } = ctx;
  const wallIds: string[] = [];

  for (const v of spec.volumes) {
    const uAxis = localUAxis(v.rotationDeg);

    for (let n = 1; n <= v.storeys; n++) {
      const storey = storeyNode(ctx, n);
      const storeyPlacement = guidOf(ctx, `placement:storey:${n}`);
      const contained: EmittedElement[] = [];

      /* The volume's own placement for this storey. Z corrects for the case
         where volumes disagree about wall height (see `storeyElevations`). */
      const dz = (n - 1) * v.wallHeightFt - ctx.storeyElevationFt[n - 1];
      const volPlacement = placement(
        ctx,
        `vol:${v.id}:${n}`,
        v.x,
        -v.z, // +Z south in the builder frame, +Y north in IFC
        dz,
        storeyPlacement,
        uAxis,
      );

      /* --- the space --------------------------------------------------- */
      const interiorW = Math.max(0.1, v.widthFt - 2 * t);
      const interiorD = Math.max(0.1, v.depthFt - 2 * t);
      const spaceId = guidOf(ctx, `space:${v.id}:${n}`);
      const spaceIri = iriOf(ctx, `space:${v.id}:${n}`);
      const spacePlacement = placement(ctx, `space:${v.id}:${n}`, 0, 0, 0, volPlacement);
      const spaceEntity: IfcJsonEntity = {
        type: "IfcSpace",
        globalId: spaceId,
        /* IfcSpace.Name is the room CODE and LongName is the room name — the
           schema's own intent, and it gives the HomeSpec's volume id a
           standard home rather than an invented attribute. */
        name: v.id,
        longName: v.storeys > 1 ? `${v.name} — level ${n}` : v.name,
        objectPlacement: ref("IfcLocalPlacement", spacePlacement),
        compositionType: "ELEMENT",
        predefinedType: "SPACE",
      };
      const spaceBody = extrudedBox(ctx, interiorW, interiorD, v.wallHeightFt);
      if (spaceBody) spaceEntity.representation = spaceBody;
      push(ctx, spaceEntity);

      push(ctx, {
        type: "IfcRelAggregates",
        globalId: guidOf(ctx, `rel:aggregate:space:${v.id}:${n}`),
        name: "StoreyContainer",
        relatingObject: ref("IfcBuildingStorey", guidOf(ctx, `storey:${n}`)),
        relatedObjects: [ref("IfcSpace", spaceId)],
      });

      attachPset(ctx, `space:${v.id}:${n}`, [{ type: "IfcSpace", globalId: spaceId }], {
        name: "Pset_SpaceCommon",
        props: [
          ["IsExternal", bool(false)],
          ["NetPlannedArea", measure("IfcAreaMeasure", M(interiorW) * M(interiorD))],
        ],
      });
      attachPset(ctx, `volume:${v.id}:${n}`, [{ type: "IfcSpace", globalId: spaceId }], {
        name: "Aura_Volume",
        description:
          "The HomeSpec Volume this space came from. Everything here is a spec field, " +
          "in the spec's own units.",
        props: [
          ["VolumeId", txt(v.id)],
          ["VolumeName", txt(v.name)],
          ["StoreyIndex", int(n)],
          ["StoreyCount", int(v.storeys)],
          ["WidthFt", real(v.widthFt)],
          ["DepthFt", real(v.depthFt)],
          ["WallHeightFt", real(v.wallHeightFt)],
          ["RotationDeg", real(v.rotationDeg)],
          ["CentreXFt", real(v.x)],
          ["CentreZFt", real(v.z)],
        ],
      });

      const spaceNode: JsonLdNode = {
        "@id": spaceIri,
        "@type": "bot:Space",
        label: v.name,
        adjacentElement: [],
        "aura:ifcGlobalId": spaceId,
        "aura:volumeId": v.id,
        "aura:netAreaSqFt": round9(interiorW * interiorD),
        "aura:heightFt": v.wallHeightFt,
      };
      ctx.graph.push(spaceNode);
      asNodeList(storey, "hasSpace").push({ "@id": spaceIri });

      /* --- the floor slab ---------------------------------------------- */
      const slabId = guidOf(ctx, `slab:${v.id}:${n}`);
      const slabIri = iriOf(ctx, `slab:${v.id}:${n}`);
      const slabPlacement = placement(
        ctx,
        `slab:${v.id}:${n}`,
        0,
        0,
        -FLOOR_SLAB_FT,
        volPlacement,
      );
      const slabEntity: IfcJsonEntity = {
        type: "IfcSlab",
        globalId: slabId,
        name: n === 1 ? `${v.name} floor deck` : `${v.name} level ${n} plate`,
        objectPlacement: ref("IfcLocalPlacement", slabPlacement),
        predefinedType: "FLOOR",
      };
      const slabBody = extrudedBox(ctx, v.widthFt, v.depthFt, FLOOR_SLAB_FT);
      if (slabBody) slabEntity.representation = slabBody;
      push(ctx, slabEntity);
      contained.push({ type: "IfcSlab", globalId: slabId, iri: slabIri });
      attachPset(ctx, `slab:${v.id}:${n}`, [{ type: "IfcSlab", globalId: slabId }], {
        name: "Aura_Slab",
        description:
          "Massing figure. The HomeSpec carries no slab thickness, so ThicknessFt is a " +
          "nominal depth that exists only so the slab is a solid — it is not a joist size " +
          "and not a structural design.",
        props: [
          ["VolumeId", txt(v.id)],
          ["StoreyIndex", int(n)],
          ["ThicknessFt", real(FLOOR_SLAB_FT)],
          ["Nominal", bool(true)],
        ],
      });
      ctx.graph.push({
        "@id": slabIri,
        "@type": "bot:Element",
        label: String(slabEntity.name),
        "aura:ifcGlobalId": slabId,
        "aura:ifcType": "IfcSlab",
      });

      /* --- the four walls ----------------------------------------------- */
      const walls: Wall[] = ["n", "s", "e", "w"];
      for (const w of walls) {
        const plan = wallPlan(v, w, t);
        const wallKey = `wall:${v.id}:${n}:${w}`;
        const wallId = guidOf(ctx, wallKey);
        const wallIri = iriOf(ctx, wallKey);
        const wallPlacementId = placement(
          ctx,
          wallKey,
          plan.centre[0],
          plan.centre[1],
          0,
          volPlacement,
          plan.run,
        );
        const wallEntity: IfcJsonEntity = {
          type: "IfcWall",
          /* IfcWall + SOLIDWALL rather than IfcWallStandardCase. Both are legal
             IFC4 and the standard case is what the reference samples use, but
             it is deprecated from IFC4.3 onward while IfcWall with an
             IfcMaterialLayerSetUsage says the same thing and keeps reading in
             the schema this format is heading toward. */
          globalId: wallId,
          name: `${v.name} ${w.toUpperCase()} wall`,
          objectPlacement: ref("IfcLocalPlacement", wallPlacementId),
          predefinedType: "SOLIDWALL",
        };
        const wallBody = extrudedBox(ctx, plan.runFt, t, v.wallHeightFt);
        if (wallBody) wallEntity.representation = wallBody;
        push(ctx, wallEntity);
        wallIds.push(wallId);
        contained.push({ type: "IfcWall", globalId: wallId, iri: wallIri });

        attachPset(ctx, wallKey, [{ type: "IfcWall", globalId: wallId }], {
          name: "Aura_Wall",
          description: "Which wall of which volume, in the HomeSpec's own vocabulary.",
          props: [
            ["VolumeId", txt(v.id)],
            ["StoreyIndex", int(n)],
            ["Wall", txt(w)],
            ["RunFt", real(plan.runFt)],
            ["HeightFt", real(v.wallHeightFt)],
            ["ThicknessFt", real(t)],
          ],
        });

        const wallNode: JsonLdNode = {
          "@id": wallIri,
          "@type": "bot:Element",
          label: String(wallEntity.name),
          "aura:ifcGlobalId": wallId,
          "aura:ifcType": "IfcWall",
          "aura:wall": w,
          "aura:runFt": round9(plan.runFt),
          "aura:thicknessFt": round9(t),
          "aura:rValueImperial": WALL_R_VALUE[spec.material],
        };
        ctx.graph.push(wallNode);
        asNodeList(spaceNode, "adjacentElement").push({ "@id": wallIri });
        interfaceBetween(ctx, spaceIri, wallIri, `space-wall:${v.id}:${n}:${w}`);

        /* --- openings on this wall -------------------------------------- */
        for (const o of v.openings) {
          if (o.wall !== w) continue;
          /* Openings live on storey 1 only. spec.ts places an opening on a
             NAMED WALL with a sill above the finished floor and has no storey
             field, so putting the same window on both levels of a two-storey
             volume would be this file inventing glass. Named, not silent —
             and it is the same gap `toPlan.ts` reports about two-storey homes. */
          if (n !== 1) continue;

          const key = `${v.id}:${n}:${o.id}`;
          const centreU = o.offsetFt + o.widthFt / 2 - plan.runFt / 2;
          const openingId = guidOf(ctx, `opening:${key}`);
          const openingPlacement = placement(
            ctx,
            `opening:${key}`,
            centreU,
            0,
            o.sillFt,
            wallPlacementId,
          );
          const openingEntity: IfcJsonEntity = {
            type: "IfcOpeningElement",
            globalId: openingId,
            name: `Opening ${o.id}`,
            objectPlacement: ref("IfcLocalPlacement", openingPlacement),
            predefinedType: "OPENING",
          };
          /* The void is the FULL wall thickness. Anything less is a recess,
             which is a different IFC thing and would leave the window buried. */
          const openingBody = extrudedBox(ctx, o.widthFt, t, o.heightFt);
          if (openingBody) openingEntity.representation = openingBody;
          push(ctx, openingEntity);

          push(ctx, {
            type: "IfcRelVoidsElement",
            globalId: guidOf(ctx, `rel:voids:${key}`),
            relatingBuildingElement: ref("IfcWall", wallId),
            relatedOpeningElement: ref("IfcOpeningElement", openingId),
          });

          const isDoor = o.kind === "door";
          const fillerType = isDoor ? "IfcDoor" : "IfcWindow";
          const fillerId = guidOf(ctx, `filler:${key}`);
          const fillerIri = iriOf(ctx, `filler:${key}`);
          const fillerPlacement = placement(
            ctx,
            `filler:${key}`,
            centreU,
            0,
            o.sillFt,
            wallPlacementId,
          );
          const fillerEntity: IfcJsonEntity = {
            type: fillerType,
            globalId: fillerId,
            name: `${v.name} ${o.id}`,
            objectPlacement: ref("IfcLocalPlacement", fillerPlacement),
            overallWidth: M(o.widthFt),
            overallHeight: M(o.heightFt),
            predefinedType: isDoor ? "DOOR" : "WINDOW",
          };
          if (o.kind === "glazing-wall") {
            /* IFC has no "glazing wall". IfcCurtainWall is the near neighbour
               and it is a WALL, not a filler — it could not sit in an opening
               in another wall, which is exactly where the HomeSpec puts this.
               So: an IfcWindow, with the Aura form named in objectType so the
               distinction survives rather than being flattened away. */
            fillerEntity.objectType = "Aura glazing wall";
          }
          const fillerBody = extrudedBox(
            ctx,
            o.widthFt,
            t,
            o.heightFt,
          );
          if (fillerBody) fillerEntity.representation = fillerBody;
          push(ctx, fillerEntity);
          contained.push({ type: fillerType, globalId: fillerId, iri: fillerIri });

          push(ctx, {
            type: "IfcRelFillsElement",
            globalId: guidOf(ctx, `rel:fills:${key}`),
            relatingOpeningElement: ref("IfcOpeningElement", openingId),
            relatedBuildingElement: ref(fillerType, fillerId),
          });

          attachPset(ctx, `filler:${key}`, [{ type: fillerType, globalId: fillerId }], {
            name: isDoor ? "Pset_DoorCommon" : "Pset_WindowCommon",
            props: [["IsExternal", bool(true)]],
          });
          attachPset(ctx, `opening:${key}`, [{ type: fillerType, globalId: fillerId }], {
            name: "Aura_Opening",
            description:
              "The HomeSpec Opening this came from. OffsetFt is measured from the wall's " +
              "left end looking at it from OUTSIDE, which is spec.ts's definition.",
            props: [
              ["OpeningId", txt(o.id)],
              ["Kind", txt(o.kind)],
              ["VolumeId", txt(v.id)],
              ["Wall", txt(o.wall)],
              ["WidthFt", real(o.widthFt)],
              ["HeightFt", real(o.heightFt)],
              ["OffsetFt", real(o.offsetFt)],
              ["SillFt", real(o.sillFt)],
              ["CountsTowardGlazing", bool(o.kind !== "door")],
            ],
          });

          ctx.graph.push({
            "@id": fillerIri,
            "@type": "bot:Element",
            label: String(fillerEntity.name),
            "aura:ifcGlobalId": fillerId,
            "aura:ifcType": fillerType,
            "aura:openingKind": o.kind,
            "aura:areaSqFt": round9(o.widthFt * o.heightFt),
          });
          /* BOT: the window is a sub-element of the wall it is cut into, and
             the space is bounded by it. Both edges are real and they say
             different things — the first is composition, the second is what a
             daylight or heat-loss query actually walks. */
          asNodeList(wallNode, "hasSubElement").push({ "@id": fillerIri });
          asNodeList(spaceNode, "adjacentElement").push({ "@id": fillerIri });
          interfaceBetween(ctx, spaceIri, fillerIri, `space-filler:${key}`);
        }
      }

      /* --- the roof, on the top storey only ----------------------------- */
      if (n === v.storeys) {
        const roofId = guidOf(ctx, `roof:${v.id}`);
        const roofIri = iriOf(ctx, `roof:${v.id}`);
        const roofPlacement = placement(
          ctx,
          `roof:${v.id}`,
          0,
          0,
          v.wallHeightFt,
          volPlacement,
        );
        push(ctx, {
          type: "IfcRoof",
          globalId: roofId,
          name: `${v.name} roof`,
          objectPlacement: ref("IfcLocalPlacement", roofPlacement),
          predefinedType: IFC_ROOF_TYPE[v.roof.form],
          objectType: `Aura ${v.roof.form} roof`,
        });
        contained.push({ type: "IfcRoof", globalId: roofId, iri: roofIri });

        attachPset(ctx, `roof:${v.id}`, [{ type: "IfcRoof", globalId: roofId }], {
          name: "Aura_Roof",
          description:
            "NO SOLID GEOMETRY, on purpose. lib/builder/geometry.ts is the single " +
            "authority for what a roof plane is in this system — five forms, each built " +
            "downward from ridgeHeightFt to hold the ridge invariant — and re-deriving " +
            "those planes here would put a second, disagreeing opinion about the same " +
            "roof into the same product. The glTF export carries the surfaces; these " +
            "properties carry the facts, including the ridge height a district height " +
            "limit is actually measured against.",
          props: [
            ["VolumeId", txt(v.id)],
            ["Form", txt(v.roof.form)],
            ["PitchDeg", real(v.roof.pitchDeg)],
            ["OverhangFt", real(v.roof.overhangFt)],
            ["Facing", txt(v.roof.facing ?? "")],
            ["RidgeHeightFt", real(ridgeHeightFt(v))],
            ["EaveHeightFt", real(v.wallHeightFt * v.storeys)],
            ["HasSolidGeometry", bool(false)],
          ],
        });
        attachPset(ctx, `roofcommon:${v.id}`, [{ type: "IfcRoof", globalId: roofId }], {
          name: "Pset_RoofCommon",
          props: [["IsExternal", bool(true)]],
        });
        ctx.graph.push({
          "@id": roofIri,
          "@type": "bot:Element",
          label: `${v.name} roof`,
          "aura:ifcGlobalId": roofId,
          "aura:ifcType": "IfcRoof",
          "aura:roofForm": v.roof.form,
          "aura:pitchDeg": v.roof.pitchDeg,
          "aura:overhangFt": v.roof.overhangFt,
          "aura:ridgeHeightFt": round9(ridgeHeightFt(v)),
        });
      }

      /* --- hang this storey's elements on the storey -------------------- */
      if (contained.length > 0) {
        push(ctx, {
          type: "IfcRelContainedInSpatialStructure",
          globalId: guidOf(ctx, `rel:contained:${v.id}:${n}`),
          name: `Storey ${n} contents`,
          relatedElements: contained.map((c) => ref(c.type, c.globalId)),
          relatingStructure: ref("IfcBuildingStorey", guidOf(ctx, `storey:${n}`)),
        });
        const list = asNodeList(storey, "containsElement");
        for (const c of contained) list.push({ "@id": c.iri });
      }
    }
  }

  emitMaterial(ctx, wallIds);
}

/** IFC4's IfcRoofTypeEnum, mapped from the five forms spec.ts offers.
 *
 *  Two of the five have no exact IFC name and are mapped to the form they
 *  geometrically ARE, with the Aura name preserved in `objectType` and in the
 *  Aura_Roof property set so nothing is lost:
 *  · a-frame  — two planes off a central ridge, which is a gable whose slopes
 *               reach the floor. GABLE_ROOF.
 *  · saltbox  — a gable with the ridge slid off centre. Still GABLE_ROOF;
 *               IFC has no asymmetric-gable value and inventing USERDEFINED
 *               would lose the fact that it sheds two ways. */
const IFC_ROOF_TYPE: Readonly<Record<RoofForm, string>> = {
  gable: "GABLE_ROOF",
  "a-frame": "GABLE_ROOF",
  shed: "SHED_ROOF",
  flat: "FLAT_ROOF",
  saltbox: "GABLE_ROOF",
};

/* ===========================================================================
   THE DECK
   =========================================================================== */

function emitDeck(ctx: Ctx): void {
  const deck = ctx.spec.deck;
  const host = ctx.spec.volumes[0];
  if (!deck || !host) return;

  /* Placed in the HOST VOLUME's own (u, v) frame, which is the same
     construction `geometry.ts`'s `deckCornersPlan` does in world coordinates:
     out from the named wall's outer face by half the deck's depth, with the
     deck's WIDTH along the wall and its DEPTH along the normal. Local rather
     than world because the volume placement already carries the rotation. */
  const runsAlongWidth = deck.wall === "n" || deck.wall === "s";
  const face = runsAlongWidth ? host.depthFt / 2 : host.widthFt / 2;
  const out: [number, number] =
    deck.wall === "n" ? [0, 1] : deck.wall === "s" ? [0, -1] : deck.wall === "e" ? [1, 0] : [-1, 0];
  const d = face + deck.depthFt / 2;
  const centre: [number, number] = [out[0] * d, out[1] * d];
  const xDim = runsAlongWidth ? deck.widthFt : deck.depthFt;
  const yDim = runsAlongWidth ? deck.depthFt : deck.widthFt;

  const deckId = guidOf(ctx, "deck");
  const deckIri = iriOf(ctx, "deck");
  const deckPlacement = placement(
    ctx,
    "deck",
    centre[0],
    centre[1],
    -DECK_SLAB_FT,
    guidOf(ctx, "placement:vol:" + host.id + ":1"),
  );
  const entity: IfcJsonEntity = {
    type: "IfcSlab",
    globalId: deckId,
    name: "Deck",
    objectPlacement: ref("IfcLocalPlacement", deckPlacement),
    predefinedType: "FLOOR",
  };
  const body = extrudedBox(ctx, xDim, yDim, DECK_SLAB_FT);
  if (body) entity.representation = body;
  push(ctx, entity);

  push(ctx, {
    type: "IfcRelContainedInSpatialStructure",
    globalId: guidOf(ctx, "rel:contained:deck"),
    name: "Deck",
    relatedElements: [ref("IfcSlab", deckId)],
    relatingStructure: ref("IfcBuildingStorey", guidOf(ctx, "storey:1")),
  });

  attachPset(ctx, "deck", [{ type: "IfcSlab", globalId: deckId }], {
    name: "Aura_Deck",
    description:
      "The HomeSpec Deck, attached to the named wall of the FIRST volume. Unconditioned: " +
      "its area is correctly absent from totalFloorAreaSqFt — but most land use bylaws DO " +
      "count decks in site coverage, so the coverage figure on a district's table is higher " +
      "than a footprint-only number.",
    props: [
      ["Wall", txt(deck.wall)],
      ["WidthFt", real(deck.widthFt)],
      ["DepthFt", real(deck.depthFt)],
      ["HotTub", bool(deck.hotTub)],
      ["AreaSqFt", real(deck.widthFt * deck.depthFt)],
      ["ThicknessFt", real(DECK_SLAB_FT)],
      ["Nominal", bool(true)],
      [
        "HotTubNote",
        txt(
          deck.hotTub
            ? "A wood-fired cedar hot tub is a costed line item in the Aura kit. It is NOT " +
                "modelled as an IFC element here — there is no honest IFC class for it and a " +
                "misclassified element is worse than an absent one."
            : "No hot tub on this deck.",
        ),
      ],
    ],
  });

  ctx.graph.push({
    "@id": deckIri,
    "@type": "bot:Element",
    label: "Deck",
    "aura:ifcGlobalId": deckId,
    "aura:ifcType": "IfcSlab",
    "aura:deckWall": deck.wall,
    "aura:areaSqFt": round9(deck.widthFt * deck.depthFt),
    "aura:hotTub": deck.hotTub,
    "aura:conditioned": false,
  });
  asNodeList(storeyNode(ctx, 1), "containsElement").push({ "@id": deckIri });
}

/* ===========================================================================
   THE JSON-LD LAYER
   =========================================================================== */

export interface JsonLdRef {
  "@id": string;
}

export interface JsonLdNode {
  "@id": string;
  "@type": string;
  [key: string]: unknown;
}

/** A `bot:Interface` between a zone and an element — BOT's own way of saying
 *  "this space is bounded here", and the node an area or a U-value would hang
 *  on the day one is measured rather than assumed. */
function interfaceBetween(ctx: Ctx, zoneIri: string, elementIri: string, key: string): void {
  ctx.graph.push({
    "@id": iriOf(ctx, `interface:${key}`),
    "@type": "bot:Interface",
    interfaceOf: [{ "@id": zoneIri }, { "@id": elementIri }],
  });
}

/**
 * The JSON-LD 1.1 context.
 *
 * `@version: 1.1` is not decoration — it is what enables `"@type": "@json"` on
 * the `ifcJSON` term, which is the whole reason the two layers can share one
 * file without the ifcJSON payload being shredded into nonsense triples.
 */
export const AURA_JSONLD_CONTEXT: Readonly<Record<string, unknown>> = Object.freeze({
  "@version": 1.1,
  bot: BOT_NS,
  aura: AURA_NS,
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  label: { "@id": "rdfs:label" },
  hasBuilding: { "@id": "bot:hasBuilding", "@type": "@id" },
  hasStorey: { "@id": "bot:hasStorey", "@type": "@id" },
  hasSpace: { "@id": "bot:hasSpace", "@type": "@id" },
  containsElement: { "@id": "bot:containsElement", "@type": "@id" },
  adjacentElement: { "@id": "bot:adjacentElement", "@type": "@id" },
  hasSubElement: { "@id": "bot:hasSubElement", "@type": "@id" },
  interfaceOf: { "@id": "bot:interfaceOf", "@type": "@id" },
  /* JSON-LD 1.1's literal-JSON datatype: "this value is opaque JSON". It is
     what keeps the embedded ifcJSON document intact and uninterpreted. */
  ifcJSON: { "@id": "aura:ifcJSON", "@type": "@json" },
});

/**
 * Where a Brick graph attaches, on the day there is a system to describe.
 *
 * Emitted as documentation, never as data. An unbuilt off-grid home has a
 * bill of materials and no sensor points, and a Brick file full of empty
 * equipment stubs would look like an integration and be a decoration.
 */
export const BRICK_EXTENSION_POINT = Object.freeze({
  ontology: "https://brickschema.org/schema/Brick#",
  attachesTo:
    "The bot:Building node. A Brick model would add brick:Equipment instances " +
    "(the PV array, the LiFePO4 bank, the generator, the HRV, the wood stove, the " +
    "cistern pump) with brick:hasLocation pointing at the bot:Space or bot:Storey " +
    "IRIs already in @graph, and brick:Point instances (state-of-charge, array power, " +
    "tank level, indoor temperature) with brick:isPointOf pointing at the equipment.",
  blockedBy:
    "Nothing is emitted today because none of it exists: the Aura_Systems property set " +
    "is the STANDARD KIT from lib/design/materials.ts, not commissioned equipment with " +
    "identifiers, and there is not one live point to name. Emit Brick when a built home " +
    "has a monitoring system, not before.",
});

export interface SemanticBundle {
  "@context": Readonly<Record<string, unknown>>;
  "@id": string;
  "@type": string;
  "aura:generator": string;
  "aura:specVersion": number;
  "aura:disclaimer": string;
  "aura:formatStatus": string;
  "aura:brickExtensionPoint": Readonly<Record<string, string>>;
  "@graph": JsonLdNode[];
  ifcJSON: IfcJsonDocument;
}

/** Said in the file, not only on the page: this format is a candidate. */
export const FORMAT_STATUS =
  "ifcJSON is a CANDIDATE encoding, not a published buildingSMART standard — the " +
  "specification repository (buildingsmart-community/ifcJSON) describes work in progress " +
  "against IFC4/IFC4.3, and IFC5 is moving to a different JSON encoding published at " +
  "ifcx.dev. This file follows the reference implementation wherever the specification " +
  "prose and the reference converter disagree. For a professional BIM handoff, use the " +
  "IFC4 SPF (.ifc) export.";

/* ===========================================================================
   THE PUBLIC WRITERS
   =========================================================================== */

function build(spec: HomeSpec, opts: SemanticExportOptions = {}): Ctx {
  const ctx: Ctx = {
    spec,
    slug: urnSlug(spec.name),
    systems: ecoSystems(opts.systems ?? {}),
    withGeometry: opts.geometry !== false,
    t: wallThicknessFt(spec.material),
    storeyElevationFt: storeyElevations(spec),
    data: [],
    graph: [],
  };
  emitSpine(ctx);
  emitVolumes(ctx);
  emitDeck(ctx);
  return ctx;
}

/** The ifcJSON document for a spec. Pure and deterministic. */
export function specToIfcJson(
  spec: HomeSpec,
  opts: SemanticExportOptions = {},
): IfcJsonDocument {
  const ctx = build(spec, opts);
  return {
    type: "ifcJSON",
    version: IFCJSON_VERSION,
    schemaIdentifier: IFC_SCHEMA_IDENTIFIER,
    originatingSystem: ORIGINATING_SYSTEM,
    data: ctx.data,
  };
}

/** The JSON-LD bundle: BOT topology plus the whole ifcJSON document. */
export function specToSemanticBundle(
  spec: HomeSpec,
  opts: SemanticExportOptions = {},
): SemanticBundle {
  const ctx = build(spec, opts);
  return {
    "@context": AURA_JSONLD_CONTEXT,
    "@id": `${AURA_URN_PREFIX}${ctx.slug}`,
    "@type": "aura:Home",
    "aura:generator": ORIGINATING_SYSTEM,
    "aura:specVersion": SPEC_VERSION,
    "aura:disclaimer": EXPORT_DISCLAIMER,
    "aura:formatStatus": FORMAT_STATUS,
    "aura:brickExtensionPoint": BRICK_EXTENSION_POINT,
    "@graph": ctx.graph,
    ifcJSON: {
      type: "ifcJSON",
      version: IFCJSON_VERSION,
      schemaIdentifier: IFC_SCHEMA_IDENTIFIER,
      originatingSystem: ORIGINATING_SYSTEM,
      data: ctx.data,
    },
  };
}

const text = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const ifcJsonToText = (doc: IfcJsonDocument): string => text(doc);
export const semanticBundleToText = (bundle: SemanticBundle): string => text(bundle);

const artifact = (
  body: string,
  filename: string,
  mimeType: string,
  note: string,
): ExportArtifact => {
  const blob = new Blob([body], { type: mimeType });
  return { blob, filename, mimeType, byteLength: blob.size, note };
};

/**
 * The bare ifcJSON document, as `aura-<name>.ifcjson`.
 *
 * `.ifcjson` is the extension IfcOpenShell's own `guess_format()` canonicalises
 * to `.ifcJSON` (verified in `ifcopenshell/__init__.py` at tag v0.8.0), and it
 * is the extension the buildingSMART converters take.
 */
export function exportIfcJson(
  spec: HomeSpec,
  opts: SemanticExportOptions = {},
): ExportArtifact {
  const doc = specToIfcJson(spec, opts);
  return artifact(
    ifcJsonToText(doc),
    exportFilename(spec, "ifcjson"),
    "application/json",
    `ifcJSON (CANDIDATE format, ${IFC_SCHEMA_IDENTIFIER}) · ${doc.data.length} entities · ` +
      "walls with real layer thickness, openings, fillers, slabs, spaces · " +
      "convertible to .ifc with buildingSMART's json2ifc.py · not a BIM-tool import format",
  );
}

/** The JSON-LD bundle, as `aura-<name>.jsonld`. */
export function exportSemanticJsonLd(
  spec: HomeSpec,
  opts: SemanticExportOptions = {},
): ExportArtifact {
  const bundle = specToSemanticBundle(spec, opts);
  return artifact(
    semanticBundleToText(bundle),
    exportFilename(spec, "jsonld"),
    "application/ld+json",
    `JSON-LD 1.1 · ${bundle["@graph"].length} BOT nodes over ${bundle.ifcJSON.data.length} ` +
      "IFC entities · Building Topology Ontology (W3C LBD public draft) · " +
      "the ifcJSON document rides inside as a JSON literal",
  );
}

/* ===========================================================================
   THE READER — the half that makes the format PROVEN rather than assumed

   A writer nobody can read is a writer nobody can check. This reads an
   Aura-written ifcJSON document (or a bundle containing one) back into a
   HomeSpec, and it does it TWICE over: once from the Aura property sets,
   which is what property sets are for, and once from the emitted
   IfcExtrudedAreaSolid geometry. Where the two disagree the disagreement is
   returned as a named check rather than resolved silently, because a
   disagreement means the solids and the data are describing different houses
   and that is precisely the bug this whole file exists to make impossible.

   The result goes through `validateHomeSpec` — the SAME gate a share link and
   a dropped .json file come through. A file off somebody's disk is exactly as
   untrusted as a URL off the internet, and a second standard for "is this a
   house" is how the two paths start disagreeing.
   =========================================================================== */

/**
 * One place where the property sets and the geometry are made to agree.
 *
 * `source` matters more than it looks. Placements are written even when solids
 * are not, so a `geometry: false` export still cross-checks positions, run
 * directions and sill heights — but NONE of the extruded dimensions. Counting
 * the two together would let an export with no solids in it report a healthy
 * number of passing checks, which is the exact shape of a check that cannot
 * fail. They are counted separately so the caller can see which is which.
 */
export interface CrossCheck {
  what: string;
  source: "solid" | "placement";
  fromPropertiesFt: number;
  fromGeometryFt: number;
  errorFt: number;
  ok: boolean;
}

export type SemanticParse =
  | {
      ok: true;
      spec: HomeSpec;
      /** Cross-checks that FAILED. Empty is the pass condition. */
      crossChecks: CrossCheck[];
      /** How many ran in total. */
      crossChecksRun: number;
      /** How many of those came from an IfcExtrudedAreaSolid. Zero means the
       *  file carried no solids and nothing about the geometry was proven. */
      solidChecksRun: number;
      entityCount: number;
    }
  | { ok: false; problem: string };

/** Agreement tolerance between a property value and the solid it describes.
 *  1e-3 ft is 0.012 inches — a hundred times the 1e-4 ft quantisation, and
 *  still far below anything a person can enter. */
const GEOMETRY_TOLERANCE_FT = 1e-3;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function entitiesOf(parsed: unknown): IfcJsonEntity[] | null {
  if (!isRecord(parsed)) return null;
  const doc = isRecord(parsed.ifcJSON) ? parsed.ifcJSON : parsed;
  if (doc.type !== "ifcJSON" || !Array.isArray(doc.data)) return null;
  const out: IfcJsonEntity[] = [];
  for (const e of doc.data) {
    if (isRecord(e) && typeof e.type === "string") out.push(e as IfcJsonEntity);
  }
  return out;
}

/** Index every named property set by the globalId of the object it defines. */
function indexPropertySets(
  entities: readonly IfcJsonEntity[],
): Map<string, Map<string, Map<string, unknown>>> {
  const setsById = new Map<string, IfcJsonEntity>();
  for (const e of entities) {
    if (e.type === "IfcPropertySet" && typeof e.globalId === "string") setsById.set(e.globalId, e);
  }
  const byObject = new Map<string, Map<string, Map<string, unknown>>>();
  for (const e of entities) {
    if (e.type !== "IfcRelDefinesByProperties") continue;
    const rel = isRecord(e.relatingPropertyDefinition) ? e.relatingPropertyDefinition : null;
    const psetId = rel && typeof rel.ref === "string" ? rel.ref : null;
    const pset = psetId ? setsById.get(psetId) : undefined;
    if (!pset || !Array.isArray(e.relatedObjects)) continue;

    const values = new Map<string, unknown>();
    if (Array.isArray(pset.hasProperties)) {
      for (const p of pset.hasProperties) {
        if (!isRecord(p) || typeof p.name !== "string") continue;
        const nv = isRecord(p.nominalValue) ? p.nominalValue : null;
        values.set(p.name, nv ? nv.value : undefined);
      }
    }
    const setName = typeof pset.name === "string" ? pset.name : "";
    for (const target of e.relatedObjects) {
      if (!isRecord(target) || typeof target.ref !== "string") continue;
      const forObject = byObject.get(target.ref) ?? new Map<string, Map<string, unknown>>();
      forObject.set(setName, values);
      byObject.set(target.ref, forObject);
    }
  }
  return byObject;
}

const numberOf = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const stringOf = (v: unknown): string | null => (typeof v === "string" ? v : null);
const boolOf = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** The (xDim, yDim, depth) of an element's single extruded rectangle, in FEET,
 *  or null when the element carries no body (a `geometry: false` export, or
 *  the roof, which never has one). */
function solidDimsFt(entity: IfcJsonEntity): [number, number, number] | null {
  const rep = isRecord(entity.representation) ? entity.representation : null;
  const reps = rep && Array.isArray(rep.representations) ? rep.representations : null;
  const shape = reps && isRecord(reps[0]) ? (reps[0] as Record<string, unknown>) : null;
  const items = shape && Array.isArray(shape.items) ? shape.items : null;
  const solid = items && isRecord(items[0]) ? (items[0] as Record<string, unknown>) : null;
  if (!solid || solid.type !== "IfcExtrudedAreaSolid") return null;
  const profile = isRecord(solid.sweptArea) ? solid.sweptArea : null;
  const x = profile ? numberOf(profile.xDim) : null;
  const y = profile ? numberOf(profile.yDim) : null;
  const d = numberOf(solid.depth);
  if (x === null || y === null || d === null) return null;
  return [FT(x), FT(y), FT(d)];
}

/** A placement's location and refDirection, in FEET and plan components. */
function placementOf(
  entity: IfcJsonEntity,
  placements: Map<string, IfcJsonEntity>,
): { xFt: number; yFt: number; zFt: number; dir: [number, number] | null } | null {
  const op = isRecord(entity.objectPlacement) ? entity.objectPlacement : null;
  const id = op && typeof op.ref === "string" ? op.ref : null;
  const p = id ? placements.get(id) : undefined;
  const rel = p && isRecord(p.relativePlacement) ? p.relativePlacement : null;
  const loc = rel && isRecord(rel.location) ? rel.location : null;
  const c = loc && Array.isArray(loc.coordinates) ? loc.coordinates : null;
  if (!c || c.length < 3) return null;
  const xs = c.map((n) => numberOf(n));
  if (xs.some((n) => n === null)) return null;
  const refDir = rel && isRecord(rel.refDirection) ? rel.refDirection : null;
  const ratios = refDir && Array.isArray(refDir.directionRatios) ? refDir.directionRatios : null;
  const dir: [number, number] | null =
    ratios && numberOf(ratios[0]) !== null && numberOf(ratios[1]) !== null
      ? [ratios[0] as number, ratios[1] as number]
      : null;
  return {
    xFt: FT(xs[0] as number),
    yFt: FT(xs[1] as number),
    zFt: FT(xs[2] as number),
    dir,
  };
}

const WALL_LETTERS: readonly Wall[] = ["n", "s", "e", "w"];
const OPENING_KINDS: readonly OpeningKind[] = ["window", "door", "glazing-wall"];
const SLOPES: readonly Siting["slope"][] = ["flat", "gentle", "steep"];
const ROOF_FORMS: readonly RoofForm[] = ["gable", "a-frame", "shed", "flat", "saltbox"];

const inTable = <T extends string>(table: readonly T[], v: unknown): T | null =>
  typeof v === "string" && (table as readonly string[]).includes(v) ? (v as T) : null;

/**
 * Read a HomeSpec back out of a parsed ifcJSON document or bundle.
 *
 * Returns `null` with a named problem rather than a partial house, on exactly
 * the reasoning `share.ts` gives: a half-read house is worse than no house,
 * because it looks like it worked.
 */
export function ifcJsonToSpec(parsed: unknown): SemanticParse {
  const entities = entitiesOf(parsed);
  if (!entities) {
    return {
      ok: false,
      problem:
        'not an ifcJSON document — expected type "ifcJSON" and a data array, at the top ' +
        "level or under an ifcJSON key",
    };
  }

  const psets = indexPropertySets(entities);
  const placements = new Map<string, IfcJsonEntity>();
  for (const e of entities) {
    if (e.type === "IfcLocalPlacement" && typeof e.globalId === "string") {
      placements.set(e.globalId, e);
    }
  }
  const get = (globalId: string | undefined, set: string, prop: string): unknown =>
    globalId ? psets.get(globalId)?.get(set)?.get(prop) : undefined;

  const checks: CrossCheck[] = [];
  const check = (
    what: string,
    source: CrossCheck["source"],
    fromProps: number,
    fromGeom: number | null,
  ): void => {
    if (fromGeom === null) return;
    const errorFt = Math.abs(fromProps - fromGeom);
    checks.push({
      what,
      source,
      fromPropertiesFt: fromProps,
      fromGeometryFt: fromGeom,
      errorFt,
      ok: errorFt <= GEOMETRY_TOLERANCE_FT,
    });
  };
  /* Read back out of the file's own material layer set rather than looked up
     from the material table, so a hand-edited thickness is caught rather than
     papered over. Resolved once — it is one scan of the entity list. */
  const layerFt = layerThicknessFt(entities);

  /* --- project-level facts --------------------------------------------- */
  const project = entities.find((e) => e.type === "IfcProject");
  if (!project) return { ok: false, problem: "no IfcProject in the document" };
  const home = psets.get(project.globalId ?? "")?.get("Aura_HomeSpec");
  if (!home) {
    return {
      ok: false,
      problem:
        "no Aura_HomeSpec property set on the IfcProject — this reader only reads ifcJSON " +
        "written by this builder, and says so rather than guessing at a foreign file",
    };
  }
  const name = stringOf(home.get("HomeName")) ?? "";
  const material = stringOf(home.get("Material"));
  const climateZone = stringOf(home.get("ClimateZone"));
  const notes = stringOf(home.get("Notes")) ?? "";

  /* --- siting ----------------------------------------------------------- */
  const site = entities.find((e) => e.type === "IfcSite");
  const frontFacesDeg = numberOf(get(site?.globalId, "Aura_Siting", "FrontFacesDeg"));
  const slope = inTable(SLOPES, get(site?.globalId, "Aura_Siting", "Slope"));
  if (frontFacesDeg === null || slope === null) {
    return { ok: false, problem: "Aura_Siting is missing FrontFacesDeg or Slope" };
  }

  /* --- volumes, from the spaces ---------------------------------------- */
  interface Draft {
    volume: Volume;
    /** wall run lengths read off the walls, keyed by wall letter */
    runFt: Partial<Record<Wall, number>>;
  }
  const drafts = new Map<string, Draft>();

  for (const e of entities) {
    if (e.type !== "IfcSpace") continue;
    const v = psets.get(e.globalId ?? "")?.get("Aura_Volume");
    if (!v) continue;
    const storeyIndex = numberOf(v.get("StoreyIndex"));
    if (storeyIndex !== 1) continue; // one draft per volume, from its ground level
    const id = stringOf(v.get("VolumeId"));
    const widthFt = numberOf(v.get("WidthFt"));
    const depthFt = numberOf(v.get("DepthFt"));
    const wallHeightFt = numberOf(v.get("WallHeightFt"));
    const storeys = numberOf(v.get("StoreyCount"));
    const rotationDeg = numberOf(v.get("RotationDeg"));
    const x = numberOf(v.get("CentreXFt"));
    const z = numberOf(v.get("CentreZFt"));
    if (
      id === null ||
      widthFt === null ||
      depthFt === null ||
      wallHeightFt === null ||
      storeys === null ||
      rotationDeg === null ||
      x === null ||
      z === null
    ) {
      return { ok: false, problem: `Aura_Volume on space "${String(e.name)}" is incomplete` };
    }

    /* Cross-check the placement the geometry actually carries. */
    const p = placementOf(e, placements);
    if (p) {
      // the space placement is at the volume origin, so its own coordinates are
      // zero; the volume placement above it is the one holding x/z and rotation
      const op = isRecord(e.objectPlacement) ? e.objectPlacement : null;
      const spacePlacement = op && typeof op.ref === "string" ? placements.get(op.ref) : undefined;
      const parent = spacePlacement && isRecord(spacePlacement.placementRelTo)
        ? placements.get(String(spacePlacement.placementRelTo.ref))
        : undefined;
      const rel = parent && isRecord(parent.relativePlacement) ? parent.relativePlacement : null;
      const loc = rel && isRecord(rel.location) ? rel.location : null;
      const c = loc && Array.isArray(loc.coordinates) ? loc.coordinates : null;
      if (c && numberOf(c[0]) !== null && numberOf(c[1]) !== null) {
        check(`volumes[${id}].x`, "placement", x, FT(c[0] as number));
        check(`volumes[${id}].z`, "placement", z, -FT(c[1] as number));
      }
      const dirs = rel && isRecord(rel.refDirection) ? rel.refDirection : null;
      const ratios = dirs && Array.isArray(dirs.directionRatios) ? dirs.directionRatios : null;
      if (ratios && numberOf(ratios[0]) !== null && numberOf(ratios[1]) !== null) {
        const bearing = bearingFromUAxis(ratios[0] as number, ratios[1] as number);
        const wanted = ((rotationDeg % 360) + 360) % 360;
        check(
          `volumes[${id}].rotationDeg`,
          "placement",
          wanted,
          Math.abs(bearing - wanted) > 180 ? bearing - 360 : bearing,
        );
      }
    }

    const dims = solidDimsFt(e);
    if (dims) {
      // The space solid is the INTERIOR: width and depth less two walls.
      if (layerFt !== null) {
        check(`volumes[${id}].widthFt (via space interior)`, "solid", widthFt - 2 * layerFt, dims[0]);
        check(`volumes[${id}].depthFt (via space interior)`, "solid", depthFt - 2 * layerFt, dims[1]);
      }
      check(`volumes[${id}].wallHeightFt`, "solid", wallHeightFt, dims[2]);
    }

    drafts.set(id, {
      volume: {
        id,
        name: stringOf(v.get("VolumeName")) ?? id,
        widthFt,
        depthFt,
        x,
        z,
        rotationDeg,
        storeys: storeys === 2 ? 2 : 1,
        wallHeightFt,
        roof: { form: "gable", pitchDeg: 0, overhangFt: 0 },
        openings: [],
      },
      runFt: {},
    });
  }

  if (drafts.size === 0) {
    return { ok: false, problem: "no IfcSpace carried an Aura_Volume property set" };
  }

  /* --- walls: run lengths, plus the run direction cross-check ----------- */
  for (const e of entities) {
    if (e.type !== "IfcWall") continue;
    const w = psets.get(e.globalId ?? "")?.get("Aura_Wall");
    if (!w) continue;
    if (numberOf(w.get("StoreyIndex")) !== 1) continue;
    const volumeId = stringOf(w.get("VolumeId"));
    const wall = inTable(WALL_LETTERS, w.get("Wall"));
    const runFt = numberOf(w.get("RunFt"));
    if (!volumeId || !wall || runFt === null) continue;
    const draft = drafts.get(volumeId);
    if (!draft) continue;
    draft.runFt[wall] = runFt;

    const dims = solidDimsFt(e);
    if (dims) check(`wall[${volumeId}:${wall}].runFt`, "solid", runFt, dims[0]);
    const p = placementOf(e, placements);
    if (p?.dir) {
      /* Not a length: the four run directions are the four axis directions and
         nothing in between, so this is a pass/fail on which wall the geometry
         says it is. The error is 0 or infinite on purpose — a half-right wall
         direction does not exist. */
      const fromGeometry = wallFromRun(p.dir[0], p.dir[1]);
      checks.push({
        what: `wall[${volumeId}:${wall}] run direction`,
        source: "placement",
        fromPropertiesFt: Number.NaN,
        fromGeometryFt: Number.NaN,
        errorFt: fromGeometry === wall ? 0 : Number.POSITIVE_INFINITY,
        ok: fromGeometry === wall,
      });
    }
  }

  /* --- openings: from the fillers -------------------------------------- */
  for (const e of entities) {
    if (e.type !== "IfcWindow" && e.type !== "IfcDoor") continue;
    const o = psets.get(e.globalId ?? "")?.get("Aura_Opening");
    if (!o) continue;
    const volumeId = stringOf(o.get("VolumeId"));
    const draft = volumeId ? drafts.get(volumeId) : undefined;
    if (!draft) continue;
    const id = stringOf(o.get("OpeningId"));
    const kind = inTable(OPENING_KINDS, o.get("Kind"));
    const wall = inTable(WALL_LETTERS, o.get("Wall"));
    const widthFt = numberOf(o.get("WidthFt"));
    const heightFt = numberOf(o.get("HeightFt"));
    const offsetFt = numberOf(o.get("OffsetFt"));
    const sillFt = numberOf(o.get("SillFt"));
    if (
      id === null ||
      kind === null ||
      wall === null ||
      widthFt === null ||
      heightFt === null ||
      offsetFt === null ||
      sillFt === null
    ) {
      return { ok: false, problem: `Aura_Opening on "${String(e.name)}" is incomplete` };
    }
    draft.volume.openings.push({ id, wall, kind, widthFt, heightFt, offsetFt, sillFt });

    const dims = solidDimsFt(e);
    if (dims) {
      check(`opening[${volumeId}:${id}].widthFt`, "solid", widthFt, dims[0]);
      check(`opening[${volumeId}:${id}].heightFt`, "solid", heightFt, dims[2]);
    }
    const p = placementOf(e, placements);
    const run = draft.runFt[wall];
    if (p && run !== undefined) {
      /* The placement holds the opening's CENTRE relative to the wall's centre;
         invert it back to the spec's offset-from-the-left-end. */
      check(`opening[${volumeId}:${id}].offsetFt`, "placement", offsetFt, p.xFt + run / 2 - widthFt / 2);
      check(`opening[${volumeId}:${id}].sillFt`, "placement", sillFt, p.zFt);
    }
  }

  /* --- roofs ------------------------------------------------------------ */
  for (const e of entities) {
    if (e.type !== "IfcRoof") continue;
    const r = psets.get(e.globalId ?? "")?.get("Aura_Roof");
    if (!r) continue;
    const volumeId = stringOf(r.get("VolumeId"));
    const draft = volumeId ? drafts.get(volumeId) : undefined;
    if (!draft) continue;
    const form = inTable(ROOF_FORMS, r.get("Form"));
    const pitchDeg = numberOf(r.get("PitchDeg"));
    const overhangFt = numberOf(r.get("OverhangFt"));
    if (form === null || pitchDeg === null || overhangFt === null) {
      return { ok: false, problem: `Aura_Roof on "${String(e.name)}" is incomplete` };
    }
    draft.volume.roof = { form, pitchDeg, overhangFt };
    const facing = inTable(WALL_LETTERS, r.get("Facing"));
    if (facing) draft.volume.roof.facing = facing;
  }

  /* --- the deck --------------------------------------------------------- */
  let deck: Deck | null = null;
  for (const e of entities) {
    if (e.type !== "IfcSlab") continue;
    const d = psets.get(e.globalId ?? "")?.get("Aura_Deck");
    if (!d) continue;
    const wall = inTable(WALL_LETTERS, d.get("Wall"));
    const widthFt = numberOf(d.get("WidthFt"));
    const depthFt = numberOf(d.get("DepthFt"));
    const hotTub = boolOf(d.get("HotTub"));
    if (wall === null || widthFt === null || depthFt === null || hotTub === null) {
      return { ok: false, problem: "Aura_Deck is incomplete" };
    }
    deck = { wall, widthFt, depthFt, hotTub };
    const dims = solidDimsFt(e);
    if (dims) {
      const along = wall === "n" || wall === "s" ? dims[0] : dims[1];
      const across = wall === "n" || wall === "s" ? dims[1] : dims[0];
      check("deck.widthFt", "solid", widthFt, along);
      check("deck.depthFt", "solid", depthFt, across);
    }
    break;
  }

  /* --- assemble and gate ------------------------------------------------ */
  const candidate = {
    version: SPEC_VERSION,
    name,
    material,
    climateZone,
    // `Array.from`, not a spread: this repo's tsconfig sets no `target`, so the
    // tsc CLI downlevels to ES5 and spreading a Map iterator would need
    // `--downlevelIteration`. One call, no compiler flag, same result.
    volumes: Array.from(drafts.values()).map((d) => d.volume),
    deck,
    siting: { frontFacesDeg, slope },
    notes,
  } satisfies {
    version: number;
    name: string;
    material: string | null;
    climateZone: string | null;
    volumes: Volume[];
    deck: Deck | null;
    siting: { frontFacesDeg: number; slope: Siting["slope"] };
    notes: string;
  };

  const gate = validateHomeSpec(candidate);
  if (!gate.ok) {
    return {
      ok: false,
      problem: `the reconstructed spec did not pass validateHomeSpec — ${gate.problem}`,
    };
  }

  return {
    ok: true,
    spec: gate.spec,
    crossChecks: checks.filter((c) => !c.ok),
    crossChecksRun: checks.length,
    solidChecksRun: checks.filter((c) => c.source === "solid").length,
    entityCount: entities.length,
  };
}

/** Structural wall thickness in feet, read back out of the material layer set
 *  the file itself carries. */
function layerThicknessFt(entities: readonly IfcJsonEntity[]): number | null {
  for (const e of entities) {
    if (e.type !== "IfcRelAssociatesMaterial") continue;
    const usage = isRecord(e.relatingMaterial) ? e.relatingMaterial : null;
    const set = usage && isRecord(usage.forLayerSet) ? usage.forLayerSet : null;
    const layers = set && Array.isArray(set.materialLayers) ? set.materialLayers : null;
    const layer = layers && isRecord(layers[0]) ? layers[0] : null;
    const thickness = layer ? numberOf(layer.layerThickness) : null;
    if (thickness !== null) return FT(thickness);
  }
  return null;
}

/** Read either file this module writes, from text. */
export function parseSemanticJson(source: string): SemanticParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    return { ok: false, problem: `not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  return ifcJsonToSpec(parsed);
}

/* ===========================================================================
   THE ROUND-TRIP REPORT — the falsifiable claim
   =========================================================================== */

export interface RoundTripReport {
  ok: boolean;
  /** Every field that came back different, named with its path. */
  differences: string[];
  /** Largest disagreement between a written property and the geometry
   *  describing it, in feet. `0` when nothing disagreed. */
  maxGeometryErrorFt: number;
  /** Cross-checks that failed. Empty is the pass condition. */
  crossChecks: CrossCheck[];
  /** How many cross-checks ran in total. */
  crossChecksRun: number;
  /** How many of those read an IfcExtrudedAreaSolid. ZERO means `ok` says
   *  nothing whatever about the solids — reported rather than hidden, because
   *  a check that cannot fail is not a check. */
  solidChecksRun: number;
  entityCount: number;
  botNodeCount: number;
  ifcJsonBytes: number;
  bundleBytes: number;
  /** Set when the reader refused the file outright. */
  problem: string | null;
}

/** Compare two specs field by field and name every difference. Numbers are
 *  compared exactly: everything written went through the same 1e-4 ft
 *  quantisation on the way back, so "close enough" would hide a real drift. */
function diffSpecs(a: HomeSpec, b: HomeSpec): string[] {
  const out: string[] = [];
  const cmp = (path: string, x: unknown, y: unknown): void => {
    if (x !== y) out.push(`${path}: wrote ${JSON.stringify(x)}, read ${JSON.stringify(y)}`);
  };
  cmp("name", a.name, b.name);
  cmp("material", a.material, b.material);
  cmp("climateZone", a.climateZone, b.climateZone);
  cmp("notes", a.notes, b.notes);
  cmp("siting.frontFacesDeg", a.siting.frontFacesDeg, b.siting.frontFacesDeg);
  cmp("siting.slope", a.siting.slope, b.siting.slope);
  cmp("deck", a.deck === null, b.deck === null);
  if (a.deck && b.deck) {
    cmp("deck.wall", a.deck.wall, b.deck.wall);
    cmp("deck.widthFt", a.deck.widthFt, b.deck.widthFt);
    cmp("deck.depthFt", a.deck.depthFt, b.deck.depthFt);
    cmp("deck.hotTub", a.deck.hotTub, b.deck.hotTub);
  }
  cmp("volumes.length", a.volumes.length, b.volumes.length);

  for (const av of a.volumes) {
    const bv = b.volumes.find((v) => v.id === av.id);
    if (!bv) {
      out.push(`volumes[${av.id}]: missing after the round trip`);
      continue;
    }
    const p = `volumes[${av.id}]`;
    cmp(`${p}.name`, av.name, bv.name);
    cmp(`${p}.widthFt`, av.widthFt, bv.widthFt);
    cmp(`${p}.depthFt`, av.depthFt, bv.depthFt);
    cmp(`${p}.x`, av.x, bv.x);
    cmp(`${p}.z`, av.z, bv.z);
    cmp(`${p}.rotationDeg`, av.rotationDeg, bv.rotationDeg);
    cmp(`${p}.storeys`, av.storeys, bv.storeys);
    cmp(`${p}.wallHeightFt`, av.wallHeightFt, bv.wallHeightFt);
    cmp(`${p}.roof.form`, av.roof.form, bv.roof.form);
    cmp(`${p}.roof.pitchDeg`, av.roof.pitchDeg, bv.roof.pitchDeg);
    cmp(`${p}.roof.overhangFt`, av.roof.overhangFt, bv.roof.overhangFt);
    cmp(`${p}.roof.facing`, av.roof.facing ?? null, bv.roof.facing ?? null);
    cmp(`${p}.openings.length`, av.openings.length, bv.openings.length);
    for (const ao of av.openings) {
      const bo = bv.openings.find((o: Opening) => o.id === ao.id);
      if (!bo) {
        out.push(`${p}.openings[${ao.id}]: missing after the round trip`);
        continue;
      }
      const q = `${p}.openings[${ao.id}]`;
      cmp(`${q}.wall`, ao.wall, bo.wall);
      cmp(`${q}.kind`, ao.kind, bo.kind);
      cmp(`${q}.widthFt`, ao.widthFt, bo.widthFt);
      cmp(`${q}.heightFt`, ao.heightFt, bo.heightFt);
      cmp(`${q}.offsetFt`, ao.offsetFt, bo.offsetFt);
      cmp(`${q}.sillFt`, ao.sillFt, bo.sillFt);
    }
  }
  return out;
}

/**
 * Write the file, read it back, and say exactly what survived.
 *
 * Cheap enough to run on every render of a panel, which is the point: the
 * claim on screen is computed live from the spec in front of the user, not
 * asserted once in a comment.
 */
export function roundTripReport(
  spec: HomeSpec,
  opts: SemanticExportOptions = {},
): RoundTripReport {
  const bundle = specToSemanticBundle(spec, opts);
  const ifcText = ifcJsonToText(bundle.ifcJSON);
  const bundleText = semanticBundleToText(bundle);
  const bytes = (s: string): number =>
    typeof TextEncoder === "undefined" ? s.length : new TextEncoder().encode(s).length;

  /* Parsed from the SERIALISED text, not from the in-memory object: a
     round-trip that never went through JSON.stringify would not exercise the
     one step where a number can lose a digit. */
  const read = parseSemanticJson(ifcText);
  const shared = {
    entityCount: bundle.ifcJSON.data.length,
    botNodeCount: bundle["@graph"].length,
    ifcJsonBytes: bytes(ifcText),
    bundleBytes: bytes(bundleText),
  };

  if (!read.ok) {
    return {
      ok: false,
      differences: [],
      maxGeometryErrorFt: 0,
      crossChecks: [],
      crossChecksRun: 0,
      solidChecksRun: 0,
      problem: read.problem,
      ...shared,
    };
  }

  const differences = diffSpecs(spec, read.spec);
  const failures = read.crossChecks;
  const finiteErrors = failures.map((c) => c.errorFt).filter((e) => Number.isFinite(e));

  return {
    /* Both halves must hold: the spec came back identical AND every dimension
       the property sets claim is the dimension the geometry actually has. */
    ok: differences.length === 0 && failures.length === 0,
    differences,
    maxGeometryErrorFt: finiteErrors.length > 0 ? Math.max(...finiteErrors) : 0,
    crossChecks: failures,
    crossChecksRun: read.crossChecksRun,
    solidChecksRun: read.solidChecksRun,
    problem: null,
    ...shared,
  };
}

/* ===========================================================================
   WHAT CAN ACTUALLY OPEN THIS — checked 11 August 2026

   Printed by the UI straight out of this array, so the page cannot claim
   something the module has not checked. `verdict` is about EVIDENCE, not
   hope: "unverified" means exactly that, and it is used for the two claims
   this file was unable to confirm rather than rounding them up to "reads".
   =========================================================================== */

export interface ToolSupportFact {
  tool: string;
  verdict: "reads" | "converts" | "does-not-read" | "unverified";
  note: string;
}

export const IFCJSON_TOOL_SUPPORT: readonly ToolSupportFact[] = Object.freeze([
  {
    tool: "Any JSON reader — a browser, jq, Python, a spreadsheet import",
    verdict: "reads",
    note:
      "This is the point of the format and the only claim here that needs no caveat. " +
      "JSON.parse gives you every wall, its thickness, its openings and its storey.",
  },
  {
    tool: "buildingSMART json2ifc.py (IFCJSON_python, needs IfcOpenShell + pandas)",
    verdict: "converts",
    note:
      "The reference reader in buildingsmart-community/ifcJSON converts ifcJSON to an " +
      'IFC-SPF .ifc file. Verified by reading its source: it requires type "ifcJSON" and ' +
      'a data array, resolves references in the {"ref": "<globalId>"} object form, and ' +
      "parses globalId with uuid.UUID() — all three of which this writer satisfies. " +
      "NOT executed against this file's output; that needs a Python environment.",
  },
  {
    tool: "IfcOpenShell (Python) — ifcopenshell.open()",
    verdict: "unverified",
    note:
      "Its documentation says \"Read and write IFC-SPF, IFCJSON, IFCXML, IFCHDF5, MySQL, " +
      "and SQLite\", and guess_format() at tag v0.8.0 does canonicalise .ifcjson/.json to " +
      '".ifcJSON". But open() in the same file has branches for .ifcXML, .ifcZIP, ' +
      ".ifcSQLite and rocksdb and NONE for .ifcJSON — a .ifcjson path falls through to the " +
      "SPF parser. Read the source, did not run it. Treat the docs sentence as unconfirmed " +
      "and use json2ifc.py.",
  },
  {
    tool: "Revit, ArchiCAD, Vectorworks, Tekla, Solibri, Navisworks",
    verdict: "does-not-read",
    note:
      "These import IFC-SPF (.ifc). No mainstream BIM authoring or checking tool was found " +
      "that lists .ifcjson as an import format. Convert first, or use the IFC4 SPF export.",
  },
  {
    tool: "web-ifc / ThatOpen Components (the browser IFC engine)",
    verdict: "does-not-read",
    note:
      "web-ifc reads and writes IFC-SPF. ThatOpen's former IfcJsonExporter produced " +
      "web-ifc's OWN property JSON, which is a different shape from buildingSMART ifcJSON, " +
      "and its tutorial page is 404 in the current docs. No JavaScript reader for " +
      "buildingSMART ifcJSON was found.",
  },
  {
    tool: "A JSON-LD processor / triple store, on the .jsonld bundle",
    verdict: "reads",
    note:
      "The @graph is Building Topology Ontology (W3C LBD public draft, not a " +
      "Recommendation). The embedded ifcJSON is declared @type: @json, so it loads as one " +
      "opaque literal instead of thousands of junk triples. Not run against a specific " +
      "processor; the context uses only JSON-LD 1.1 features (@version, @type: @json).",
  },
]);

/** One sentence for a button label, so the UI cannot over-promise. */
export const IFCJSON_UI_LABEL =
  "ifcJSON (candidate) — for developers, data tools and linked-data pipelines. Not a BIM " +
  "handoff: for Revit, ArchiCAD or a building department, use the IFC4 (.ifc) export.";

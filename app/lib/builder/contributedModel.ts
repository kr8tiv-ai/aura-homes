/* =============================================================================
   CONTRIBUTED MODELS — a home model authored as DATA, by a person or an agent.

   WHAT THIS REPLACES. Until now, contributing a plan meant editing
   lib/builder/planCatalog.ts: PLAN_TEMPLATES is a TypeScript `as const` array
   built with three MODULE-PRIVATE helpers (`original`, `adapted`,
   `publicDomain`) over two more private helpers (`volume`, `opening`). There
   was no schema, no parser, no validator, no loader. A contribution was a pull
   request against a single large source file, which is a barrier a person
   without a checkout cannot cross and an agent cannot cross at all.

   THE HARD BOUNDARY THAT SHAPES THIS FILE. agent/ has zero imports from
   app/lib/builder/, so an MCP tool CANNOT construct a PlanTemplate — it cannot
   even name the type. The only contribution format that works across that line
   is plain JSON that both sides produce and validate independently. That is
   also, exactly, what a human contributor needs: a documented object they can
   write in a text editor, and a refusal that names the field it refused.

   WHAT THIS DELIBERATELY DOES NOT DO. It does not sell anything. No payment,
   no settlement, no payout, no creator revenue. The roadmap places the
   marketplace in arc 02 and this repository's rule is that nothing unbuilt is
   written in the present tense; the product's own footer says Aura Homes
   facilitates and is not a party to any purchase. A contributed model can be
   authored, validated, converted and listed. Money is not in this file, and a
   recorded asking price (see ../marketplace/modelListings) is a dated,
   sourced number, not a transaction.

   THE RIGHTS MODEL IS THE ASSET, AND IS REUSED RATHER THAN REDESIGNED.
   ContributedRights is a strict SUBSET of PlanSource — proved at compile time
   by CONTRIBUTED_RIGHTS_ARE_PLAN_SOURCE below — so a validated contribution
   drops into the same discriminated union the catalog already ships, with the
   same literal-typed `shareAlike` per arm, and satisfies the same assertions
   tests/plan-catalog.spec.ts already makes about https URLs, non-NC licences
   and 20-character attribution and change notices.

   The one arm a contribution may NOT use is `aura-authored`. That arm's
   `name` is the literal "Aura Homes"; a contributor signing it would be
   claiming authorship that is not theirs, and Aura vouching for a stranger's
   work would be the "vetted" failure this repository already refuses in
   lib/marketplace/suppliers.ts. A contributor's own original design enters as
   `licensed-adaptation` (they name a share-alike licence) or as
   `public-domain-adaptation` (they name a public-domain dedication such as
   CC0); in both cases `relationship` describes how the catalog record relates
   to the source they named, which for their own published design is exactly a
   dimensional adaptation of it.

   KNOWN GAP, STATED RATHER THAN PAPERED OVER. PlanSource has no arm for
   third-party original work under a PERMISSIVE, non-share-alike licence (MIT,
   CC BY 4.0): `licensed-adaptation` types `shareAlike` as the literal `true`.
   Recording `true` for a CC BY contribution would be a false legal claim, so
   such a record is refused with a problem string that says why. Closing that
   gap means adding a fourth arm to PlanSource in planCatalog.ts, which this
   module does not do.

   ---------------------------------------------------------------------------
   TWO LAYERS OF CHECKING, AND WHY THE SEAM IS WHERE IT IS (MK02).

   `collectContributedModelProblems` is the whole check and is what every
   caller should use. Underneath it are two layers that answer two different
   questions, and they are separately exported because they have different
   owners:

   1. SHAPE — `collectContributedModelShapeProblems`. "Is this a well-formed
      record?" This is the layer agent/src/mcp/tools.ts mirrors message for
      message, because an MCP client must get the same refusals without a
      checkout. tests/contributed-model.spec.ts pins the two implementations
      against each other, string for string, and names every divergence.

   2. CATALOGUE ADMISSION — `collectCatalogueAdmissionProblems`. "Would the
      record this converts to survive tests/plan-catalog.spec.ts?" It runs on
      the CONVERTED PlanTemplate — the actual artefact that lands — rather
      than on a paraphrase of it, and it needs `modelledGlazingRatio` and the
      NBC ceiling, neither of which agent/ can reach. A contribution that
      passes here and fails there would be a promise broken at the worst
      possible moment: after somebody did the work. The gates it mirrors, and
      the ones it deliberately cannot, are listed in CATALOGUE_GATES_MIRRORED
      and CATALOGUE_GATES_NOT_MIRRORED below.

   UNKNOWN KEYS ARE REFUSED BY NAME. Every record shape in this file carries an
   explicit key list, and a key outside it is a refusal that quotes the key.
   The alternative — the behaviour this replaced — was the worst of the three
   options available: `contributedModelToPlanTemplate` builds its output from a
   fixed field list, so a top-level field a contributor added was DROPPED, in
   silence, and the round-trip assertion could not see it because both
   directions went through the same fixed list. It neither worked nor said so.

   ---------------------------------------------------------------------------
   THE SHAPE IS A TREE, AND EVERY ANSWER IS COMPUTED FROM IT (MK03).

   MK02 left the contract as nine independent key lists and nine hand-written
   calls that walked them. That was complete when it was written and complete
   when it was read, and nothing anywhere held it to being complete: a tenth
   nested record could be added to the contract, and the only thing standing
   between it and an unwalked shape was somebody remembering. Worse, the
   round-trip gate's `lost`/`survived` computation ran against the TOP-LEVEL key
   list alone, so nested losslessness rested entirely on a `toEqual` over two
   fixtures — which fires only when the fixture happens to carry the field, and
   when it does fire reports an unlabelled object diff rather than the path that
   vanished.

   CONTRIBUTED_MODEL_SHAPE below is the one description of the accepted nested
   structure. Three functions read it and nothing else:

     collectUnknownKeyProblems  — refuse every key the contract does not name,
                                  at any depth, naming the PATH and the record
                                  whose key list is being quoted.
     contributedKeyPaths        — every accepted path a given record CARRIES.
     contributedContractKeyPaths— every accepted path the contract DECLARES.

   The last two are what let a round-trip gate say "envelope.volumes[0].roof
   .facing was dropped" instead of printing two objects side by side, and what
   let a fixture be held to exercising the whole contract rather than the part
   somebody happened to type. Wiring a new shape into the tree is what makes it
   checked; tests/contributed-model.spec.ts asserts every exported key list is
   reachable from the tree, so an unwired one goes red rather than unnoticed.
   ============================================================================= */

import type { ClimateZone, EcoMaterial } from "@/lib/designApi";
import { FDWR_MAX } from "@/lib/design/materials";
import type { PlanCostBasis, PlanSource, PlanTemplate } from "./planCatalog";
import { totalFloorAreaSqFt, type Deck, type HomeSpec, type Opening, type Roof, type RoofForm, type Siting, type Volume } from "./spec";
import { modelledGlazingRatio } from "./toPlan";

/** Self-describing envelope. A record without it is refused: an unversioned
 *  blob cannot be migrated later, and "which version is this?" is not a
 *  question a contributor should have to answer by guessing. */
export const CONTRIBUTED_MODEL_CONTRACT = "aura.contributed-model/v1";

/** Every contributed id carries this prefix, which no PLAN_TEMPLATES id does.
 *  planCatalog's `findTemplate` returns the FIRST id match, so a contribution
 *  sharing an id with a catalog plan would silently shadow or be shadowed by
 *  it. The prefix makes that collision structurally impossible instead of
 *  merely unlikely, without this module importing the catalog's data. */
export const CONTRIBUTED_ID_PREFIX = "contributed-";

/** tests/plan-catalog.spec.ts asserts every plan's instantiated document has
 *  more than 100 sq ft of floor area. A contribution that would fail that
 *  assertion is refused here rather than after it lands in the catalog. */
export const CATALOG_MINIMUM_FLOOR_AREA_SQFT = 100;

/* --------------------------------------------------------------- the rights */

export type ContributedRelationship = "dimensional-adaptation" | "system-informed-study";

/** Mirrors PlanSource's `licensed-adaptation` arm, field for field. */
export interface ContributedLicensedRights {
  kind: "licensed-adaptation";
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  changes: string;
  shareAlike: true;
  relationship: ContributedRelationship;
}

/** Mirrors PlanSource's `public-domain-adaptation` arm, field for field. */
export interface ContributedPublicDomainRights {
  kind: "public-domain-adaptation";
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  changes: string;
  shareAlike: false;
  relationship: ContributedRelationship;
}

export type ContributedRights = ContributedLicensedRights | ContributedPublicDomainRights;

/** A compile-time proof, not a comment: if PlanSource ever changes so that a
 *  ContributedRights value is no longer assignable to it, this line stops
 *  type-checking and `npx tsc --noEmit` says so. The alternative — discovering
 *  the drift when a contributed record fails to build a PlanTemplate at
 *  runtime — is how a catalog ships a record nobody can instantiate. */
export type ContributedRightsArePlanSource = ContributedRights extends PlanSource ? true : never;
export const CONTRIBUTED_RIGHTS_ARE_PLAN_SOURCE: ContributedRightsArePlanSource = true;

/* ------------------------------------------------------------- the envelope */

/** The dimensional envelope, taken straight off HomeSpec rather than
 *  re-declared. Reusing the Pick means a contribution can never drift from the
 *  shape the builder, the geometry, the plan bridge and the export already
 *  read — and `volumes` carries full, explicit Volume records, so nothing
 *  about a contributed home is filled in by a private default a contributor
 *  cannot see. */
export type ContributedEnvelope = Pick<
  HomeSpec,
  "material" | "climateZone" | "volumes" | "deck" | "siting"
>;

/* ---------------------------------------------------------------- the model */

export interface ContributedModel {
  contract: typeof CONTRIBUTED_MODEL_CONTRACT;
  id: string;
  title: string;
  kicker: string;
  summary: string;
  bestFor: string;
  bedrooms: number;
  bathrooms: number;
  sleeping: string;
  storeys: 1 | 2;
  tags: string[];
  features: string[];
  /** Optional by the same precedent as FinishedHomeModel's price.numeric: a
   *  record that does not state one serializes without the key. Absent means
   *  the catalog's modelled basis applies. */
  costBasis?: PlanCostBasis;
  envelope: ContributedEnvelope;
  notes: string;
  rights: ContributedRights;
}

export type ContributionRefusal = { ok: false; problem: string };
export type ContributionCheck = { ok: true; model: ContributedModel } | ContributionRefusal;

/* ------------------------------------------------------------- the key sets

   THE CONTRACT IS THE KEY LIST, NOT JUST THE TYPES. A TypeScript interface
   disappears at runtime, and JSON arrives at runtime. These lists are the
   runtime half of the same contract: they drive the unknown-key refusals
   below, and each is proved against its own interface at compile time by the
   `…_KEYS_ARE_COMPLETE` constants, using the same technique as
   CONTRIBUTED_RIGHTS_ARE_PLAN_SOURCE above. Adding a field to an interface
   without adding it here stops `npx tsc --noEmit`; adding it here without
   teaching `contributedModelToPlanTemplate` about it fails the round-trip
   assertion in tests/contributed-model.spec.ts, by name. */

export const CONTRIBUTED_MODEL_KEYS = [
  "contract",
  "id",
  "title",
  "kicker",
  "summary",
  "bestFor",
  "bedrooms",
  "bathrooms",
  "sleeping",
  "storeys",
  "tags",
  "features",
  "costBasis",
  "envelope",
  "notes",
  "rights",
] as const;

export const CONTRIBUTED_RIGHTS_KEYS = [
  "kind",
  "name",
  "url",
  "license",
  "licenseUrl",
  "attribution",
  "changes",
  "shareAlike",
  "relationship",
] as const;

export const CONTRIBUTED_ENVELOPE_KEYS = ["material", "climateZone", "volumes", "deck", "siting"] as const;

export const CONTRIBUTED_VOLUME_KEYS = [
  "id",
  "name",
  "widthFt",
  "depthFt",
  "x",
  "z",
  "rotationDeg",
  "storeys",
  "wallHeightFt",
  "roof",
  "openings",
] as const;

export const CONTRIBUTED_ROOF_KEYS = ["form", "pitchDeg", "overhangFt", "facing"] as const;

export const CONTRIBUTED_OPENING_KEYS = [
  "id",
  "wall",
  "kind",
  "widthFt",
  "heightFt",
  "offsetFt",
  "sillFt",
] as const;

export const CONTRIBUTED_DECK_KEYS = ["wall", "widthFt", "depthFt", "hotTub"] as const;

export const CONTRIBUTED_SITING_KEYS = ["frontFacesDeg", "slope"] as const;

export const CONTRIBUTED_COST_BASIS_KEYS = ["status", "label", "note"] as const;

/** `true` only when the list and the interface name exactly the same keys in
 *  both directions. A missing key and a stale key are both errors here. */
type KeysMatch<Interface, Listed extends string> = [
  Exclude<keyof Interface, Listed>,
  Exclude<Listed, keyof Interface>,
] extends [never, never]
  ? true
  : never;

export const CONTRIBUTED_KEY_SETS_ARE_COMPLETE: [
  KeysMatch<ContributedModel, (typeof CONTRIBUTED_MODEL_KEYS)[number]>,
  KeysMatch<ContributedRights, (typeof CONTRIBUTED_RIGHTS_KEYS)[number]>,
  KeysMatch<ContributedEnvelope, (typeof CONTRIBUTED_ENVELOPE_KEYS)[number]>,
  KeysMatch<Volume, (typeof CONTRIBUTED_VOLUME_KEYS)[number]>,
  KeysMatch<Roof, (typeof CONTRIBUTED_ROOF_KEYS)[number]>,
  KeysMatch<Opening, (typeof CONTRIBUTED_OPENING_KEYS)[number]>,
  KeysMatch<Deck, (typeof CONTRIBUTED_DECK_KEYS)[number]>,
  KeysMatch<Siting, (typeof CONTRIBUTED_SITING_KEYS)[number]>,
  KeysMatch<PlanCostBasis, (typeof CONTRIBUTED_COST_BASIS_KEYS)[number]>,
] = [true, true, true, true, true, true, true, true, true];

/* -------------------------------------------------------- the shape, as a tree

   The nine key lists above say WHICH keys each record may carry. This says how
   the records NEST, which is the half that was missing: without it, every
   answer about the contract below the top level had to be hand-written at the
   call site, and a hand-written walk is complete only until the next field.

   `label` is not decoration. The old refusal for a key three levels down read
   "… is not a field of aura.contributed-model/v1. This contract carries
   exactly: form, pitchDeg, overhangFt, facing." — which names the path (good)
   and then tells the contributor that the whole contract carries four keys,
   which is false. The label says whose key list is being quoted. It opens a
   sentence, so it is capitalised. */

export interface ContributedShape {
  /** how a refusal names this record: "A roof record carries exactly: …" */
  readonly label: string;
  readonly keys: readonly string[];
  /** keys whose value is itself a checked record, or an array of them */
  readonly children?: Readonly<Record<string, ContributedShapeChild>>;
}

export interface ContributedShapeChild {
  readonly at: "record" | "array";
  readonly shape: ContributedShape;
}

export const CONTRIBUTED_OPENING_SHAPE: ContributedShape = {
  label: "An opening record",
  keys: CONTRIBUTED_OPENING_KEYS,
};

export const CONTRIBUTED_ROOF_SHAPE: ContributedShape = {
  label: "A roof record",
  keys: CONTRIBUTED_ROOF_KEYS,
};

export const CONTRIBUTED_VOLUME_SHAPE: ContributedShape = {
  label: "A volume record",
  keys: CONTRIBUTED_VOLUME_KEYS,
  children: {
    roof: { at: "record", shape: CONTRIBUTED_ROOF_SHAPE },
    openings: { at: "array", shape: CONTRIBUTED_OPENING_SHAPE },
  },
};

export const CONTRIBUTED_DECK_SHAPE: ContributedShape = {
  label: "A deck record",
  keys: CONTRIBUTED_DECK_KEYS,
};

export const CONTRIBUTED_SITING_SHAPE: ContributedShape = {
  label: "The siting record",
  keys: CONTRIBUTED_SITING_KEYS,
};

export const CONTRIBUTED_ENVELOPE_SHAPE: ContributedShape = {
  label: "The envelope record",
  keys: CONTRIBUTED_ENVELOPE_KEYS,
  children: {
    volumes: { at: "array", shape: CONTRIBUTED_VOLUME_SHAPE },
    /** `deck` is legitimately null; the walk simply does not descend into a
     *  non-record, so an explicit null is neither refused nor walked. */
    deck: { at: "record", shape: CONTRIBUTED_DECK_SHAPE },
    siting: { at: "record", shape: CONTRIBUTED_SITING_SHAPE },
  },
};

export const CONTRIBUTED_RIGHTS_SHAPE: ContributedShape = {
  label: "The rights record",
  keys: CONTRIBUTED_RIGHTS_KEYS,
};

export const CONTRIBUTED_COST_BASIS_SHAPE: ContributedShape = {
  label: "A cost-basis record",
  keys: CONTRIBUTED_COST_BASIS_KEYS,
};

export const CONTRIBUTED_MODEL_SHAPE: ContributedShape = {
  label: "The model record",
  keys: CONTRIBUTED_MODEL_KEYS,
  children: {
    rights: { at: "record", shape: CONTRIBUTED_RIGHTS_SHAPE },
    envelope: { at: "record", shape: CONTRIBUTED_ENVELOPE_SHAPE },
    costBasis: { at: "record", shape: CONTRIBUTED_COST_BASIS_SHAPE },
  },
};

/* ----------------------------------------------------------------- checking */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `a.b` at depth, and the bare key at the root, so a top-level refusal reads
 *  `energyRating …` rather than `.energyRating …`. */
const joinPath = (at: string, key: string): string => (at === "" ? key : `${at}.${key}`);

/**
 * Every key on this record, AT ANY DEPTH, that the contract does not name —
 * each refused by its full PATH.
 *
 * WHY REFUSE RATHER THAN IGNORE. Three options exist for a field nobody asked
 * for: carry it (this contract cannot — `contributedModelToPlanTemplate` emits
 * exactly the PlanTemplate interface, and a catalog record with mystery keys is
 * a catalog nobody can migrate), drop it, or refuse it. Dropping is the one
 * that is silently wrong: the contributor's file still has the field, the
 * catalog record does not, nothing anywhere says so, and the loss only ever
 * surfaces as a bug report about missing data months later. Refusing costs the
 * contributor one edit and tells them exactly which one.
 *
 * WHY THE PATH AND NOT THE KEY. A contributor told `colour is not a field` has
 * to guess which of the roofs in a three-volume model they typed it on. The
 * refusal reads `envelope.volumes[1].roof.colour`, which is a place they can
 * open their editor to.
 *
 * REPLACES the two functions MK02 shipped — `unknownKeyProblems(record,
 * allowed, at)` called from nine sites, and `unknownTopLevelKeyProblems`. Both
 * behaviours are kept: the `at`-prefixed path, the quoted allowed list, the
 * contract name and the "refused rather than dropped in silence" sentence. Two
 * things changed on purpose. The quoted list is now introduced by the record it
 * belongs to instead of by "This contract", which was false for every nested
 * shape. And unknown keys are now reported as one depth-first block ahead of
 * the type and range problems rather than interleaved with them — same set,
 * different order.
 */
export function collectUnknownKeyProblems(
  value: unknown,
  shape: ContributedShape = CONTRIBUTED_MODEL_SHAPE,
  at = "",
): string[] {
  if (!isObject(value)) return [];
  const problems: string[] = [];
  for (const key of Object.keys(value)) {
    if (shape.keys.includes(key)) continue;
    problems.push(
      `${joinPath(at, key)} is not a field of ${CONTRIBUTED_MODEL_CONTRACT}. ${shape.label} carries exactly: ` +
        `${shape.keys.join(", ")}. A field the contract does not name cannot be carried into the catalog, ` +
        `so it is refused rather than dropped in silence.`,
    );
  }
  for (const [key, child] of Object.entries(shape.children ?? {})) {
    const held = value[key];
    const path = joinPath(at, key);
    if (child.at === "record") {
      problems.push(...collectUnknownKeyProblems(held, child.shape, path));
    } else if (Array.isArray(held)) {
      held.forEach((entry, index) => {
        problems.push(...collectUnknownKeyProblems(entry, child.shape, `${path}[${index}]`));
      });
    }
  }
  return problems;
}

/**
 * Every accepted path this record actually CARRIES, depth first, arrays
 * indexed — `envelope.volumes[0].roof.facing`, not `envelope`.
 *
 * This is the round-trip gate's eyes. Comparing the paths a record carries
 * before and after conversion names what vanished; comparing the records
 * themselves prints two objects and leaves the reader to find the difference,
 * which is what the gate did before this and why it could only see the top
 * level. Keys the contract does NOT name are deliberately absent: they are
 * refused by `collectUnknownKeyProblems`, and a validated record has none.
 */
export function contributedKeyPaths(
  value: unknown,
  shape: ContributedShape = CONTRIBUTED_MODEL_SHAPE,
  at = "",
): string[] {
  if (!isObject(value)) return [];
  const paths: string[] = [];
  for (const key of shape.keys) {
    if (!(key in value)) continue;
    const path = joinPath(at, key);
    paths.push(path);
    const child = shape.children?.[key];
    if (!child) continue;
    const held = value[key];
    if (child.at === "record") {
      paths.push(...contributedKeyPaths(held, child.shape, path));
    } else if (Array.isArray(held)) {
      held.forEach((entry, index) => {
        paths.push(...contributedKeyPaths(entry, child.shape, `${path}[${index}]`));
      });
    }
  }
  return paths;
}

/**
 * Every accepted path the contract DECLARES, with `[0]` standing for an array
 * member — the yardstick a fixture is held against.
 *
 * A fixture that carries a subset of these is a fixture that stops exercising
 * whatever it omits, and the round-trip assertion it feeds quietly stops
 * covering that field. `roof.facing` was exactly that: accepted by the
 * validator, absent from the fixture, and therefore outside the reach of every
 * assertion in the spec that reads the fixture.
 */
export function contributedContractKeyPaths(
  shape: ContributedShape = CONTRIBUTED_MODEL_SHAPE,
  at = "",
): string[] {
  const paths: string[] = [];
  for (const key of shape.keys) {
    const path = joinPath(at, key);
    paths.push(path);
    const child = shape.children?.[key];
    if (!child) continue;
    paths.push(...contributedContractKeyPaths(child.shape, child.at === "array" ? `${path}[0]` : path));
  }
  return paths;
}

const filled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const ROOF_FORMS: readonly RoofForm[] = ["gable", "a-frame", "shed", "flat", "saltbox"];
const WALLS = ["n", "s", "e", "w"] as const;
const MATERIALS: readonly EcoMaterial[] = ["sip", "rammed_earth", "clt", "timber_frame"];
const CLIMATE_ZONES: readonly ClimateZone[] = ["4", "5", "6", "7A", "7B", "8"];
const SLOPES = ["flat", "gentle", "steep"] as const;
const RELATIONSHIPS: readonly ContributedRelationship[] = [
  "dimensional-adaptation",
  "system-informed-study",
];

/** Licences that forbid the thing this catalog does. NC forbids the commercial
 *  use the catalog is for (already asserted in plan-catalog.spec); ND forbids
 *  adaptation, which is what every non-Aura entry in this catalog IS. */
const NONCOMMERCIAL = /\bNC\b|non-?commercial/i;
const NO_DERIVATIVES = /\bND\b|no-?derivat/i;

/** A public-domain claim must name its legal basis. Same vocabulary the
 *  catalog spec already enforces on PLAN_TEMPLATES. */
const PUBLIC_DOMAIN_BASIS = /17 USC 105|public domain|not in copyright/i;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function rightsProblems(value: unknown): string[] {
  if (!isObject(value)) return ["rights is missing — a model with no stated provenance cannot be accepted."];
  const problems: string[] = [];
  const kind = value.kind;

  /* THESE TWO WERE EARLY RETURNS, AND THAT MADE THE DOCSTRING FALSE (MK02).
     `collectContributedModelProblems` promises every reason in one pass; a
     record with a bad `kind` AND a missing attribution used to be handed back
     one problem, fixed, and then handed the next one — exactly the loop the
     list form exists to avoid. The kind problem is now recorded and the rest
     of the block is still checked. Only the ARM-SPECIFIC checks (which arm's
     shareAlike rule applies, whether a public-domain basis is named) are
     skipped, because without a valid arm there is no arm rule to apply. */
  const namedArm = kind === "licensed-adaptation" || kind === "public-domain-adaptation";
  if (kind === "aura-authored") {
    problems.push(
      "rights.kind is \"aura-authored\", which only Aura Homes may sign. Contribute under " +
        "\"licensed-adaptation\" (naming a share-alike licence) or \"public-domain-adaptation\" " +
        "(naming a public-domain dedication).",
    );
  } else if (!namedArm) {
    problems.push("rights.kind must be \"licensed-adaptation\" or \"public-domain-adaptation\".");
  }

  /* the unknown-key walk that used to sit here is now one recursive pass over
     CONTRIBUTED_MODEL_SHAPE in collectContributedModelShapeProblems */
  if (!filled(value.name)) problems.push("rights.name does not say whose work this is.");
  if (!filled(value.url) || !/^https:\/\//.test(value.url as string))
    problems.push("rights.url must be an https:// link to the source that can be opened and checked.");
  if (!filled(value.licenseUrl) || !/^https:\/\//.test(value.licenseUrl as string))
    problems.push("rights.licenseUrl must be an https:// link to the licence or rights statement itself.");
  if (!filled(value.license)) {
    problems.push("rights.license does not name the terms this work is offered under.");
  } else {
    const license = value.license as string;
    if (NONCOMMERCIAL.test(license))
      problems.push("rights.license is noncommercial; this catalog permits commercial use and cannot carry it.");
    if (NO_DERIVATIVES.test(license))
      problems.push("rights.license forbids derivatives; every non-Aura entry in this catalog is an adaptation.");
  }
  if (!filled(value.attribution) || (value.attribution as string).trim().length <= 20)
    problems.push("rights.attribution must be a real credit line of more than 20 characters, not a placeholder.");
  if (!filled(value.changes) || (value.changes as string).trim().length <= 20)
    problems.push("rights.changes must state, in more than 20 characters, what was changed from the source.");
  if (!RELATIONSHIPS.includes(value.relationship as ContributedRelationship))
    problems.push(
      "rights.relationship must be \"dimensional-adaptation\" or \"system-informed-study\".",
    );

  if (kind === "licensed-adaptation" && value.shareAlike !== true)
    problems.push(
      "rights.shareAlike must be true on a licensed-adaptation. PlanSource has no arm for " +
        "third-party original work under a permissive, non-share-alike licence, and recording " +
        "true for a permissive licence would be a false legal claim — offer the work under a " +
        "share-alike licence or a public-domain dedication instead.",
    );
  if (kind === "public-domain-adaptation") {
    if (value.shareAlike !== false)
      problems.push("rights.shareAlike must be false on a public-domain-adaptation — no licence survives to pass on.");
    if (filled(value.license) && !PUBLIC_DOMAIN_BASIS.test(value.license as string))
      problems.push(
        "rights.license must name the public-domain basis (for example \"17 USC 105\", " +
          "\"CC0 1.0 public domain dedication\", or \"not in copyright\").",
      );
  }
  return problems;
}

function openingProblems(volumeIndex: number, volume: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const openings = volume.openings;
  const at = `envelope.volumes[${volumeIndex}]`;
  if (!Array.isArray(openings)) {
    problems.push(`${at}.openings must be an array (an empty array is allowed).`);
    return problems;
  }
  const widthFt = finite(volume.widthFt) ? volume.widthFt : 0;
  const depthFt = finite(volume.depthFt) ? volume.depthFt : 0;
  const storeys = volume.storeys === 2 ? 2 : 1;
  const wallHeightFt = finite(volume.wallHeightFt) ? volume.wallHeightFt : 0;
  const seen = new Set<string>();
  openings.forEach((raw, index) => {
    const where = `${at}.openings[${index}]`;
    if (!isObject(raw)) {
      problems.push(`${where} is not a record.`);
      return;
    }
    if (!filled(raw.id)) problems.push(`${where}.id is missing.`);
    else if (seen.has(raw.id)) problems.push(`${where}.id "${raw.id}" is used twice in the same volume.`);
    else seen.add(raw.id);
    if (!WALLS.includes(raw.wall as (typeof WALLS)[number]))
      problems.push(`${where}.wall must be one of n, s, e, w.`);
    if (raw.kind !== "window" && raw.kind !== "door" && raw.kind !== "glazing-wall")
      problems.push(`${where}.kind must be window, door or glazing-wall.`);
    if (!finite(raw.widthFt) || raw.widthFt <= 0) problems.push(`${where}.widthFt must be a positive number.`);
    if (!finite(raw.heightFt) || raw.heightFt <= 0) problems.push(`${where}.heightFt must be a positive number.`);
    if (!finite(raw.offsetFt) || raw.offsetFt < 0) problems.push(`${where}.offsetFt must be zero or greater.`);
    if (!finite(raw.sillFt) || raw.sillFt < 0) problems.push(`${where}.sillFt must be zero or greater.`);
    if (finite(raw.widthFt) && finite(raw.offsetFt)) {
      const run = raw.wall === "n" || raw.wall === "s" ? widthFt : depthFt;
      if (raw.offsetFt + raw.widthFt > run + 1e-9)
        problems.push(
          `${where} runs past the end of its wall: offsetFt ${raw.offsetFt} + widthFt ${raw.widthFt} exceeds the ${run} ft wall.`,
        );
    }
    if (finite(raw.heightFt) && finite(raw.sillFt)) {
      const available = wallHeightFt * storeys;
      if (raw.sillFt + raw.heightFt > available + 0.01)
        problems.push(
          `${where} is taller than its wall: sillFt ${raw.sillFt} + heightFt ${raw.heightFt} exceeds the ${available} ft available.`,
        );
    }
  });
  return problems;
}

function envelopeProblems(value: unknown): string[] {
  if (!isObject(value)) return ["envelope is missing — a model with no dimensions is not a model."];
  const problems: string[] = [];

  if (!MATERIALS.includes(value.material as EcoMaterial))
    problems.push(`envelope.material must be one of ${MATERIALS.join(", ")}.`);
  if (!CLIMATE_ZONES.includes(value.climateZone as ClimateZone))
    problems.push(`envelope.climateZone must be one of ${CLIMATE_ZONES.join(", ")}.`);

  const siting = value.siting;
  if (!isObject(siting)) {
    problems.push("envelope.siting is missing.");
  } else {
    if (!finite(siting.frontFacesDeg) || siting.frontFacesDeg < 0 || siting.frontFacesDeg > 360)
      problems.push("envelope.siting.frontFacesDeg must be a compass bearing between 0 and 360.");
    if (!SLOPES.includes(siting.slope as (typeof SLOPES)[number]))
      problems.push("envelope.siting.slope must be flat, gentle or steep.");
  }

  const deck = value.deck;
  if (deck !== null) {
    if (!isObject(deck)) {
      problems.push("envelope.deck must be a deck record or an explicit null.");
    } else {
      if (!WALLS.includes(deck.wall as (typeof WALLS)[number]))
        problems.push("envelope.deck.wall must be one of n, s, e, w.");
      if (!finite(deck.widthFt) || deck.widthFt <= 0)
        problems.push("envelope.deck.widthFt must be a positive number.");
      if (!finite(deck.depthFt) || deck.depthFt <= 0)
        problems.push("envelope.deck.depthFt must be a positive number.");
      if (typeof deck.hotTub !== "boolean")
        problems.push("envelope.deck.hotTub must be true or false.");
    }
  }

  const volumes = value.volumes;
  if (!Array.isArray(volumes) || volumes.length === 0) {
    problems.push("envelope.volumes must contain at least one volume.");
    return problems;
  }
  const ids = new Set<string>();
  volumes.forEach((raw, index) => {
    const at = `envelope.volumes[${index}]`;
    if (!isObject(raw)) {
      problems.push(`${at} is not a record.`);
      return;
    }
    if (!filled(raw.id)) problems.push(`${at}.id is missing.`);
    else if (ids.has(raw.id)) problems.push(`${at}.id "${raw.id}" is used twice.`);
    else ids.add(raw.id);
    if (!filled(raw.name)) problems.push(`${at}.name is missing.`);
    if (!finite(raw.widthFt) || raw.widthFt <= 0) problems.push(`${at}.widthFt must be a positive number.`);
    if (!finite(raw.depthFt) || raw.depthFt <= 0) problems.push(`${at}.depthFt must be a positive number.`);
    if (!finite(raw.x)) problems.push(`${at}.x must be a number.`);
    if (!finite(raw.z)) problems.push(`${at}.z must be a number.`);
    if (!finite(raw.rotationDeg)) problems.push(`${at}.rotationDeg must be a number.`);
    if (raw.storeys !== 1 && raw.storeys !== 2) problems.push(`${at}.storeys must be 1 or 2.`);
    if (!finite(raw.wallHeightFt) || raw.wallHeightFt <= 0)
      problems.push(`${at}.wallHeightFt must be a positive number.`);
    const roof = raw.roof;
    if (!isObject(roof)) {
      problems.push(`${at}.roof is missing.`);
    } else {
      if (!ROOF_FORMS.includes(roof.form as RoofForm))
        problems.push(`${at}.roof.form must be one of ${ROOF_FORMS.join(", ")}.`);
      if (!finite(roof.pitchDeg) || roof.pitchDeg < 0 || roof.pitchDeg >= 90)
        problems.push(`${at}.roof.pitchDeg must be between 0 and 90 degrees.`);
      if (!finite(roof.overhangFt) || roof.overhangFt < 0)
        problems.push(`${at}.roof.overhangFt must be zero or greater.`);
      if (roof.facing !== undefined && !WALLS.includes(roof.facing as (typeof WALLS)[number]))
        problems.push(`${at}.roof.facing, when present, must be one of n, s, e, w.`);
    }
    problems.push(...openingProblems(index, raw));
  });

  if (problems.length === 0) {
    const area = (volumes as Array<{ widthFt: number; depthFt: number; storeys: number }>).reduce(
      (sum, item) => sum + item.widthFt * item.depthFt * item.storeys,
      0,
    );
    if (area <= CATALOG_MINIMUM_FLOOR_AREA_SQFT)
      problems.push(
        `envelope.volumes total ${area} sq ft of floor area; the catalog contract requires more than ` +
          `${CATALOG_MINIMUM_FLOOR_AREA_SQFT} sq ft.`,
      );
  }
  return problems;
}

/**
 * Every reason this record is not a WELL-FORMED contributed model, in one pass.
 *
 * The list form is the primary one because it is what a contributor — human or
 * agent — actually needs: fixing one refusal only to be handed the next one is
 * a bad loop to put a person in, and a worse one to put a model in.
 *
 * THIS IS THE MIRRORED LAYER. The MCP tool `validate_contributed_model`
 * reimplements exactly these checks on the agent side (agent/ cannot import
 * this file) and tests/contributed-model.spec.ts pins the two lists against
 * each other, string for string, over ~200 mutated records.
 *
 * It is deliberately NOT the whole check. `collectContributedModelProblems`
 * adds the catalogue-admission layer on top; call that one unless you are
 * specifically comparing against the agent.
 */
export function collectContributedModelShapeProblems(value: unknown): string[] {
  if (!isObject(value)) return ["A contributed model must be a JSON object."];
  const problems: string[] = [];

  /* ONE recursive pass for every unknown key at every depth, ahead of the type
     and range checks. It used to be nine hand-written calls interleaved with
     them; the set of refusals is the same, the order is now depth-first, and
     the coverage is now a property of CONTRIBUTED_MODEL_SHAPE rather than of
     somebody having remembered all nine. */
  problems.push(...collectUnknownKeyProblems(value));
  if (value.contract !== CONTRIBUTED_MODEL_CONTRACT)
    problems.push(`contract must be "${CONTRIBUTED_MODEL_CONTRACT}".`);
  if (!filled(value.id)) {
    problems.push("id is missing.");
  } else {
    const id = value.id as string;
    if (!id.startsWith(CONTRIBUTED_ID_PREFIX))
      problems.push(
        `id must start with "${CONTRIBUTED_ID_PREFIX}" so it can never collide with a catalog plan id.`,
      );
    if (!SLUG.test(id)) problems.push("id must be a lower-case slug: letters, digits and single hyphens.");
  }
  for (const field of ["title", "kicker", "summary", "bestFor", "sleeping", "notes"] as const) {
    if (!filled(value[field])) problems.push(`${field} is missing.`);
  }
  if (!finite(value.bedrooms) || value.bedrooms < 0 || !Number.isInteger(value.bedrooms))
    problems.push("bedrooms must be a whole number of zero or more.");
  if (!finite(value.bathrooms) || value.bathrooms <= 0)
    problems.push("bathrooms must be greater than zero — every home in this catalog has one.");
  if (value.storeys !== 1 && value.storeys !== 2) problems.push("storeys must be 1 or 2.");
  for (const field of ["tags", "features"] as const) {
    const list = value[field];
    if (!Array.isArray(list) || list.length === 0) {
      problems.push(`${field} must be a non-empty array of strings.`);
    } else if (!list.every((entry) => filled(entry))) {
      problems.push(`${field} contains an empty entry.`);
    }
  }
  if ("costBasis" in value && value.costBasis !== undefined) {
    const basis = value.costBasis;
    if (!isObject(basis)) {
      problems.push("costBasis, when present, must be a record.");
    } else {
      if (basis.status !== "modelled" && basis.status !== "proxy")
        problems.push("costBasis.status must be \"modelled\" or \"proxy\".");
      if (!filled(basis.label)) problems.push("costBasis.label is missing.");
      if (!filled(basis.note)) problems.push("costBasis.note is missing.");
    }
  }
  problems.push(...rightsProblems(value.rights));
  problems.push(...envelopeProblems(value.envelope));
  return problems;
}

/**
 * EVERY reason this record cannot be accepted: well-formedness AND catalogue
 * admission, in one pass.
 *
 * This is the function every caller in the app uses, and the one whose
 * emptiness `validateContributedModel` and `listContributedModel` treat as
 * "yes". The catalogue layer runs only once the shape layer is clean, and that
 * is not the early-return sin the shape layer was just cured of: the catalogue
 * checks run on the CONVERTED PlanTemplate, and a record that is not a
 * well-formed ContributedModel cannot be converted at all. There is no
 * catalogue answer being withheld — there is no catalogue answer yet.
 */
export function collectContributedModelProblems(value: unknown): string[] {
  const shape = collectContributedModelShapeProblems(value);
  if (shape.length > 0) return shape;
  return collectCatalogueAdmissionProblems(contributedModelToPlanTemplate(value as ContributedModel));
}

/** The repo-standard refusal shape: the FIRST problem, named. */
export function validateContributedModel(value: unknown): ContributionCheck {
  const problems = collectContributedModelProblems(value);
  if (problems.length > 0) return { ok: false, problem: problems[0] };
  return { ok: true, model: value as unknown as ContributedModel };
}

/* -------------------------------------------------------------- conversion */

/**
 * The provenance sentence embedded in the instantiated spec's notes.
 *
 * This is a DELIBERATE MIRROR of the private `adapted()` and `publicDomain()`
 * helpers in planCatalog.ts (which this node may not edit — PL01 owns that
 * file). Mirroring a private helper can drift, so the drift is made loud:
 * tests/contributed-model.spec.ts takes real PLAN_TEMPLATES entries of each
 * non-Aura arm and asserts their shipped `spec.notes` begin with exactly what
 * this function produces from their own `source`. If planCatalog's wording
 * changes, that assertion fails and names this function.
 */
export function provenanceNotice(rights: ContributedRights): string {
  return rights.kind === "public-domain-adaptation"
    ? `${rights.attribution} ${rights.changes} Rights: ${rights.license} (${rights.licenseUrl}). Source: ${rights.url}.`
    : `${rights.attribution} ${rights.changes} Licensed ${rights.license}: ${rights.licenseUrl}. Source: ${rights.url}.`;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * A validated contribution becomes a PlanTemplate — the same record shape the
 * curated catalog ships, satisfying the same assertions.
 *
 * The input type is `ContributedModel`, so a record without rights is
 * unspellable here: the refusal is not a runtime courtesy, it is the only way
 * to obtain the argument.
 */
export function contributedModelToPlanTemplate(model: ContributedModel): PlanTemplate {
  const notice = provenanceNotice(model.rights);
  const spec: HomeSpec = {
    version: 1,
    name: model.title,
    material: model.envelope.material,
    climateZone: model.envelope.climateZone,
    volumes: clone(model.envelope.volumes),
    deck: clone(model.envelope.deck),
    siting: clone(model.envelope.siting),
    notes: `${notice}\n\n${model.notes}`,
  };
  const plan: PlanTemplate = {
    id: model.id,
    title: model.title,
    kicker: model.kicker,
    summary: model.summary,
    bestFor: model.bestFor,
    bedrooms: model.bedrooms,
    bathrooms: model.bathrooms,
    sleeping: model.sleeping,
    storeys: model.storeys,
    tags: [...model.tags],
    features: [...model.features],
    ...(model.costBasis ? { costBasis: clone(model.costBasis) } : {}),
    source: clone(model.rights),
    spec,
  };
  return plan;
}

/**
 * The inverse. It REFUSES rather than guesses: an Aura-authored plan is not a
 * contribution, and a plan whose notes do not begin with exactly the notice
 * its own rights produce is a plan this module did not build, so reversing it
 * would be reconstruction, not inversion.
 */
export function planTemplateToContributedModel(
  plan: PlanTemplate,
): { ok: true; model: ContributedModel } | ContributionRefusal {
  if (plan.source.kind === "aura-authored")
    return {
      ok: false,
      problem: "source.kind is \"aura-authored\": an Aura catalog plan is not a contributed model.",
    };
  const rights = clone(plan.source) as ContributedRights;
  const prefix = `${provenanceNotice(rights)}\n\n`;
  if (!plan.spec.notes.startsWith(prefix))
    return {
      ok: false,
      problem:
        "spec.notes does not begin with the provenance notice these rights produce, so the " +
        "contributor's own notes cannot be recovered without inventing them.",
    };
  const model: ContributedModel = {
    contract: CONTRIBUTED_MODEL_CONTRACT,
    id: plan.id,
    title: plan.title,
    kicker: plan.kicker,
    summary: plan.summary,
    bestFor: plan.bestFor,
    bedrooms: plan.bedrooms,
    bathrooms: plan.bathrooms,
    sleeping: plan.sleeping,
    storeys: plan.storeys,
    tags: [...plan.tags],
    features: [...plan.features],
    ...(plan.costBasis ? { costBasis: clone(plan.costBasis) } : {}),
    envelope: {
      material: plan.spec.material,
      climateZone: plan.spec.climateZone,
      volumes: clone(plan.spec.volumes),
      deck: clone(plan.spec.deck),
      siting: clone(plan.spec.siting),
    },
    notes: plan.spec.notes.slice(prefix.length),
    rights,
  };
  return { ok: true, model };
}

/* -------------------------------------------------- catalogue admission

   THE PROMISE THIS SECTION KEEPS. Everything above answers "is this record
   well-formed?". This answers the question the contributor actually cares
   about: "if I hand this in, does it land?" tests/plan-catalog.spec.ts holds
   the catalog to a set of gates. A contribution that validates here and then
   fails one of those is a promise broken at the worst possible moment — after
   somebody did the work, and in a pull request they cannot debug.

   THESE PREDICATES MIRROR tests/plan-catalog.spec.ts, WHICH THIS NODE DOES NOT
   OWN, and a mirror drifts. The drift is made loud rather than trusted, the
   same way `provenanceNotice` handles it: tests/contributed-model.spec.ts runs
   this function over every shipped PLAN_TEMPLATES record and asserts it refuses
   none of them except the two the catalog spec itself grandfathers. A gate that
   fails honest work goes red immediately; a gate the catalog ADDS and this
   misses can only be caught by re-reading, which is why the two lists below are
   written down instead of being implied by the code. */

/** The shared thumbnail span in components/builder/PlanDiagram.tsx. One
 *  oversized record silently shrinks every diagram in the catalog. */
export const CATALOG_MAX_SPAN_FT = 44;

/** A proxy cost basis that does not say what it is a proxy FOR is just a
 *  label; the catalog spec requires a real sentence. */
export const CATALOG_PROXY_NOTE_MIN_CHARS = 60;

/** Gates of tests/plan-catalog.spec.ts that a contribution is checked against
 *  BEFORE it is accepted, so it cannot fail them after landing. */
export const CATALOGUE_GATES_MIRRORED = [
  "floor area over the catalog minimum",
  "openings inside their walls, ids unique per volume",
  "no two openings interpenetrate on the same wall in both axes",
  "glazing disclosure above the NBC 9.36 prescriptive ceiling",
  "no over-ceiling disclosure worn by a plan under the ceiling",
  "every glazing percentage a plan states about itself tracks its geometry",
  "no plan wider than the shared thumbnail span",
  "a proxy cost basis names what the Alberta BOM is not modelling",
  "https source and licence urls, non-NC licence, attribution and change notice",
] as const;

/** Gates this module CANNOT mirror, named rather than left as a surprise.
 *  Both are cross-record properties: they are facts about a contribution's
 *  relationship to the other 55 plans, and this module deliberately holds no
 *  reference to the catalog's data (see CONTRIBUTED_ID_PREFIX above). They are
 *  the submissions queue's job, not the record validator's. */
export const CATALOGUE_GATES_NOT_MIRRORED = [
  "no two plans are the same building wearing a different name — needs PLAN_TEMPLATES to compare against",
  "first-volume elevations do not collapse onto a handful of patterns — needs the whole library",
] as const;

/* The catalog spec's own wording, restated. Each is the exact expression
   tests/plan-catalog.spec.ts uses; changing one here without changing it there
   makes this module refuse records the catalog would accept. */
const GLAZING_CEILING_NAMED = /22% NBC 9\.36 prescriptive ceiling/;
const GLAZING_OVER_CEILING_CLAIM = /above the 22% NBC 9\.36 prescriptive ceiling/;
const GLAZING_COMPLIANCE_PATH = /performance path|performance model|trade-off path/i;
const GLAZING_COLD_COST = /heat loss|heat-loss|loses heat|overheat/i;
const GLAZING_STATED_PATTERNS = [/modelled at (\d{1,3})% glazing/, /(\d{1,3})% of the modelled wall area/];
const PROXY_LABEL = /proxy/i;
const PROXY_NOTE_NAMES_ITS_LIMIT = /quote|supplier|advisor|engineering/i;

/** The plan's bounding span in feet, rotation included — the same computation
 *  the catalog spec makes, and the same one PlanDiagram draws with. */
function planSpanFt(spec: HomeSpec): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of spec.volumes) {
    const rad = (v.rotationDeg * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    const halfW = (v.widthFt * c + v.depthFt * s) / 2;
    const halfD = (v.widthFt * s + v.depthFt * c) / 2;
    minX = Math.min(minX, v.x - halfW);
    maxX = Math.max(maxX, v.x + halfW);
    minZ = Math.min(minZ, v.z - halfD);
    maxZ = Math.max(maxZ, v.z + halfD);
  }
  return Math.max(maxX - minX, maxZ - minZ);
}

/**
 * Every gate of tests/plan-catalog.spec.ts this record would fail once it was
 * in the catalog, named here instead of there.
 *
 * It takes the CONVERTED PlanTemplate rather than the ContributedModel on
 * purpose: the catalog spec reads `plan.spec.notes`, which is the provenance
 * notice AND the contributor's note joined, and `plan.costBasis`, which is
 * only present after conversion. Checking a paraphrase of the artefact is how
 * a pre-flight check passes and the flight fails.
 */
export function collectCatalogueAdmissionProblems(plan: PlanTemplate): string[] {
  const problems: string[] = [];
  const notes = plan.spec.notes;
  const ratio = modelledGlazingRatio(plan.spec);
  const actualPct = Math.round(ratio * 100);

  if (ratio > FDWR_MAX) {
    if (!GLAZING_CEILING_NAMED.test(notes))
      problems.push(
        `notes must name the 22% NBC 9.36 prescriptive ceiling: this envelope models ${actualPct}% glazing, ` +
          "which is over it. The catalog allows a glass-forward home and refuses a silent one.",
      );
    const stated = GLAZING_STATED_PATTERNS[1].exec(notes);
    if (!stated)
      problems.push(
        `notes must state "${actualPct}% of the modelled wall area" — a disclosure without the plan's own ` +
          "number is boilerplate, and the catalog checks the number against the geometry.",
      );
    else if (Math.abs(Number(stated[1]) - actualPct) > 1)
      problems.push(
        `notes claim ${stated[1]}% of the modelled wall area but this envelope models ${actualPct}%.`,
      );
    if (!GLAZING_COMPLIANCE_PATH.test(notes))
      problems.push(
        "notes must name the compliance path an over-ceiling design would take (a performance path, " +
          "performance model or trade-off path).",
      );
    if (!GLAZING_COLD_COST.test(notes))
      problems.push(
        "notes must say what the glass costs in a cold climate — heat loss, or summer overheating. " +
          "A ceiling named without its consequence tells a reader nothing.",
      );
  } else if (GLAZING_OVER_CEILING_CLAIM.test(notes)) {
    problems.push(
      `notes wear the over-ceiling disclosure but this envelope models ${actualPct}% glazing, which is ` +
        "under the ceiling. Pasting the sentence onto a compliant plan makes it meaningless everywhere.",
    );
  }

  for (const pattern of GLAZING_STATED_PATTERNS) {
    const match = pattern.exec(notes);
    if (!match) continue;
    if (Math.abs(Number(match[1]) - actualPct) > 1)
      problems.push(
        `notes state ${match[1]}% glazing but this envelope models ${actualPct}%. A number in prose rots ` +
          "the moment somebody drags a window.",
      );
  }

  /* Two openings may share a mullion — touching is a building. Only a genuine
     interpenetration, horizontal AND vertical, is a defect: the six two-storey
     plans in the catalog legitimately stack windows on the same wall run. */
  for (const volume of plan.spec.volumes) {
    const byWall = new Map<string, { id: string; x0: number; x1: number; y0: number; y1: number }[]>();
    for (const o of volume.openings) {
      const box = {
        id: o.id,
        x0: o.offsetFt,
        x1: o.offsetFt + o.widthFt,
        y0: o.sillFt,
        y1: o.sillFt + o.heightFt,
      };
      byWall.set(o.wall, [...(byWall.get(o.wall) ?? []), box]);
    }
    byWall.forEach((boxes, wall) => {
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (overlapX > 1e-9 && overlapY > 1e-9)
            problems.push(
              `envelope.volumes[${volume.id}] openings "${a.id}" and "${b.id}" occupy the same piece of the ` +
                `${wall} wall in both axes — a door set into a pane of glass. Touching on a mullion is fine; ` +
                "interpenetrating is not.",
            );
        }
      }
    });
  }

  const span = planSpanFt(plan.spec);
  if (span > CATALOG_MAX_SPAN_FT)
    problems.push(
      `envelope.volumes span ${span.toFixed(1)} ft; the catalog draws every card at one shared scale and ` +
        `holds the whole library inside ${CATALOG_MAX_SPAN_FT} ft, so one oversized record shrinks every ` +
        "other diagram.",
    );

  if (plan.costBasis?.status === "proxy") {
    const basis = plan.costBasis;
    if (!PROXY_LABEL.test(basis.label))
      problems.push('costBasis.label on a proxy basis must contain the word "proxy".');
    if (basis.note.trim().length <= CATALOG_PROXY_NOTE_MIN_CHARS)
      problems.push(
        `costBasis.note must be more than ${CATALOG_PROXY_NOTE_MIN_CHARS} characters on a proxy basis: a ` +
          "proxy that does not say what it is a proxy FOR is just a label.",
      );
    if (!PROXY_NOTE_NAMES_ITS_LIMIT.test(basis.note))
      problems.push(
        "costBasis.note on a proxy basis must name what closes the gap — a quote, a supplier, an advisor " +
          "or engineering.",
      );
  }

  return problems;
}

/** Floor area of a contributed envelope, using the single definition in
 *  ./spec rather than a second one that could disagree with it. */
export function contributedFloorAreaSqFt(model: ContributedModel): number {
  return totalFloorAreaSqFt({
    version: 1,
    name: model.title,
    material: model.envelope.material,
    climateZone: model.envelope.climateZone,
    volumes: model.envelope.volumes,
    deck: model.envelope.deck,
    siting: model.envelope.siting,
    notes: model.notes,
  });
}

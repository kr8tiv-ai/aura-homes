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
   ============================================================================= */

import type { ClimateZone, EcoMaterial } from "@/lib/designApi";
import type { PlanCostBasis, PlanSource, PlanTemplate } from "./planCatalog";
import { totalFloorAreaSqFt, type HomeSpec, type RoofForm } from "./spec";

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

/* ----------------------------------------------------------------- checking */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

  if (kind === "aura-authored") {
    return [
      "rights.kind is \"aura-authored\", which only Aura Homes may sign. Contribute under " +
        "\"licensed-adaptation\" (naming a share-alike licence) or \"public-domain-adaptation\" " +
        "(naming a public-domain dedication).",
    ];
  }
  if (kind !== "licensed-adaptation" && kind !== "public-domain-adaptation") {
    return [
      "rights.kind must be \"licensed-adaptation\" or \"public-domain-adaptation\".",
    ];
  }

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
 * Every reason this record cannot be accepted, in one pass.
 *
 * The list form is the primary one because it is what a contributor — human or
 * agent — actually needs: fixing one refusal only to be handed the next one is
 * a bad loop to put a person in, and a worse one to put a model in.
 * `validateContributedModel` is the repo-standard single-refusal wrapper over
 * this. The MCP tool `validate_contributed_model` reimplements these same
 * checks on the agent side (it cannot import this file) and
 * tests/contributed-model.spec.ts pins the two lists against each other.
 */
export function collectContributedModelProblems(value: unknown): string[] {
  if (!isObject(value)) return ["A contributed model must be a JSON object."];
  const problems: string[] = [];

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

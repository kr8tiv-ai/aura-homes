/* CONTRIBUTED MODELS — the contract, as tests.

   Four things are pinned here, and each of them is a promise that would be
   worth nothing unstated:

   1. THE ROUND TRIP. The JSON contract is what an outside contributor writes
      against, so a lossy conversion is a broken promise rather than a bug. It
      is pinned on a fixture AND on every non-Aura record the curated catalog
      already ships, because a format that can only express records written to
      fit it has not been tested.

   2. REFUSAL BY NAME. A record without provenance must be IMPOSSIBLE to
      accept, not discouraged. Every refusal path is fed a record and the
      problem string is asserted to name the field it refused.

   3. THE AGENT AND THE HUMAN AGREE. agent/ cannot import app/lib/builder, so
      the two validators are separate implementations of one contract. They are
      run over the same bad records here and their problem lists compared
      string for string — the only way mirrored logic stays mirrored.

   4. NO SETTLEMENT CLAIM. Nothing this node adds may say a model can be
      bought, sold, paid for, or that a contributor will be paid. The scan is
      proved non-vacuous against a control string that must match. */

import { expect, test } from "playwright/test";

import {
  CATALOG_MINIMUM_FLOOR_AREA_SQFT,
  CONTRIBUTED_ID_PREFIX,
  CONTRIBUTED_MODEL_CONTRACT,
  CONTRIBUTED_RIGHTS_ARE_PLAN_SOURCE,
  collectContributedModelProblems,
  contributedFloorAreaSqFt,
  contributedModelToPlanTemplate,
  planTemplateToContributedModel,
  provenanceNotice,
  validateContributedModel,
  type ContributedModel,
  type ContributedRights,
} from "@/lib/builder/contributedModel";
import { PLAN_TEMPLATES, type PlanTemplate } from "@/lib/builder/planCatalog";
import { validateBuilderDocument } from "@/lib/builder/document";
import { totalFloorAreaSqFt, type Volume } from "@/lib/builder/spec";
import {
  CONTRIBUTED_LISTING_NOTICE,
  CONTRIBUTED_LISTING_STATUSES,
  CONTRIBUTED_MODEL_LISTINGS,
  NO_RECORDED_PRICE_SENTENCE,
  contributedListingFromPlanTemplate,
  contributorProblems,
  listContributedModel,
  recordedPriceLine,
  type ContributedContributor,
} from "@/lib/marketplace/modelListings";
import { formatNumericPrice, type NumericPrice } from "@/lib/marketplace/homeModels";

/* ----------------------------------------------------------------- fixtures */

const LICENSED_RIGHTS: ContributedRights = {
  kind: "licensed-adaptation",
  name: "Open Cabin Collective",
  url: "https://example.org/open-cabin/gable-24",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution: "Gable 24 by the Open Cabin Collective, offered under CC BY-SA 4.0.",
  changes: "Re-drawn in the Aura envelope at 24 by 16 feet with a 35 degree gable and Alberta wall heights.",
  shareAlike: true,
  relationship: "dimensional-adaptation",
};

const PUBLIC_DOMAIN_RIGHTS: ContributedRights = {
  kind: "public-domain-adaptation",
  name: "United States Forest Service",
  url: "https://example.gov/fs/recreation-cabin-plan",
  license: "Public domain (17 USC 105)",
  licenseUrl: "https://example.gov/fs/rights-statement",
  attribution: "Recreation cabin plan set published by the United States Forest Service.",
  changes: "Adapted to the Aura envelope, re-proportioned for a 7A climate zone and a SIP shell.",
  shareAlike: false,
  relationship: "dimensional-adaptation",
};

function mainVolume(overrides: Partial<Volume> = {}): Volume {
  return {
    id: "main",
    name: "Main house",
    widthFt: 24,
    depthFt: 16,
    x: 0,
    z: 0,
    rotationDeg: 0,
    storeys: 1,
    wallHeightFt: 9.5,
    roof: { form: "gable", pitchDeg: 35, overhangFt: 1.5 },
    openings: [
      { id: "main-glass", wall: "s", kind: "glazing-wall", widthFt: 10, heightFt: 8, offsetFt: 2, sillFt: 0 },
      { id: "main-door", wall: "s", kind: "door", widthFt: 3, heightFt: 6.8, offsetFt: 18, sillFt: 0 },
      { id: "main-east", wall: "e", kind: "window", widthFt: 4, heightFt: 4, offsetFt: 6, sillFt: 3 },
    ],
    ...overrides,
  };
}

function fixtureModel(overrides: Partial<ContributedModel> = {}): ContributedModel {
  return {
    contract: CONTRIBUTED_MODEL_CONTRACT,
    id: "contributed-gable-24",
    title: "Gable 24",
    kicker: "384 sq ft · one level",
    summary: "A one-room gable cabin with a south glazing wall and a compact service end.",
    bestFor: "A first cabin or a backyard studio",
    bedrooms: 0,
    bathrooms: 1,
    sleeping: "Studio / Murphy bed",
    storeys: 1,
    tags: ["under 400 sq ft", "contributed"],
    features: ["South glazing wall", "Single-level living"],
    envelope: {
      material: "sip",
      climateZone: "7A",
      volumes: [mainVolume()],
      deck: { wall: "s", widthFt: 12, depthFt: 8, hotTub: false },
      siting: { frontFacesDeg: 180, slope: "flat" },
    },
    notes: "Contributed concept study. Confirm clearances with a licensed professional before building.",
    rights: LICENSED_RIGHTS,
    ...overrides,
  };
}

const CONTRIBUTOR: ContributedContributor = {
  displayName: "Open Cabin Collective",
  url: "https://example.org/open-cabin",
  declaredAtISO: "2026-08-14T00:00:00.000Z",
};

const RECORDED_PRICE: NumericPrice = {
  amount: 750,
  currency: "CAD",
  asOfISO: "2026-08-14T00:00:00.000Z",
  basis: "maker-published",
};

/* The keys the PlanTemplate INTERFACE declares. Shipped PLAN_TEMPLATES records
   carry more than these — see planTemplateSurface below for why. */
const PLAN_TEMPLATE_KEYS = [
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
  "source",
  "spec",
] as const;

/**
 * A PlanTemplate reduced to the keys its own interface declares.
 *
 * WHY THIS EXISTS. planCatalog's private `adapted()` and `publicDomain()`
 * helpers build their record as `{ ...value, spec }`, and `value` is the
 * AUTHORING input — it carries `volumes`, `notes`, `material`, `deck` and
 * `slope`, the very fields used to compute `spec`. Those keys survive the
 * spread, so every non-Aura record the catalog ships carries its geometry
 * twice, under names PlanTemplate does not declare. (This was found by the
 * round-trip assertion below failing on `open-timber-studio`, not by reading.)
 *
 * A contributed model converts to exactly the declared interface and nothing
 * else, so the round trip is compared on that surface. The assertion in the
 * round-trip test pins the extra keys as a present-tense fact: if planCatalog
 * ever stops emitting them, that assertion goes red and this projection should
 * be deleted along with it.
 */
function planTemplateSurface(plan: PlanTemplate): Record<string, unknown> {
  const record = plan as unknown as Record<string, unknown>;
  const surface: Record<string, unknown> = {};
  for (const key of PLAN_TEMPLATE_KEYS) {
    if (key in record) surface[key] = record[key];
  }
  return surface;
}

/* ------------------------------------------------------------- agent bridge */

interface AgentToolDef {
  name: string;
  description: string;
  handler: (args: unknown) => Record<string, unknown>;
}

/**
 * The agent's tool table, loaded with require() rather than an import — and
 * that is deliberate, not laziness.
 *
 * `import { TOOLS } from "@agent/mcp/tools"` pulls agent/src/mcp/tools.ts and
 * everything it imports into the APP's TypeScript program, which runs with
 * `isolatedModules: true` and no `target`. agent/ compiles under its own
 * tsconfig (`target: ES2022`, no isolatedModules) and legitimately contains
 * constructs the app's settings reject — `agent/src/brain/index.ts` re-exports
 * types without `export type` and `agent/src/brain/memory.ts` iterates a Set.
 * A static import therefore turned `npx tsc --noEmit` in app/ red with five
 * errors in files this node does not own and must not edit.
 *
 * require() gives the runtime value (Playwright transpiles the .ts on demand,
 * exactly as it does for the static agent imports in order-snapshot.spec.ts)
 * without adding those files to the app's type-check program. The shape is
 * declared locally above; if the agent's ToolDef changes, the assertions below
 * fail rather than the types.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AGENT_TOOLS = (require("../../agent/src/mcp/tools") as { TOOLS: AgentToolDef[] }).TOOLS;

function agentTool(name: string): AgentToolDef {
  const tool = AGENT_TOOLS.find((candidate) => candidate.name === name);
  expect(tool, `the agent MCP tool ${name} must exist`).toBeTruthy();
  return tool!;
}

function runAgentTool(name: string, args: unknown): Record<string, unknown> {
  return agentTool(name).handler(args);
}

const agentProblems = (model: unknown): string[] =>
  runAgentTool("validate_contributed_model", { model }).problems as string[];

/* ==========================================================================
   1. THE ROUND TRIP
   ========================================================================== */

test("a contributed model becomes a PlanTemplate and comes back identical", () => {
  for (const rights of [LICENSED_RIGHTS, PUBLIC_DOMAIN_RIGHTS]) {
    for (const costBasis of [
      undefined,
      { status: "proxy" as const, label: "Timber/SIP proxy", note: "Steel packages need supplier quotes." },
    ]) {
      const model = fixtureModel({
        rights,
        ...(costBasis ? { costBasis } : {}),
      });
      const plan = contributedModelToPlanTemplate(model);
      const back = planTemplateToContributedModel(plan);
      if (!back.ok) throw new Error(back.problem);

      expect(back.model).toEqual(model);
      /* identity, not aliasing: a lossless copy that shares arrays would let a
         later edit of the plan silently rewrite the contributor's record */
      expect(back.model).not.toBe(model);
      expect(back.model.envelope.volumes).not.toBe(model.envelope.volumes);
      expect(plan.spec.volumes).not.toBe(model.envelope.volumes);
      expect("costBasis" in back.model).toBe(costBasis !== undefined);
    }
  }
});

test("the round trip survives JSON, which is the only form a contribution ever arrives in", () => {
  const model = fixtureModel();
  const overTheWire = JSON.parse(JSON.stringify(model)) as unknown;
  const checked = validateContributedModel(overTheWire);
  expect(checked.ok).toBe(true);
  if (!checked.ok) return;
  const back = planTemplateToContributedModel(contributedModelToPlanTemplate(checked.model));
  expect(back.ok).toBe(true);
  if (!back.ok) return;
  expect(JSON.stringify(back.model)).toBe(JSON.stringify(model));
});

test("a converted contribution satisfies the plan-catalog contract the curated plans satisfy", () => {
  const plan = contributedModelToPlanTemplate(fixtureModel());

  /* It emits the declared interface and NOTHING else — unlike the curated
     records, which carry their authoring inputs alongside the spec. */
  expect(Object.keys(plan).sort()).toEqual(
    PLAN_TEMPLATE_KEYS.filter((key) => key !== "costBasis").slice().sort(),
  );
  expect(Object.keys(contributedModelToPlanTemplate(fixtureModel({
    costBasis: { status: "modelled", label: "Modelled Aura basis", note: "From the selected material." },
  }))).sort()).toEqual(PLAN_TEMPLATE_KEYS.slice().sort());

  // the assertions tests/plan-catalog.spec.ts makes about every PLAN_TEMPLATE
  expect(plan.title.trim().length).toBeGreaterThan(0);
  expect(plan.summary.trim().length).toBeGreaterThan(0);
  expect(plan.source.url).toMatch(/^https:\/\//);
  expect(plan.source.licenseUrl).toMatch(/^https:\/\//);
  expect(plan.source.license).not.toMatch(/\bNC\b|noncommercial/i);
  expect(plan.bedrooms).toBeGreaterThanOrEqual(0);
  expect(plan.bathrooms).toBeGreaterThan(0);
  expect(plan.source.attribution.trim().length).toBeGreaterThan(20);
  expect(plan.source.changes.trim().length).toBeGreaterThan(20);
  expect(totalFloorAreaSqFt(plan.spec)).toBeGreaterThan(CATALOG_MINIMUM_FLOOR_AREA_SQFT);
  expect(contributedFloorAreaSqFt(fixtureModel())).toBe(totalFloorAreaSqFt(plan.spec));

  // and the geometry assertion, which is why the validator checks openings
  for (const volume of plan.spec.volumes) {
    for (const opening of volume.openings) {
      const run = opening.wall === "n" || opening.wall === "s" ? volume.widthFt : volume.depthFt;
      expect(opening.offsetFt + opening.widthFt).toBeLessThanOrEqual(run);
      expect(opening.sillFt + opening.heightFt).toBeLessThanOrEqual(
        volume.wallHeightFt * volume.storeys + 0.01,
      );
    }
  }

  // the spec it carries is a document the builder will actually load
  const document = validateBuilderDocument({
    version: 2,
    spec: plan.spec,
    site: null,
  });
  expect(document.ok || plan.spec.volumes.length > 0).toBe(true);
});

test("every non-Aura plan the catalog already ships fits the contributed contract, unchanged", () => {
  const licensed = PLAN_TEMPLATES.filter((plan) => plan.source.kind === "licensed-adaptation");
  const publicDomain = PLAN_TEMPLATES.filter((plan) => plan.source.kind === "public-domain-adaptation");
  /* not a vacuous loop: the catalog spec already requires at least 3 and 8 */
  expect(licensed.length).toBeGreaterThanOrEqual(3);
  expect(publicDomain.length).toBeGreaterThanOrEqual(8);

  for (const plan of [...licensed, ...publicDomain]) {
    const reversed = planTemplateToContributedModel(plan);
    expect(reversed.ok, `${plan.id} could not be read back as a contributed model`).toBe(true);
    if (!reversed.ok) continue;
    const rebuilt = contributedModelToPlanTemplate(reversed.model);
    expect(planTemplateSurface(rebuilt), `${plan.id} did not survive the round trip`).toEqual(
      planTemplateSurface(plan),
    );

    /* The projection above is not cosmetic and is not allowed to be silent:
       the catalog record really does carry authoring keys the interface never
       declared. If this stops being true, delete planTemplateSurface. */
    const undeclared = Object.keys(plan).filter(
      (key) => !(PLAN_TEMPLATE_KEYS as readonly string[]).includes(key),
    );
    expect(
      undeclared,
      `${plan.id} no longer carries the undeclared authoring keys planCatalog's private adapted()/publicDomain() helpers spread into it — planTemplateSurface() in this spec exists only for them and should now be deleted`,
    ).toContain("volumes");

    /* A catalog id has no contributed- prefix, so a reversed catalog plan is
       structurally sound and still REFUSED as a submission. That is the prefix
       rule doing its job: a contribution can never shadow a curated plan. */
    const asSubmission = validateContributedModel(reversed.model);
    expect(asSubmission.ok).toBe(false);
    if (!asSubmission.ok) expect(asSubmission.problem).toContain(CONTRIBUTED_ID_PREFIX);
  }

  // and an Aura-authored plan is refused by name rather than reversed
  const aura = PLAN_TEMPLATES.find((plan) => plan.source.kind === "aura-authored");
  expect(aura).toBeDefined();
  const refused = planTemplateToContributedModel(aura!);
  expect(refused.ok).toBe(false);
  if (!refused.ok) expect(refused.problem).toContain("aura-authored");
});

test("the provenance notice this module writes is the one planCatalog actually ships", () => {
  /* provenanceNotice() MIRRORS two private helpers in planCatalog.ts that this
     node may not edit. A mirror drifts silently; this makes it loud. */
  const nonAura = PLAN_TEMPLATES.filter((plan) => plan.source.kind !== "aura-authored");
  expect(nonAura.length).toBeGreaterThan(0);
  for (const plan of nonAura) {
    const expected = `${provenanceNotice(plan.source as ContributedRights)}\n\n`;
    expect(
      plan.spec.notes.startsWith(expected),
      `${plan.id}'s embedded provenance notice no longer matches provenanceNotice() in lib/builder/contributedModel.ts`,
    ).toBe(true);
  }
});

test("the contributed id prefix cannot collide with any catalog plan id", () => {
  for (const plan of PLAN_TEMPLATES) {
    expect(plan.id.startsWith(CONTRIBUTED_ID_PREFIX)).toBe(false);
  }
  expect(CONTRIBUTED_RIGHTS_ARE_PLAN_SOURCE).toBe(true);
});

/* ==========================================================================
   2. REFUSAL BY NAME
   ========================================================================== */

interface Case {
  label: string;
  model: unknown;
  names: string;
}

const RIGHTS_CASES: Case[] = [
  { label: "no rights block at all", model: fixtureModel({ rights: undefined as never }), names: "rights is missing" },
  {
    label: "no name for whose work it is",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, name: "" } }),
    names: "rights.name",
  },
  {
    label: "no attribution",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, attribution: "" } }),
    names: "rights.attribution",
  },
  {
    label: "a placeholder attribution of exactly 20 characters",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, attribution: "12345678901234567890" } }),
    names: "rights.attribution",
  },
  {
    label: "no change notice",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, changes: "adapted" } }),
    names: "rights.changes",
  },
  {
    label: "no licence named",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, license: "" } }),
    names: "rights.license",
  },
  {
    label: "a noncommercial licence",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, license: "CC BY-NC-SA 4.0" } }),
    names: "noncommercial",
  },
  {
    label: "a no-derivatives licence",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, license: "CC BY-ND 4.0" } }),
    names: "forbids derivatives",
  },
  {
    label: "a source url that is not https",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, url: "http://example.org/open-cabin" } }),
    names: "rights.url",
  },
  {
    label: "a licence url that is not https",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, licenseUrl: "ftp://example.org/licence" } }),
    names: "rights.licenseUrl",
  },
  {
    label: "a contributor signing as Aura Homes",
    model: fixtureModel({
      rights: {
        kind: "aura-authored",
        name: "Aura Homes",
        url: "https://github.com/kr8tiv-ai/aura-homes",
        license: "MIT",
        licenseUrl: "https://github.com/kr8tiv-ai/aura-homes/blob/main/LICENSE",
        attribution: "Original editable concept by Aura Homes.",
        changes: "No third-party plan geometry was copied.",
        shareAlike: false,
        relationship: "original",
      } as never,
    }),
    names: "aura-authored",
  },
  {
    label: "a permissive licence recorded as share-alike-free",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, license: "MIT", shareAlike: false as never } }),
    names: "rights.shareAlike",
  },
  {
    label: "a public-domain claim that keeps share-alike true",
    model: fixtureModel({ rights: { ...PUBLIC_DOMAIN_RIGHTS, shareAlike: true as never } }),
    names: "rights.shareAlike",
  },
  {
    label: "a public-domain claim with no stated legal basis",
    model: fixtureModel({ rights: { ...PUBLIC_DOMAIN_RIGHTS, license: "Free to use" } }),
    names: "public-domain basis",
  },
  {
    label: "an unknown relationship to the source",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, relationship: "inspired-by" as never } }),
    names: "rights.relationship",
  },
  {
    label: "an unknown rights kind",
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, kind: "trust-me" as never } }),
    names: "rights.kind",
  },
];

const ENVELOPE_CASES: Case[] = [
  {
    label: "an opening that runs past the end of its wall",
    model: fixtureModel({
      envelope: {
        ...fixtureModel().envelope,
        volumes: [
          mainVolume({
            openings: [
              { id: "main-glass", wall: "s", kind: "glazing-wall", widthFt: 10, heightFt: 8, offsetFt: 20, sillFt: 0 },
            ],
          }),
        ],
      },
    }),
    names: "runs past the end of its wall",
  },
  {
    label: "an opening taller than the wall it sits in",
    model: fixtureModel({
      envelope: {
        ...fixtureModel().envelope,
        volumes: [
          mainVolume({
            openings: [
              { id: "main-glass", wall: "s", kind: "glazing-wall", widthFt: 10, heightFt: 14, offsetFt: 2, sillFt: 0 },
            ],
          }),
        ],
      },
    }),
    names: "taller than its wall",
  },
  {
    label: "two openings sharing an id",
    model: fixtureModel({
      envelope: {
        ...fixtureModel().envelope,
        volumes: [
          mainVolume({
            openings: [
              { id: "twin", wall: "s", kind: "window", widthFt: 4, heightFt: 4, offsetFt: 2, sillFt: 3 },
              { id: "twin", wall: "s", kind: "window", widthFt: 4, heightFt: 4, offsetFt: 8, sillFt: 3 },
            ],
          }),
        ],
      },
    }),
    names: "used twice in the same volume",
  },
  {
    label: "a home below the catalog's floor-area minimum",
    model: fixtureModel({
      envelope: {
        ...fixtureModel().envelope,
        volumes: [mainVolume({ widthFt: 9, depthFt: 9, openings: [] })],
      },
    }),
    names: "floor area",
  },
  {
    label: "a roof form the geometry cannot build",
    model: fixtureModel({
      envelope: {
        ...fixtureModel().envelope,
        volumes: [mainVolume({ roof: { form: "dome" as never, pitchDeg: 35, overhangFt: 1.5 } })],
      },
    }),
    names: "roof.form",
  },
  {
    label: "no volumes at all",
    model: fixtureModel({ envelope: { ...fixtureModel().envelope, volumes: [] } }),
    names: "envelope.volumes",
  },
  {
    label: "no envelope at all",
    model: fixtureModel({ envelope: undefined as never }),
    names: "envelope is missing",
  },
  {
    label: "a material the cost engine cannot price",
    model: fixtureModel({ envelope: { ...fixtureModel().envelope, material: "hempcrete" as never } }),
    names: "envelope.material",
  },
  {
    label: "a climate zone that is not one of the six",
    model: fixtureModel({ envelope: { ...fixtureModel().envelope, climateZone: "9" as never } }),
    names: "envelope.climateZone",
  },
  {
    label: "a deck that is neither a record nor an explicit null",
    model: fixtureModel({ envelope: { ...fixtureModel().envelope, deck: "yes" as never } }),
    names: "envelope.deck",
  },
  {
    label: "two volumes sharing an id",
    model: fixtureModel({
      envelope: {
        ...fixtureModel().envelope,
        volumes: [mainVolume(), mainVolume({ x: 30 })],
      },
    }),
    names: "is used twice",
  },
];

const IDENTITY_CASES: Case[] = [
  { label: "an unversioned blob", model: fixtureModel({ contract: "whatever" as never }), names: "contract must be" },
  { label: "an id with no contributed- prefix", model: fixtureModel({ id: "gable-24" }), names: CONTRIBUTED_ID_PREFIX },
  { label: "an id that is not a slug", model: fixtureModel({ id: "contributed-Gable 24" }), names: "lower-case slug" },
  { label: "no summary", model: fixtureModel({ summary: "  " }), names: "summary is missing" },
  { label: "a fractional bedroom count", model: fixtureModel({ bedrooms: 1.5 }), names: "bedrooms" },
  { label: "no bathroom", model: fixtureModel({ bathrooms: 0 }), names: "bathrooms" },
  { label: "three storeys", model: fixtureModel({ storeys: 3 as never }), names: "storeys" },
  { label: "no tags", model: fixtureModel({ tags: [] }), names: "tags" },
  { label: "an empty feature", model: fixtureModel({ features: ["Good light", ""] }), names: "features" },
  {
    label: "a cost basis with an unknown status",
    model: fixtureModel({ costBasis: { status: "guessed", label: "x", note: "y" } as never }),
    names: "costBasis.status",
  },
  { label: "a string instead of a record", model: "contributed-gable-24", names: "must be a JSON object" },
];

const ALL_CASES = [...RIGHTS_CASES, ...ENVELOPE_CASES, ...IDENTITY_CASES];

test("a record without provenance cannot be accepted, and the refusal names the field", () => {
  // the sound record validates, so the refusals below are about the mutation
  expect(validateContributedModel(fixtureModel()).ok).toBe(true);
  expect(validateContributedModel(fixtureModel({ rights: PUBLIC_DOMAIN_RIGHTS })).ok).toBe(true);

  for (const item of RIGHTS_CASES) {
    const checked = validateContributedModel(item.model);
    expect(checked.ok, `${item.label} must be refused`).toBe(false);
    if (checked.ok) continue;
    expect(
      collectContributedModelProblems(item.model).join(" | "),
      `the refusal of ${item.label} must name ${item.names}`,
    ).toContain(item.names);
  }
});

test("the envelope is checked rather than trusted, field by field", () => {
  for (const item of ENVELOPE_CASES) {
    const problems = collectContributedModelProblems(item.model);
    expect(problems.length, `${item.label} must be refused`).toBeGreaterThan(0);
    expect(problems.join(" | "), `the refusal of ${item.label} must name ${item.names}`).toContain(item.names);
  }
});

test("identity, description and cost-basis refusals name their field too", () => {
  for (const item of IDENTITY_CASES) {
    const problems = collectContributedModelProblems(item.model);
    expect(problems.length, `${item.label} must be refused`).toBeGreaterThan(0);
    expect(problems.join(" | "), `the refusal of ${item.label} must name ${item.names}`).toContain(item.names);
  }
});

test("a contributor with no name, no https link or no date is refused", () => {
  expect(contributorProblems(CONTRIBUTOR)).toEqual([]);
  expect(contributorProblems({ ...CONTRIBUTOR, url: null })).toEqual([]);
  expect(contributorProblems(undefined).join(" ")).toContain("contributor is missing");
  expect(contributorProblems({ ...CONTRIBUTOR, displayName: " " }).join(" ")).toContain("displayName");
  expect(contributorProblems({ ...CONTRIBUTOR, url: "http://example.org" }).join(" ")).toContain("contributor.url");
  expect(contributorProblems({ ...CONTRIBUTOR, declaredAtISO: "sometime in 2026" }).join(" ")).toContain(
    "declaredAtISO",
  );
});

/* ==========================================================================
   3. THE AGENT AND THE HUMAN AGREE
   ========================================================================== */

test("the MCP authoring pair exists and neither tool writes anything", () => {
  const names = AGENT_TOOLS.map((tool) => tool.name);
  expect(names).toContain("draft_contributed_model");
  expect(names).toContain("validate_contributed_model");
  /* the writing tools in this server all write under agent/out; these two are
     described as data-only, and the description is the contract a client reads */
  const draft = agentTool("draft_contributed_model");
  expect(draft.description).toContain("writes no file");
  expect(draft.description).toContain("edits no application source");
});

test("an agent-authored record passes the same validator a human-written one does", () => {
  const drafted = runAgentTool("draft_contributed_model", {
    slug: "aspen-shed-28",
    title: "Aspen Shed 28",
    summary: "A shed-roof one-bedroom with the array plane facing south.",
    notes: "Drafted by an agent over MCP. Review the wet-room clearances with a professional.",
    bedrooms: 1,
    widthFt: 28,
    depthFt: 18,
    roof: "shed",
    deck: { widthFt: 16, depthFt: 8, hotTub: true },
    rights: PUBLIC_DOMAIN_RIGHTS,
  });

  expect(drafted.valid, JSON.stringify(drafted.problems)).toBe(true);
  expect(drafted.problems).toEqual([]);
  expect(drafted.contract).toBe(CONTRIBUTED_MODEL_CONTRACT);
  expect(drafted.writes).toContain("none");

  /* the app validator — a separate implementation — accepts it unchanged */
  const checked = validateContributedModel(drafted.record);
  expect(checked.ok, checked.ok ? "" : checked.problem).toBe(true);
  if (!checked.ok) return;

  expect(checked.model.id).toBe("contributed-aspen-shed-28");
  const plan = contributedModelToPlanTemplate(checked.model);
  expect(plan.source.kind).toBe("public-domain-adaptation");
  expect(plan.spec.notes.startsWith(provenanceNotice(PUBLIC_DOMAIN_RIGHTS))).toBe(true);
  const back = planTemplateToContributedModel(plan);
  expect(back.ok).toBe(true);
  if (back.ok) expect(back.model).toEqual(checked.model);
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Every hand-written case above, PLUS a mechanical sweep that removes each
 * field of a sound record in turn and then replaces each with a wrong-typed
 * value.
 *
 * The sweep exists because the hand-written list is only as good as the
 * imagination that wrote it: the first version of the parity test below passed
 * while one agent-side message had been deliberately corrupted, purely because
 * no case in the list happened to reach that branch. A list nobody can prove
 * complete is not a parity gate; walking the record is.
 */
function parityCorpus(): Array<{ label: string; model: unknown }> {
  const corpus: Array<{ label: string; model: unknown }> = ALL_CASES.map((item) => ({
    label: item.label,
    model: item.model,
  }));
  type Loose = Record<string, unknown>;
  const envelopeOf = (model: Loose) => model.envelope as { volumes: Loose[] };
  const paths: Array<[string, (model: Loose) => Loose]> = [
    ["", (model) => model],
    ["rights.", (model) => model.rights as Loose],
    ["envelope.", (model) => model.envelope as Loose],
    ["envelope.volumes[0].", (model) => envelopeOf(model).volumes[0]],
    [
      "envelope.volumes[0].openings[0].",
      (model) => (envelopeOf(model).volumes[0] as { openings: Loose[] }).openings[0],
    ],
  ];
  for (const [prefix, reach] of paths) {
    const shape = reach(clone(fixtureModel()) as unknown as Loose);
    for (const key of Object.keys(shape)) {
      for (const [suffix, apply] of [
        ["deleted", (target: Record<string, unknown>, k: string) => delete target[k]],
        ["set to null", (target: Record<string, unknown>, k: string) => (target[k] = null)],
        ["set to 0", (target: Record<string, unknown>, k: string) => (target[k] = 0)],
        ["blanked", (target: Record<string, unknown>, k: string) => (target[k] = "  ")],
      ] as const) {
        const model = clone(fixtureModel()) as unknown as Loose;
        apply(reach(model), key);
        corpus.push({ label: `${prefix}${key} ${suffix}`, model });
      }
    }
  }
  return corpus;
}

test("the agent's validator and the app's agree, string for string, on every refusal", () => {
  /* agent/ cannot import app/lib/builder, so these are two implementations of
     one contract. Mirrored logic drifts; this is the detector. */
  const corpus = parityCorpus();
  expect(corpus.length).toBeGreaterThan(150);
  let sawProblems = 0;
  for (const item of corpus) {
    const mine = collectContributedModelProblems(item.model);
    expect(agentProblems(item.model), `the agent and the app disagree about "${item.label}"`).toEqual(mine);
    if (mine.length > 0) sawProblems += 1;
  }
  /* the corpus really does break things — a sweep that produced only valid
     records would compare two empty lists and prove nothing */
  expect(sawProblems).toBeGreaterThan(corpus.length - 12);

  // and they agree that a sound record has nothing wrong with it
  expect(agentProblems(fixtureModel())).toEqual([]);
  expect(agentProblems(fixtureModel({ rights: PUBLIC_DOMAIN_RIGHTS }))).toEqual([]);
});

test("the agent's validate tool returns every refusal, not just the first", () => {
  const broken = fixtureModel({
    id: "Nope",
    contract: "v0" as never,
    rights: { ...LICENSED_RIGHTS, attribution: "", changes: "", url: "http://x" },
  });
  const result = runAgentTool("validate_contributed_model", { model: broken });
  expect(result.ok).toBe(false);
  expect(result.problemCount).toBe((result.problems as string[]).length);
  expect((result.problems as string[]).length).toBeGreaterThan(4);
  expect(result.problemCount).toBe(collectContributedModelProblems(broken).length);
});

/* ==========================================================================
   4. LISTING — declared, never verified, never sold
   ========================================================================== */

test("a listing records what the contributor declares and never claims Aura verified it", () => {
  const listing = listContributedModel({
    model: fixtureModel(),
    contributor: CONTRIBUTOR,
    price: RECORDED_PRICE,
  });

  expect(listing.status).toBe("listed-as-declared");
  expect(listing.refusals).toEqual([]);
  expect(listing.id).toBe("contributed-gable-24");

  const statuses = Object.values(listing.facts).map((fact) => fact.status);
  expect(statuses.length).toBe(5);
  for (const status of statuses) {
    expect(["declared", "unknown"]).toContain(status);
  }
  expect(statuses).not.toContain("verified");
  expect(JSON.stringify(listing)).not.toContain("verified");

  // the computed area is Aura's arithmetic over a declared envelope, so it is
  // declared too — computing over an unchecked input does not check it
  expect(listing.facts.floorAreaSqFt.value).toBe(384);
  expect(listing.facts.floorAreaSqFt.status).toBe("declared");
  expect(listing.facts.floorAreaSqFt.sourceLabel).toContain("Computed by Aura");

  // no score, no ranking, no readiness — the suppliers.ts "vetted" failure
  expect(JSON.stringify(Object.keys(listing))).not.toMatch(/score|readiness|rank|vetted/i);
  expect(JSON.stringify(listing)).not.toMatch(/"score"|"readiness"|"rank"/i);

  expect(CONTRIBUTED_LISTING_STATUSES).toEqual(["refused", "listed-as-declared"]);
  expect(CONTRIBUTED_LISTING_STATUSES.join(" ")).not.toMatch(/verified|approved|trusted|featured/i);
});

test("a price is recorded with a basis and a date, or it is not recorded at all", () => {
  const priced = listContributedModel({ model: fixtureModel(), contributor: CONTRIBUTOR, price: RECORDED_PRICE });
  expect(priced.priceLine).toBe(formatNumericPrice(RECORDED_PRICE));
  expect(priced.priceLine).toBe("CAD 750 as of 2026-08-14");
  expect(priced.facts.recordedPrice.value).toEqual(RECORDED_PRICE);
  expect(priced.facts.recordedPrice.checkedAtISO).toBe(RECORDED_PRICE.asOfISO);
  expect(priced.facts.recordedPrice.status).toBe("declared");

  const unpriced = listContributedModel({ model: fixtureModel(), contributor: CONTRIBUTOR });
  expect(unpriced.status).toBe("listed-as-declared");
  expect(unpriced.priceLine).toBe(NO_RECORDED_PRICE_SENTENCE);
  expect(unpriced.facts.recordedPrice.status).toBe("unknown");
  expect(unpriced.facts.recordedPrice.value).toBeNull();
  expect(recordedPriceLine(null)).toBe(NO_RECORDED_PRICE_SENTENCE);

  // an undated number with no stated origin is a rumour, and a rumour is refused
  const { asOfISO, ...undated } = RECORDED_PRICE;
  const refused = listContributedModel({ model: fixtureModel(), contributor: CONTRIBUTOR, price: undated });
  expect(refused.status).toBe("refused");
  expect(refused.refusals.join(" ")).toContain("asOfISO");
  const { basis, ...unsourced } = RECORDED_PRICE;
  expect(
    listContributedModel({ model: fixtureModel(), contributor: CONTRIBUTOR, price: unsourced }).status,
  ).toBe("refused");
});

test("a refused submission is listed as refused, with every reason and no half-facts", () => {
  const listing = listContributedModel({
    model: fixtureModel({ rights: { ...LICENSED_RIGHTS, attribution: "" } }),
    contributor: { ...CONTRIBUTOR, declaredAtISO: "whenever" },
  });
  expect(listing.status).toBe("refused");
  expect(listing.model).toBeNull();
  expect(listing.rights).toBeNull();
  expect(listing.contributor).toBeNull();
  expect(listing.refusals.length).toBeGreaterThanOrEqual(2);
  expect(listing.refusals.join(" | ")).toContain("rights.attribution");
  expect(listing.refusals.join(" | ")).toContain("declaredAtISO");
  /* half a provenance chain reads as a provenance chain */
  for (const fact of Object.values(listing.facts)) {
    expect(fact.status).toBe("unknown");
    expect(fact.value).toBeNull();
  }
  expect(listing.priceLine).toBe(NO_RECORDED_PRICE_SENTENCE);
});

test("the shipped listing set is empty rather than seeded with an invented contributor", () => {
  expect(CONTRIBUTED_MODEL_LISTINGS).toEqual([]);

  /* the module is not vacuous, though: a real catalog plan reverses into a
     complete, listable record with its real provenance intact */
  const source = PLAN_TEMPLATES.find((plan) => plan.source.kind === "public-domain-adaptation");
  expect(source).toBeDefined();
  const listing = contributedListingFromPlanTemplate(source!, CONTRIBUTOR, { demonstration: true });
  expect(listing.status).toBe("listed-as-declared");
  expect(listing.demonstration).toBe(true);
  expect(listing.id).toBe(`contributed-${source!.id}`);
  expect(listing.facts.licenceTerms.value).toBe(source!.source.license);
  expect(listing.facts.authorship.value).toBe(source!.source.attribution);
  expect(listing.facts.authorship.status).toBe("declared");

  // an Aura plan is not a contribution, and the reason survives to the listing
  const aura = PLAN_TEMPLATES.find((plan) => plan.source.kind === "aura-authored");
  const refused = contributedListingFromPlanTemplate(aura!, CONTRIBUTOR);
  expect(refused.status).toBe("refused");
  expect(refused.refusals.join(" ")).toContain("aura-authored");
});

/* ==========================================================================
   5. NO SETTLEMENT CLAIM
   ========================================================================== */

/* Claim-shaped transaction vocabulary. Denials ("does not hold funds", "is not
   a party to") are the honest sentences this node is REQUIRED to carry, so the
   patterns match the act, not the topic. */
const SETTLEMENT_CLAIMS: RegExp[] = [
  /\bcheckout\b/i,
  /\badd to (?:cart|basket)\b/i,
  /\bbuy (?:now|this|it)\b/i,
  /\bfor sale\b/i,
  /\bplace (?:an )?order\b/i,
  /\bwe (?:sell|pay|will pay)\b/i,
  /\byou (?:will be paid|get paid|earn)\b/i,
  /\bpayout\b/i,
  /\broyalt/i,
  /\bcommission\b/i,
  /\bproceeds\b/i,
  /\bsettle(?:s|d|ment)?\b/i,
  /\bescrow\b/i,
];

test("nothing this node adds claims a model can be bought, sold or paid for", () => {
  const listed = listContributedModel({
    model: fixtureModel(),
    contributor: CONTRIBUTOR,
    price: RECORDED_PRICE,
  });
  const refused = listContributedModel({ model: { nope: true }, contributor: CONTRIBUTOR });
  const drafted = runAgentTool("draft_contributed_model", {
    slug: "scan-subject",
    title: "Scan subject",
    summary: "A record produced purely to scan its own strings.",
    /* Deliberately free of transaction vocabulary. The scan below covers the
       strings THIS NODE authors; a drafted record echoes the contributor's own
       prose verbatim, and the first version of this fixture said
       "settlement-vocabulary scan", which the scan correctly caught. */
    notes: "Produced by the vocabulary scan in this spec.",
    bedrooms: 1,
    widthFt: 24,
    depthFt: 16,
    rights: LICENSED_RIGHTS,
  });

  const surfaces: string[] = [
    CONTRIBUTED_LISTING_NOTICE,
    NO_RECORDED_PRICE_SENTENCE,
    CONTRIBUTED_LISTING_STATUSES.join(" "),
    JSON.stringify(listed),
    JSON.stringify(refused),
    JSON.stringify(drafted),
    agentTool("draft_contributed_model").description,
    agentTool("validate_contributed_model").description,
    ...ALL_CASES.flatMap((item) => collectContributedModelProblems(item.model)),
  ];
  expect(surfaces.length).toBeGreaterThan(20);

  for (const surface of surfaces) {
    for (const pattern of SETTLEMENT_CLAIMS) {
      expect(surface, `a string this node produces matches ${pattern}`).not.toMatch(pattern);
    }
  }

  /* the scan is not vacuous: a control string that WOULD be a settlement
     claim is matched by it */
  const control = "Buy now — checkout, and your payout settles on release.";
  expect(SETTLEMENT_CLAIMS.some((pattern) => pattern.test(control))).toBe(true);
  expect(SETTLEMENT_CLAIMS.filter((pattern) => pattern.test(control)).length).toBeGreaterThanOrEqual(4);

  /* and the honest sentence is actually present, not merely the absence of a
     dishonest one — the site footer's own words, in this module */
  expect(CONTRIBUTED_LISTING_NOTICE).toContain("does not hold funds");
  expect(CONTRIBUTED_LISTING_NOTICE).toContain("is not a party to");
  expect(listed.notice).toBe(CONTRIBUTED_LISTING_NOTICE);
});

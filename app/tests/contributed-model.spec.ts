/* CONTRIBUTED MODELS — the contract, as tests.

   Four things are pinned here, and each of them is a promise that would be
   worth nothing unstated:

   1. THE ROUND TRIP. The JSON contract is what an outside contributor writes
      against, so a lossy conversion is a broken promise rather than a bug. It
      is pinned on a fixture AND on every non-Aura record the curated catalog
      already ships, because a format that can only express records written to
      fit it has not been tested.

      MK02 CLOSED THE HOLE IN THIS. The round-trip assertion used to be unable
      to fail on the one class of loss that actually happens: a contributor
      adds a top-level field, `contributedModelToPlanTemplate` builds its
      output from a fixed field list and drops it, `planTemplateToContributed
      Model` builds ITS output from the same fixed list, and both fixtures were
      written from that same list — so the comparison never saw a key that
      neither side carried. Two things replace it: unknown keys are now REFUSED
      BY NAME, and the round trip is now driven off the validator's own
      accepted-key lists rather than off a hand-written fixture, so a key the
      validator accepts and the converter does not know fails by name.

      MK03 CLOSED THE SAME HOLE ONE LEVEL DOWN. What MK02 shipped ran against
      CONTRIBUTED_MODEL_KEYS — the TOP-LEVEL list. `envelope` surviving as a key
      says nothing about `envelope.volumes[0].roof.facing` surviving as a field,
      so nested losslessness rested on a `toEqual` between two fixtures, which
      can only see a field the fixture carries. The roof record carried none:
      CONTRIBUTED_ROOF_KEYS was the one declared key list no assertion in this
      file read. Measured, not inferred — rebuilding each roof from form,
      pitchDeg and overhangFt, throwing `facing` away, left all 30 tests green.
      The survival check is now computed per PATH from the contract's own shape
      tree, the fixture is held to carrying every path the contract declares,
      and unknown keys are refused at every declared record with the whole path
      named.

   5. THE CATALOGUE GATE, PRE-ENFORCED. A contribution that validates here and
      then fails tests/plan-catalog.spec.ts is a promise broken after somebody
      did the work. An 80%-glazed contribution used to validate clean and would
      have failed the glazing-disclosure gate the moment it landed.

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
  CATALOG_MAX_SPAN_FT,
  CATALOG_MINIMUM_FLOOR_AREA_SQFT,
  CATALOGUE_GATES_MIRRORED,
  CATALOGUE_GATES_NOT_MIRRORED,
  CONTRIBUTED_COST_BASIS_KEYS,
  CONTRIBUTED_DECK_KEYS,
  CONTRIBUTED_ENVELOPE_KEYS,
  CONTRIBUTED_ID_PREFIX,
  CONTRIBUTED_KEY_SETS_ARE_COMPLETE,
  CONTRIBUTED_MODEL_CONTRACT,
  CONTRIBUTED_MODEL_KEYS,
  CONTRIBUTED_OPENING_KEYS,
  CONTRIBUTED_RIGHTS_ARE_PLAN_SOURCE,
  CONTRIBUTED_RIGHTS_KEYS,
  CONTRIBUTED_MODEL_SHAPE,
  CONTRIBUTED_ROOF_KEYS,
  CONTRIBUTED_SITING_KEYS,
  CONTRIBUTED_VOLUME_KEYS,
  collectCatalogueAdmissionProblems,
  collectContributedModelProblems,
  collectContributedModelShapeProblems,
  collectUnknownKeyProblems,
  contributedContractKeyPaths,
  contributedFloorAreaSqFt,
  contributedKeyPaths,
  contributedModelToPlanTemplate,
  planTemplateToContributedModel,
  provenanceNotice,
  validateContributedModel,
  type ContributedModel,
  type ContributedRights,
  type ContributedShape,
} from "@/lib/builder/contributedModel";
import { PLAN_TEMPLATES, type PlanTemplate } from "@/lib/builder/planCatalog";
import { validateBuilderDocument } from "@/lib/builder/document";
import { modelledGlazingRatio } from "@/lib/builder/toPlan";
import { FDWR_MAX } from "@/lib/design/materials";
import { totalFloorAreaSqFt, type Volume } from "@/lib/builder/spec";
import {
  CONTRIBUTED_LISTING_NOTICE,
  CONTRIBUTED_LISTING_STATUSES,
  CONTRIBUTED_MODEL_LISTINGS,
  NO_RECORDED_PRICE_SENTENCE,
  contributedListingFromPlanTemplate,
  contributedPriceRefusal,
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

/* A proxy basis that would ACTUALLY survive tests/plan-catalog.spec.ts: that
   gate wants more than 60 characters and a named way to close the gap. The
   first version of this fixture read "Steel packages need supplier quotes." —
   36 characters — which is exactly the contribution MK02 exists to stop:
   structurally valid, and refused by the catalog the moment it landed. */
const PROXY_COST_BASIS = {
  status: "proxy" as const,
  label: "Timber/SIP proxy",
  note:
    "The Alberta BOM prices a timber and SIP shell; a steel frame and polycarbonate glazing package " +
    "needs supplier quotes and an engineering review before this range means anything.",
};

/**
 * An 80%-glazed contribution with nothing in its notes about it.
 *
 * THIS IS THE COUNTEREXAMPLE MK02 WAS GIVEN. Every wall of a 24 × 16 shell is
 * glass except the west one: 228 + 228 + 152 = 608 sq ft of glass over 760 sq
 * ft of modelled wall. It is well-formed in every way the shape validator
 * checks — openings sit inside their walls, ids are unique, floor area clears
 * the minimum — so it validated CLEAN before this node, and would then have
 * failed the glazing-disclosure gate in tests/plan-catalog.spec.ts inside the
 * pull request that added it.
 */
function overGlazedModel(overrides: Partial<ContributedModel> = {}): ContributedModel {
  return fixtureModel({
    id: "contributed-glass-box",
    title: "Glass Box",
    envelope: {
      ...fixtureModel().envelope,
      volumes: [
        mainVolume({
          openings: [
            { id: "s-wall", wall: "s", kind: "glazing-wall", widthFt: 24, heightFt: 9.5, offsetFt: 0, sillFt: 0 },
            { id: "n-wall", wall: "n", kind: "glazing-wall", widthFt: 24, heightFt: 9.5, offsetFt: 0, sillFt: 0 },
            { id: "e-wall", wall: "e", kind: "glazing-wall", widthFt: 16, heightFt: 9.5, offsetFt: 0, sillFt: 0 },
          ],
        }),
      ],
    },
    ...overrides,
  });
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
    for (const costBasis of [undefined, PROXY_COST_BASIS]) {
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

/* --------------------------------------------------------------------------
   1a. THE ROUND TRIP, DRIVEN OFF THE CONTRACT RATHER THAN OFF A FIXTURE

   The assertion above compares two records that were both built from the same
   fixed field list. That is exactly why it could not see the loss it was named
   after. These three drive off the validator's OWN accepted-key lists, so the
   fixture cannot quietly stop exercising a field, and a key the validator
   accepts that the converter does not know fails by name.
   ------------------------------------------------------------------------ */

/**
 * The fixture with every optional field present, so it exercises the whole
 * accepted key set rather than the subset somebody happened to type.
 *
 * MK03 ADDED `roof.facing`, AND THAT WAS THE HOLE. `facing` is optional on
 * Roof, the base fixture's gable carries none, and CONTRIBUTED_ROOF_KEYS was
 * the one declared key list no assertion in this file ever read — the
 * completeness test below checked the model, rights, envelope, costBasis,
 * siting, deck, volume and opening key sets and skipped the roof. A key the
 * fixture does not carry is a key the round-trip `toEqual` cannot compare, so
 * the whole roof record sat outside every losslessness claim this spec made.
 *
 * `shed` is the honest carrier: spec.ts documents `facing` as the direction a
 * shed or saltbox slope faces, so putting it on a gable would be exercising the
 * key with meaningless data. Roof form enters neither modelledWallAreaSqFt nor
 * glazedAreaSqFt, so the 80%/13% glazing figures pinned elsewhere in this file
 * are untouched — those read fixtureModel(), not this.
 */
const fullyExercisedModel = (): ContributedModel =>
  fixtureModel({
    costBasis: PROXY_COST_BASIS,
    envelope: {
      ...fixtureModel().envelope,
      volumes: [mainVolume({ roof: { form: "shed", pitchDeg: 20, overhangFt: 1.5, facing: "s" } })],
    },
  });

/**
 * Every RECORD the contract's shape tree declares, as a path plus the shape
 * that governs it — WALKED from CONTRIBUTED_MODEL_SHAPE rather than listed.
 *
 * A list here would have exactly the failure mode MK03 exists to close: it
 * would be right when it was typed and silently short one entry the day the
 * contract grew a shape. Walking means a shape wired into the tree is covered
 * without anybody adding a line, and a shape NOT wired into the tree is absent
 * from the reachability assertion that reads this.
 */
function declaredRecordShapes(
  shape: ContributedShape = CONTRIBUTED_MODEL_SHAPE,
  at = "",
): Array<{ path: string; shape: ContributedShape }> {
  const found: Array<{ path: string; shape: ContributedShape }> = [{ path: at, shape }];
  for (const [key, child] of Object.entries(shape.children ?? {})) {
    const path = at === "" ? key : `${at}.${key}`;
    found.push(...declaredRecordShapes(child.shape, child.at === "array" ? `${path}[0]` : path));
  }
  return found;
}

/**
 * A fresh, fully detached fixture that can be mutated in place.
 *
 * FOUND BY THE INJECTION GATE BELOW, NOT BY READING. `fixtureModel()` spreads
 * `rights: LICENSED_RIGHTS` and takes `costBasis: PROXY_COST_BASIS` — both
 * MODULE-LEVEL CONSTANTS, handed out by reference. Writing a key into
 * `fixtureModel().rights` therefore writes it into every fixture every later
 * test in this file builds, and the failure surfaces somewhere else entirely.
 * Anything that mutates a fixture rather than overriding it must start here.
 */
const detachedFixture = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(fullyExercisedModel())) as Record<string, unknown>;

/** Walk `envelope.volumes[0].roof` on a real record and hand back the object it
 *  names, so a test can inject at a path the contract declares rather than at
 *  a place somebody hand-typed. */
function reachPath(root: Record<string, unknown>, path: string): Record<string, unknown> {
  if (path === "") return root;
  let node: unknown = root;
  for (const segment of path.split(".")) {
    const parsed = /^([A-Za-z]+)(?:\[(\d+)\])?$/.exec(segment);
    if (!parsed) throw new Error(`reachPath cannot parse "${segment}" of "${path}"`);
    node = (node as Record<string, unknown>)[parsed[1]];
    if (parsed[2] !== undefined) node = (node as unknown[])[Number(parsed[2])];
  }
  return node as Record<string, unknown>;
}

test("the fixture exercises every key the contract accepts, at every level", () => {
  /* Without this, adding a key to the contract and forgetting to add it to the
     fixture would leave the round-trip assertion below testing the old shape
     and reporting success. The fixture is not allowed to fall behind. */
  const model = fullyExercisedModel();
  expect(Object.keys(model).sort()).toEqual([...CONTRIBUTED_MODEL_KEYS].sort());
  expect(Object.keys(model.rights).sort()).toEqual([...CONTRIBUTED_RIGHTS_KEYS].sort());
  expect(Object.keys(model.envelope).sort()).toEqual([...CONTRIBUTED_ENVELOPE_KEYS].sort());
  expect(Object.keys(model.costBasis!).sort()).toEqual([...CONTRIBUTED_COST_BASIS_KEYS].sort());
  expect(Object.keys(model.envelope.siting).sort()).toEqual([...CONTRIBUTED_SITING_KEYS].sort());
  expect(Object.keys(model.envelope.deck!).sort()).toEqual([...CONTRIBUTED_DECK_KEYS].sort());
  const volume = model.envelope.volumes[0];
  expect(Object.keys(volume).sort()).toEqual([...CONTRIBUTED_VOLUME_KEYS].sort());
  expect(Object.keys(volume.openings[0]).sort()).toEqual([...CONTRIBUTED_OPENING_KEYS].sort());
  /* RENEGOTIATED IN PLACE (MK03). This line used to read: "`facing` is
     genuinely optional on Roof and the fixture's gable has none, so volumes are
     compared as a subset in that one direction only" — and no roof assertion
     followed it. The premise was true and the conclusion was the defect: the
     roof key set was the one of the nine that nothing here read, so a dropped
     `roof.facing` was invisible to this whole file. Measured, before the fix:
     making planTemplateToContributedModel rebuild each roof from form/pitchDeg/
     overhangFt only — throwing `facing` away — left all 30 tests in this file
     green. The fixture now carries it, so the exemption is gone rather than
     narrowed. */
  expect(Object.keys(volume.roof).sort()).toEqual([...CONTRIBUTED_ROOF_KEYS].sort());
  expect(CONTRIBUTED_KEY_SETS_ARE_COMPLETE.every((proof) => proof === true)).toBe(true);

  /* AND THE SAME QUESTION ASKED OF THE CONTRACT RATHER THAN OF THIS LIST.
     The eight assertions above are hand-written, which is how the roof came to
     be missed: they cover the shapes somebody thought of. This one is computed
     from CONTRIBUTED_MODEL_SHAPE, so a record shape added to the contract is
     demanded of the fixture without anybody adding a line here. */
  const declared = contributedContractKeyPaths();
  const carried = contributedKeyPaths(model);
  expect(
    declared.filter((path) => !carried.includes(path)),
    "the contract declares these paths and the fixture does not carry them — every assertion in this " +
      "file that reads the fixture has silently stopped covering them",
  ).toEqual([]);

  /* not a vacuous yardstick: it reaches four levels down, into the record that
     was outside it until MK03, and it indexes arrays rather than stopping at
     them */
  expect(declared).toContain("envelope.volumes[0].roof.facing");
  expect(declared).toContain("envelope.volumes[0].openings[0].sillFt");
  expect(declared.length).toBe(
    [
      CONTRIBUTED_MODEL_KEYS,
      CONTRIBUTED_RIGHTS_KEYS,
      CONTRIBUTED_ENVELOPE_KEYS,
      CONTRIBUTED_VOLUME_KEYS,
      CONTRIBUTED_ROOF_KEYS,
      CONTRIBUTED_OPENING_KEYS,
      CONTRIBUTED_DECK_KEYS,
      CONTRIBUTED_SITING_KEYS,
      CONTRIBUTED_COST_BASIS_KEYS,
    ].reduce((sum, keys) => sum + keys.length, 0),
  );
});

test("every key the contract accepts survives the round trip — a field the converter does not know fails here", () => {
  /* THE GATE THAT REPLACED THE VACUOUS ONE.

     `contributedModelToPlanTemplate` copies a fixed list of fields. If the
     contract ever accepts a key that list does not mention, the key is dropped
     on the way in and never comes back — and the old assertion could not see
     it, because its fixture was written from the converter's list too. Here
     the accepted list is the source of truth on BOTH sides: the record must
     carry every accepted key (asserted above), and the record that comes back
     must carry them all again, with the same values. */
  const model = fullyExercisedModel();
  const back = planTemplateToContributedModel(contributedModelToPlanTemplate(model));
  expect(back.ok, back.ok ? "" : back.problem).toBe(true);
  if (!back.ok) return;

  const survived = Object.keys(back.model);
  const lost = [...CONTRIBUTED_MODEL_KEYS].filter((key) => !survived.includes(key));
  expect(
    lost,
    "these keys are accepted by collectContributedModelProblems and dropped by " +
      "contributedModelToPlanTemplate — a contributor's field would vanish in silence",
  ).toEqual([]);
  expect(survived.sort()).toEqual([...CONTRIBUTED_MODEL_KEYS].sort());

  /* ------------------------------------------------------------------------
     MK03: THE SAME QUESTION, AT EVERY DEPTH.

     The four lines above are the whole of what MK02 shipped, and they run
     against CONTRIBUTED_MODEL_KEYS — the TOP-LEVEL list. `envelope` surviving
     as a key says nothing about `envelope.volumes[0].roof.facing` surviving as
     a field. Nested losslessness rested entirely on the `toEqual` below, which
     has two problems: it can only see a field the FIXTURE carries (the roof
     record carried none until this wave), and when it does fire it prints two
     objects side by side rather than naming what went missing. Measured, on the
     shipped fixture and a converter rebuilt to drop `facing`:

       Error: expect(received).toEqual(expected) // deep equality
       - Expected  - 1
       + Received  + 0
                 "roof": Object {
       -           "facing": "s",
                   "form": "gable",

     A reader has to diff that by eye to learn the word "facing". These two
     assertions answer in paths. */
  const before = contributedKeyPaths(model);
  const after = contributedKeyPaths(back.model);
  expect(
    before.filter((path) => !after.includes(path)),
    "these PATHS went in and did not come out — contributedModelToPlanTemplate or " +
      "planTemplateToContributedModel rebuilds a nested record from a fixed field list that no longer " +
      "matches the contract, and a contributor's field would vanish in silence",
  ).toEqual([]);
  expect(
    after.filter((path) => !before.includes(path)),
    "the round trip INVENTED these paths — a field nobody submitted is as wrong as a field that vanished",
  ).toEqual([]);

  /* non-vacuous: the comparison really does reach the record that used to sit
     outside it, and really does index into arrays */
  expect(before).toContain("envelope.volumes[0].roof.facing");
  expect(before).toContain("envelope.volumes[0].openings[2].sillFt");
  expect(before.length).toBeGreaterThan(CONTRIBUTED_MODEL_KEYS.length);

  expect(back.model).toEqual(model);
});

test("a field the contract does not name is refused by name, not dropped", () => {
  /* The other half of the same hole. Dropping is the worst of the three
     options: it neither carries the contributor's data nor tells them. */
  const withStrayField = { ...fixtureModel(), energyRating: "Net zero ready" } as unknown;
  const problems = collectContributedModelProblems(withStrayField);
  expect(problems.length).toBeGreaterThan(0);
  expect(problems.join(" | ")).toContain("energyRating");
  expect(problems.join(" | ")).toContain(CONTRIBUTED_MODEL_CONTRACT);
  expect(validateContributedModel(withStrayField).ok).toBe(false);

  /* and the record without it is accepted, so the refusal is about the stray
     key rather than about the fixture */
  expect(validateContributedModel(fixtureModel()).ok).toBe(true);

  // every nested record shape is covered too, each naming its own path
  const nested: Array<[string, unknown]> = [
    ["rights.trustMe", fixtureModel({ rights: { ...LICENSED_RIGHTS, trustMe: true } as never })],
    [
      "envelope.orientation",
      fixtureModel({ envelope: { ...fixtureModel().envelope, orientation: "south" } as never }),
    ],
    [
      "envelope.volumes[0].wallThicknessMm",
      fixtureModel({
        envelope: {
          ...fixtureModel().envelope,
          volumes: [{ ...mainVolume(), wallThicknessMm: 240 } as never],
        },
      }),
    ],
    [
      "envelope.volumes[0].roof.colour",
      fixtureModel({
        envelope: {
          ...fixtureModel().envelope,
          volumes: [mainVolume({ roof: { form: "gable", pitchDeg: 35, overhangFt: 1.5, colour: "black" } as never })],
        },
      }),
    ],
    [
      "envelope.volumes[0].openings[0].uValue",
      fixtureModel({
        envelope: {
          ...fixtureModel().envelope,
          volumes: [
            mainVolume({
              openings: [
                { id: "main-glass", wall: "s", kind: "glazing-wall", widthFt: 10, heightFt: 8, offsetFt: 2, sillFt: 0, uValue: 0.8 } as never,
              ],
            }),
          ],
        },
      }),
    ],
    [
      "envelope.deck.pergola",
      fixtureModel({
        envelope: {
          ...fixtureModel().envelope,
          deck: { wall: "s", widthFt: 12, depthFt: 8, hotTub: false, pergola: true } as never,
        },
      }),
    ],
    [
      "envelope.siting.elevationFt",
      fixtureModel({
        envelope: {
          ...fixtureModel().envelope,
          siting: { frontFacesDeg: 180, slope: "flat", elevationFt: 2200 } as never,
        },
      }),
    ],
    [
      "costBasis.currency",
      fixtureModel({ costBasis: { ...PROXY_COST_BASIS, currency: "CAD" } as never }),
    ],
  ];
  /* STRENGTHENED (MK03): this loop used to slice the last segment off `path`
     and assert only that the KEY appeared somewhere in the joined refusals. A
     contributor told `colour is not a field` about a three-volume model has to
     guess which roof they typed it on, and the assertion would have passed just
     the same if the path prefix had been dropped or had been wrong. The whole
     path is asserted now, and the refusal must OPEN with it rather than merely
     contain it, so `roof.colour` cannot satisfy a claim about
     `envelope.volumes[0].roof.colour`. */
  for (const [path, model] of nested) {
    const problems = collectContributedModelProblems(model);
    const named = problems.filter((problem) => problem.startsWith(`${path} is not a field`));
    expect(named.length, `${path} must be refused by its whole path, exactly once`).toBe(1);
  }
});

test("an unknown key is refused at EVERY record the contract declares, named by its whole path", () => {
  /* THE GATE THE HAND-WIRING NEVER HAD.

     MK02's unknown-key refusals were nine separate calls, one per record shape.
     Nine was the right number when it was written, and nothing anywhere held it
     to being the right number: a tenth nested record could join the contract
     and the only thing between it and an unwalked shape was somebody
     remembering. This walks the contract's own shape tree and smuggles a key
     into every record it finds, so an unwired shape fails here by path rather
     than by being noticed in review. */
  const records = declaredRecordShapes();

  /* Every exported key list is reachable from the tree. An orphan list — one
     the contract declares and the walk never reaches — is exactly the tenth
     shape nobody wired up, and it fails here rather than in a contributor's
     pull request. CONTRIBUTED_KEY_SETS_ARE_COMPLETE already ties each list to
     its interface at compile time, so this closes the chain:
     interface -> key list -> shape tree -> walked. */
  expect(
    records.map((record) => record.shape.keys.join(",")).sort(),
    "a key list the contract exports is not reachable from CONTRIBUTED_MODEL_SHAPE — nothing walks it, " +
      "so an unknown key inside that record is dropped rather than refused",
  ).toEqual(
    [
      CONTRIBUTED_MODEL_KEYS,
      CONTRIBUTED_RIGHTS_KEYS,
      CONTRIBUTED_ENVELOPE_KEYS,
      CONTRIBUTED_VOLUME_KEYS,
      CONTRIBUTED_ROOF_KEYS,
      CONTRIBUTED_OPENING_KEYS,
      CONTRIBUTED_DECK_KEYS,
      CONTRIBUTED_SITING_KEYS,
      CONTRIBUTED_COST_BASIS_KEYS,
    ]
      .map((keys) => keys.join(","))
      .sort(),
  );
  /* the walk reaches four levels, not just the two the eye checks */
  expect(records.map((record) => record.path)).toContain("envelope.volumes[0].openings[0]");
  expect(records.map((record) => record.path)).toContain("envelope.volumes[0].roof");

  for (const { path, shape } of records) {
    const model = detachedFixture();
    reachPath(model, path).smuggled = "a field nobody asked for";
    const fullPath = path === "" ? "smuggled" : `${path}.smuggled`;

    const problems = collectContributedModelProblems(model);
    const named = problems.filter((problem) => problem.startsWith(`${fullPath} is not a field`));
    expect(named.length, `a key smuggled into ${path || "the model record"} must be refused by its whole path`).toBe(1);

    /* and the refusal must quote the key list of the record it is talking
       about. The old message read "This contract carries exactly: form,
       pitchDeg, overhangFt, facing" for a roof — naming the path correctly and
       then telling the contributor something false about the contract. */
    expect(named[0]).toContain(shape.label);
    expect(named[0]).toContain(shape.keys.join(", "));
    expect(named[0]).toContain(CONTRIBUTED_MODEL_CONTRACT);
    expect(named[0]).toContain("refused rather than dropped in silence");

    /* the record without the smuggled key is accepted, so each refusal is about
       the stray key rather than about the injection site */
    expect(collectContributedModelProblems(fullyExercisedModel())).toEqual([]);
  }

  /* the walker is the one the validator uses, and it agrees with itself */
  const deep = detachedFixture();
  reachPath(deep, "envelope.volumes[0].openings[1]").glazingCoating = "low-e";
  expect(collectUnknownKeyProblems(deep).map((problem) => problem.split(" ")[0])).toEqual([
    "envelope.volumes[0].openings[1].glazingCoating",
  ]);
  expect(collectContributedModelProblems(deep)).toEqual(collectUnknownKeyProblems(deep));
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
   1b. THE CATALOGUE GATE, PRE-ENFORCED

   The contract's promise is that a record which validates here lands. A
   contribution that passes this validator and then fails
   tests/plan-catalog.spec.ts is a promise broken after somebody did the work,
   inside a pull request they cannot debug.
   ========================================================================== */

test("an 80%-glazed contribution is refused HERE, not in the pull request that adds it", () => {
  /* THE COUNTEREXAMPLE. Before MK02 this record validated clean: it is
     well-formed in every way the shape layer checks. It would then have failed
     tests/plan-catalog.spec.ts's glazing-disclosure gate on landing. */
  const model = overGlazedModel();
  expect(collectContributedModelShapeProblems(model), "the counterexample must be WELL-FORMED — a record refused for its shape would prove nothing about the catalogue layer").toEqual([]);

  const ratio = modelledGlazingRatio(contributedModelToPlanTemplate(model).spec);
  expect(ratio).toBeGreaterThan(FDWR_MAX);
  expect(Math.round(ratio * 100)).toBe(80);

  const problems = collectContributedModelProblems(model);
  expect(problems.length).toBeGreaterThanOrEqual(4);
  const joined = problems.join(" | ");
  expect(joined).toContain("22% NBC 9.36 prescriptive ceiling");
  expect(joined).toContain("80% of the modelled wall area");
  expect(joined).toMatch(/performance path/);
  expect(joined).toMatch(/heat loss|overheat/);
  expect(validateContributedModel(model).ok).toBe(false);

  /* and it is ACCEPTED once it discloses, so the gate is about the silence
     rather than about the glass — the catalog allows a glass-forward home */
  const disclosed = overGlazedModel({
    notes:
      "This envelope is glazed to 80% of the modelled wall area, well above the 22% NBC 9.36 " +
      "prescriptive ceiling. It needs the performance path rather than the prescriptive one, and in " +
      "a zone 7A winter that glass is where the heat loss is — triple glazing and a real heating " +
      "strategy are not optional here.",
  });
  expect(collectContributedModelProblems(disclosed), "a disclosed over-glazed contribution is allowed").toEqual([]);
});

test("a contribution cannot wear a disclosure it did not earn, or state a percentage that has rotted", () => {
  const liar = fixtureModel({
    notes:
      "Glazed well above the 22% NBC 9.36 prescriptive ceiling, on the performance path, with the " +
      "heat loss that implies.",
  });
  expect(modelledGlazingRatio(contributedModelToPlanTemplate(liar).spec)).toBeLessThanOrEqual(FDWR_MAX);
  expect(collectContributedModelProblems(liar).join(" | ")).toContain("under the ceiling");

  const drifted = fixtureModel({ notes: "A compact cabin modelled at 41% glazing across its envelope." });
  expect(collectContributedModelProblems(drifted).join(" | ")).toContain("13%");
});

test("the other catalogue gates are pre-enforced too — overlap, span and a proxy that says nothing", () => {
  const overlapping = fixtureModel({
    envelope: {
      ...fixtureModel().envelope,
      volumes: [
        mainVolume({
          openings: [
            { id: "glass", wall: "s", kind: "glazing-wall", widthFt: 10, heightFt: 8, offsetFt: 2, sillFt: 0 },
            { id: "door", wall: "s", kind: "door", widthFt: 3, heightFt: 6.8, offsetFt: 9.7, sillFt: 0 },
          ],
        }),
      ],
    },
  });
  expect(collectContributedModelProblems(overlapping).join(" | ")).toContain("same piece of the s wall");

  const oversized = fixtureModel({
    envelope: {
      ...fixtureModel().envelope,
      volumes: [mainVolume({ widthFt: 46, openings: [] })],
    },
  });
  expect(collectContributedModelProblems(oversized).join(" | ")).toContain(`${CATALOG_MAX_SPAN_FT} ft`);

  for (const [label, basis] of [
    ["a note too short to say anything", { ...PROXY_COST_BASIS, note: "Steel packages need supplier quotes." }],
    ["a label that does not say proxy", { ...PROXY_COST_BASIS, label: "Alberta basis" }],
    [
      "a note that never names what closes the gap",
      {
        ...PROXY_COST_BASIS,
        note:
          "The range comes from the shared Alberta bill of materials and does not represent this " +
          "design's intended construction in any way at all.",
      },
    ],
  ] as const) {
    const problems = collectContributedModelProblems(fixtureModel({ costBasis: basis }));
    expect(problems.join(" | "), `${label} must be refused`).toContain("costBasis");
  }

  // and the compliant proxy basis is accepted
  expect(collectContributedModelProblems(fixtureModel({ costBasis: PROXY_COST_BASIS }))).toEqual([]);
});

/** The two ids tests/plan-catalog.spec.ts grandfathers by name in
 *  OVER_GLAZED_BEFORE_THIS_GATE. Both are `aura-authored`, so no contribution
 *  can ever be one of them; they are restated here only so this spec can say
 *  which library records its mirror is allowed to refuse. */
const CATALOG_GRANDFATHERED_OVER_GLAZED = ["fjell-cube", "lys-lantern"] as const;

test("the pre-enforced mirror refuses none of the plans the catalog already ships", () => {
  /* THE OTHER HALF OF A GATE THAT WORKS. It is not enough that the mirror
     catches the counterexample — it must not reject honest work. If it refused
     a shipped record, this mirror would be stricter than the gate it mirrors
     and would block real contributions for no reason. */
  const refused = PLAN_TEMPLATES.filter((plan) => collectCatalogueAdmissionProblems(plan).length > 0).map(
    (plan) => plan.id,
  );
  const unexpected = refused.filter(
    (id) => !(CATALOG_GRANDFATHERED_OVER_GLAZED as readonly string[]).includes(id),
  );
  expect(
    unexpected,
    "the pre-enforced catalogue mirror refuses a plan the catalog itself accepts — it is stricter than tests/plan-catalog.spec.ts and would block honest contributions",
  ).toEqual([]);
  expect(PLAN_TEMPLATES.length - refused.length).toBeGreaterThanOrEqual(53);

  /* Not a vacuous sweep: every refusal it does make is the glazing disclosure
     the catalog spec grandfathers by the same two names. */
  for (const id of refused) {
    const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id)!;
    expect(modelledGlazingRatio(plan.spec)).toBeGreaterThan(FDWR_MAX);
    expect(collectCatalogueAdmissionProblems(plan).join(" | ")).toContain("NBC 9.36");
  }
});

test("the gates this module cannot pre-enforce are written down rather than left as a surprise", () => {
  expect(CATALOGUE_GATES_MIRRORED.length).toBeGreaterThanOrEqual(8);
  expect(CATALOGUE_GATES_NOT_MIRRORED.length).toBeGreaterThan(0);
  /* Both unmirrored gates are cross-record: they are facts about a
     contribution's relationship to the other plans, and this module holds no
     reference to the catalog's data on purpose. Naming them is the handoff. */
  for (const gate of CATALOGUE_GATES_NOT_MIRRORED) {
    expect(gate).toMatch(/needs PLAN_TEMPLATES|needs the whole library/);
  }
  expect(CATALOGUE_GATES_NOT_MIRRORED.join(" ")).toContain("same building wearing a different name");
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

/**
 * The one corpus record the two implementations no longer agree on, and the
 * exact string that differs.
 *
 * RENEGOTIATED IN PLACE, NOT WEAKENED (MK02). The parity target moved from
 * `collectContributedModelProblems` to `collectContributedModelShapeProblems`,
 * because the app grew a second layer — catalogue admission — that agent/
 * cannot compute: it needs `modelledGlazingRatio` and the NBC ceiling out of
 * app/lib, which agent/ has zero imports from by design. The SHAPE layer is
 * still compared string for string across the whole corpus.
 *
 * Within that layer there is now exactly one divergence, and it is written
 * down rather than tolerated. MK02 fixed the early return in `rightsProblems`
 * that stopped after the `kind` refusal and never checked the rest of the
 * block — so an "aura-authored" contribution whose `relationship` is also
 * wrong now gets both reasons at once. The mirror in
 * agent/src/mcp/tools.ts `cmRightsProblems` still returns early, and that file
 * is outside this node's write set. This list is closed and asserted exactly:
 * a NEW divergence fails, and so does a stale entry.
 */
const KNOWN_AGENT_SHAPE_DIVERGENCES: Record<string, string[]> = {
  "a contributor signing as Aura Homes": [
    "rights.relationship must be \"dimensional-adaptation\" or \"system-informed-study\".",
  ],
};

test("the agent's validator and the app's agree, string for string, on every refusal", () => {
  /* agent/ cannot import app/lib/builder, so these are two implementations of
     one contract. Mirrored logic drifts; this is the detector. */
  const corpus = parityCorpus();
  expect(corpus.length).toBeGreaterThan(150);
  let sawProblems = 0;
  let sawDivergence = 0;
  for (const item of corpus) {
    const mine = collectContributedModelShapeProblems(item.model);
    const theirs = agentProblems(item.model);
    const pinned = KNOWN_AGENT_SHAPE_DIVERGENCES[item.label];
    if (pinned) {
      sawDivergence += 1;
      expect(
        mine.filter((problem) => !theirs.includes(problem)),
        `the pinned divergence for "${item.label}" is not the one recorded — re-read agent/src/mcp/tools.ts cmRightsProblems`,
      ).toEqual(pinned);
      expect(
        theirs.filter((problem) => !mine.includes(problem)),
        `the agent reports something the app does not for "${item.label}"`,
      ).toEqual([]);
    } else {
      expect(theirs, `the agent and the app disagree about "${item.label}"`).toEqual(mine);
    }
    if (mine.length > 0) sawProblems += 1;
  }
  /* the corpus really does break things — a sweep that produced only valid
     records would compare two empty lists and prove nothing */
  expect(sawProblems).toBeGreaterThan(corpus.length - 12);
  /* a stale exemption is worse than no exemption: every pinned divergence must
     still be a real one, reached by a real corpus record */
  expect(sawDivergence).toBe(Object.keys(KNOWN_AGENT_SHAPE_DIVERGENCES).length);

  // and they agree that a sound record has nothing wrong with it
  expect(agentProblems(fixtureModel())).toEqual([]);
  expect(agentProblems(fixtureModel({ rights: PUBLIC_DOMAIN_RIGHTS }))).toEqual([]);
});

test("a bad rights kind no longer hides the rest of the block — every reason, in one pass", () => {
  /* The early return this replaces handed back ONE problem and stopped, so a
     contributor with two things wrong fixed one and was handed the next. The
     list form exists precisely to avoid that loop. */
  const model = fixtureModel({
    rights: { ...LICENSED_RIGHTS, kind: "trust-me" as never, attribution: "", url: "http://example.org" },
  });
  const problems = collectContributedModelShapeProblems(model);
  expect(problems.join(" | ")).toContain("rights.kind");
  expect(problems.join(" | ")).toContain("rights.attribution");
  expect(problems.join(" | ")).toContain("rights.url");
  expect(problems.length).toBeGreaterThanOrEqual(3);

  /* the arm-specific rules stay skipped, and that is not the same defect: with
     no valid arm there is no arm rule to apply, so reporting one would be
     inventing a requirement */
  expect(problems.join(" | ")).not.toContain("shareAlike");
});

test("two whole classes of refusal the agent's mirror does not yet make, named with the file to change", () => {
  /* HONESTY OVER COMPLETION. agent/src/mcp/tools.ts is outside this node's
     write set, so its `contributedModelProblems` is now a STRICT SUBSET of the
     app's. Rather than let that be discovered by a contributor whose record
     the MCP tool called valid and the app refused, both classes are pinned
     here. When agent/ gains them, these assertions go red and must be flipped
     — which is the point. */
  const strayKey = { ...fixtureModel(), energyRating: "Net zero ready" } as unknown;
  expect(collectContributedModelProblems(strayKey).join(" | ")).toContain("energyRating");
  expect(
    agentProblems(strayKey),
    "agent/src/mcp/tools.ts contributedModelProblems now rejects unknown keys — delete this pin and fold the case back into the parity corpus",
  ).toEqual([]);

  const overGlazed = overGlazedModel();
  expect(collectContributedModelProblems(overGlazed).join(" | ")).toContain("NBC 9.36");
  expect(
    agentProblems(overGlazed),
    "agent/src/mcp/tools.ts now pre-enforces the catalogue glazing gate — delete this pin",
  ).toEqual([]);
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
  /* compared against the SHAPE layer, which is the layer the agent mirrors —
     see KNOWN_AGENT_SHAPE_DIVERGENCES above for why the target moved */
  expect(result.problemCount).toBe(collectContributedModelShapeProblems(broken).length);
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

test("a price refusal names the field the contributor actually submitted", () => {
  /* The rule is homeModels' — one definition of "a price needs a date and a
     basis". Its MESSAGES were written for FinishedHomeModel, where the price
     lives at `price.numeric`. A contributed submission has no `numeric`, so an
     unmodified message pointed the contributor at a field they never wrote:
     refusing without naming a real field, dressed up as naming one. */
  const cases: Array<[string, unknown]> = [
    ["price.asOfISO", { amount: 750, currency: "CAD", basis: "maker-published" }],
    ["price.basis", { amount: 750, currency: "CAD", asOfISO: "2026-08-14T00:00:00.000Z" }],
    ["price.amount", { amount: -1, currency: "CAD", asOfISO: "2026-08-14T00:00:00.000Z", basis: "maker-published" }],
    ["price.currency", { amount: 750, currency: "dollars", asOfISO: "2026-08-14T00:00:00.000Z", basis: "maker-published" }],
    ["price is not a record", "seven hundred and fifty"],
  ];
  for (const [names, price] of cases) {
    const listing = listContributedModel({ model: fixtureModel(), contributor: CONTRIBUTOR, price });
    expect(listing.status).toBe("refused");
    const joined = listing.refusals.join(" | ");
    expect(joined, `a bad price must be refused as ${names}`).toContain(names.split(" ")[0]);
    expect(
      joined,
      "a contributed price refusal must never name price.numeric — that field belongs to FinishedHomeModel and the contributor never wrote it",
    ).not.toContain("price.numeric");
  }

  /* the rewrite is anchored on the prefix and passes anything else through
     untouched, rather than guessing — so a reworded message upstream arrives
     visibly unanchored instead of silently mangled */
  expect(contributedPriceRefusal("price.numeric.amount is not a positive finite number.")).toBe(
    "price.amount is not a positive finite number.",
  );
  expect(contributedPriceRefusal("something else entirely.")).toBe("something else entirely.");
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

  /* THE REFUSAL IS THE ONE THAT WAS ACTUALLY MADE (MK02).

     This path used to validate a stub record — `{ contract }` and nothing else
     — purely to obtain the listing shape, then throw away the dozen refusals
     that stub produced and substitute the reversal's. The returned listing
     therefore carried a `refusals` array that had not come from the check that
     produced the rest of it, contradicting listContributedModel's own
     docstring. It is built directly now: exactly one thing was checked and
     exactly one thing failed, so exactly one reason comes back — and none of
     the stub's consequential noise about a record nobody submitted. */
  expect(refused.refusals.length).toBe(1);
  expect(refused.refusals.join(" ")).not.toContain("envelope");
  expect(refused.refusals.join(" ")).not.toContain("contract must be");
  expect(refused.id).toBe(aura!.id);
  expect(refused.model).toBeNull();
  expect(refused.rights).toBeNull();
  expect(refused.contributor).toBeNull();
  for (const fact of Object.values(refused.facts)) {
    expect(fact.status).toBe("unknown");
    expect(fact.value).toBeNull();
  }
  expect(contributedListingFromPlanTemplate(aura!, CONTRIBUTOR, { demonstration: true }).demonstration).toBe(true);
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

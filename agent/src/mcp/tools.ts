// The aura-brain MCP tool set: thin typed wrappers over the EXISTING agent
// modules (../parcels, ../pipeline, ../claude, ../brain). No pipeline or brain
// logic is reimplemented here — each handler validates input with zod, merges
// defaults from the bundled samples, and calls the module.

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  escrowPosition,
  detectSlips,
  getGuidance,
  renderDigest,
  STAGE_ORDER,
} from "../brain";
import { generateNarrative } from "../claude";
import { filterParcels } from "../parcels";
import {
  budgetToMilestones,
  designBriefToBudget,
  questionnaireToDesignBrief,
} from "../pipeline";
import {
  absorb,
  forget,
  liveFacts,
  loadMemory,
  memoryPath,
  retrieveScored,
  saveMemory,
} from "../brain/memory";
import { isRepoCostModel } from "../types";
import { reduceWithAssist } from "../concierge/assist";
import { PARTNER_STATE } from "../concierge/catalog";
import { createOrder } from "../concierge/order";
import { ConciergeContext, ConciergeIntent } from "../concierge/reducer";
import { listOrders, loadOrder, orderPath, saveOrder } from "../concierge/store";
import { ALBERTA_FACTS, FACTS_DISCLAIMER, findFacts } from "./facts";
import {
  loadCostModel,
  loadSampleParcels,
  loadSampleQuestionnaire,
  loadSuppliers,
  mergeQuestionnaire,
  normalizeJourney,
  SUPPLIERS_PATH,
} from "./load";

// ---------------------------------------------------------------- zod schemas

const aquiferSchema = z.enum(["reliable", "unreliable", "unknown"]);

const parcelListingSchema = z.object({
  id: z.string(),
  name: z.string().describe('Display name, e.g. "37 Aspen Road"'),
  county: z.string(),
  district: z.string().describe("Planning district within the county (districts set minimums, never counties)"),
  priceCad: z.number(),
  minDwellingSizeSqft: z
    .number()
    .nullable()
    .describe("District minimum dwelling size; null = not yet verified against the land-use bylaw"),
  aquifer: aquiferSchema,
  gridDistanceKm: z.number(),
  septicSoils: z.boolean().describe("true = soils suit a conventional septic field"),
  acreage: z.number().optional(),
  basis: z.string().optional().describe("Sourcing note"),
});

const questionnairePatchSchema = z
  .object({
    projectName: z.string().optional(),
    parcel: z
      .object({
        county: z.string().optional(),
        district: z.string().optional(),
        minDwellingSizeSqft: z.number().optional(),
        acreage: z.number().optional(),
        aquifer: aquiferSchema.optional(),
        gridDistanceKm: z.number().optional(),
        septicSoils: z.boolean().optional(),
        gridPowerAtLine: z.boolean().optional(),
        landBudgetCad: z.object({ low: z.number(), high: z.number() }).optional(),
      })
      .optional(),
    home: z
      .object({
        sizeSqft: z.number().optional(),
        style: z.enum(["modernCabin", "aFrame", "bungalow", "storeyAndAHalf", "custom"]).optional(),
        storeys: z.union([z.literal(1), z.literal(2)]).optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        glazingRatio: z.number().min(0).max(1).optional().describe("Fraction of wall area glazed, 0..1"),
      })
      .optional(),
    energy: z
      .object({
        solarKw: z.number().optional(),
        batteryKwh: z.number().optional(),
        backupGenerator: z.boolean().optional(),
        generatorKw: z.number().optional(),
        woodStove: z.boolean().optional(),
      })
      .optional(),
    water: z
      .object({
        source: z.enum(["cistern", "well", "awgSupplement"]).optional(),
        cisternLitres: z.number().optional(),
        septic: z
          .enum(["tankAndField", "mound", "holdingTank", "packagedTreatment", "biofilterDrip"])
          .optional(),
      })
      .optional(),
    extras: z
      .object({
        hotTub: z.boolean().optional(),
        deck: z.boolean().optional(),
        deckSqft: z.number().optional(),
        hrv: z.boolean().optional(),
      })
      .optional(),
    contingencyRate: z.number().optional().describe("Contingency as a fraction of subtotal (built-in model only; the repo cost-model file's contingencyPct governs otherwise)"),
  })
  .describe("Partial questionnaire; anything omitted falls back to the bundled sample (800 sqft modern cabin, Lac Ste. Anne Agricultural parcel)");

const substepSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["pending", "active", "waitingOn", "done"]),
  waitingOn: z
    .object({
      who: z.enum(["owner", "pro", "county", "supplier", "platform"]),
      what: z.string(),
      sinceISO: z.string(),
    })
    .optional(),
  completedISO: z.string().optional(),
});

const substepList = z.array(substepSchema);

const journeyInputSchema = z
  .object({
    buildId: z.string(),
    projectName: z.string(),
    parcel: z.string().optional().describe('Display string, e.g. "37 Aspen Road, Lac Ste. Anne County"'),
    stage: z.enum(["land", "design", "budget", "escrow", "build"]),
    substeps: z
      .object({
        land: substepList.optional(),
        design: substepList.optional(),
        budget: substepList.optional(),
        escrow: substepList.optional(),
        build: substepList.optional(),
      })
      .optional(),
    blockers: z
      .array(
        z.object({
          id: z.string(),
          description: z.string(),
          raisedISO: z.string(),
          resolvedISO: z.string().optional(),
        })
      )
      .optional(),
    escrow: z.object({
      holdbackRateBps: z.number().describe("1000 = 10%, matches AuraBuildEscrow default"),
      holdbackPeriodDays: z.number().describe("60, matches AuraBuildEscrow default"),
      milestones: z.array(
        z.object({
          index: z.number(),
          name: z.string(),
          amountCad: z.number(),
          holdbackCad: z.number(),
          status: z.enum(["awaitingFunding", "funded", "released"]),
          approvals: z
            .object({ owner: z.string().optional(), builder: z.string().optional() })
            .optional(),
          releasedISO: z.string().optional(),
          holdbackReleased: z.boolean().optional(),
          holdbackReleasedISO: z.string().optional(),
        })
      ),
    }),
    keyDates: z
      .object({
        landClosedISO: z.string().optional(),
        designCompleteISO: z.string().optional(),
        drawingsApprovedISO: z.string().optional(),
        permitSubmittedISO: z.string().optional(),
        permitIssuedISO: z.string().optional(),
        sipOrderedISO: z.string().optional(),
        sipDeliveredISO: z.string().optional(),
        foundationCompleteISO: z.string().optional(),
        buildStartISO: z.string().optional(),
        moveInISO: z.string().optional(),
      })
      .optional(),
    emailPrefs: z
      .object({
        weeklyDigest: z.boolean(),
        materialChanges: z.boolean(),
        address: z.string().optional(),
      })
      .optional(),
  })
  .describe("A JourneyState; omit to use the bundled sample journey (Aura Pilot Build 01, escrow stage)");

const nowISOSchema = z
  .string()
  .optional()
  .describe('ISO timestamp used as "now" by the timer rules; defaults to the current time');

function parseNow(nowISO?: string): Date {
  if (!nowISO) return new Date();
  const d = new Date(nowISO);
  if (isNaN(d.getTime())) {
    throw new McpError(ErrorCode.InvalidParams, `nowISO is not a valid ISO timestamp: ${nowISO}`);
  }
  return d;
}

// ---------------------------------------------------------------- tool registry

export interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: never) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

function defineTool<T extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  schema: T,
  handler: (args: z.infer<T>) => Record<string, unknown> | Promise<Record<string, unknown>>
): ToolDef {
  return { name, description, schema, handler: handler as ToolDef["handler"] };
}

// ---------------------------------------------------------------- the 10 tools

const checkParcel = defineTool(
  "check_parcel",
  "LAND stage: evaluate parcel listings against a design questionnaire. The hard gate is the " +
    "DISTRICT minimum dwelling size (districts, never counties, set it) plus aquifer, grid distance, " +
    "and septic-soil advisories. Defaults: bundled sample parcels vs the 800 sqft sample design " +
    "(which the 1,076 sqft Country Residential minimum at Lakeside Estates REJECTS).",
  z.object({
    parcels: z
      .array(parcelListingSchema)
      .optional()
      .describe("Parcel listings to evaluate; defaults to the bundled Lac Ste. Anne / Sturgeon samples"),
    questionnaire: questionnairePatchSchema.optional(),
  }),
  (args) => {
    const q = mergeQuestionnaire(loadSampleQuestionnaire(), args.questionnaire);
    const parcels = args.parcels ?? loadSampleParcels();
    const results = filterParcels(parcels, q);
    return {
      designSqft: q.home.sizeSqft,
      parcelCount: parcels.length,
      results,
    };
  }
);

const generateDesignBrief = defineTool(
  "generate_design_brief",
  "DESIGN stage: questionnaire to constraint-checked design brief (SIP shell spec, screw-pile count, " +
    "solar/battery sizing with the winter floor, water source with the aquifer rule, FDWR check). " +
    "Accepts a partial questionnaire merged over the bundled sample. Narrative comes from Claude when " +
    "ANTHROPIC_API_KEY is set, else the deterministic offline fallback.",
  z.object({ questionnaire: questionnairePatchSchema.optional() }),
  async (args) => {
    const q = mergeQuestionnaire(loadSampleQuestionnaire(), args.questionnaire);
    const core = questionnaireToDesignBrief(q);
    const { narrative, narrativeSource } = await generateNarrative(core, q);
    return { ...core, narrative, narrativeSource };
  }
);

const budgetEstimate = defineTool(
  "budget_estimate",
  "BUDGET stage: design brief to LOW/MID/HIGH budget lines and totals in CAD, priced from " +
    "data/alberta/cost-model.json (totals reconcile to the file's totalsRule; land informational, " +
    "excluded from totals). Accepts a partial questionnaire merged over the bundled sample.",
  z.object({ questionnaire: questionnairePatchSchema.optional() }),
  (args) => {
    const q = mergeQuestionnaire(loadSampleQuestionnaire(), args.questionnaire);
    const brief = questionnaireToDesignBrief(q);
    const { model, source, extras } = loadCostModel();
    const budget = designBriefToBudget(brief, model, q.contingencyRate);

    let reconciliation: Record<string, unknown> = { costModelSource: source };
    if (isRepoCostModel(model) && extras.totalsExLand) {
      const referenceSqft = model.referenceHome?.sqft ?? 800;
      const atReferenceSpec =
        q.home.sizeSqft === referenceSqft && (q.extras.hotTub || q.extras.deck);
      const t = budget.total;
      const f = extras.totalsExLand;
      const matches = t.lowCad === f.low && t.midCad === f.mid && t.highCad === f.high;
      reconciliation = {
        costModelSource: source,
        asOf: extras.asOf,
        totalsRule: extras.totalsRule,
        fileTotalsExLand: f,
        computedTotalsExLand: { low: t.lowCad, mid: t.midCad, high: t.highCad },
        reconcilesToFile: atReferenceSpec ? matches : "not-applicable",
        note: atReferenceSpec
          ? matches
            ? "Computed totals equal data/alberta/cost-model.json totalsExLand to the dollar."
            : "MISMATCH: computed totals do not equal the file's totalsExLand — investigate before publishing figures."
          : `Design deviates from the ${referenceSqft} sqft reference spec, so the file's totalsExLand ` +
            "do not apply verbatim; totals still follow the file's totalsRule (sum of line items x (1 + contingencyPct)).",
      };
    }

    return {
      projectName: q.projectName,
      sizeSqft: q.home.sizeSqft,
      budget,
      reconciliation,
    };
  }
);

const milestoneSchedule = defineTool(
  "milestone_schedule",
  "ESCROW stage: budget (MID column) to the escrow milestone schedule with the Alberta statutory " +
    "10% holdback modeled per milestone (releasable after 60 days), mirroring AuraBuildEscrow. " +
    "Accepts a partial questionnaire merged over the bundled sample.",
  z.object({ questionnaire: questionnairePatchSchema.optional() }),
  (args) => {
    const q = mergeQuestionnaire(loadSampleQuestionnaire(), args.questionnaire);
    const brief = questionnaireToDesignBrief(q);
    const { model } = loadCostModel();
    const budget = designBriefToBudget(brief, model, q.contingencyRate);
    const plan = budgetToMilestones(budget, q.projectName);
    return {
      ...plan,
      totalMatchesBudgetMid: plan.totalCad === budget.total.midCad,
      budgetMidTotalCad: budget.total.midCad,
    };
  }
);

const journeyStatus = defineTool(
  "journey_status",
  "Journey state machine snapshot: stage, per-stage substep progress, open blockers, and the escrow " +
    "money position (funded / released net / held back / awaiting). Pass a JourneyState or omit for " +
    "the bundled sample journey.",
  z.object({ journey: journeyInputSchema.optional() }),
  (args) => {
    const state = normalizeJourney(args.journey);
    const pos = escrowPosition(state.escrow);
    const stageIdx = STAGE_ORDER.indexOf(state.stage);
    const substeps = STAGE_ORDER.map((stage) => {
      const list = state.substeps[stage] ?? [];
      return {
        stage,
        done: list.filter((s) => s.status === "done").length,
        total: list.length,
        active: list.filter((s) => s.status === "active").map((s) => s.label),
        waitingOn: list
          .filter((s) => s.status === "waitingOn" && s.waitingOn)
          .map((s) => ({
            label: s.label,
            who: s.waitingOn?.who,
            what: s.waitingOn?.what,
            sinceISO: s.waitingOn?.sinceISO,
          })),
      };
    });
    return {
      buildId: state.buildId,
      projectName: state.projectName,
      parcel: state.parcel,
      stage: state.stage,
      stageLine: `Stage ${stageIdx + 1} of ${STAGE_ORDER.length} — ${state.stage.toUpperCase()}`,
      escrowPosition: pos,
      substeps,
      openBlockers: state.blockers.filter((b) => !b.resolvedISO),
    };
  }
);

const nextActions = defineTool(
  "next_actions",
  "The next 3 actions for a journey with who does it, why, and what it costs — current-stage guidance " +
    "first, then the following stage's. Facts cited from docs/ALBERTA-PLAYBOOK.md. Pass a JourneyState " +
    "or omit for the bundled sample journey.",
  z.object({ journey: journeyInputSchema.optional() }),
  (args) => {
    const state = normalizeJourney(args.journey);
    return { stage: state.stage, actions: getGuidance(state) };
  }
);

const detectSlipsTool = defineTool(
  "detect_slips",
  "Ball-drop detection: runs the deterministic slip-rule library (SIP kit unordered after drawings " +
    "approval, permit unsubmitted, matured holdback still held, stale 2-of-3 approval, winter window, " +
    "waiting-on escalation) over a journey. Pass a JourneyState or omit for the bundled sample.",
  z.object({ journey: journeyInputSchema.optional(), nowISO: nowISOSchema }),
  (args) => {
    const state = normalizeJourney(args.journey);
    const now = parseNow(args.nowISO);
    const slips = detectSlips(state, now);
    return { nowISO: now.toISOString(), count: slips.length, slips };
  }
);

const digestPreview = defineTool(
  "digest_preview",
  'Renders the weekly "Your build update" email for a journey: what moved, money position, what\'s ' +
    "next, and flagged slips — as subject + plain text + HTML. Pass a JourneyState or omit for the " +
    "bundled sample journey.",
  z.object({ journey: journeyInputSchema.optional(), nowISO: nowISOSchema }),
  (args) => {
    const state = normalizeJourney(args.journey);
    const now = parseNow(args.nowISO);
    const slips = detectSlips(state, now);
    const digest = renderDigest(state, slips, now);
    return {
      subject: digest.subject,
      slipsFlagged: slips.length,
      plainText: digest.plainText,
      html: digest.html,
    };
  }
);

const supplierDirectory = defineTool(
  "supplier_directory",
  "Queries the Alberta-first supplier directory (data/alberta/suppliers.json): SIP plants, solar, " +
    "water/cistern, septic, windows, stoves, hot tubs, permit agencies, crypto rails. No category " +
    "returns the category index.",
  z.object({
    category: z
      .enum([
        "sip",
        "foundation",
        "solar",
        "water",
        "septic",
        "windows",
        "stoves",
        "hotTubs",
        "permits",
        "cryptoRails",
      ])
      .optional(),
    albertaOnly: z.boolean().optional().describe("Only entries flagged albertaLocal"),
    query: z.string().optional().describe("Case-insensitive text match over name/location/note"),
  }),
  (args) => {
    const dir = loadSuppliers();
    if (!args.category && !args.query) {
      return {
        principle: dir.principle,
        asOf: dir.asOf,
        source: SUPPLIERS_PATH,
        categories: Object.fromEntries(
          Object.entries(dir.categories).map(([name, entries]) => [name, entries.length])
        ),
        note: "Pass category (and optionally albertaOnly / query) to get entries.",
      };
    }
    const q = args.query?.toLowerCase();
    const pool = args.category
      ? { [args.category]: dir.categories[args.category] ?? [] }
      : dir.categories;
    const results: Record<string, unknown[]> = {};
    let matched = 0;
    for (const [name, entries] of Object.entries(pool)) {
      const hits = entries.filter((e) => {
        if (args.albertaOnly && !e.albertaLocal) return false;
        if (!q) return true;
        return `${e.name} ${e.location ?? ""} ${e.note ?? ""}`.toLowerCase().includes(q);
      });
      if (hits.length > 0) {
        results[name] = hits;
        matched += hits.length;
      }
    }
    return { principle: dir.principle, asOf: dir.asOf, matched, results };
  }
);

const albertaFact = defineTool(
  "alberta_fact",
  "Looks up a structured Alberta fact (permits, district minimums, professional requirements, money " +
    "rules) drawn from docs/ALBERTA-PLAYBOOK.md. Each fact returns with its basis. No arguments " +
    "returns the full fact index.",
  z.object({
    id: z.string().optional().describe('Exact fact id, e.g. "minimum-dwelling-size"'),
    query: z.string().optional().describe('Keyword search, e.g. "who pulls electrical permits"'),
  }),
  (args) => {
    const index = ALBERTA_FACTS.map((f) => ({ id: f.id, topic: f.topic }));
    if (!args.id && !args.query) {
      return { disclaimer: FACTS_DISCLAIMER, facts: index };
    }
    const matches = findFacts(args.id, args.query);
    if (matches.length === 0) {
      return {
        disclaimer: FACTS_DISCLAIMER,
        matches: [],
        note: "No fact matched; available ids listed.",
        available: index,
      };
    }
    return { disclaimer: FACTS_DISCLAIMER, matches };
  }
);

const journeyMemory = defineTool(
  "journey_memory",
  "Per-build memory engineering (the five-stage pipeline from @0xWast3's Memory Engineering: " +
    "capture -> consolidate -> retrieve -> supersede -> forget). Pass statements to run them through " +
    "the rejection-first capture filter into the build's JSON store (agent/out/memory); pass query " +
    "and/or stage for ranked retrieval of live facts (LAND surfaces parcel constraints, ESCROW money " +
    "preferences); runForget prunes expired and superseded facts past the grace window. Stores " +
    "single-sentence facts only, never transcripts.",
  z.object({
    buildId: z
      .string()
      .optional()
      .describe('Journey build id; defaults to "aura-pilot-01" (the bundled sample journey)'),
    statements: z
      .array(z.string())
      .optional()
      .describe("Owner statements to capture and consolidate (most will be rejected — by design)"),
    query: z.string().optional().describe("Free-text retrieval query"),
    stage: z
      .enum(["land", "design", "budget", "escrow", "build"])
      .optional()
      .describe("Stage-aware retrieval; ignored when query is given"),
    runForget: z
      .boolean()
      .optional()
      .describe("Drop expired and superseded facts past the 14-day grace window"),
    nowISO: nowISOSchema,
  }),
  (args) => {
    const now = parseNow(args.nowISO);
    const buildId = args.buildId ?? "aura-pilot-01";
    let store = loadMemory(buildId);
    const out: Record<string, unknown> = { buildId, storePath: memoryPath(buildId) };
    let mutated = false;

    if (args.statements && args.statements.length > 0) {
      const absorbed = absorb(store, args.statements, { nowISO: now.toISOString() });
      store = absorbed.store;
      out.absorbed = absorbed.log;
      mutated = true;
    }
    if (args.runForget) {
      const result = forget(store, now);
      store = result.store;
      out.forgotten = result.dropped.map((f) => ({ id: f.id, content: f.content }));
      mutated = mutated || result.dropped.length > 0;
    }
    if (args.query || args.stage) {
      out.retrieved = retrieveScored(args.query ?? (args.stage as string), store, now).map((r) => ({
        score: Number(r.score.toFixed(3)),
        ...r.fact,
      }));
    }
    if (mutated) saveMemory(store);

    out.factCount = store.facts.length;
    out.liveFactCount = liveFacts(store, now).length;
    return out;
  }
);

// ---------------------------------------------------------------- concierge

/** Typed user intents for the concierge reducer — mirrors ConciergeIntent. */
const conciergeIntentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("askAbout"), question: z.string() }),
  z.object({ type: z.literal("listHomes") }),
  z.object({ type: z.literal("listParcels") }),
  z.object({ type: z.literal("selectHome"), homeId: z.string().describe('Catalog id, e.g. "aura-sip-800"') }),
  z.object({ type: z.literal("selectParcel"), parcelId: z.string().describe('Parcel id, e.g. "lsa-lakeside-estates"') }),
  z.object({ type: z.literal("requestQuote") }),
  z.object({ type: z.literal("placeDeposit") }),
  z.object({ type: z.literal("confirmDeposit"), txRef: z.string().optional() }),
  z.object({ type: z.literal("requestRefund") }),
  z.object({ type: z.literal("tick") }),
  z.object({ type: z.literal("startBuild") }),
]);

/** Context for a reducer turn: bundled samples + the repo cost model. */
function conciergeContext(now: Date): ConciergeContext {
  const { model, extras } = loadCostModel();
  return {
    now,
    parcels: loadSampleParcels(),
    questionnaire: loadSampleQuestionnaire(),
    costModel: model,
    fileTotalsExLand: extras.totalsExLand,
  };
}

const conciergeStart = defineTool(
  "concierge_start",
  "Opens a concierge purchase journey: a typed, serializable Order (append-only event log, " +
    "injectable clock) that walks browsing -> parcel verdict (the land gate can REFUSE with the " +
    "bylaw citation) -> home -> quote priced live from data/alberta/cost-model.json -> USDC " +
    "reservation deposit -> refund window -> refunded or converted -> building. Returns the new " +
    "order and the opening line. Orders persist under agent/out/concierge/.",
  z.object({
    orderId: z.string().optional().describe("Defaults to a timestamp-derived id"),
    buyerName: z.string().optional(),
    buyerWallet: z.string().optional().describe("Wallet that funds the deposit (escrow homeowner)"),
    desiredSizeSqft: z.number().optional().describe("Design size for the land gate before a home is chosen (default 800)"),
    nowISO: nowISOSchema,
  }),
  (args) => {
    const now = parseNow(args.nowISO);
    const order = createOrder({
      id: args.orderId ?? `ord-${now.getTime().toString(36)}`,
      now,
      buyer: { name: args.buyerName, wallet: args.buyerWallet },
      desiredSizeSqft: args.desiredSizeSqft,
    });
    saveOrder(order);
    return {
      order,
      reply:
        "Welcome to Aura. I take you from a question to a funded home — and I will refuse the " +
        "order, with the bylaw citation, if the land cannot legally hold the home. Land first: " +
        "ask me to list parcels, or tell me about the home you want. " + PARTNER_STATE.line,
      storePath: orderPath(order.id),
    };
  }
);

const conciergeSend = defineTool(
  "concierge_send",
  "Sends one typed intent to a concierge order and returns { order, reply, actions }. " +
    "Offline-deterministic: verdicts come from the parcel filter, quotes from the cost-model " +
    "pipeline (totals reconcile to the file to the dollar), milestones carry the 10% statutory " +
    "holdback. askAbout answers deterministically; with ANTHROPIC_API_KEY set the reply is " +
    "model-written over the same facts (never required). The refusal path returns the district " +
    "minimum citation plus constructive next steps.",
  z.object({
    orderId: z.string(),
    intent: conciergeIntentSchema,
    nowISO: nowISOSchema,
  }),
  async (args) => {
    const order = loadOrder(args.orderId);
    if (!order) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `No order "${args.orderId}" — call concierge_start first (known: ${listOrders()
          .map((o) => o.id)
          .join(", ") || "none"}).`
      );
    }
    const now = parseNow(args.nowISO);
    const result = await reduceWithAssist(order, args.intent as ConciergeIntent, conciergeContext(now));
    saveOrder(result.order);
    return {
      order: result.order,
      reply: result.reply,
      replySource: result.replySource,
      actions: result.actions,
    };
  }
);

const conciergeState = defineTool(
  "concierge_state",
  "Reads a concierge order (full state: status, home, parcel verdict with reasons, quote with " +
    "reconciliation, deposit with refund deadline, append-only event log). Without orderId, " +
    "lists all known orders.",
  z.object({ orderId: z.string().optional() }),
  (args) => {
    if (!args.orderId) {
      return { orders: listOrders() };
    }
    const order = loadOrder(args.orderId);
    if (!order) {
      throw new McpError(ErrorCode.InvalidParams, `No order "${args.orderId}".`);
    }
    return { order };
  }
);

export const TOOLS: ToolDef[] = [
  checkParcel,
  generateDesignBrief,
  budgetEstimate,
  milestoneSchedule,
  journeyStatus,
  nextActions,
  detectSlipsTool,
  digestPreview,
  supplierDirectory,
  albertaFact,
  journeyMemory,
  conciergeStart,
  conciergeSend,
  conciergeState,
];

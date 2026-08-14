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

// ---------------------------------------------------------------- the tool set
// (TOOLS at the bottom of this file is the authority on how many there are;
//  the server's startup banner prints TOOLS.length. This header used to say
//  "the 10 tools" long after there were fourteen.)

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

// ------------------------------------------------------- contributed models

/* WHY THIS LIVES HERE, DUPLICATED.

   agent/ has ZERO imports from app/lib/builder/ and cannot construct a
   PlanTemplate — it cannot even name the type. So an agent cannot contribute a
   home model by calling the app's code. The only format that crosses that line
   is plain JSON that BOTH sides produce and validate independently, which is
   also exactly what a human contributor writes by hand.

   These checks therefore mirror app/lib/builder/contributedModel.ts's
   `collectContributedModelProblems` message for message. Mirrored logic drifts,
   so the drift is made loud rather than trusted: app/tests/contributed-model.
   spec.ts runs the SAME bad records through both implementations and asserts
   the two problem lists are identical, string for string.

   NOTHING HERE SELLS ANYTHING. These tools emit and check data. They write no
   file, touch no repository source, and make no claim that a model can be
   bought, sold, paid for, or that a contributor will be paid. */

const CONTRIBUTED_MODEL_CONTRACT = "aura.contributed-model/v1";
const CONTRIBUTED_ID_PREFIX = "contributed-";
const CATALOG_MINIMUM_FLOOR_AREA_SQFT = 100;

const CM_ROOF_FORMS = ["gable", "a-frame", "shed", "flat", "saltbox"] as const;
const CM_WALLS = ["n", "s", "e", "w"] as const;
const CM_MATERIALS = ["sip", "rammed_earth", "clt", "timber_frame"] as const;
const CM_CLIMATE_ZONES = ["4", "5", "6", "7A", "7B", "8"] as const;
const CM_SLOPES = ["flat", "gentle", "steep"] as const;
const CM_RELATIONSHIPS = ["dimensional-adaptation", "system-informed-study"] as const;

const CM_NONCOMMERCIAL = /\bNC\b|non-?commercial/i;
const CM_NO_DERIVATIVES = /\bND\b|no-?derivat/i;
const CM_PUBLIC_DOMAIN_BASIS = /17 USC 105|public domain|not in copyright/i;
const CM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type CmRecord = Record<string, unknown>;

const cmIsObject = (value: unknown): value is CmRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cmFilled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const cmFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const cmIncludes = (list: readonly string[], value: unknown): boolean =>
  typeof value === "string" && list.indexOf(value) >= 0;

function cmRightsProblems(value: unknown): string[] {
  if (!cmIsObject(value))
    return ["rights is missing — a model with no stated provenance cannot be accepted."];
  const problems: string[] = [];
  const kind = value.kind;

  if (kind === "aura-authored") {
    return [
      'rights.kind is "aura-authored", which only Aura Homes may sign. Contribute under ' +
        '"licensed-adaptation" (naming a share-alike licence) or "public-domain-adaptation" ' +
        "(naming a public-domain dedication).",
    ];
  }
  if (kind !== "licensed-adaptation" && kind !== "public-domain-adaptation") {
    return ['rights.kind must be "licensed-adaptation" or "public-domain-adaptation".'];
  }

  if (!cmFilled(value.name)) problems.push("rights.name does not say whose work this is.");
  if (!cmFilled(value.url) || !/^https:\/\//.test(value.url))
    problems.push("rights.url must be an https:// link to the source that can be opened and checked.");
  if (!cmFilled(value.licenseUrl) || !/^https:\/\//.test(value.licenseUrl))
    problems.push("rights.licenseUrl must be an https:// link to the licence or rights statement itself.");
  if (!cmFilled(value.license)) {
    problems.push("rights.license does not name the terms this work is offered under.");
  } else {
    if (CM_NONCOMMERCIAL.test(value.license))
      problems.push("rights.license is noncommercial; this catalog permits commercial use and cannot carry it.");
    if (CM_NO_DERIVATIVES.test(value.license))
      problems.push("rights.license forbids derivatives; every non-Aura entry in this catalog is an adaptation.");
  }
  if (!cmFilled(value.attribution) || value.attribution.trim().length <= 20)
    problems.push("rights.attribution must be a real credit line of more than 20 characters, not a placeholder.");
  if (!cmFilled(value.changes) || value.changes.trim().length <= 20)
    problems.push("rights.changes must state, in more than 20 characters, what was changed from the source.");
  if (!cmIncludes(CM_RELATIONSHIPS, value.relationship))
    problems.push('rights.relationship must be "dimensional-adaptation" or "system-informed-study".');

  if (kind === "licensed-adaptation" && value.shareAlike !== true)
    problems.push(
      "rights.shareAlike must be true on a licensed-adaptation. PlanSource has no arm for " +
        "third-party original work under a permissive, non-share-alike licence, and recording " +
        "true for a permissive licence would be a false legal claim — offer the work under a " +
        "share-alike licence or a public-domain dedication instead."
    );
  if (kind === "public-domain-adaptation") {
    if (value.shareAlike !== false)
      problems.push(
        "rights.shareAlike must be false on a public-domain-adaptation — no licence survives to pass on."
      );
    if (cmFilled(value.license) && !CM_PUBLIC_DOMAIN_BASIS.test(value.license))
      problems.push(
        'rights.license must name the public-domain basis (for example "17 USC 105", ' +
          '"CC0 1.0 public domain dedication", or "not in copyright").'
      );
  }
  return problems;
}

function cmOpeningProblems(volumeIndex: number, volume: CmRecord): string[] {
  const problems: string[] = [];
  const openings = volume.openings;
  const at = `envelope.volumes[${volumeIndex}]`;
  if (!Array.isArray(openings)) {
    problems.push(`${at}.openings must be an array (an empty array is allowed).`);
    return problems;
  }
  const widthFt = cmFinite(volume.widthFt) ? volume.widthFt : 0;
  const depthFt = cmFinite(volume.depthFt) ? volume.depthFt : 0;
  const storeys = volume.storeys === 2 ? 2 : 1;
  const wallHeightFt = cmFinite(volume.wallHeightFt) ? volume.wallHeightFt : 0;
  const seen = new Set<string>();
  openings.forEach((raw: unknown, index: number) => {
    const where = `${at}.openings[${index}]`;
    if (!cmIsObject(raw)) {
      problems.push(`${where} is not a record.`);
      return;
    }
    if (!cmFilled(raw.id)) problems.push(`${where}.id is missing.`);
    else if (seen.has(raw.id)) problems.push(`${where}.id "${raw.id}" is used twice in the same volume.`);
    else seen.add(raw.id);
    if (!cmIncludes(CM_WALLS, raw.wall)) problems.push(`${where}.wall must be one of n, s, e, w.`);
    if (raw.kind !== "window" && raw.kind !== "door" && raw.kind !== "glazing-wall")
      problems.push(`${where}.kind must be window, door or glazing-wall.`);
    if (!cmFinite(raw.widthFt) || raw.widthFt <= 0) problems.push(`${where}.widthFt must be a positive number.`);
    if (!cmFinite(raw.heightFt) || raw.heightFt <= 0) problems.push(`${where}.heightFt must be a positive number.`);
    if (!cmFinite(raw.offsetFt) || raw.offsetFt < 0) problems.push(`${where}.offsetFt must be zero or greater.`);
    if (!cmFinite(raw.sillFt) || raw.sillFt < 0) problems.push(`${where}.sillFt must be zero or greater.`);
    if (cmFinite(raw.widthFt) && cmFinite(raw.offsetFt)) {
      const run = raw.wall === "n" || raw.wall === "s" ? widthFt : depthFt;
      if (raw.offsetFt + raw.widthFt > run + 1e-9)
        problems.push(
          `${where} runs past the end of its wall: offsetFt ${raw.offsetFt} + widthFt ${raw.widthFt} exceeds the ${run} ft wall.`
        );
    }
    if (cmFinite(raw.heightFt) && cmFinite(raw.sillFt)) {
      const available = wallHeightFt * storeys;
      if (raw.sillFt + raw.heightFt > available + 0.01)
        problems.push(
          `${where} is taller than its wall: sillFt ${raw.sillFt} + heightFt ${raw.heightFt} exceeds the ${available} ft available.`
        );
    }
  });
  return problems;
}

function cmEnvelopeProblems(value: unknown): string[] {
  if (!cmIsObject(value)) return ["envelope is missing — a model with no dimensions is not a model."];
  const problems: string[] = [];

  if (!cmIncludes(CM_MATERIALS, value.material))
    problems.push(`envelope.material must be one of ${CM_MATERIALS.join(", ")}.`);
  if (!cmIncludes(CM_CLIMATE_ZONES, value.climateZone))
    problems.push(`envelope.climateZone must be one of ${CM_CLIMATE_ZONES.join(", ")}.`);

  const siting = value.siting;
  if (!cmIsObject(siting)) {
    problems.push("envelope.siting is missing.");
  } else {
    if (!cmFinite(siting.frontFacesDeg) || siting.frontFacesDeg < 0 || siting.frontFacesDeg > 360)
      problems.push("envelope.siting.frontFacesDeg must be a compass bearing between 0 and 360.");
    if (!cmIncludes(CM_SLOPES, siting.slope))
      problems.push("envelope.siting.slope must be flat, gentle or steep.");
  }

  const deck = value.deck;
  if (deck !== null) {
    if (!cmIsObject(deck)) {
      problems.push("envelope.deck must be a deck record or an explicit null.");
    } else {
      if (!cmIncludes(CM_WALLS, deck.wall)) problems.push("envelope.deck.wall must be one of n, s, e, w.");
      if (!cmFinite(deck.widthFt) || deck.widthFt <= 0)
        problems.push("envelope.deck.widthFt must be a positive number.");
      if (!cmFinite(deck.depthFt) || deck.depthFt <= 0)
        problems.push("envelope.deck.depthFt must be a positive number.");
      if (typeof deck.hotTub !== "boolean") problems.push("envelope.deck.hotTub must be true or false.");
    }
  }

  const volumes = value.volumes;
  if (!Array.isArray(volumes) || volumes.length === 0) {
    problems.push("envelope.volumes must contain at least one volume.");
    return problems;
  }
  const ids = new Set<string>();
  volumes.forEach((raw: unknown, index: number) => {
    const at = `envelope.volumes[${index}]`;
    if (!cmIsObject(raw)) {
      problems.push(`${at} is not a record.`);
      return;
    }
    if (!cmFilled(raw.id)) problems.push(`${at}.id is missing.`);
    else if (ids.has(raw.id)) problems.push(`${at}.id "${raw.id}" is used twice.`);
    else ids.add(raw.id);
    if (!cmFilled(raw.name)) problems.push(`${at}.name is missing.`);
    if (!cmFinite(raw.widthFt) || raw.widthFt <= 0) problems.push(`${at}.widthFt must be a positive number.`);
    if (!cmFinite(raw.depthFt) || raw.depthFt <= 0) problems.push(`${at}.depthFt must be a positive number.`);
    if (!cmFinite(raw.x)) problems.push(`${at}.x must be a number.`);
    if (!cmFinite(raw.z)) problems.push(`${at}.z must be a number.`);
    if (!cmFinite(raw.rotationDeg)) problems.push(`${at}.rotationDeg must be a number.`);
    if (raw.storeys !== 1 && raw.storeys !== 2) problems.push(`${at}.storeys must be 1 or 2.`);
    if (!cmFinite(raw.wallHeightFt) || raw.wallHeightFt <= 0)
      problems.push(`${at}.wallHeightFt must be a positive number.`);
    const roof = raw.roof;
    if (!cmIsObject(roof)) {
      problems.push(`${at}.roof is missing.`);
    } else {
      if (!cmIncludes(CM_ROOF_FORMS, roof.form))
        problems.push(`${at}.roof.form must be one of ${CM_ROOF_FORMS.join(", ")}.`);
      if (!cmFinite(roof.pitchDeg) || roof.pitchDeg < 0 || roof.pitchDeg >= 90)
        problems.push(`${at}.roof.pitchDeg must be between 0 and 90 degrees.`);
      if (!cmFinite(roof.overhangFt) || roof.overhangFt < 0)
        problems.push(`${at}.roof.overhangFt must be zero or greater.`);
      if (roof.facing !== undefined && !cmIncludes(CM_WALLS, roof.facing))
        problems.push(`${at}.roof.facing, when present, must be one of n, s, e, w.`);
    }
    problems.push(...cmOpeningProblems(index, raw));
  });

  if (problems.length === 0) {
    const area = (volumes as Array<{ widthFt: number; depthFt: number; storeys: number }>).reduce(
      (sum, item) => sum + item.widthFt * item.depthFt * item.storeys,
      0
    );
    if (area <= CATALOG_MINIMUM_FLOOR_AREA_SQFT)
      problems.push(
        `envelope.volumes total ${area} sq ft of floor area; the catalog contract requires more than ` +
          `${CATALOG_MINIMUM_FLOOR_AREA_SQFT} sq ft.`
      );
  }
  return problems;
}

/** Every reason this record cannot be accepted, in one pass. Mirrors
 *  app/lib/builder/contributedModel.ts message for message. */
function contributedModelProblems(value: unknown): string[] {
  if (!cmIsObject(value)) return ["A contributed model must be a JSON object."];
  const problems: string[] = [];

  if (value.contract !== CONTRIBUTED_MODEL_CONTRACT)
    problems.push(`contract must be "${CONTRIBUTED_MODEL_CONTRACT}".`);
  if (!cmFilled(value.id)) {
    problems.push("id is missing.");
  } else {
    const id = value.id;
    if (id.indexOf(CONTRIBUTED_ID_PREFIX) !== 0)
      problems.push(
        `id must start with "${CONTRIBUTED_ID_PREFIX}" so it can never collide with a catalog plan id.`
      );
    if (!CM_SLUG.test(id)) problems.push("id must be a lower-case slug: letters, digits and single hyphens.");
  }
  for (const field of ["title", "kicker", "summary", "bestFor", "sleeping", "notes"] as const) {
    if (!cmFilled(value[field])) problems.push(`${field} is missing.`);
  }
  if (!cmFinite(value.bedrooms) || value.bedrooms < 0 || !Number.isInteger(value.bedrooms))
    problems.push("bedrooms must be a whole number of zero or more.");
  if (!cmFinite(value.bathrooms) || value.bathrooms <= 0)
    problems.push("bathrooms must be greater than zero — every home in this catalog has one.");
  if (value.storeys !== 1 && value.storeys !== 2) problems.push("storeys must be 1 or 2.");
  for (const field of ["tags", "features"] as const) {
    const list = value[field];
    if (!Array.isArray(list) || list.length === 0) {
      problems.push(`${field} must be a non-empty array of strings.`);
    } else if (!list.every((entry: unknown) => cmFilled(entry))) {
      problems.push(`${field} contains an empty entry.`);
    }
  }
  if ("costBasis" in value && value.costBasis !== undefined) {
    const basis = value.costBasis;
    if (!cmIsObject(basis)) {
      problems.push("costBasis, when present, must be a record.");
    } else {
      if (basis.status !== "modelled" && basis.status !== "proxy")
        problems.push('costBasis.status must be "modelled" or "proxy".');
      if (!cmFilled(basis.label)) problems.push("costBasis.label is missing.");
      if (!cmFilled(basis.note)) problems.push("costBasis.note is missing.");
    }
  }
  problems.push(...cmRightsProblems(value.rights));
  problems.push(...cmEnvelopeProblems(value.envelope));
  return problems;
}

const contributedRightsSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("licensed-adaptation"),
      name: z.string().describe("Whose work this is — never Aura Homes"),
      url: z.string().describe("https:// link to the source that can be opened and checked"),
      license: z.string().describe('Named share-alike terms, e.g. "CC BY-SA 4.0". Never NC or ND.'),
      licenseUrl: z.string().describe("https:// link to the licence text itself"),
      attribution: z.string().describe("The credit line, more than 20 characters"),
      changes: z.string().describe("What was changed from the source, more than 20 characters"),
      shareAlike: z.literal(true),
      relationship: z.enum(["dimensional-adaptation", "system-informed-study"]),
    }),
    z.object({
      kind: z.literal("public-domain-adaptation"),
      name: z.string(),
      url: z.string().describe("https:// link to where the rights statement was read"),
      license: z
        .string()
        .describe('Must name the basis: "17 USC 105", "CC0 1.0 public domain dedication", "not in copyright"'),
      licenseUrl: z.string(),
      attribution: z.string().describe("Credit is recorded even though none is owed"),
      changes: z.string(),
      shareAlike: z.literal(false),
      relationship: z.enum(["dimensional-adaptation", "system-informed-study"]),
    }),
  ])
  .describe(
    'The rights block, mirroring the app\'s PlanSource. The third arm, "aura-authored", is ' +
      "refused on a contribution: only Aura Homes may sign as Aura Homes."
  );

const draftContributedModel = defineTool(
  "draft_contributed_model",
  "CONTRIBUTE: turns a short brief plus a rights block into a complete contributed-model JSON " +
    "record (contract aura.contributed-model/v1) and checks it. Returns the record as DATA — it " +
    "writes no file and edits no application source, so an agent can author a home model without " +
    "a clone of the repository and without a pull request. The same JSON is what a human " +
    "contributor writes by hand. Nothing here is an offer, a sale or a payment: Aura Homes " +
    "facilitates and is not a party to any agreement about the model.",
  z.object({
    slug: z.string().describe('Short lower-case slug; the "contributed-" prefix is added for you'),
    title: z.string(),
    summary: z.string().describe("One sentence a reader sees on the card"),
    notes: z.string().describe("Your own note, carried into the design brief beside the provenance notice"),
    rights: contributedRightsSchema,
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().min(0.5).optional().describe("Default 1"),
    storeys: z.union([z.literal(1), z.literal(2)]).optional().describe("Default 1"),
    widthFt: z.number().min(8).describe("Main volume width in feet"),
    depthFt: z.number().min(8).describe("Main volume depth in feet"),
    wallHeightFt: z.number().min(8.5).optional().describe("Default 9.5"),
    roof: z.enum(["gable", "a-frame", "shed", "flat", "saltbox"]).optional().describe("Default gable"),
    pitchDeg: z.number().min(0).max(89).optional().describe("Default 35 (18 for shed, 2 for flat)"),
    material: z.enum(["sip", "rammed_earth", "clt", "timber_frame"]).optional().describe("Default sip"),
    climateZone: z.enum(["4", "5", "6", "7A", "7B", "8"]).optional().describe("Default 7A"),
    frontFacesDeg: z.number().min(0).max(360).optional().describe("Default 180 (due south)"),
    slope: z.enum(["flat", "gentle", "steep"]).optional().describe("Default flat"),
    deck: z
      .object({ widthFt: z.number(), depthFt: z.number(), hotTub: z.boolean().optional() })
      .optional()
      .describe("Omit for no deck"),
    kicker: z.string().optional().describe("Default: computed area and storey count"),
    bestFor: z.string().optional(),
    sleeping: z.string().optional(),
    tags: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
  }),
  (args) => {
    const storeys = args.storeys ?? 1;
    const widthFt = args.widthFt;
    const depthFt = args.depthFt;
    const wallHeightFt = args.wallHeightFt ?? 9.5;
    const roofForm = args.roof ?? "gable";
    const areaSqFt = widthFt * depthFt * storeys;
    const slug = args.slug.replace(/^contributed-/, "");
    const volumeId = "main";

    /* The same opening pattern the curated catalog's private helper draws, so
       a drafted model reads as a house rather than as a blank box. A
       contributor who cares about their elevations replaces `openings`
       wholesale — the contract carries them explicitly for that reason. */
    const glassWidth = Math.max(3, Math.min(widthFt * 0.42, 14));
    const glassOffset = Math.max(0.6, widthFt * 0.08);
    const doorOffset = Math.min(Math.max(glassOffset + glassWidth + 0.5, widthFt - 3.8), widthFt - 3.1);
    const sideOffset = Math.max(1, depthFt / 2 - 2);
    const sideWidth = Math.min(4, depthFt * 0.35);

    const record = {
      contract: CONTRIBUTED_MODEL_CONTRACT,
      id: `${CONTRIBUTED_ID_PREFIX}${slug}`,
      title: args.title,
      kicker:
        args.kicker ??
        `${Math.round(areaSqFt).toLocaleString("en-CA")} sq ft · ${storeys === 1 ? "one level" : "two levels"}`,
      summary: args.summary,
      bestFor: args.bestFor ?? "A contributed concept to review against your own site and program",
      bedrooms: args.bedrooms,
      bathrooms: args.bathrooms ?? 1,
      sleeping:
        args.sleeping ??
        (args.bedrooms === 0 ? "Studio / Murphy bed" : `${args.bedrooms} enclosed bedroom${args.bedrooms === 1 ? "" : "s"}`),
      storeys,
      tags: args.tags ?? ["contributed"],
      features: args.features ?? ["Contributed concept", "Editable in the Aura builder"],
      envelope: {
        material: args.material ?? "sip",
        climateZone: args.climateZone ?? "7A",
        volumes: [
          {
            id: volumeId,
            name: "Main house",
            widthFt,
            depthFt,
            x: 0,
            z: 0,
            rotationDeg: 0,
            storeys,
            wallHeightFt,
            roof: {
              form: roofForm,
              pitchDeg: args.pitchDeg ?? (roofForm === "shed" ? 18 : roofForm === "flat" ? 2 : 35),
              overhangFt: 1.5,
              ...(roofForm === "shed" || roofForm === "saltbox" ? { facing: "s" } : {}),
            },
            openings: [
              { id: `${volumeId}-glass`, wall: "s", kind: "glazing-wall", widthFt: glassWidth, heightFt: 8, offsetFt: glassOffset, sillFt: 0 },
              { id: `${volumeId}-door`, wall: "s", kind: "door", widthFt: Math.min(3, widthFt * 0.28), heightFt: 6.8, offsetFt: doorOffset, sillFt: 0 },
              { id: `${volumeId}-east`, wall: "e", kind: "window", widthFt: sideWidth, heightFt: 4, offsetFt: sideOffset, sillFt: 3 },
              { id: `${volumeId}-west`, wall: "w", kind: "window", widthFt: sideWidth, heightFt: 4, offsetFt: sideOffset, sillFt: 3 },
            ],
          },
        ],
        deck: args.deck
          ? { wall: "s", widthFt: args.deck.widthFt, depthFt: args.deck.depthFt, hotTub: args.deck.hotTub ?? false }
          : null,
        siting: { frontFacesDeg: args.frontFacesDeg ?? 180, slope: args.slope ?? "flat" },
      },
      notes: args.notes,
      rights: args.rights,
    };

    const problems = contributedModelProblems(record);
    return {
      contract: CONTRIBUTED_MODEL_CONTRACT,
      record,
      valid: problems.length === 0,
      problems,
      floorAreaSqFt: areaSqFt,
      whatHappensNext:
        problems.length === 0
          ? "This record validates. Hand the JSON to Aura Homes to be listed with its rights and its " +
            "evidence state. Aura records what you declare and checks none of it; listing is not a " +
            "sale and Aura is not a party to any agreement about the model."
          : "This record does not validate yet. Fix every problem above and draft it again.",
      writes: "none — this tool returns data and changes no file",
    };
  }
);

const validateContributedModelTool = defineTool(
  "validate_contributed_model",
  "CONTRIBUTE: checks a contributed-model JSON record against the contract and returns EVERY " +
    "reason it would be refused, named field by field — not just the first. A record without " +
    "provenance (missing attribution, missing licence, a non-https source, or an " +
    '"aura-authored" claim, which only Aura Homes may sign) is refused, not merely discouraged. ' +
    "Refusals are also refused for geometry: an opening that runs past the end of its wall or a " +
    "home under the catalog's floor-area minimum comes back by name. Returns data only.",
  z.object({
    model: z.unknown().describe("The contributed-model JSON record, exactly as it would be submitted"),
  }),
  (args) => {
    const problems = contributedModelProblems(args.model);
    return {
      contract: CONTRIBUTED_MODEL_CONTRACT,
      ok: problems.length === 0,
      problemCount: problems.length,
      problems,
      note:
        problems.length === 0
          ? "The record is well-formed and its rights claims are present. Aura has NOT checked that " +
            "they are true — every claim on a contributed model is the contributor's own declaration."
          : "Every problem above must be fixed. A record with unstated provenance cannot be accepted.",
    };
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
  draftContributedModel,
  validateContributedModelTool,
];

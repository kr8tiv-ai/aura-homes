import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

import {
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import {
  GUIDANCE_TOPICS,
  defaultsFor,
  explain,
  type GuidanceExplanation,
  type GuidanceIntake,
  type GuidanceTopic,
} from "@/lib/builder/guidance";
import { FDWR_MAX, WALL_R_VALUE } from "@/lib/design/materials";
import { deriveProgram, modelledGlazingRatio, storeysOf } from "@/lib/builder/toPlan";
import { totalFloorAreaSqFt } from "@/lib/builder/spec";

/* ===========================================================================
   GQ01 + GQ02 — guided mode gets smarter without getting louder.

   THE ASSERTION THIS FILE EXISTS FOR, said once: a constraint is never
   reported as satisfied unless the module actually compared the design
   against it. Everything below is a way of making that falsifiable rather
   than asserted.

   Three instruments carry it:

     1. THE SATISFACTION GREP. A vocabulary of phrases that CLAIM a
        constraint is met ("under the", "within", "clears", …). Any sentence
        containing one must carry `measurement.withinTarget !== null`, which
        the module can only produce by running the comparison. The grep's
        vocabulary lives HERE, not in the module, so the module cannot define
        its way to green — and a canary below proves the grep can fail.

     2. THE GRAPH REFUSAL. After a planar-graph conversion `document.spec` is
        a frozen recovery copy. Every spec-derived reading must go
        `not-modelled` and every measurement must disappear. This is pinned
        against a really-converted document, not a stubbed flag.

     3. NO SECOND CALCULATION. Each measurement is compared back to the
        module that owns the number — `modelledGlazingRatio`, `deriveProgram`,
        `storeysOf`, `totalFloorAreaSqFt`, `WALL_R_VALUE`. If guidance ever
        grows its own arithmetic, these stop agreeing.

   PURE. No page, no browser, no clock. `npm test` is the gate.
   =========================================================================== */

const appRoot = resolve(__dirname, "..");

const doc = (): BuilderDocument => defaultBuilderDocument();

/** A really-converted planar-graph document, not a hand-set `kind` field.
 *  0.5 ft is the wall thickness every other spec in this suite converts with;
 *  the number is not what is under test, and matching them keeps the fixtures
 *  comparable. */
function graphDoc(): BuilderDocument {
  const converted = convertBuilderDocumentToGraph(doc(), 0.5);
  if (!converted.ok) throw new Error(`fixture could not convert: ${converted.problem}`);
  return converted.document;
}

function must(topic: GuidanceTopic, document: BuilderDocument): GuidanceExplanation {
  const explanation = explain(topic, document);
  if (explanation === null) throw new Error(`explain(${topic}) returned null for this fixture`);
  return explanation;
}

/* ---------------------------------------------------------------------------
   1. the satisfaction grep — the GQ02 gate
   ------------------------------------------------------------------------ */

/**
 * Phrases that assert a constraint is MET. Owned by this spec on purpose: a
 * list the module could edit is a list the module can pass by rewording.
 *
 * "over the" is included deliberately — a sentence saying a design EXCEEDS a
 * ceiling is just as much a compared claim as one saying it is under, and it
 * needs the same comparison behind it.
 */
const SATISFACTION_PHRASES = [
  "under the",
  "over the",
  "within the",
  "below the",
  "above the",
  "clears the",
  "meets the",
  "complies",
  "compliant",
  "passes the",
  "satisfies",
] as const;

const claimsAComparison = (sentence: string): boolean =>
  SATISFACTION_PHRASES.some((phrase) => sentence.toLowerCase().includes(phrase));

test("the satisfaction grep can actually fail", () => {
  /* Without this, the gate below could be green because the vocabulary never
     matches anything — an assertion that cannot fail is not an assertion.
     These two strings are the shapes the gate is hunting for. */
  expect(claimsAComparison("Your glass is 12.0% of the wall area, under the 22.0% ceiling.")).toBe(
    true,
  );
  expect(claimsAComparison("This home clears the district minimum.")).toBe(true);
  expect(claimsAComparison("Aura models no roof assembly R-value at all.")).toBe(false);
});

test("no sentence claims a constraint is met without having compared it", () => {
  const fixtures: Array<[string, BuilderDocument]> = [
    ["reference home", doc()],
    ["planar graph", graphDoc()],
    ["glass wall removed", withoutGlass()],
    ["over-glazed", overGlazed()],
    ["no volumes", withoutVolumes()],
  ];

  for (const [name, document] of fixtures) {
    for (const topic of GUIDANCE_TOPICS) {
      const explanation = explain(topic, document);
      if (explanation === null) continue;
      if (!claimsAComparison(explanation.sentence)) continue;
      expect(
        explanation.measurement?.withinTarget ?? null,
        `${name} · ${topic}: the sentence compares against a target, so the comparison must have been run`,
      ).not.toBeNull();
      expect(explanation.standing, `${name} · ${topic}`).toBe("checked");
    }
  }
});

test("a target is never implied without one, and never claimed without a comparison", () => {
  for (const document of [doc(), graphDoc(), overGlazed(), withoutVolumes()]) {
    for (const topic of GUIDANCE_TOPICS) {
      const explanation = explain(topic, document);
      if (explanation === null || explanation.measurement === null) continue;
      const { target, targetLabel, withinTarget } = explanation.measurement;
      if (withinTarget !== null) {
        expect(target, `${topic}: a verdict needs a target`).not.toBeNull();
        expect(targetLabel, `${topic}: a target needs a name`).not.toBeNull();
        expect(explanation.standing).toBe("checked");
      }
      if (target === null) {
        expect(withinTarget, `${topic}: no target means no verdict`).toBeNull();
        expect(targetLabel, `${topic}: no target means no target name`).toBeNull();
      }
    }
  }
});

/* ---------------------------------------------------------------------------
   2. every sentence carries its source
   ------------------------------------------------------------------------ */

test("every explanation is one sourced sentence, and the source is named", () => {
  for (const topic of GUIDANCE_TOPICS) {
    const explanation = must(topic, doc());
    expect(explanation.topic, `${topic}: the explanation names its own topic`).toBe(topic);
    expect(explanation.title.trim().length, `${topic}: title`).toBeGreaterThan(0);
    expect(explanation.sentence.trim().length, `${topic}: sentence`).toBeGreaterThan(0);
    expect(explanation.source.module.trim().length, `${topic}: source.module`).toBeGreaterThan(0);
    expect(explanation.source.authority.trim().length, `${topic}: source.authority`).toBeGreaterThan(
      0,
    );
    /* One sentence. A full stop mid-string is a second sentence sneaking in,
       and two sentences beside a control is where a tooltip becomes a wall of
       text. Decimals are the only interior dots allowed — an abbreviation is
       indistinguishable from a sentence boundary to any grep, so the module
       spells names out instead. This caught "Lac Ste. Anne" on the first run,
       which is the whole reason the rule is mechanical. */
    const interiorFullStops = explanation.sentence
      .slice(0, -1)
      .match(/\.(?!\d)(?!\s*$)/g);
    expect(interiorFullStops, `${topic}: "${explanation.sentence}"`).toBeNull();
    expect(explanation.sentence.endsWith("."), `${topic}: sentence ends`).toBe(true);
    /* Brand voice: no exclamation points anywhere in this product. */
    expect(explanation.sentence).not.toContain("!");
  }
});

test("a topic this build cannot source returns null rather than a sentence", () => {
  /* Not reachable through `GuidanceTopic`, and reachable the moment a topic
     string arrives from a saved layout, a registry, or a newer build. The
     guard is the "no source, no sentence" rule as code; deleting it turns
     this test red rather than leaving a silent undefined on screen. */
  const unknown = "solar-gain" as GuidanceTopic;
  expect(explain(unknown, doc())).toBeNull();
});

test("a material with no R-value in the table produces no wall sentence", () => {
  /* `validateHomeSpec` rejects an unknown material, so this document could
     only arrive by hand or from a future build — which is exactly when a
     tooltip printing `R-undefined` would be worst. */
  const document = doc();
  const strange = {
    ...document,
    spec: { ...document.spec, material: "unobtanium" as BuilderDocument["spec"]["material"] },
  };
  expect(WALL_R_VALUE[strange.spec.material]).toBeUndefined();
  expect(explain("wall-r-value", strange)).toBeNull();
  /* And the topics that do not depend on the table still answer, so the null
     above is about the missing source and not about a thrown fixture. */
  expect(explain("roof-r-value", strange)).not.toBeNull();
});

/* ---------------------------------------------------------------------------
   3. the numbers belong to the modules that own them
   ------------------------------------------------------------------------ */

test("the glazing reading is modelledGlazingRatio against FDWR_MAX, not a second sum", () => {
  const document = doc();
  const explanation = must("glazing-ratio", document);
  expect(explanation.standing).toBe("checked");
  expect(explanation.measurement?.value).toBe(modelledGlazingRatio(document.spec));
  expect(explanation.measurement?.target).toBe(FDWR_MAX);
  expect(explanation.measurement?.withinTarget).toBe(
    modelledGlazingRatio(document.spec) <= FDWR_MAX,
  );
});

test("an over-glazed home is told it is over, and the verdict flips with the design", () => {
  const under = must("glazing-ratio", doc());
  const over = must("glazing-ratio", overGlazed());
  expect(under.measurement?.withinTarget).toBe(true);
  expect(over.measurement?.withinTarget).toBe(false);
  expect(under.sentence).not.toBe(over.sentence);
  /* The falsifiable half: the two fixtures must actually differ in ratio, or
     the flip above is about the sentence rather than about the home. */
  expect(over.measurement?.value ?? 0).toBeGreaterThan(under.measurement?.value ?? 0);
});

test("a home with no wall area is refused a ratio rather than given 0%", () => {
  const explanation = must("glazing-ratio", withoutVolumes());
  expect(explanation.standing).toBe("not-modelled");
  expect(explanation.measurement).toBeNull();
  expect(explanation.sentence).not.toContain("0.0%");
});

test("rooms and storeys quote deriveProgram and storeysOf", () => {
  const document = doc();
  expect(must("room-layout", document).measurement?.value).toBe(
    deriveProgram(document.spec).bedrooms,
  );
  expect(must("storey-count", document).measurement?.value).toBe(storeysOf(document.spec));
});

test("minimum dwelling size states the area and refuses the check", () => {
  const document = doc();
  const explanation = must("minimum-dwelling-size", document);
  expect(explanation.standing).toBe("not-modelled");
  expect(explanation.measurement?.value).toBe(totalFloorAreaSqFt(document.spec));
  expect(explanation.measurement?.target).toBeNull();
  /* The refusal is the point. `LiveReadout.tsx` prints the same one, and the
     product would rather say nothing than print a plausible bylaw figure. */
  expect(explanation.sentence.toLowerCase()).toContain("does not check");
});

test("wall R is quoted from the table and never called compliance", () => {
  const document = doc();
  const explanation = must("wall-r-value", document);
  expect(explanation.measurement?.value).toBe(WALL_R_VALUE[document.spec.material]);
  expect(explanation.measurement?.target).toBeNull();
  expect(explanation.standing).toBe("not-modelled");
});

test("roof R is an honest blank, because nothing in the repo models one", () => {
  const explanation = must("roof-r-value", doc());
  expect(explanation.standing).toBe("not-modelled");
  expect(explanation.measurement).toBeNull();
  /* If a roof assembly R ever lands in the materials table, this fails and
     the sentence gets rewritten — which is the correct order of events. */
  const materials = readFileSync(resolve(appRoot, "lib/design/materials.ts"), "utf8");
  expect(materials).not.toMatch(/ROOF_R_VALUE/);
});

/* ---------------------------------------------------------------------------
   4. the graph refusal
   ------------------------------------------------------------------------ */

test("after a graph conversion no spec-derived reading is offered as this home", () => {
  const converted = graphDoc();
  expect(converted.geometry.kind).toBe("building-graph");

  for (const topic of ["glazing-ratio", "room-layout", "storey-count"] as const) {
    const explanation = must(topic, converted);
    expect(explanation.standing, topic).toBe("not-modelled");
    expect(explanation.measurement, topic).toBeNull();
    expect(explanation.sentence.toLowerCase(), topic).toContain("graph");
  }

  /* Minimum dwelling size was already not-modelled; what changes is that it
     stops quoting a floor area it can no longer stand behind. */
  const minimum = must("minimum-dwelling-size", converted);
  expect(minimum.standing).toBe("not-modelled");
  expect(minimum.measurement).toBeNull();

  /* Material is not geometry, so these two keep answering. A blanket refusal
     would be its own small lie. */
  expect(must("wall-r-value", converted).measurement?.value).toBe(
    WALL_R_VALUE[converted.spec.material],
  );
  expect(must("roof-r-value", converted).standing).toBe("not-modelled");
});

/* ---------------------------------------------------------------------------
   5. defaults from the intake
   ------------------------------------------------------------------------ */

const intake = (over: Partial<GuidanceIntake> = {}): GuidanceIntake => ({
  location: { country: "Canada", region: "Alberta", municipality: "Sturgeon County" },
  budgetCad: { min: null, max: null },
  householdSize: null,
  landStatus: "owned",
  deliveryPreference: "compare",
  timeline: "",
  accessibility: [],
  utilityGoals: [],
  cryptoComfort: "guided",
  completedAtISO: null,
  ...over,
});

const byId = (defaults: ReturnType<typeof defaultsFor>, id: string) =>
  defaults.suggestions.find((suggestion) => suggestion.id === id);

test("every suggestion carries a reason and a named source", () => {
  const defaults = defaultsFor(
    intake({
      householdSize: 4,
      deliveryPreference: "manufactured",
      accessibility: ["step-free entry"],
    }),
  );
  expect(defaults.suggestions.length).toBeGreaterThan(0);
  for (const suggestion of defaults.suggestions) {
    expect(suggestion.reason.trim().length, suggestion.id).toBeGreaterThan(0);
    expect(suggestion.display.trim().length, suggestion.id).toBeGreaterThan(0);
    expect(suggestion.source.module.trim().length, suggestion.id).toBeGreaterThan(0);
    expect(suggestion.source.authority.trim().length, suggestion.id).toBeGreaterThan(0);
    expect(suggestion.reason, suggestion.id).not.toContain("!");
  }
  /* Suggestion ids are unique, so a UI list can key on them and a spec can
     name one without ambiguity. */
  const ids = defaults.suggestions.map((suggestion) => suggestion.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("the zone default is Alberta-only, and says it is an assumption", () => {
  const alberta = byId(defaultsFor(intake()), "climate-zone");
  expect(alberta?.value).toEqual({ field: "spec.climateZone", zone: "7A" });
  expect(alberta?.source.kind).toBe("assumption");
  /* It must not read as a lookup. Alberta holds 7A, 7B and 8 and this product
     does not know which one a parcel is in. */
  expect(alberta?.reason.toLowerCase()).toContain("does not look");

  const ontario = defaultsFor(intake({ location: { country: "Canada", region: "Ontario", municipality: "" } }));
  expect(byId(ontario, "climate-zone")).toBeUndefined();
  expect(ontario.unused.join(" ")).toContain("Ontario");
});

test("the footprint suggestion is deriveProgram's own answer, not a second table", () => {
  const defaults = defaultsFor(intake({ householdSize: 4 }));
  const footprint = byId(defaults, "footprint");
  if (footprint === undefined || footprint.value.field !== "spec.volumes[0]") {
    throw new Error("expected a footprint suggestion for a household of four");
  }
  /* The claim in the reason is "the smallest home Aura's own program rule
     reads that many bedrooms out of". Both halves are checked: the suggested
     footprint reaches the bedroom count, and its own floor area is the
     product of the two dimensions rather than the nominal target. */
  expect(footprint.value.widthFt * footprint.value.depthFt).toBeCloseTo(
    footprint.value.floorAreaSqFt,
    6,
  );
  const asSpec = doc();
  asSpec.spec = {
    ...asSpec.spec,
    volumes: [
      {
        ...asSpec.spec.volumes[0],
        widthFt: footprint.value.widthFt,
        depthFt: footprint.value.depthFt,
        storeys: 1,
      },
    ],
  };
  expect(deriveProgram(asSpec.spec).bedrooms).toBeGreaterThanOrEqual(2);
});

test("a bigger household never gets a smaller home", () => {
  const areaFor = (people: number): number => {
    const suggestion = byId(defaultsFor(intake({ householdSize: people })), "footprint");
    if (suggestion === undefined || suggestion.value.field !== "spec.volumes[0]") return 0;
    return suggestion.value.floorAreaSqFt;
  };
  const two = areaFor(2);
  const four = areaFor(4);
  const six = areaFor(6);
  expect(two).toBeGreaterThan(0);
  expect(four).toBeGreaterThan(two);
  expect(six).toBeGreaterThan(four);
});

test("a household the program rule cannot house is told so, not given a guess", () => {
  const defaults = defaultsFor(intake({ householdSize: 14 }));
  expect(byId(defaults, "footprint")).toBeUndefined();
  expect(defaults.unused.join(" ").toLowerCase()).toContain("no footprint is suggested");
});

test("answers that change nothing here are named rather than swallowed", () => {
  const defaults = defaultsFor(
    intake({
      budgetCad: { min: null, max: 450_000 },
      landStatus: "searching",
      timeline: "spring 2027",
      utilityGoals: ["off-grid power", "rainwater"],
      cryptoComfort: "experienced",
    }),
  );
  const said = defaults.unused.join(" ").toLowerCase();
  expect(said).toContain("budget");
  expect(said).toContain("land");
  expect(said).toContain("timeline");
  expect(said).toContain("utility goal");
  expect(said).toContain("crypto");
  for (const line of defaults.unused) expect(line).not.toContain("!");
});

test("defaultsFor suggests and never applies", () => {
  /* GQ03 owns the apply path and requires a confirmation. A module that could
     return a document would eventually be called somewhere that skipped the
     confirmation, so it returns none — pinned in the source, because the type
     alone would not stop a `document` field being added later. */
  const source = readFileSync(resolve(appRoot, "lib/builder/guidance.ts"), "utf8");
  expect(source).not.toMatch(/reconcileBuilderDocumentSpec|withProjectDesign/);
  const before = intake({ householdSize: 4, accessibility: ["step-free entry"] });
  const snapshot = JSON.stringify(before);
  defaultsFor(before);
  expect(JSON.stringify(before)).toBe(snapshot);
});

/* ---------------------------------------------------------------------------
   6. purity — what makes every assertion above repeatable
   ------------------------------------------------------------------------ */

test("guidance is pure: no React, no clock, no randomness, no locale", () => {
  const source = readFileSync(resolve(appRoot, "lib/builder/guidance.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const banned of ["Date.now", "new Date", "Math.random", "toLocaleString"]) {
    expect(code, `guidance.ts must not reach for ${banned}`).not.toContain(banned);
  }
  /* A React import, not the letters r-e-a-c-t: "reaches" is an ordinary word
     and a grep that banned it would be a grep nobody could write prose past. */
  expect(code).not.toMatch(/from\s+["']react/);
});

test("explain and defaultsFor are deterministic and do not mutate their inputs", () => {
  const document = doc();
  const snapshot = JSON.stringify(document);
  const first = GUIDANCE_TOPICS.map((topic) => explain(topic, document));
  const second = GUIDANCE_TOPICS.map((topic) => explain(topic, document));
  expect(first).toEqual(second);
  expect(JSON.stringify(document)).toBe(snapshot);

  const answers = intake({ householdSize: 3 });
  expect(defaultsFor(answers)).toEqual(defaultsFor(answers));
});

/* ---------------------------------------------------------------------------
   fixtures
   ------------------------------------------------------------------------ */

/** The reference home with its south glazing wall and windows removed. */
function withoutGlass(): BuilderDocument {
  const document = doc();
  return {
    ...document,
    spec: {
      ...document.spec,
      volumes: document.spec.volumes.map((volume) => ({
        ...volume,
        openings: volume.openings.filter((opening) => opening.kind === "door"),
      })),
    },
  };
}

/** Enough glass to pass the prescriptive ceiling. The glazing wall is widened
 *  and repeated on all four walls; nothing else changes, so the ratio is the
 *  only variable between this and the reference home. */
function overGlazed(): BuilderDocument {
  const document = doc();
  const volume = document.spec.volumes[0];
  return {
    ...document,
    spec: {
      ...document.spec,
      volumes: [
        {
          ...volume,
          openings: (["n", "s", "e", "w"] as const).map((wall) => ({
            id: `glass-${wall}`,
            wall,
            kind: "glazing-wall" as const,
            widthFt: 18,
            heightFt: 9,
            offsetFt: 2,
            sillFt: 0,
          })),
        },
      ],
    },
  };
}

/** A document with no massing at all — reachable by deleting the last volume,
 *  and the case where a naive ratio prints a reassuring 0%. */
function withoutVolumes(): BuilderDocument {
  const document = doc();
  return { ...document, spec: { ...document.spec, volumes: [] } };
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "playwright/test";

import CoPilot from "@/components/builder/CoPilot";
import { checkOpening } from "@/components/builder/openingEdit";
import {
  COPILOT_ENGINE,
  applyPreparedAction,
  copilotQuietDemo,
  defaultCoPilotBasis,
  previewPreparedAction,
  readCoPilot,
  type CoPilotBasis,
  type CoPilotReport,
  type CoPilotSuggestion,
} from "@/lib/builder/copilot";
import { PLAN_TEMPLATES } from "@/lib/builder/planCatalog";
import {
  builderDocumentFromLegacySpec,
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
} from "@/lib/builder/projectBudget";
import { NOT_MODELLED } from "@/lib/builder/scenarios";
import { modelledGraphGlazingRatio } from "@/lib/builder/graphGeometry";
import { glazedAreaSqFt, totalFloorAreaSqFt, type HomeSpec } from "@/lib/builder/spec";
import {
  checkSpecAgainstParcel,
  modelledGlazingRatio,
  storeysOf,
  type SpecParcelCheck,
} from "@/lib/builder/toPlan";
import { envelopeFor } from "@/lib/design/layout";
import { FDWR_MAX } from "@/lib/design/materials";

/* ═══════════════════════════════════════════════════════════════════════════
   AI01 — the gates on a bounded co-pilot.

   THE CONTRACT THIS FILE POLICES, in the words of the node: "every proposed
   write is a confirm-before-act card; a spec asserts no code path applies a
   suggestion without one."

   A test that clicks Confirm and watches the document change does not prove
   that. It proves ONE path works. The claim is about every OTHER path, so the
   assertions below are negative-space assertions and they come in four layers,
   because each layer is blind to a different bypass and saying so is the only
   honest way to ship a claim this shape:

     1. THE MODULE REFUSES. `applyPreparedAction` takes a `Confirmation` that
        must name the suggestion AND quote the exact words the control carried.
        A loop over the list, a stale closure or a "just the safe ones"
        shortcut would each have to write out the confirm text of a card
        nobody was shown. Asserted by calling it wrong three ways.

     2. NOTHING ELSE LEAKS A SPEC. `applyPreparedAction` is the only export in
        the module that can produce a `HomeSpec`. Asserted by serialising
        everything the other exports return and looking for the key — so a
        future `previewPreparedAction` that "helpfully" returned the candidate
        would go red rather than quietly opening a second door.

     3. THE INTERFACE HAS ONE APPLY PATH. In `CoPilot.tsx` the call to
        `applyPreparedAction` and the call to the editor's `onApply` each occur
        exactly ONCE, both inside one fenced handler, and that handler opens
        with a guard refusing any suggestion that is not the armed one. The
        control that reaches it is rendered only inside the armed branch.

     4. NOTHING FIRES ON ITS OWN. The component has no effects, no timers and
        no animation frames — pinned by absence over the comment-stripped
        source, which is the half a static render cannot see. And the static
        render carries the other half: the whole sidebar with three live
        suggestions produces markup with NO confirm control in it and calls
        `onApply` zero times. Absence from markup is an assertion CSS cannot
        fake; a disabled button would fail it.

   WHAT THIS FILE CANNOT SEE, SAID OUT LOUD. `renderToStaticMarkup` attaches no
   event handlers, so the CLICK on a confirm button is not exercised here and
   `useState` never advances — the armed branch is therefore never rendered in
   this file, which is exactly why layers 1 and 3 exist. The wiring between the
   button and `confirmArmed` is asserted structurally rather than by pressing.

   NO SECOND CALCULATION. Every figure a card prints is recomputed here from
   the module that owns it — `modelledGlazingRatio`, `envelopeFor`,
   `createProjectBudget`, `checkOpening` — and compared. If the co-pilot ever
   grows arithmetic of its own, these stop agreeing.

   PURE. No page, no server, no clock. `npm test` is the gate.
   ═══════════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const moduleSource = readFileSync(path.join(appRoot, "lib/builder/copilot.ts"), "utf8");
const componentSource = readFileSync(path.join(appRoot, "components/builder/CoPilot.tsx"), "utf8");

/** Comments stripped, so a banned token can be DISCUSSED in a header without
 *  the grep that bans it firing on the discussion. Exactly the split
 *  `guidance.spec.ts` keeps for the same reason. Block comments cover JSX
 *  comments too, since `{/* … *​/}` is a block comment inside braces. */
const strip = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const componentCode = strip(componentSource);
const moduleCode = strip(moduleSource);

const occurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

/* ---------------------------------------------------------------------------
   THE JSX HARNESS.

   Playwright's babel transform rewrites JSX in project files into its own
   component-test envelope — `{ __pw_type: "jsx", type, props, key }` — not into
   React elements, and handing one of those to `renderToStaticMarkup` throws.
   So the tree is converted back. Taken from `tests/variations.spec.ts`, which
   took it from `tests/margin-stack.spec.ts`, for the same reason.
------------------------------------------------------------------------- */
interface PwJsx {
  __pw_type: "jsx";
  type: unknown;
  props?: Record<string, unknown>;
  key?: unknown;
}

const isPwJsx = (value: unknown): value is PwJsx =>
  typeof value === "object" && value !== null && (value as PwJsx).__pw_type === "jsx";

const wrappedComponents = new Map<unknown, unknown>();

function asReact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(asReact);
  if (!isPwJsx(node)) return node;
  const { children, ...rest } = node.props ?? {};
  const props: Record<string, unknown> = { ...rest };
  if (node.key !== undefined && node.key !== null) props.key = node.key;
  const type = typeof node.type === "function" ? wrapComponent(node.type) : node.type;
  if (children === undefined) return createElement(type as never, props);
  const kids = (Array.isArray(children) ? children : [children]).map(asReact);
  return createElement(type as never, props, ...(kids as never[]));
}

function wrapComponent(component: unknown): unknown {
  const cached = wrappedComponents.get(component);
  if (cached !== undefined) return cached;
  const wrapper = (props: Record<string, unknown>) =>
    asReact((component as (p: Record<string, unknown>) => unknown)(props));
  Object.defineProperty(wrapper, "name", {
    value: (component as { name?: string }).name ?? "Anonymous",
  });
  wrappedComponents.set(component, wrapper);
  return wrapper;
}

/* --------------------------------------------------------------- fixtures */

const SCENARIO = defaultProjectBudgetScenario();

const withSpec = (base: BuilderDocument, spec: HomeSpec): BuilderDocument => {
  const checked = validateBuilderDocument({ ...base, spec });
  if (!checked.ok) throw new Error(`fixture is invalid: ${checked.problem}`);
  return checked.document;
};

const DOC = defaultBuilderDocument();

/**
 * The reference home with its south glazing wall widened from 16 ft to 26 ft.
 *
 * 7 ft to 33 ft along a 34 ft wall, clear of the door at 3–6 ft, so every
 * opening is still legal — the ONLY thing this fixture changes is the ratio.
 */
function glassyFixture(): BuilderDocument {
  const volume = DOC.spec.volumes[0];
  return withSpec(DOC, {
    ...DOC.spec,
    volumes: [
      {
        ...volume,
        openings: volume.openings.map((opening) =>
          opening.id === "o1" ? { ...opening, widthFt: 26, offsetFt: 7 } : opening,
        ),
      },
    ],
  });
}

/** The reference home with one window hung off the end of the south wall:
 *  30 ft to 40 ft along a wall that is 34 ft long. `validateHomeSpec` accepts
 *  it — it checks the contract, not the building — which is precisely why
 *  `checkOpening` exists and why this card does. */
function badOpeningFixture(): BuilderDocument {
  const volume = DOC.spec.volumes[0];
  return withSpec(DOC, {
    ...DOC.spec,
    volumes: [
      {
        ...volume,
        openings: [
          ...volume.openings,
          { id: "o5", wall: "s", kind: "window", widthFt: 10, heightFt: 4, offsetFt: 30, sillFt: 3 },
        ],
      },
    ],
  });
}

/** A really-converted planar-graph document, not a hand-set `kind` field.
 *  0.5 ft is the wall thickness every other spec in this suite converts with. */
function graphFixture(): BuilderDocument {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  if (!converted.ok) throw new Error(`fixture could not convert: ${converted.problem}`);
  return converted.document;
}

/** A 60 × 60 lot with 20 ft front and rear setbacks and 10 ft sides — a
 *  40 × 20 buildable envelope, which the 34 × 23.5 reference home does not fit
 *  either way round. */
const TIGHT_LOT = {
  lotWidthFt: 60,
  lotDepthFt: 60,
  frontSetbackFt: 20,
  sideSetbackFt: 10,
  rearSetbackFt: 20,
};

const tightCheck = (document: BuilderDocument): SpecParcelCheck =>
  checkSpecAgainstParcel(document.spec, TIGHT_LOT);

/** The smallest home the budget ladder can reach from a given volume:
 *  34 × 0.6 and 23.5 × 0.6, each on the editor's own half-foot step.
 *
 *  TAKES ITS SPEC RATHER THAN CLOSING OVER `DOC`, and the reason is a real
 *  finding rather than tidiness. The ladder shrinks width and depth only —
 *  openings keep their sizes, which the footprint card says out loud — so a
 *  glass-heavy home's glazing cost does not shrink with it. Once glazing was
 *  priced by AREA instead of by opening count (BQ02, 2026-08-15), a cap
 *  derived from the plain reference home's smallest rung sat BELOW the glassy
 *  fixture's cheapest rung, and the budget card correctly stopped existing.
 *  The cap has to be derived from the same home the card is read against. */
function smallestLadderRung(spec: HomeSpec): HomeSpec {
  const volume = spec.volumes[0];
  return {
    ...spec,
    volumes: [{ ...volume, widthFt: 20.5, depthFt: 14 }],
  };
}

const GLASSY = glassyFixture();

const priceOf = (spec: HomeSpec, capCad: number | null) =>
  createProjectBudget({
    document: { ...DOC, spec },
    scenario: SCENARIO,
    region: "Alberta",
    municipality: "",
    budgetCapCad: capCad,
  });

/** A cap the reference home is over and the smallest ladder rung is under,
 *  derived from two real prices rather than picked. `createProjectBudget`
 *  calls a design "over" when even its LEAN path exceeds the cap, so the
 *  bound that matters is `total.low`. */
const REACHABLE_CAP = Math.ceil(priceOf(smallestLadderRung(GLASSY.spec), null).total.low / 50) * 50;

const basis = (capCad: number | null): CoPilotBasis => ({
  ...defaultCoPilotBasis(),
  scenario: SCENARIO,
  budgetCapCad: capCad,
});

const BAD_OPENING = badOpeningFixture();

/** One document with three findings at once: glass over the reference, a
 *  footprint that will not fit the lot, and a price over a stated cap. */
const LOUD_REPORT = readCoPilot({
  document: GLASSY,
  parcelCheck: tightCheck(GLASSY),
  basis: basis(REACHABLE_CAP),
});

const QUIET_REPORT = readCoPilot({ document: DOC, parcelCheck: null });

const OPENING_REPORT = readCoPilot({ document: BAD_OPENING, parcelCheck: null });

const find = (report: CoPilotReport, kind: CoPilotSuggestion["kind"]): CoPilotSuggestion => {
  const found = report.suggestions.find((suggestion) => suggestion.kind === kind);
  if (!found) {
    throw new Error(
      `no ${kind} card in this report; it carries ${report.suggestions
        .map((suggestion) => suggestion.kind)
        .join(", ") || "nothing"}`,
    );
  }
  return found;
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. WHAT THIS IS — a deterministic advisor, and the word is checkable
   ═══════════════════════════════════════════════════════════════════════ */

test("the co-pilot is deterministic, pure, and reaches nothing", () => {
  expect(COPILOT_ENGINE).toBe("deterministic-advisor");

  const before = JSON.stringify(GLASSY);
  const first = readCoPilot({ document: GLASSY, parcelCheck: tightCheck(GLASSY), basis: basis(REACHABLE_CAP) });
  const second = readCoPilot({ document: GLASSY, parcelCheck: tightCheck(GLASSY), basis: basis(REACHABLE_CAP) });
  expect(second).toEqual(first);
  expect(JSON.stringify(GLASSY), "readCoPilot mutated the document it was handed").toBe(before);

  /* A model, a network call, a clock or a random number would each make the
     paragraph above false, and each is a single token. Comments are stripped
     so the header can name what it refuses without tripping this. */
  for (const banned of [
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "Math.random",
    "Date.now",
    "new Date",
    "toLocaleString",
    "process.env",
    "openai",
    "anthropic",
    "apiKey",
  ]) {
    expect(moduleCode, `copilot.ts must not reach for ${banned}`).not.toContain(banned);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. THE MODULE REFUSES — layer 1
   ═══════════════════════════════════════════════════════════════════════ */

test("applyPreparedAction refuses a confirmation that names another suggestion", () => {
  const card = find(LOUD_REPORT, "glazing-over-prescriptive");
  const result = applyPreparedAction(GLASSY, card.action, {
    confirmedId: "some-other-card",
    confirmedText: card.action.confirmText,
  });
  expect(result.ok, "a confirmation for a different card applied this one").toBe(false);
  if (result.ok) throw new Error("unreachable");
  expect(result.problem).toContain("some-other-card");
  expect(result.problem).toContain("Nothing was applied");
});

test("applyPreparedAction refuses a confirmation that quotes different words", () => {
  const card = find(LOUD_REPORT, "glazing-over-prescriptive");
  const result = applyPreparedAction(GLASSY, card.action, {
    confirmedId: card.id,
    confirmedText: "Apply",
  });
  expect(
    result.ok,
    "a confirmation quoting words the control never carried applied the change",
  ).toBe(false);
  if (result.ok) throw new Error("unreachable");
  expect(result.problem).toContain(card.action.confirmText);
});

test("a matching confirmation applies, in one step, without touching the document", () => {
  const card = find(LOUD_REPORT, "glazing-over-prescriptive");
  const before = JSON.stringify(GLASSY);
  const result = applyPreparedAction(GLASSY, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.problem);

  expect(result.spec).not.toBe(GLASSY.spec);
  expect(result.label).toBe(card.action.label);
  expect(result.announcement.length).toBeGreaterThan(0);
  expect(JSON.stringify(GLASSY), "applying mutated the document it was handed").toBe(before);

  /* The glass really moved, measured by the engine that raised the finding. */
  expect(glazedAreaSqFt(result.spec)).toBeLessThan(glazedAreaSqFt(GLASSY.spec));
});

test("nothing except applyPreparedAction can produce a spec", () => {
  /* THE SECOND DOOR IS THE ONE NOBODY GUARDS. A preview that returned the
     candidate document would let any caller skip the confirmation entirely and
     hand the result to the editor, and the card would be theatre. So every
     value the other exports return is serialised and searched for the keys a
     HomeSpec cannot exist without. */
  const cards = [...LOUD_REPORT.suggestions, ...OPENING_REPORT.suggestions];
  expect(cards.length, "no cards to check, so this assertion is vacuous").toBeGreaterThan(3);

  const surfaces: string[] = [
    JSON.stringify(LOUD_REPORT),
    JSON.stringify(QUIET_REPORT),
    JSON.stringify(OPENING_REPORT),
    ...cards.map((card) => JSON.stringify(previewPreparedAction(GLASSY, card.action))),
  ];

  for (const surface of surfaces) {
    for (const key of ['"volumes":', '"wallHeightFt":', '"openings":', '"siting":']) {
      expect(surface, `a co-pilot value leaked ${key} — that is a spec escaping the confirmation`)
        .not.toContain(key);
    }
  }

  /* And prove the detector discriminates: the one function that IS allowed to
     produce a spec fails the same search. */
  const card = find(LOUD_REPORT, "glazing-over-prescriptive");
  const applied = applyPreparedAction(GLASSY, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  expect(JSON.stringify(applied)).toContain('"volumes":');
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. THE INTERFACE HAS ONE APPLY PATH — layer 3
   ═══════════════════════════════════════════════════════════════════════ */

const APPLY_BEGIN = "/* == CO-PILOT APPLY PATH · BEGIN ==";
const APPLY_END = "/* == CO-PILOT APPLY PATH · END == */";
const CONFIRM_BEGIN = "== CO-PILOT CONFIRM BRANCH · BEGIN ==";
const CONFIRM_END = "== CO-PILOT CONFIRM BRANCH · END ==";
const ARMED_GUARD = "if (armedId !== suggestion.id) return;";

/** The fenced apply path, taken from the RAW source because the fence is made
 *  of comments. */
function applyPathSlice(): string {
  const from = componentSource.indexOf(APPLY_BEGIN);
  const to = componentSource.indexOf(APPLY_END);
  return componentSource.slice(from, to);
}

test("the fences that make the apply path findable are each present exactly once", () => {
  /* Before any assertion about what is INSIDE a fence means anything, the
     fence has to exist and be unique — otherwise a slice of "" passes every
     containment check that follows by finding nothing to object to. */
  for (const marker of [APPLY_BEGIN, APPLY_END, CONFIRM_BEGIN, CONFIRM_END]) {
    expect(occurrences(componentSource, marker), `${marker} is not present exactly once`).toBe(1);
  }
  expect(componentSource.indexOf(APPLY_BEGIN)).toBeLessThan(componentSource.indexOf(APPLY_END));
  expect(applyPathSlice().length).toBeGreaterThan(200);
});

test("the component has exactly one call to applyPreparedAction, inside the fence", () => {
  expect(
    occurrences(componentSource, "applyPreparedAction("),
    "CoPilot.tsx calls applyPreparedAction more than once, so there is more than one apply path",
  ).toBe(1);
  expect(
    applyPathSlice(),
    "the call to applyPreparedAction is outside the fenced apply path",
  ).toContain("applyPreparedAction(");
});

test("the component hands the editor an edit from exactly one place, inside the fence", () => {
  expect(
    occurrences(componentSource, "onApply("),
    "CoPilot.tsx calls the editor's onApply more than once",
  ).toBe(1);
  expect(applyPathSlice(), "the call to onApply is outside the fenced apply path").toContain(
    "onApply(",
  );
});

test("the apply path opens with the guard that refuses an unarmed suggestion", () => {
  /* This is the assertion the whole node turns on: the handler cannot be
     called with a card the person did not arm, and the refusal is the FIRST
     statement rather than a check somewhere in the middle that a later edit
     could step around. */
  const slice = applyPathSlice();
  expect(slice, "the armed guard is missing from the apply path").toContain(ARMED_GUARD);
  expect(
    slice.indexOf(ARMED_GUARD),
    "the armed guard does not come before the call it guards",
  ).toBeLessThan(slice.indexOf("applyPreparedAction("));
});

test("the control that applies exists only inside the armed branch", () => {
  const from = componentSource.indexOf(CONFIRM_BEGIN);
  const to = componentSource.indexOf(CONFIRM_END);
  const branch = componentSource.slice(from, to);

  expect(
    occurrences(componentSource, "confirmArmed("),
    "confirmArmed is invoked from more than one place",
  ).toBe(1);
  expect(branch, "the confirm control is outside the armed branch").toContain(
    "confirmArmed(suggestion)",
  );

  /* And the branch really is the armed one: the conditional that opens it is
     immediately above the fence. */
  const lead = componentSource.slice(Math.max(0, from - 220), from);
  expect(lead, "the confirm fence is not inside an `armedId === suggestion.id` branch").toContain(
    "armedId === suggestion.id",
  );
});

test("nothing in the sidebar can fire on its own", () => {
  /* The half a static render cannot see. An effect, a timer or a frame
     callback is how an "auto-apply the safe ones" would arrive, and none of
     them shows up in markup. Comments are stripped so the header can name
     these by word. */
  for (const banned of ["useEffect", "setTimeout", "setInterval", "requestAnimationFrame", "queueMicrotask"]) {
    expect(componentCode, `CoPilot.tsx must not reach for ${banned}`).not.toContain(banned);
  }
});

test("the source detectors above can actually fail", () => {
  /* Every assertion in this section is a grep, which is the class of check
     that silently starts matching nothing. Prove each token it hunts for is
     really the shape the file is written in, and that a near-miss does not
     satisfy it. */
  expect(occurrences(componentSource, "applyPreparedAction")).toBeGreaterThan(1); // import + call
  expect(occurrences(componentSource, "onApply")).toBeGreaterThan(1); // prop, deps, call
  expect(occurrences(componentSource, "armedId")).toBeGreaterThan(3);
  expect(occurrences(componentSource, "applyPreparedActionXX")).toBe(0);
  expect(applyPathSlice()).not.toContain("useCallbackXX");
  expect(componentCode).toContain("useCallback");
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. NOTHING AUTO-APPLIES — layer 4, measured on real markup
   ═══════════════════════════════════════════════════════════════════════ */

function markupFor(document: BuilderDocument, parcelCheck: SpecParcelCheck | null, capCad: number | null) {
  const applied: Array<{ label: string }> = [];
  const markup = renderToStaticMarkup(
    asReact({
      __pw_type: "jsx",
      type: CoPilot,
      props: {
        document,
        parcelCheck,
        onApply: (_spec: HomeSpec, label: string) => applied.push({ label }),
        scenario: SCENARIO,
        budgetCapCad: capCad,
      },
    }) as never,
  );
  return { markup, applied };
}

test("rendering the whole sidebar applies nothing and offers no confirm control", () => {
  const { markup, applied } = markupFor(GLASSY, tightCheck(GLASSY), REACHABLE_CAP);

  expect(applied, "rendering the co-pilot handed the editor an edit").toEqual([]);
  expect(markup).toContain(`data-copilot-engine="${COPILOT_ENGINE}"`);
  expect(markup).toContain('data-copilot-armed="none"');

  /* Three real cards on screen, so the absence below is an absence and not an
     empty list. */
  for (const card of LOUD_REPORT.suggestions) {
    expect(markup, `card ${card.id} is missing from the sidebar`).toContain(
      `data-copilot-suggestion="${card.id}"`,
    );
    expect(markup).toContain(`data-copilot-card-armed="no"`);
  }

  /* The confirm control is not disabled and not hidden — it is not in the
     tree. A stylesheet cannot defeat this, and a `disabled` attribute would
     fail it. */
  for (const card of LOUD_REPORT.suggestions) {
    expect(
      markup,
      `the confirm control for ${card.id} is in the markup of an unarmed card`,
    ).not.toContain(card.action.confirmText);
  }
  expect(markup).not.toContain('data-copilot-card-armed="yes"');

  /* What IS on screen: the review control, one per card, and an empty live
     region — an always-on decorative sentence would pass for an announcement. */
  expect(occurrences(markup, "Review this change")).toBe(LOUD_REPORT.suggestions.length);
  expect(occurrences(markup, "Dismiss")).toBe(LOUD_REPORT.suggestions.length);
  expect(markup).toContain('role="status" aria-live="polite"></p>');
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. EVIDENCE, NOT VIBES
   ═══════════════════════════════════════════════════════════════════════ */

/** Every `import … from "…"` in copilot.ts, as specifier → imported names. */
const IMPORTS: Array<{ specifier: string; names: string }> = Array.from(
  moduleSource.matchAll(/import\s+([\s\S]*?)\s+from\s+"([^"]+)";/g),
).map((match) => ({ specifier: match[2], names: match[1] }));

/**
 * Is this evidence source a function the module ACTUALLY imports, from the
 * module it names?
 *
 * A source line is the card's whole claim to provenance. "modelledGlazingRatio
 * · lib/builder/toPlan.ts" printed by a module that never called it would be
 * the exact failure the closed union exists to prevent, and the type system
 * cannot catch it — the union is strings.
 */
function sourceIsImported(source: string): boolean {
  const [fn, file] = source.split(" · ");
  if (!fn || !file) return false;
  const base = file.replace(/\.tsx?$/, "").split("/").pop();
  return IMPORTS.some(
    (entry) =>
      (entry.specifier.endsWith(`/${base}`) || entry.specifier === `./${base}`) &&
      new RegExp(`\\b${fn}\\b`).test(entry.names),
  );
}

test("every figure a card prints names an engine this module actually called", () => {
  const cards = [...LOUD_REPORT.suggestions, ...OPENING_REPORT.suggestions];
  expect(cards.length).toBeGreaterThan(3);

  for (const card of cards) {
    expect(card.evidence.length, `${card.id} carries no evidence`).toBeGreaterThan(0);
    for (const item of card.evidence) {
      expect(Number.isFinite(item.value), `${card.id}/${item.label} has a non-finite value`).toBe(true);
      expect(item.formatted.length).toBeGreaterThan(0);
      expect(
        sourceIsImported(item.source),
        `${card.id}/${item.label} credits ${item.source}, which copilot.ts does not import`,
      ).toBe(true);
    }
  }

  /* The detector has to discriminate before its verdict means anything. */
  expect(sourceIsImported("modelledGlazingRatio · lib/builder/toPlan.ts")).toBe(true);
  expect(sourceIsImported("noSuchFunction · lib/builder/toPlan.ts")).toBe(false);
  expect(sourceIsImported("modelledGlazingRatio · lib/design/nowhere.ts")).toBe(false);
  expect(sourceIsImported("modelledGlazingRatio")).toBe(false);
});

test("every card names what gets worse, and never invents a limitation", () => {
  const cards = [...LOUD_REPORT.suggestions, ...OPENING_REPORT.suggestions];
  for (const card of cards) {
    expect(
      card.tradeOffs.length,
      `${card.id} lists no cost, which makes it an advertisement rather than advice`,
    ).toBeGreaterThan(0);

    /* Not-modelled entries are QUOTED from scenarios.ts, never restated. The
       identity check is the point: a co-pilot that wrote its own version of
       "daylight autonomy is not modelled" would drift from the panel that
       owns the sentence. */
    for (const entry of card.notModelled) {
      expect(
        NOT_MODELLED.some((known) => known === entry),
        `${card.id} carries a not-modelled entry that is not one of scenarios.ts's own`,
      ).toBe(true);
    }
  }

  /* And at least one card really does carry them, so the loop above is not
     passing over an empty list everywhere. */
  const glazing = find(LOUD_REPORT, "glazing-over-prescriptive");
  expect(glazing.notModelled.map((entry) => entry.id)).toEqual([
    "daylight-autonomy",
    "solar-gain",
  ]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. THE FOUR READINGS, EACH AGAINST THE ENGINE THAT OWNS IT
   ═══════════════════════════════════════════════════════════════════════ */

test("the glazing card fires only over the prescriptive reference, and measures its own result", () => {
  /* The reference home is UNDER the ceiling, so it gets no card — a suggestion
     that fires on a compliant design would train people to ignore the panel. */
  expect(modelledGlazingRatio(DOC.spec)).toBeLessThan(FDWR_MAX);
  expect(QUIET_REPORT.suggestions.some((card) => card.kind === "glazing-over-prescriptive")).toBe(false);

  const ratio = modelledGlazingRatio(GLASSY.spec);
  expect(ratio).toBeGreaterThan(FDWR_MAX);

  const card = find(LOUD_REPORT, "glazing-over-prescriptive");
  const printed = card.evidence.find((item) => item.label === "Glazing ratio now");
  expect(printed?.value, "the card's ratio is not modelledGlazingRatio's").toBe(ratio);
  expect(card.evidence.find((item) => item.label.includes("prescriptive"))?.value).toBe(FDWR_MAX);

  /* The outcome is MEASURED on the candidate, not predicted from the factor.
     Recomputed here through the confirmed apply path and compared. */
  const applied = applyPreparedAction(GLASSY, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  if (!applied.ok) throw new Error(applied.problem);
  const after = modelledGlazingRatio(applied.spec);
  expect(after).toBeLessThan(ratio);
  expect(
    card.outcome,
    "the outcome sentence does not quote the ratio measured on the candidate",
  ).toContain(`${(Math.round(after * 1000) / 10).toFixed(1)}%`);
});

test("the footprint card proposes the area analyseParcel verified, and re-checks the fit", () => {
  const check = tightCheck(GLASSY);
  const report = check.report;
  if (report === null) throw new Error("fixture produced no parcel report");
  expect(report.fits, "the tight-lot fixture fits, so this card cannot be tested").toBe(false);
  expect(report.suggestedTotalSqFt).not.toBeNull();

  const card = find(LOUD_REPORT, "footprint-over-buildable-envelope");
  const [wantWidth, wantDepth] = envelopeFor(report.suggestedTotalSqFt as number, storeysOf(GLASSY.spec));

  /* The dimensions are the plan engine's own envelope rule over the area
     `analyseParcel` verified — not a proportion chosen here. */
  if (card.action.payload.via !== "phrases") throw new Error("the footprint card stopped using phrases");
  expect(card.action.payload.phrases).toEqual([`width ${wantWidth}`, `depth ${wantDepth}`]);

  const applied = applyPreparedAction(GLASSY, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  if (!applied.ok) throw new Error(applied.problem);
  expect(totalFloorAreaSqFt(applied.spec)).toBeLessThan(totalFloorAreaSqFt(GLASSY.spec));
  expect(
    checkSpecAgainstParcel(applied.spec, check.facts).report?.fits,
    "the co-pilot proposed a size that still does not fit",
  ).toBe(true);
  expect(card.outcome).toContain("it fits the buildable envelope");
});

test("the budget card exists only against a stated cap, and refuses when no size reaches it", () => {
  /* No cap, no card: the only cost TARGET this product has is one you state,
     and measuring a design against a ceiling nobody set would be invention. */
  const uncapped = readCoPilot({ document: GLASSY, parcelCheck: null, basis: basis(null) });
  expect(uncapped.suggestions.some((card) => card.kind === "budget-over-stated-cap")).toBe(false);

  const card = find(LOUD_REPORT, "budget-over-stated-cap");
  if (card.action.payload.via !== "phrases") throw new Error("the budget card stopped using phrases");

  const applied = applyPreparedAction(GLASSY, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  if (!applied.ok) throw new Error(applied.problem);

  /* Re-priced by the same engine: the proposal really lands inside the cap. */
  const after = priceOf(applied.spec, REACHABLE_CAP);
  expect(after.cap?.state, "the co-pilot proposed a size that is still over the cap").not.toBe("over");
  expect(card.outcome).toContain("Measured on the result by re-pricing it");

  /* A cap nothing can reach is a refusal with the search stated, not a card
     proposing a house that would not help. */
  const impossible = readCoPilot({ document: GLASSY, parcelCheck: null, basis: basis(50) });
  expect(impossible.suggestions.some((entry) => entry.kind === "budget-over-stated-cap")).toBe(false);
  const refusal = impossible.refusals.find((entry) => entry.id === "budget-over-stated-cap");
  expect(refusal?.reason).toContain("Eight progressively smaller homes were priced");
});

test("an opening off its wall gets a refit, and the refit is verified by checkOpening", () => {
  expect(checkOpening(DOC.spec, "main", "o1").onWall).toBe(true);
  expect(QUIET_REPORT.suggestions.some((card) => card.kind === "opening-off-its-wall")).toBe(false);

  const illegal = checkOpening(BAD_OPENING.spec, "main", "o5");
  expect(illegal.onWall, "the fixture's opening is legal, so this card cannot be tested").toBe(false);

  const card = find(OPENING_REPORT, "opening-off-its-wall");
  expect(card.id).toBe("opening-off-its-wall:main:o5");

  const applied = applyPreparedAction(BAD_OPENING, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  if (!applied.ok) throw new Error(applied.problem);

  const after = checkOpening(applied.spec, "main", "o5");
  expect(after.onWall, "the refit left the opening off its wall").toBe(true);
  expect(after.clashes).toEqual([]);
  expect(card.outcome).toContain("on its wall, and clear of its neighbours");
});

/* ═══════════════════════════════════════════════════════════════════════════
   7. THE REFUSALS — what was looked at and not offered
   ═══════════════════════════════════════════════════════════════════════ */

test("a planar-graph project is read from the graph, not refused as a frozen copy", () => {
  const report = readCoPilot({ document: graphFixture(), parcelCheck: null });
  expect(report.unavailable).toBeNull();
  expect(report.suggestions.some((card) => card.kind === "footprint-over-buildable-envelope")).toBe(
    false,
  );
  expect(report.suggestions.some((card) => card.kind === "opening-off-its-wall")).toBe(false);
  expect(report.refusals.some((entry) => entry.id === "footprint-over-buildable-envelope")).toBe(
    true,
  );
  expect(report.refusals.find((entry) => entry.id === "footprint-over-buildable-envelope")?.reason)
    .toContain("applyPhrase");
  expect(report.refusals.find((entry) => entry.id === "opening-off-its-wall")?.reason).toContain(
    "applyOpeningEdit",
  );
});

test("a glassy graph project gets a less-glass card that writes the graph", () => {
  const converted = convertBuilderDocumentToGraph(GLASSY, 0.5);
  expect(converted.ok, "the glassy fixture itself failed to convert").toBe(true);
  if (!converted.ok) return;
  const document = converted.document;
  expect(document.geometry.kind).toBe("building-graph");
  if (document.geometry.kind !== "building-graph") return;

  const beforeRatio = modelledGraphGlazingRatio(document.geometry.graph);
  expect(beforeRatio).toBeGreaterThan(FDWR_MAX);

  const report = readCoPilot({ document, parcelCheck: null });
  expect(report.unavailable).toBeNull();
  const card = report.suggestions.find((entry) => entry.kind === "glazing-over-prescriptive");
  expect(card, "the graph advisor did not offer less glass").toBeDefined();
  if (!card) return;
  expect(card.action.payload).toEqual({ via: "scenario-move", move: "less-glass" });
  expect(card.evidence.some((item) => item.source.includes("modelledGraphGlazingRatio"))).toBe(
    true,
  );

  const applied = applyPreparedAction(document, card.action, {
    confirmedId: card.id,
    confirmedText: card.action.confirmText,
  });
  expect(applied.ok, applied.ok ? "" : applied.problem).toBe(true);
  if (!applied.ok) return;
  expect(applied.graph, "the apply path wrote the recovery spec instead of the graph").toBeDefined();
  if (!applied.graph) return;
  expect(modelledGraphGlazingRatio(applied.graph)).toBeLessThan(beforeRatio);
  expect(glazedAreaSqFt(applied.spec)).toBe(glazedAreaSqFt(document.spec));
});

test("a clearance clash is named as something not offered, never as a card", () => {
  /* `resolveFixtures` finds these and the builder already prints them under
     the model. What does not exist is an EDIT, so the co-pilot proposes none
     and says why — rather than moving somebody's wood stove to a spot chosen
     by arithmetic that models neither the room nor the flue. */
  for (const report of [QUIET_REPORT, LOUD_REPORT, OPENING_REPORT]) {
    expect(report.suggestions.some((card) => card.id === "clearance-clashes")).toBe(false);
    const refusal = report.refusals.find((entry) => entry.id === "clearance-clashes");
    expect(refusal, "the clearance refusal is missing, so its absence reads as an oversight").toBeDefined();
    expect(refusal?.reason).toContain("WETT inspector");
  }
});

test("a design with nothing wrong gets no cards and says what it looked at", () => {
  expect(QUIET_REPORT.suggestions).toEqual([]);
  expect(QUIET_REPORT.unavailable).toBeNull();
  expect(QUIET_REPORT.refusals.map((entry) => entry.id)).toContain(
    "footprint-over-buildable-envelope",
  );

  const { markup, applied } = markupFor(DOC, null, null);
  expect(applied).toEqual([]);
  expect(markup).toContain('data-copilot-open="0"');
  expect(markup).toContain("Nothing this build can check has anything to say");
  expect(markup).toContain("Looked at, and not offered");
});

test("the quiet sidebar names a catalog plan that actually produces a glazing card", () => {
  /* WAVE13 leftover: an empty first impression is correct for the default
     home and also unconvincing. The sentence must name a live catalog plan
     that this advisor would actually card — derived from PLAN_TEMPLATES and
     readCoPilot, never a hand-typed id that can go stale. */
  const demo = copilotQuietDemo(PLAN_TEMPLATES);
  expect(demo, "the library has no plan this advisor would card").not.toBeNull();
  if (!demo) return;

  const plan = PLAN_TEMPLATES.find((entry) => entry.id === demo.planId);
  expect(plan, `quiet demo ${demo.planId} is not in PLAN_TEMPLATES`).toBeDefined();
  expect(demo.ratio).toBeGreaterThan(FDWR_MAX);
  expect(demo.sentence).toContain(demo.planId);
  expect(demo.sentence).toContain("plan library");

  const report = readCoPilot({
    document: builderDocumentFromLegacySpec(plan!.spec),
    parcelCheck: null,
  });
  expect(report.suggestions.some((card) => card.kind === "glazing-over-prescriptive")).toBe(true);

  const { markup } = markupFor(DOC, null, null);
  expect(markup).toContain(`data-copilot-quiet-demo="${demo.planId}"`);
  expect(markup).toContain(demo.planId);
  expect(markup).toContain(demo.title);
});

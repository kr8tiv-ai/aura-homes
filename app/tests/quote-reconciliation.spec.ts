import { expect, test } from "playwright/test";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { createProjectBudget, defaultProjectBudgetScenario } from "@/lib/builder/projectBudget";
import {
  PROJECT_QUOTE_FORMAT,
  PROJECT_QUOTE_VERSION,
  reconcileProjectQuote,
  validateProjectQuote,
  type LegacyProjectQuote,
  type ProjectQuote,
} from "@/lib/project/quoteReconciliation";

const budget = createProjectBudget({
  document: defaultBuilderDocument(),
  scenario: defaultProjectBudgetScenario(),
  region: "Alberta",
  municipality: "Foothills County",
  budgetCapCad: 500_000,
});

function quote(change: Partial<LegacyProjectQuote> = {}): LegacyProjectQuote {
  return {
    format: "aura-project-quote",
    version: 1,
    id: "quote-1",
    vendorName: "Example SIP Supplier",
    capturedAtISO: "2026-08-01T00:00:00.000Z",
    validUntilISO: "2026-08-31T23:59:59.000Z",
    currency: "CAD",
    designHash: budget.designHash,
    modelTotalMidCad: budget.total.mid,
    evidence: null,
    notes: "Freight excluded.",
    lines: [
      { id: "line-1", budgetLineId: "shell", description: "SIP shell", amountCad: 48_000, allowance: false },
      { id: "line-2", budgetLineId: "roof", description: "Roof allowance", amountCad: 15_000, allowance: true },
    ],
    ...change,
  };
}

test("a quote is normalized against only the Aura scopes it covers", () => {
  const result = reconcileProjectQuote(budget, quote(), "2026-08-12T00:00:00.000Z");
  const modelCovered = budget.lines.filter((line) => ["shell", "roof"].includes(line.id)).reduce((sum, line) => sum + line.mid, 0);
  expect(result.quotedTotalCad).toBe(63_000);
  expect(result.modelCoveredMidCad).toBe(modelCovered);
  expect(result.varianceCad).toBe(63_000 - modelCovered);
  expect(result.allowances.map((line) => line.id)).toEqual(["line-2"]);
  expect(result.omittedBudgetLineIds).not.toContain("shell");
  expect(result.omittedBudgetLineIds).toContain("site-preparation");
});

test("expiry and unmapped lines remain visible instead of being normalized away", () => {
  const result = reconcileProjectQuote(
    budget,
    quote({ lines: [{ id: "misc", budgetLineId: null, description: "Unmapped fee", amountCad: 900, allowance: false }] }),
    "2026-09-01T00:00:00.000Z",
  );
  expect(result.stale).toBe(true);
  expect(result.unmappedLines).toHaveLength(1);
  expect(result.coveredBudgetLineIds).toEqual([]);
  expect(result.modelCoveredMidCad).toBe(0);
});

test("invalid quote evidence cannot enter a project", () => {
  expect(validateProjectQuote(quote()).ok).toBe(true);
  expect(validateProjectQuote({ ...quote(), lines: [{ ...quote().lines[0], amountCad: -1 }] }).ok).toBe(false);
  expect(validateProjectQuote({ ...quote(), evidence: { name: "quote.pdf", mediaType: "application/pdf", sizeBytes: 2, sha256: "not-a-hash", dataUrl: "data:application/pdf;base64,AA==" } }).ok).toBe(false);
});

test("version two quotes bind both hashes and explain changed planning inputs", () => {
  expect(PROJECT_QUOTE_VERSION).toBe(2);
  const latest = {
    ...quote(),
    format: PROJECT_QUOTE_FORMAT,
    version: PROJECT_QUOTE_VERSION,
    budgetHash: (budget as unknown as { budgetHash: string }).budgetHash,
    budgetBasis: {
      region: budget.region,
      municipality: budget.municipality,
      scenario: budget.scenario,
      budgetCapCad: budget.cap?.capCad ?? null,
    },
  };
  expect(validateProjectQuote(latest).ok).toBe(true);
  const invalidTax = structuredClone(latest);
  invalidTax.budgetBasis.scenario.salesTaxPct = Number.POSITIVE_INFINITY;
  expect(validateProjectQuote(invalidTax).ok).toBe(false);
  const changedScenario = { ...defaultProjectBudgetScenario(), utilities: "off-grid" as const, finish: "elevated" as const, delivery: "full-service" as const, contingencyPct: 20, salesTaxPct: 5 };
  const changedBudget = createProjectBudget({
    document: defaultBuilderDocument(),
    scenario: changedScenario,
    region: "British Columbia",
    municipality: "Nelson",
    budgetCapCad: 600_000,
  });
  const result = reconcileProjectQuote(changedBudget, latest as never, "2026-08-12T00:00:00.000Z");
  expect((result as unknown as { basisState: string }).basisState).toBe("changed");
  expect((result as unknown as { basisChanges: Array<{ field: string }> }).basisChanges.map((change) => change.field)).toEqual(expect.arrayContaining([
    "utilities", "finish", "delivery", "contingency", "tax", "region", "municipality", "budget-cap",
  ]));
});

test("version one quotes remain readable and are identified as unbound to a canonical budget", () => {
  const legacy = quote();
  const checked = validateProjectQuote(legacy);
  expect(checked.ok).toBe(true);
  if (!checked.ok) return;
  const result = reconcileProjectQuote(budget, checked.quote, "2026-08-12T00:00:00.000Z");
  expect((result as unknown as { basisState: string }).basisState).toBe("legacy-unbound");
  expect((result as unknown as { basisChanges: Array<{ field: string }> }).basisChanges).toEqual([
    expect.objectContaining({ field: "legacy" }),
  ]);
});

import { expect, test } from "playwright/test";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { createProjectBudget, defaultProjectBudgetScenario } from "@/lib/builder/projectBudget";
import {
  reconcileProjectQuote,
  validateProjectQuote,
  type ProjectQuote,
} from "@/lib/project/quoteReconciliation";

const budget = createProjectBudget({
  document: defaultBuilderDocument(),
  scenario: defaultProjectBudgetScenario(),
  region: "Alberta",
  municipality: "Foothills County",
  budgetCapCad: 500_000,
});

function quote(change: Partial<ProjectQuote> = {}): ProjectQuote {
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

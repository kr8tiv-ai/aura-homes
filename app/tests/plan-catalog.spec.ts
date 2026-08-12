import { expect, test } from "playwright/test";

import { validateBuilderDocument } from "@/lib/builder/document";
import {
  PLAN_TEMPLATES,
  estimatePlanTemplate,
  instantiatePlanTemplate,
} from "@/lib/builder/planCatalog";
import { totalFloorAreaSqFt } from "@/lib/builder/spec";

test("the plan library is substantial, deterministic and contains licensed open work", () => {
  expect(PLAN_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  expect(new Set(PLAN_TEMPLATES.map((plan) => plan.id)).size).toBe(PLAN_TEMPLATES.length);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "licensed-adaptation").length).toBeGreaterThanOrEqual(3);

  for (const plan of PLAN_TEMPLATES) {
    expect(plan.title.trim().length).toBeGreaterThan(0);
    expect(plan.summary.trim().length).toBeGreaterThan(0);
    expect(plan.source.url).toMatch(/^https:\/\//);
    expect(plan.source.licenseUrl).toMatch(/^https:\/\//);
    expect(plan.source.license).not.toMatch(/\bNC\b|noncommercial/i);
    expect(plan.bedrooms).toBeGreaterThanOrEqual(0);
    expect(plan.bathrooms).toBeGreaterThan(0);

    if (plan.source.kind === "licensed-adaptation") {
      expect(plan.source.attribution.trim().length).toBeGreaterThan(20);
      expect(plan.source.changes.trim().length).toBeGreaterThan(20);
      expect(plan.source.shareAlike).toBe(true);
    }
  }
});

test("every plan becomes an independent, validated BuilderDocument", () => {
  for (const plan of PLAN_TEMPLATES) {
    const first = instantiatePlanTemplate(plan.id);
    const second = instantiatePlanTemplate(plan.id);

    expect(validateBuilderDocument(first).ok).toBe(true);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.spec).not.toBe(second.spec);
    expect(first.spec.name).toBe(plan.title);
    expect(totalFloorAreaSqFt(first.spec)).toBeGreaterThan(100);

    first.spec.name = "A private edit";
    expect(second.spec.name).toBe(plan.title);
  }
});

test("every plan carries a transparent Alberta materials-and-systems range", () => {
  for (const plan of PLAN_TEMPLATES) {
    const estimate = estimatePlanTemplate(plan.id);
    const document = instantiatePlanTemplate(plan.id);

    expect(estimate.currency).toBe("CAD");
    expect(estimate.jurisdiction).toBe("Alberta pilot");
    expect(estimate.areaSqFt).toBeCloseTo(totalFloorAreaSqFt(document.spec), 4);
    expect(estimate.low).toBeGreaterThan(0);
    expect(estimate.low).toBeLessThan(estimate.mid);
    expect(estimate.mid).toBeLessThan(estimate.high);
    expect(estimate.lineItems).toBeGreaterThanOrEqual(8);
    expect(estimate.assumptions.join(" ")).toMatch(/land|permit/i);
  }
});

test("unknown plan identifiers fail instead of silently loading the reference home", () => {
  expect(() => instantiatePlanTemplate("not-a-plan")).toThrow(/Unknown Aura plan template/);
  expect(() => estimatePlanTemplate("not-a-plan")).toThrow(/Unknown Aura plan template/);
});

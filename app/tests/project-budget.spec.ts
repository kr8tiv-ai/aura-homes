import { expect, test } from "playwright/test";

import { convertBuilderDocumentToGraph, defaultBuilderDocument } from "@/lib/builder/document";
import { duplicateGraphStorey } from "@/lib/builder/buildingGraph";
import { hashBuilderDocument } from "@/lib/builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudgetScenario,
} from "@/lib/builder/projectBudget";

function scenario(change: Partial<ProjectBudgetScenario> = {}): ProjectBudgetScenario {
  return { ...defaultProjectBudgetScenario(), ...change };
}

test("a project budget is bound to the exact durable design", () => {
  const document = defaultBuilderDocument();
  const budget = createProjectBudget({
    document,
    scenario: scenario(),
    region: "Alberta",
    municipality: "Foothills County",
    budgetCapCad: 500_000,
  });

  expect(budget.designHash).toBe(hashBuilderDocument(document));
  expect(budget.areaSqFt).toBe(799);
  expect(budget.currency).toBe("CAD");
  expect(budget.lines.length).toBeGreaterThanOrEqual(12);
  expect(budget.subtotal.low).toBeLessThan(budget.subtotal.mid);
  expect(budget.subtotal.mid).toBeLessThan(budget.subtotal.high);
  expect(budget.total.low).toBeLessThan(budget.total.mid);
  expect(budget.total.mid).toBeLessThan(budget.total.high);
  expect(budget.cap?.capCad).toBe(500_000);
  expect(budget.assumptions.join(" ")).toMatch(/Alberta|design/i);
  expect(budget.exclusions.join(" ")).toMatch(/land|tax/i);
});

test("edited geometry changes the range instead of reusing a reference fixture", () => {
  const small = defaultBuilderDocument();
  small.spec = {
    ...small.spec,
    volumes: [{ ...small.spec.volumes[0], widthFt: 18, depthFt: 20, openings: [] }],
  };
  const large = defaultBuilderDocument();
  large.spec = {
    ...large.spec,
    volumes: [{ ...large.spec.volumes[0], widthFt: 36, depthFt: 40 }],
  };

  const low = createProjectBudget({ document: small, scenario: scenario(), region: "Alberta", municipality: "", budgetCapCad: null });
  const high = createProjectBudget({ document: large, scenario: scenario(), region: "Alberta", municipality: "", budgetCapCad: null });

  expect(low.areaSqFt).toBe(360);
  expect(high.areaSqFt).toBe(1440);
  expect(high.total.mid).toBeGreaterThan(low.total.mid);
});

test("utility paths change real line items and not just a label", () => {
  const document = defaultBuilderDocument();
  const serviced = createProjectBudget({ document, scenario: scenario({ utilities: "serviced" }), region: "Alberta", municipality: "Edmonton fringe", budgetCapCad: null });
  const offGrid = createProjectBudget({ document, scenario: scenario({ utilities: "off-grid" }), region: "Alberta", municipality: "Rural", budgetCapCad: null });

  expect(serviced.lines.some((line) => line.id === "municipal-connections")).toBe(true);
  expect(serviced.lines.some((line) => line.id === "solar")).toBe(false);
  expect(serviced.lines.some((line) => line.id === "septic")).toBe(false);
  expect(offGrid.lines.some((line) => line.id === "solar")).toBe(true);
  expect(offGrid.lines.some((line) => line.id === "battery")).toBe(true);
  expect(offGrid.lines.some((line) => line.id === "septic")).toBe(true);
});

test("site unknowns lower confidence and become explicit quote gaps", () => {
  const document = defaultBuilderDocument();
  const unknown = createProjectBudget({ document, scenario: scenario({ site: "unknown", shippingDistanceKm: 0 }), region: "Alberta", municipality: "", budgetCapCad: null });
  const known = createProjectBudget({ document, scenario: scenario({ site: "serviced-flat", shippingDistanceKm: 80 }), region: "Alberta", municipality: "Leduc", budgetCapCad: null });

  expect(unknown.confidence.score).toBeLessThan(known.confidence.score);
  expect(unknown.gaps.join(" ")).toMatch(/site|delivery/i);
  expect(known.gaps.join(" ")).not.toMatch(/delivery distance/i);
});

test("finish and delivery choices move the same cost basis predictably", () => {
  const document = defaultBuilderDocument();
  const lean = createProjectBudget({ document, scenario: scenario({ finish: "essential", delivery: "owner-builder" }), region: "Alberta", municipality: "", budgetCapCad: null });
  const complete = createProjectBudget({ document, scenario: scenario({ finish: "elevated", delivery: "full-service" }), region: "Alberta", municipality: "", budgetCapCad: null });

  expect(complete.total.low).toBeGreaterThan(lean.total.low);
  expect(complete.total.mid).toBeGreaterThan(lean.total.mid);
  expect(complete.total.high).toBeGreaterThan(lean.total.high);
});

test("graph projects use exact graph floor area, including duplicated storeys", () => {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok || converted.document.geometry.kind !== "building-graph") return;
  const source = converted.document.geometry.graph.storeys[0];
  const duplicated = duplicateGraphStorey(converted.document.geometry.graph, source.id, {
    id: "storey-2",
    name: "Upper storey",
    elevationFt: source.elevationFt + source.heightFt,
  });
  expect(duplicated.ok).toBe(true);
  if (!duplicated.ok) return;
  const document = {
    ...converted.document,
    geometry: { ...converted.document.geometry, graph: duplicated.graph },
  };

  const budget = createProjectBudget({ document, scenario: scenario(), region: "Alberta", municipality: "", budgetCapCad: null });
  expect(budget.areaSqFt).toBeCloseTo(1598, 0);
  expect(budget.measures.storeys).toBe(2);
});

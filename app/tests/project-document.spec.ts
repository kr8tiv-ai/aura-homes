import { expect, test } from "playwright/test";

import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import {
  AURA_PROJECT_VERSION,
  canonicalAuraProjectJson,
  createAuraProject,
  hashAuraProject,
  projectJourney,
  withProjectDesign,
  validateAuraProject,
} from "@/lib/project/document";
import {
  decryptAuraProjectFile,
  encryptAuraProjectFile,
  parseAuraProjectFile,
  projectFileJson,
} from "@/lib/project/file";

const now = new Date("2026-08-11T12:00:00.000Z");

test("a builder document becomes one durable find-land-and-build project", () => {
  const document = defaultBuilderDocument();
  const project = createAuraProject({
    id: "project-alberta-1",
    name: "Foothills home",
    journey: "find-land-build",
    document,
    now,
  });

  expect(project.version).toBe(AURA_PROJECT_VERSION);
  expect(project.design.document).toEqual(document);
  expect(project.design.documentHash).toBe(hashBuilderDocument(document));
  expect(project.requirements.location.region).toBe("Alberta");
  expect(project.discovery.land.shortlist).toEqual([]);
  expect(project.delivery.rfqs).toEqual([]);
  expect(validateAuraProject(project)).toEqual({ ok: true, project });
});

test("project identity is canonical and refuses a changed embedded design", () => {
  const project = createAuraProject({
    id: "project-hash",
    name: "Hash home",
    journey: "build-on-owned-land",
    document: defaultBuilderDocument(),
    now,
  });
  const reordered = JSON.parse(canonicalAuraProjectJson(project));

  expect(hashAuraProject(reordered)).toBe(hashAuraProject(project));

  const changed = structuredClone(project);
  changed.design.document.spec.name = "Changed without updating the hash";
  const checked = validateAuraProject(changed);
  expect(checked.ok).toBe(false);
  if (!checked.ok) expect(checked.problem).toContain("design hash mismatch");
});

test("future project versions fail visibly without being interpreted", () => {
  const project = createAuraProject({
    id: "project-future",
    name: "Future home",
    journey: "buy-finished-home",
    document: defaultBuilderDocument(),
    now,
  });
  const future = { ...project, version: AURA_PROJECT_VERSION + 1 };
  const checked = validateAuraProject(future);

  expect(checked.ok).toBe(false);
  if (!checked.ok) {
    expect(checked.futureVersion).toBe(AURA_PROJECT_VERSION + 1);
    expect(checked.problem).toContain("newer version");
  }
});

test("journey progress recommends the first incomplete real-world decision", () => {
  const project = createAuraProject({
    id: "project-progress",
    name: "Journey home",
    journey: "find-land-build",
    document: defaultBuilderDocument(),
    now,
  });

  const initial = projectJourney(project);
  expect(initial.steps.map((step) => step.id)).toEqual([
    "requirements",
    "design",
    "land",
    "team",
    "quotes",
    "funding",
    "build",
    "operate",
  ]);
  expect(initial.next.id).toBe("requirements");

  const ready = structuredClone(project);
  ready.requirements.completedAtISO = now.toISOString();
  expect(projectJourney(ready).next.id).toBe("land");
});

test("plain and encrypted Aura project files round-trip without information loss", async () => {
  const project = createAuraProject({
    id: "project-file",
    name: "Portable home",
    journey: "find-land-build",
    document: defaultBuilderDocument(),
    now,
  });

  const plain = parseAuraProjectFile(projectFileJson(project));
  expect(plain.ok).toBe(true);
  if (plain.ok) expect(plain.project).toEqual(project);

  const encrypted = await encryptAuraProjectFile(project, "paper-forest-river");
  expect(encrypted).not.toContain(project.name);
  const decrypted = await decryptAuraProjectFile(encrypted, "paper-forest-river");
  expect(decrypted).toEqual(project);
  await expect(decryptAuraProjectFile(encrypted, "wrong-passphrase")).rejects.toThrow(
    "could not be decrypted",
  );
});

test("a builder edit replaces only the durable project design", () => {
  const project = createAuraProject({
    id: "project-design-sync",
    name: "Foothills build",
    journey: "find-land-build",
    document: defaultBuilderDocument(),
    now,
  });
  const document = defaultBuilderDocument();
  document.spec = { ...document.spec, name: "Edited in Guided mode" };
  const next = withProjectDesign(project, document, new Date("2026-08-11T12:03:00.000Z"));

  expect(next.design.document.spec.name).toBe("Edited in Guided mode");
  expect(next.design.documentHash).toBe(hashBuilderDocument(document));
  expect(next.requirements).toEqual(project.requirements);
  expect(next.createdAtISO).toBe(project.createdAtISO);
  expect(next.updatedAtISO).toBe("2026-08-11T12:03:00.000Z");
  expect(validateAuraProject(next).ok).toBe(true);
});

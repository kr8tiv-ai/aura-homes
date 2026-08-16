import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "playwright/test";
import { keccak256, stringToHex } from "viem";

import {
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  hashBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import { exportDxf, exportIfc } from "@/lib/builder/exportPro";
import { exportIfcJson } from "@/lib/builder/exportSemantic";
import { exportSpecJson } from "@/lib/builder/exportSpec";
import {
  HANDOFF_PACKAGE_FORMAT,
  buildHandoffPackage,
  readHandoffPackage,
  type HandoffPackage,
  type HandoffPackageInput,
} from "@/lib/builder/handoffPackage";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudget,
} from "@/lib/builder/projectBudget";

/* ===========================================================================
   EX01 + EX02 — see the package before you download it, and a package that
   lies about itself must be impossible to make.

   Two assertions carry this file, and every test below exists to make one of
   them falsifiable rather than asserted:

     1. THE PREVIEW AND THE DOWNLOAD ARE THE SAME BYTES. One generation
        produces `package` (what a screen shows) and `artifact` (what a button
        saves). Pinned by comparing the artifact's own bytes back to both.

     2. A PACKAGE WHOSE STATED HASH DISAGREES WITH ITS CONTENTS CANNOT BE
        PRODUCED. Pinned three ways: the builder verifies its own output before
        returning; the reader refuses every single-field tamper by name; and no
        hash is reachable as an input, proved by handing the builder stray hash
        keys and getting byte-identical output.

   Determinism note: `issuedISO` is a parameter everywhere in this file. The
   module reads no clock, which is what makes "same bytes" a testable claim.
   =========================================================================== */

const DATE = "2026-08-14";

const base = (over: Partial<HandoffPackageInput> = {}): HandoffPackageInput => ({
  document: defaultBuilderDocument(),
  issuedISO: DATE,
  ...over,
});

const budgetFor = (document: BuilderDocument): ProjectBudget =>
  createProjectBudget({
    document,
    scenario: defaultProjectBudgetScenario(),
    region: "Alberta",
    municipality: "Foothills County",
    budgetCapCad: 500_000,
  });

/** Re-serialise a package after an edit, exactly as a person with a text
 *  editor would. The reader must survive being handed this. */
const retext = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/* =========================================================== 1. byte identity */

test("the preview and the downloaded file are the same bytes", async () => {
  const built = await buildHandoffPackage(base());

  // What the button saves.
  const saved = await built.artifact.blob.text();
  // What a screen shows is `built.package`; `built.json` is the text of both.
  expect(saved).toBe(built.json);
  expect(JSON.parse(saved)).toEqual(built.package);
  expect(built.artifact.byteLength).toBe(new TextEncoder().encode(built.json).length);

  // And the saved bytes verify as the package that was displayed.
  const read = readHandoffPackage(saved);
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(read.package.packageHash).toBe(built.package.packageHash);
  expect(read.package.designHash).toBe(built.package.designHash);
});

test("the same document and the same date produce byte-identical packages", async () => {
  const document = defaultBuilderDocument();
  const a = await buildHandoffPackage(base({ document }));
  const b = await buildHandoffPackage(base({ document }));
  expect(b.json).toBe(a.json);
  expect(b.artifact.filename).toBe(a.artifact.filename);
});

/* ============================================================ 2. round trip */

test("re-importing the package reproduces the same document hash", async () => {
  const document = defaultBuilderDocument();
  const built = await buildHandoffPackage(base({ document }));

  const read = readHandoffPackage(built.json);
  expect(read.ok).toBe(true);
  if (!read.ok) return;

  expect(hashBuilderDocument(read.document)).toBe(hashBuilderDocument(document));
  expect(read.designHash).toBe(hashBuilderDocument(document));
  expect(built.package.designHash).toBe(hashBuilderDocument(document));

  // Rebuilding from the re-imported document lands on the same package.
  const again = await buildHandoffPackage(base({ document: read.document }));
  expect(again.json).toBe(built.json);
});

test("a different design is a different package — the round trip is not vacuous", async () => {
  const document = defaultBuilderDocument();
  const wider: BuilderDocument = {
    ...document,
    spec: {
      ...document.spec,
      volumes: document.spec.volumes.map((v, i) => (i === 0 ? { ...v, widthFt: v.widthFt + 6 } : v)),
    },
  };
  const a = await buildHandoffPackage(base({ document }));
  const b = await buildHandoffPackage(base({ document: wider }));

  expect(b.package.designHash).not.toBe(a.package.designHash);
  expect(b.package.packageHash).not.toBe(a.package.packageHash);
  expect(b.json).not.toBe(a.json);

  const read = readHandoffPackage(b.json);
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(hashBuilderDocument(read.document)).not.toBe(hashBuilderDocument(document));
});

/* ================================== 3. a lying package cannot be produced */

test("no hash is an input — stray hash keys handed to the builder change nothing", async () => {
  const document = defaultBuilderDocument();
  const honest = await buildHandoffPackage(base({ document }));

  /* `HandoffPackageInput` has no hash field, so this cast is the only way to
     express the attempt at all. That is the point: there is no supported call
     that sets a hash, and the unsupported one is inert. */
  const forged = await buildHandoffPackage({
    ...base({ document }),
    designHash: "0x" + "de".repeat(32),
    packageHash: "0x" + "ad".repeat(32),
    budgetHash: "0x" + "be".repeat(32),
  } as unknown as HandoffPackageInput);

  expect(forged.json).toBe(honest.json);
  expect(forged.package.designHash).toBe(hashBuilderDocument(document));
  expect(forged.package.designHash).not.toContain("dede");
  expect(forged.package.packageHash).not.toContain("adad");
});

test("every single-field tamper is refused by name", async () => {
  const built = await buildHandoffPackage(base());
  const clone = (): HandoffPackage => JSON.parse(built.json) as HandoffPackage;

  // A clean package reads.
  expect(readHandoffPackage(built.json).ok).toBe(true);

  // The stated design hash, changed.
  const a = clone();
  a.designHash = `0x${"11".repeat(32)}`;
  const aRead = readHandoffPackage(retext(a));
  expect(aRead.ok).toBe(false);
  if (!aRead.ok) expect(aRead.problem).toContain("design hash");

  // The project itself, changed under an unchanged hash.
  const b = clone();
  (b.project as { spec: { name: string } }).spec.name = "Somebody else's house";
  const bRead = readHandoffPackage(retext(b));
  expect(bRead.ok).toBe(false);
  if (!bRead.ok) expect(bRead.problem).toMatch(/hashes to|not readable/);

  // A file's contents, changed under an unchanged file hash.
  const c = clone();
  const sheet = c.files.find((f) => f.kind === "drawing");
  expect(sheet).toBeTruthy();
  if (sheet) sheet.content = `${sheet.content}<!-- an extra line -->`;
  const cRead = readHandoffPackage(retext(c));
  expect(cRead.ok).toBe(false);
  if (!cRead.ok && sheet) expect(cRead.problem).toContain(sheet.name);

  // A file's stated byte count, changed.
  const d = clone();
  d.files[0].bytes = d.files[0].bytes + 1;
  const dRead = readHandoffPackage(retext(d));
  expect(dRead.ok).toBe(false);
  if (!dRead.ok) expect(dRead.problem).toContain("bytes");

  // The package hash itself.
  const e = clone();
  e.packageHash = `0x${"22".repeat(32)}`;
  const eRead = readHandoffPackage(retext(e));
  expect(eRead.ok).toBe(false);
  if (!eRead.ok) expect(eRead.problem).toContain("package hash");

  // Anything else in the body — an omission quietly deleted.
  const f = clone();
  f.omissions = [];
  const fRead = readHandoffPackage(retext(f));
  expect(fRead.ok).toBe(false);

  // The .aura.json file swapped for a different, internally consistent project.
  const g = clone();
  const other = defaultBuilderDocument();
  other.spec.name = "A different home";
  const projectFile = g.files.find((file) => file.kind === "project");
  expect(projectFile).toBeTruthy();
  if (projectFile) {
    const swapped = await buildHandoffPackage(base({ document: other }));
    const donor = swapped.package.files.find((file) => file.kind === "project");
    expect(donor).toBeTruthy();
    if (donor) {
      projectFile.content = donor.content;
      projectFile.bytes = donor.bytes;
      projectFile.hash = donor.hash;
    }
  }
  const gRead = readHandoffPackage(retext(g));
  expect(gRead.ok).toBe(false);
  if (!gRead.ok && projectFile) expect(gRead.problem).toContain(projectFile.name);
});

/* ---------------------------------------------------------------------------
   THE RESEALED FORGERY.

   Every tamper above leaves the stated package hash stale, so check 5 catches
   it and nothing is learned about the fields check 5 hashes. But the package
   hash is a plain keccak over the body with no secret in it: a tamperer can
   edit a field and recompute it. `resealed` is that attacker, written here
   from the module's documented rule rather than imported from it, so the
   forgery is a real forgery rather than a call into the code under test.
   ------------------------------------------------------------------------ */

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) out[key] = canonicalValue(source[key]);
  return out;
};

function resealed(pkg: HandoffPackage): string {
  const body: Record<string, unknown> = { ...(pkg as unknown as Record<string, unknown>) };
  delete body.packageHash;
  const sealed = {
    ...body,
    packageHash: keccak256(stringToHex(JSON.stringify(canonicalValue(body)))),
  };
  return `${JSON.stringify(canonicalValue(sealed), null, 2)}\n`;
}

test("the forgery machinery is faithful — an untouched reseal still reads", async () => {
  /* Without this, every refusal below could be a broken reseal rather than a
     caught tamper, and the two tests after it would prove nothing. */
  const built = await buildHandoffPackage(base());
  const clone = JSON.parse(built.json) as HandoffPackage;
  const read = readHandoffPackage(resealed(clone));
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(read.package.packageHash).toBe(built.package.packageHash);
});

test("a resealed package that renames the project is caught by the document, not by a hash", async () => {
  const built = await buildHandoffPackage(base());
  const forged = JSON.parse(built.json) as HandoffPackage;
  const honestName = forged.projectName;
  forged.projectName = "Somebody else's house";

  const read = readHandoffPackage(resealed(forged));
  expect(read.ok).toBe(false);
  if (read.ok) return;
  /* The refusal must come from re-deriving the name out of the embedded
     document. If it named the package hash instead, the reseal failed and the
     manifest's own words are still unchecked. */
  expect(read.problem).toContain("Somebody else's house");
  expect(read.problem).toContain(honestName);
  expect(read.problem).not.toContain("package hash");

  // And the honest name is the document's, never the manifest's copy of it.
  expect(honestName).toBe(defaultBuilderDocument().spec.name);
});

test("a resealed package that lies about its geometry mode is refused", async () => {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok) return;

  const built = await buildHandoffPackage(base({ document: converted.document }));
  expect(built.package.geometryMode).toBe("building-graph");

  /* A graph project dressed as a legacy-volume one: the recipient would go
     looking for a spec-derived DXF this design cannot produce. */
  const forged = JSON.parse(built.json) as HandoffPackage;
  forged.geometryMode = "legacy-volumes";
  const read = readHandoffPackage(resealed(forged));
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.problem).toContain("legacy-volumes");
  expect(read.problem).toContain("building-graph");
  expect(read.problem).not.toContain("package hash");
});

test("a package from a newer build, or from nothing at all, is refused rather than half-read", async () => {
  const built = await buildHandoffPackage(base());
  const future = JSON.parse(built.json) as HandoffPackage;
  (future as unknown as { version: number }).version = 99;
  const futureRead = readHandoffPackage(retext(future));
  expect(futureRead.ok).toBe(false);
  if (!futureRead.ok) expect(futureRead.problem).toContain("newer build");

  expect(readHandoffPackage("not json at all").ok).toBe(false);
  expect(readHandoffPackage("[]").ok).toBe(false);
  expect(readHandoffPackage('{"format":"something-else"}').ok).toBe(false);
});

/* =========================================== 4. what the package carries */

test("the package carries the professional set, and each file keeps its writer's own words", async () => {
  const document = defaultBuilderDocument();
  const built = await buildHandoffPackage(base({ document }));
  const pkg = built.package;

  expect(pkg.format).toBe(HANDOFF_PACKAGE_FORMAT);
  expect(pkg.issuedISO).toBe(DATE);
  // Renegotiated on first run: BuilderGeometry names this kind "legacy-volumes",
  // plural. The package reports the document's own kind rather than a second name.
  expect(pkg.geometryMode).toBe("legacy-volumes");

  const kinds = pkg.files.map((f) => f.kind);
  expect(kinds).toContain("readme");
  expect(kinds).toContain("project");
  expect(kinds).toContain("dxf");
  expect(kinds).toContain("ifc");
  expect(kinds).toContain("ifcjson");
  expect(kinds.filter((k) => k === "drawing").length).toBe(8);

  const note = (kind: string): string => pkg.files.find((f) => f.kind === kind)?.note ?? "";

  /* VERBATIM, not paraphrased. If a writer's honest label ever changes, this
     package's description of that file changes with it — there is no second
     copy of the sentence to drift. */
  expect(note("project")).toBe(exportSpecJson(document).note);
  expect(note("dxf")).toBe(exportDxf(document, { dateISO: DATE }).note);
  expect(note("ifc")).toBe(exportIfc(document, { dateISO: DATE }).note);
  expect(note("ifcjson")).toBe(exportIfcJson(document).note);

  // The disclaimer and the professional note travel inside the file.
  expect(pkg.limitations.join(" ")).toContain("Not a permit set");
  expect(pkg.limitations.join(" ")).toContain("LICENSED RESIDENTIAL DESIGNER");

  const readme = pkg.files.find((f) => f.kind === "readme");
  expect(readme).toBeTruthy();
  expect(readme?.content).toContain(pkg.designHash);
  expect(readme?.content).toContain("WHAT A PROFESSIONAL STILL DOES");
});

test("each file's summary is read out of the produced bytes, not written by hand", async () => {
  const document = defaultBuilderDocument();
  const built = await buildHandoffPackage(base({ document }));

  const ifc = built.package.files.find((f) => f.kind === "ifc");
  const ifcjson = built.package.files.find((f) => f.kind === "ifcjson");
  expect(ifc).toBeTruthy();
  expect(ifcjson).toBeTruthy();
  if (!ifc || !ifcjson) return;

  // The counts are the file's own: recomputed here from the same content.
  const instances = ifc.content.match(/^#\d+=/gm)?.length ?? 0;
  expect(instances).toBeGreaterThan(0);
  expect(ifc.summary.join(" ")).toContain(String(instances));
  expect(ifc.summary.join(" ")).toContain("IFC4");

  const entities = (JSON.parse(ifcjson.content) as { data: unknown[] }).data.length;
  expect(entities).toBeGreaterThan(0);
  expect(ifcjson.summary.join(" ")).toContain(String(entities));

  /* THE FALSIFYING HALF: a hand-written summary would say the same thing about
     a bigger house. This one moves with the bytes. */
  const bigger: BuilderDocument = {
    ...document,
    spec: {
      ...document.spec,
      volumes: [...document.spec.volumes, { ...document.spec.volumes[0], id: "vol-second" }],
    },
  };
  const grown = await buildHandoffPackage(base({ document: bigger }));
  const grownIfc = grown.package.files.find((f) => f.kind === "ifc");
  expect(grownIfc).toBeTruthy();
  if (!grownIfc) return;
  const grownInstances = grownIfc.content.match(/^#\d+=/gm)?.length ?? 0;
  expect(grownInstances).toBeGreaterThan(instances);
  expect(grownIfc.summary.join(" ")).toContain(String(grownInstances));
  expect(grownIfc.summary.join(" ")).not.toBe(ifc.summary.join(" "));
});

/* ================================================= 5. the cost snapshot */

test("a matching cost snapshot is carried and hash-bound; a mismatched one is named, never shipped", async () => {
  const document = defaultBuilderDocument();
  const budget = budgetFor(document);

  const withCost = await buildHandoffPackage(base({ document, budget }));
  expect(withCost.package.cost).not.toBeNull();
  expect(withCost.package.budgetHash).toBe(budget.budgetHash);
  expect(withCost.package.cost?.designHash).toBe(withCost.package.designHash);
  expect(readHandoffPackage(withCost.json).ok).toBe(true);

  // A budget computed for a different design never rides beside this one.
  const other = defaultBuilderDocument();
  other.spec.name = "A different home";
  const foreign = budgetFor(other);
  expect(foreign.designHash).not.toBe(hashBuilderDocument(document));
  const refused = await buildHandoffPackage(base({ document, budget: foreign }));
  expect(refused.package.cost).toBeNull();
  expect(refused.package.budgetHash).toBeNull();
  expect(refused.package.omissions.map((o) => o.what)).toContain("The cost snapshot");
  const refusal = refused.package.omissions.find((o) => o.what === "The cost snapshot")?.why ?? "";
  // Renegotiated on first run: the omission names BOTH hashes and says "a
  // different house". Pinning the two hashes is the stronger assertion — the
  // sentence has to identify which price belonged to which design.
  expect(refusal).toContain("different house");
  expect(refusal).toContain(foreign.designHash.slice(0, 10));
  expect(refusal).toContain(hashBuilderDocument(document).slice(0, 10));

  // No budget at all is stated plainly, not implied by silence.
  const none = await buildHandoffPackage(base({ document }));
  expect(none.package.cost).toBeNull();
  expect(none.package.omissions.find((o) => o.what === "The cost snapshot")?.why).toContain(
    "No cost basis",
  );

  // A cost snapshot edited after packaging is refused on the way back in.
  const tampered = JSON.parse(withCost.json) as HandoffPackage;
  if (tampered.cost) tampered.cost.total = { low: 1, mid: 2, high: 3 };
  const read = readHandoffPackage(retext(tampered));
  expect(read.ok).toBe(false);
  if (!read.ok) expect(read.problem).toContain("cost snapshot");
});

/* ============================================ 6. no unearned fidelity */

test("planar-graph geometry ships the graph-backed writers and names the ones that still cannot", async () => {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok) return;

  const built = await buildHandoffPackage(base({ document: converted.document }));
  const kinds = built.package.files.map((f) => f.kind);

  expect(built.package.geometryMode).toBe("building-graph");
  expect(kinds.filter((kind) => kind === "drawing")).toHaveLength(8);
  expect(kinds).toContain("ifc");
  expect(kinds).toContain("ifcjson");
  expect(kinds).toContain("project");
  /* DXF still reads back against a spec-shaped source model, so a graph
     package that included one would be the one place that rule stopped
     holding. Named, not substituted. */
  expect(kinds).not.toContain("dxf");

  const named = built.package.omissions.map((o) => `${o.what} ${o.why}`).join(" ");
  expect(named).toMatch(/dxf|DXF|AutoCAD/i);
  expect(named).not.toContain("recovery HomeSpec was substituted");

  // Still a complete, verifiable package, and still a true round trip.
  const read = readHandoffPackage(built.json);
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(hashBuilderDocument(read.document)).toBe(hashBuilderDocument(converted.document));
});

test("the glTF is named as absent rather than left to be wondered about", async () => {
  const built = await buildHandoffPackage(base());
  const glb = built.package.omissions.find((o) => o.what.includes("glTF"));
  expect(glb).toBeTruthy();
  expect(glb?.why).toContain("live 3D scene");
});

/* ================================ 7. the panel has one path to the bytes */

test("the panel renders and saves the one generated artifact — there is no second code path", () => {
  const source = readFileSync(
    join(__dirname, "..", "components", "builder", "HandoffPanel.tsx"),
    "utf8",
  );

  /* A preview rendered from a second serialisation is the failure this node
     exists to prevent, and it has a shape: the panel would have to stringify
     something, or build its own Blob, or call an exporter itself. None of
     those may appear here. */
  expect(source).not.toContain("JSON.stringify");
  expect(source).not.toContain("new Blob(");
  expect(source).not.toContain("exportDxf");
  expect(source).not.toContain("exportIfc");
  expect(source).not.toContain("drawingSet(");

  // Exactly one download, and it hands over the artifact the build returned.
  const downloads = source.match(/downloadArtifact\(/g)?.length ?? 0;
  expect(downloads).toBe(1);
  expect(source).toContain("downloadArtifact(prepared.result.artifact)");

  // The sheets on screen are drawn from the package's own bytes.
  expect(source).toContain("drawingDataUrl(file.content)");

  // And the one sentence about the professional comes from the module, so the
  // screen and the README cannot say different things.
  expect(source).toContain("WHAT_A_PROFESSIONAL_STILL_DOES");
});

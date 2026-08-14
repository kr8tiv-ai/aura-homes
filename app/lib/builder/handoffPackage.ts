/* ===========================================================================
   THE HANDOFF PACKAGE — the one file you send a professional.

   THE PROBLEM THIS SOLVES. The export panel already offers seven honest doors.
   Somebody handing their home to a designer, an engineer or a builder has to
   walk through five of them, remember which, and attach the results to an
   email — and the recipient has to trust that the drawing, the model and the
   project file all describe the same house. This assembles that set once, in
   one artifact, and proves the parts agree.

   WHY ONE JSON AND NOT A ZIP. A zip needs a compression library this repo does
   not carry, and the moment the parts are inside a container the integrity
   claim moves inside it too — you cannot check a zip's contents against its
   stated hash without unzipping it first. A single JSON file IS its own
   manifest: every artifact sits beside its byte count and its keccak hash, in
   text, readable in any editor, verifiable by anything that can parse JSON.
   The cost is JSON string escaping and no compression; the benefit is that the
   package can be checked by hand, and this file adds no dependency.

   THE TWO PROPERTIES THAT MAKE IT WORTH SENDING
   ---------------------------------------------
   1. THE PREVIEW AND THE DOWNLOAD ARE THE SAME BYTES. `buildHandoffPackage`
      generates once and returns `{ package, json, artifact }` where `json` is
      the text and `artifact.blob` holds those exact bytes. A UI shows
      `package` and saves `artifact`; there is no second code path that could
      render a preview of something other than what is saved.

   2. A PACKAGE WHOSE STATED HASH DISAGREES WITH ITS CONTENTS CANNOT BE MADE.
      Not discouraged — impossible. Three mechanisms, and they compound:
        · No hash is ever an INPUT. `HandoffPackageInput` has no hash field.
          Every hash in the output is computed here from the content beside it.
        · `readHandoffPackage` recomputes all of them — the design hash from
          the embedded project, each file's hash and byte count from its own
          content, the budget hash from the budget, and the package hash from
          everything else — and refuses the package by name if any disagrees.
        · `buildHandoffPackage` runs its own output through that reader before
          returning, and throws if it does not verify. So a package that lies
          is not merely rejected on the way in; it never leaves this module.

   DETERMINISM. No clock. `issuedISO` is a required parameter, the same rule
   `drawings.ts` and `exportPro.ts` already keep, so the same document and the
   same date produce byte-identical packages.

   EVERY ARTIFACT COMES FROM ITS EXISTING WRITER, AND KEEPS ITS OWN WORDS. The
   drawings come from `drawings.ts`, the DXF and IFC from `exportPro.ts`, the
   ifcJSON from `exportSemantic.ts`, the project from `exportSpec.ts`. Each
   file entry carries that writer's own one-line `note`, verbatim. This module
   never writes a description of a format; it would be the third place the same
   claim lived, and the third place is where claims start to drift.

   WHAT IS NOT IN IT, AND WHY THAT IS SAID RATHER THAN HIDDEN. A glTF is a copy
   of the rendered 3D scene, which only exists in a mounted viewer, so it is
   not here — the .glb door in the export panel writes it. A design on planar
   graph geometry has no legacy-volume drawing set, DXF or IFC yet, so those
   are recorded as omissions carrying the refusing writer's own reason. An
   omission with a reason is a fact; a missing file is a mystery.
   =========================================================================== */

import { keccak256, stringToHex, type Hex } from "viem";

import type { ComfortReport } from "./comfort";
import {
  canonicalBuilderDocumentJson,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import {
  PROFESSIONAL_NOTE,
  drawingModel,
  drawingSet,
  type DrawingParcel,
  type DrawingRooms,
} from "./drawings";
import { exportSourceLimitation } from "./exportSource";
import {
  EXPORT_DISCLAIMER,
  exportFilename,
  exportSpecJson,
  type ExportArtifact,
} from "./exportSpec";
import { hashProjectBudget, type ProjectBudget } from "./projectBudget";

export const HANDOFF_PACKAGE_FORMAT = "aura-handoff-package" as const;
export const HANDOFF_PACKAGE_VERSION = 1 as const;

export const HANDOFF_GENERATOR = "Aura Homes builder — handoff package";

/**
 * The one plain sentence the panel prints and the README repeats.
 *
 * Deliberately about what the RECIPIENT still has to do, not about what the
 * software did. The longer account is `PROFESSIONAL_NOTE`, carried verbatim in
 * `limitations`; this is the version somebody reads in three seconds.
 */
export const WHAT_A_PROFESSIONAL_STILL_DOES =
  "A licensed residential designer still has to check this against your lot and the building code, add the structural design, the survey, the soil and pile design and the energy-code calculations, and seal the set — this package is the starting point that makes that work quick, not a permit set.";

export type HandoffFileKind =
  | "readme"
  | "project"
  | "drawing"
  | "dxf"
  | "ifc"
  | "ifcjson";

export interface HandoffFile {
  /** Suggested name if this part is ever written out on its own. */
  name: string;
  kind: HandoffFileKind;
  mediaType: string;
  /** The writing module's own one-line note about this format. Verbatim. */
  note: string;
  /** UTF-8 length of `content`, measured on `content`. */
  bytes: number;
  /** keccak256 of `content`, computed from `content`. */
  hash: Hex;
  /**
   * Facts read back OUT of `content` after it was produced — entity counts, a
   * sheet's scale, the schema the file declares.
   *
   * These are facts about the FILE, never a re-derivation of a fact about the
   * house. Counting how many walls a produced IFC contains is a check on the
   * writer; recomputing floor area here would be a second opinion about the
   * design, which is the divergence this repo keeps paying for.
   */
  summary: string[];
  content: string;
}

export interface HandoffOmission {
  what: string;
  /** The refusing writer's own sentence, never a paraphrase. */
  why: string;
}

export interface HandoffPackage {
  format: typeof HANDOFF_PACKAGE_FORMAT;
  version: typeof HANDOFF_PACKAGE_VERSION;
  generator: string;
  /** A parameter, never a clock. */
  issuedISO: string;
  projectName: string;
  /** Equal to `hashBuilderDocument(project)`. Checked on the way out and in. */
  designHash: Hex;
  /** Equal to `cost.budgetHash` when a cost snapshot is carried. */
  budgetHash: Hex | null;
  geometryMode: BuilderDocument["geometry"]["kind"];
  /** The canonical builder document. Re-importing this reproduces designHash. */
  project: unknown;
  files: HandoffFile[];
  /** The project's own budget, or null when no cost basis was supplied. */
  cost: ProjectBudget | null;
  omissions: HandoffOmission[];
  limitations: string[];
  /** keccak256 of the canonical package with this field removed. */
  packageHash: Hex;
}

export interface HandoffPackageInput {
  document: BuilderDocument;
  /** ISO date for every title block and file header. Required, so the package
   *  is reproducible: same document, same date, same bytes. */
  issuedISO: string;
  /**
   * The owner's comfort targets for the two writers that carry them.
   *
   * `null` is treated as "no report was computed" and OMITTED, so those writers
   * derive their own defaults — the same bargain `ExportRow` makes, kept
   * identical so a package and a single-file download never disagree.
   */
  comfort?: ComfortReport | null;
  /**
   * The project's cost snapshot. Carried only when its `designHash` matches
   * this document; a budget computed for a different design is recorded as an
   * omission rather than shipped beside a house it does not describe.
   */
  budget?: ProjectBudget | null;
  /** A solved room program, when the plan engine has produced one. */
  rooms?: DrawingRooms | null;
  address?: string;
}

export interface HandoffPackageResult {
  /** What a UI displays. */
  package: HandoffPackage;
  /** The exact text of `artifact.blob`. */
  json: string;
  /** What a UI saves. Same bytes as `json`, by construction. */
  artifact: ExportArtifact;
}

export type HandoffPackageRead =
  | { ok: true; package: HandoffPackage; document: BuilderDocument; designHash: Hex }
  | { ok: false; problem: string };

/* ---------------------------------------------------------------- plumbing */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
  return out;
}

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalValue(value));

const hashText = (text: string): Hex => keccak256(stringToHex(text));

/** UTF-8 bytes, not UTF-16 code units — the number a recipient's file manager
 *  will show, and the number a byte range in an HTTP request would use. */
const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** Substring occurrences, without building a regular expression out of
 *  caller-supplied text. */
function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

const shortHash = (hash: Hex): string => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

/* ------------------------------------------------------ summaries of bytes */

/** What a produced SVG sheet actually contains, counted in the sheet. */
function summariseSvg(content: string): string[] {
  const strokes =
    occurrences(content, "<path") +
    occurrences(content, "<line") +
    occurrences(content, "<polyline") +
    occurrences(content, "<polygon") +
    occurrences(content, "<rect") +
    occurrences(content, "<circle");
  return [
    `${strokes} drawn element${strokes === 1 ? "" : "s"}`,
    `${occurrences(content, "<text")} labels and dimension strings`,
  ];
}

/** What a produced IFC-SPF file actually contains, counted in the file. */
function summariseIfc(content: string): string[] {
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/.exec(content);
  const instances = content.match(/^#\d+=/gm)?.length ?? 0;
  return [
    `${schema ? schema[1] : "schema not declared"} · ${instances} instances`,
    `${occurrences(content, "=IFCWALLSTANDARDCASE(")} walls · ` +
      `${occurrences(content, "=IFCOPENINGELEMENT(")} openings · ` +
      `${occurrences(content, "=IFCSLAB(")} slabs · ` +
      `${occurrences(content, "=IFCPILE(")} piles`,
  ];
}

/** What a produced ifcJSON file actually contains, parsed back from the file. */
function summariseIfcJson(content: string): string[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isObject(parsed)) return ["not a JSON object"];
    const data = Array.isArray(parsed.data) ? parsed.data : [];
    return [
      `${String(parsed.schemaIdentifier ?? "schema not declared")} · ${data.length} entities`,
      `parses with JSON.parse in ${byteLength(content)} bytes`,
    ];
  } catch {
    return ["this file does not parse as JSON"];
  }
}

/** What the embedded project file declares, read back from the file. */
function summariseProject(content: string): string[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isObject(parsed)) return ["not a JSON object"];
    return [
      `${String(parsed.format ?? "format not declared")} v${String(parsed.version ?? "?")}`,
      "re-openable in the builder; this is the file the design hash is taken over",
    ];
  } catch {
    return ["this file does not parse as JSON"];
  }
}

/* ------------------------------------------------------------- the builder */

function readmeText(input: {
  projectName: string;
  issuedISO: string;
  designHash: Hex;
  budgetHash: Hex | null;
  files: readonly Omit<HandoffFile, "summary">[];
  omissions: readonly HandoffOmission[];
}): string {
  const lines: string[] = [
    `AURA HANDOFF PACKAGE — ${input.projectName}`,
    `Issued ${input.issuedISO} · design hash ${input.designHash}`,
    input.budgetHash
      ? `Cost snapshot carried · budget hash ${input.budgetHash}`
      : "No cost snapshot is carried in this package.",
    "",
    "WHAT THIS IS. One file holding the whole design handoff: the project itself,",
    "the drawing set, and the professional formats, each beside the byte count and",
    "the keccak hash of its own contents. Open it in any text editor; it is JSON.",
    "",
    "HOW TO CHECK IT. Every hash in this file is computed from the content beside",
    "it. The design hash is taken over the canonical project document, so",
    "re-importing the project reproduces it exactly. A package whose stated hashes",
    "disagree with its contents is refused by the reader that wrote it.",
    "",
    "WHAT IS INSIDE",
  ];
  for (const file of input.files) {
    lines.push(`  ${file.name} — ${file.bytes} bytes — ${file.note}`);
  }
  if (input.omissions.length > 0) {
    lines.push("", "WHAT IS NOT INSIDE, AND WHY");
    for (const omission of input.omissions) {
      lines.push(`  ${omission.what}: ${omission.why}`);
    }
  }
  lines.push(
    "",
    "WHAT A PROFESSIONAL STILL DOES",
    WHAT_A_PROFESSIONAL_STILL_DOES,
    "",
    EXPORT_DISCLAIMER,
    "",
  );
  return lines.join("\n");
}

/**
 * Assemble the package.
 *
 * ASYNC for two reasons, both deliberate. The DXF, IFC and ifcJSON writers are
 * pulled in with `await import()` so a page that merely offers this button does
 * not carry several thousand lines of drafting and STEP authoring in its main
 * chunk — the same bargain `ExportRow` makes. And each artifact's bytes are
 * read back out of its own Blob, so the text embedded here is the text that
 * writer produced rather than a second serialisation of the same object.
 *
 * Throws only when its own output fails its own reader, which is a defect in
 * this module rather than a fact about the caller's design.
 */
export async function buildHandoffPackage(
  input: HandoffPackageInput,
): Promise<HandoffPackageResult> {
  const { document, issuedISO } = input;
  const validated = validateBuilderDocument(document);
  if (!validated.ok) {
    throw new Error(`Cannot package this Aura project: ${validated.problem}`);
  }
  const doc = validated.document;
  const designHash = hashBuilderDocument(doc);
  const projectName = doc.spec.name;
  /* `undefined` means "derive the defaults", `null` means "write none" to the
     two writers that carry comfort. A builder that has not computed a report
     wants the first, which is why null collapses to undefined here exactly as
     it does in the export panel. */
  const comfort = input.comfort ?? undefined;

  const files: Omit<HandoffFile, "summary">[] = [];
  const summaries: string[][] = [];
  const omissions: HandoffOmission[] = [];
  const limitations: string[] = [EXPORT_DISCLAIMER];

  const reason = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

  const add = (file: Omit<HandoffFile, "summary">, summary: string[]): void => {
    files.push(file);
    summaries.push(summary);
  };

  /* ---------------------------------------------------------- the project */
  const projectArtifact = exportSpecJson(doc);
  const projectText = await projectArtifact.blob.text();
  add(
    {
      name: projectArtifact.filename,
      kind: "project",
      mediaType: projectArtifact.mimeType,
      note: projectArtifact.note,
      bytes: byteLength(projectText),
      hash: hashText(projectText),
      content: projectText,
    },
    summariseProject(projectText),
  );

  /* ---------------------------------------------------------- the drawings

     The site rides the document; the drawing module takes a parcel in its own
     shape, so this is a translation and not a second source of lot facts. */
  const parcel: DrawingParcel | null = doc.site?.parcel
    ? {
        lotWidthFt: doc.site.parcel.lotWidthFt,
        lotDepthFt: doc.site.parcel.lotDepthFt,
        frontSetbackFt: doc.site.parcel.frontSetbackFt,
        sideSetbackFt: doc.site.parcel.sideSetbackFt,
        rearSetbackFt: doc.site.parcel.rearSetbackFt,
      }
    : null;

  try {
    const set = drawingSet({
      document: doc,
      dateISO: issuedISO,
      projectName,
      address: input.address,
      rooms: input.rooms ?? null,
      parcel,
    });
    const slug = exportFilename(doc.spec, "svg").replace(/\.svg$/, "");
    for (const sheet of set.sheets) {
      add(
        {
          name: `${slug}-${sheet.number}.svg`,
          kind: "drawing",
          mediaType: "image/svg+xml",
          note: `${sheet.number} · ${sheet.title} · ${sheet.scale} · not sealed, not for construction`,
          bytes: byteLength(sheet.svg),
          hash: hashText(sheet.svg),
          content: sheet.svg,
        },
        [...summariseSvg(sheet.svg), ...sheet.notes],
      );
    }
    for (const warning of set.warnings) {
      omissions.push({ what: "The drawing engine clamped or refused something", why: warning });
    }
  } catch (err) {
    omissions.push({ what: "The drawing set (A0–A7)", why: reason(err) });
  }

  /* --------------------------------------------------------------- the DXF

     Written, then read back by a parser that shares no code with the writer
     and compared against the same model the sheets are drawn from. A failing
     DXF is left OUT of the package with its error count named, because the
     export panel already refuses to save one and a package that quietly
     included it would be the one place that rule stopped holding. */
  try {
    const pro = await import("./exportPro");
    const dxfArtifact = pro.exportDxf(doc, { dateISO: issuedISO });
    const dxfText = await dxfArtifact.blob.text();
    const check = await import("./dxfCheck");
    const report = check.checkDxf(dxfText, check.sourceFromModel(drawingModel(doc)));
    if (report.ok) {
      const passed = report.sourceChecks.filter((c) => c.pass).length;
      add(
        {
          name: dxfArtifact.filename,
          kind: "dxf",
          mediaType: dxfArtifact.mimeType,
          note: dxfArtifact.note,
          bytes: byteLength(dxfText),
          hash: hashText(dxfText),
          content: dxfText,
        },
        [
          `${report.entities.length} entities on ${report.layersUsed.length} of ${report.layersDeclared.length} layers · ${report.unitsLabel}`,
          `read back before packaging: ${passed} of ${report.sourceChecks.length} checks against the model passed`,
        ],
      );
    } else {
      const errors = report.problems.filter((p) => p.severity === "error").length;
      omissions.push({
        what: "The AutoCAD DXF",
        why: `This build wrote a .dxf that does not read back as your model — ${errors} error(s) — so it was left out rather than sent to a drafter. The Download .dxf button shows the whole parsed file and every problem.`,
      });
    }
  } catch (err) {
    omissions.push({ what: "The AutoCAD DXF", why: reason(err) });
  }

  /* --------------------------------------------------------------- the IFC */
  try {
    const pro = await import("./exportPro");
    const ifcArtifact = pro.exportIfc(doc, { dateISO: issuedISO, comfort });
    const ifcText = await ifcArtifact.blob.text();
    add(
      {
        name: ifcArtifact.filename,
        kind: "ifc",
        mediaType: ifcArtifact.mimeType,
        note: ifcArtifact.note,
        bytes: byteLength(ifcText),
        hash: hashText(ifcText),
        content: ifcText,
      },
      summariseIfc(ifcText),
    );
  } catch (err) {
    omissions.push({ what: "The IFC4 building", why: reason(err) });
  }

  /* ----------------------------------------------------------- the ifcJSON */
  try {
    const semantic = await import("./exportSemantic");
    const jsonArtifact = semantic.exportIfcJson(doc, { comfort });
    const jsonText = await jsonArtifact.blob.text();
    add(
      {
        name: jsonArtifact.filename,
        kind: "ifcjson",
        mediaType: jsonArtifact.mimeType,
        note: jsonArtifact.note,
        bytes: byteLength(jsonText),
        hash: hashText(jsonText),
        content: jsonText,
      },
      summariseIfcJson(jsonText),
    );
    limitations.push(semantic.FORMAT_STATUS);
  } catch (err) {
    omissions.push({ what: "The ifcJSON", why: reason(err) });
  }

  /* -------------------------------------------------------------- the glTF

     Not an omission this module can fix: a .glb is a copy of the rendered 3D
     scene, which exists only in a mounted viewer. Saying so beats leaving the
     recipient to wonder whether the model was forgotten. */
  omissions.push({
    what: "The glTF model (.glb)",
    why: "A .glb is written from the live 3D scene rather than from the project alone, so it is not assembled here. The Download .glb button in the export panel writes it, and the IFC in this package carries the building itself.",
  });

  /* ------------------------------------------------------- the cost snapshot */
  let cost: ProjectBudget | null = null;
  let budgetHash: Hex | null = null;
  const budget = input.budget ?? null;
  if (budget === null) {
    omissions.push({
      what: "The cost snapshot",
      why: "No cost basis was supplied with this design. The budget workspace produces one against a named scenario; nothing here estimates a price.",
    });
  } else if (budget.designHash !== designHash) {
    omissions.push({
      what: "The cost snapshot",
      why: `The supplied budget was computed for design ${shortHash(budget.designHash)} and this package is design ${shortHash(designHash)}. A price for a different house was left out rather than shipped beside this one.`,
    });
  } else if (hashProjectBudget(budget) !== budget.budgetHash) {
    omissions.push({
      what: "The cost snapshot",
      why: "The supplied budget's stated hash does not match its own planning basis, so it was left out. Recalculate it in the budget workspace.",
    });
  } else {
    cost = budget;
    budgetHash = budget.budgetHash;
  }

  /* ------------------------------------------------------- honesty furniture */
  const limitation = exportSourceLimitation(doc, "legacy-volume");
  if (limitation) limitations.push(limitation);
  limitations.push(...PROFESSIONAL_NOTE);

  /* ------------------------------------------------------------- the README

     Last, because it lists the files. It names the design hash, which is fixed
     by the project alone, and never the package hash, which is not known until
     the README itself is in. */
  const readme = readmeText({
    projectName,
    issuedISO,
    designHash,
    budgetHash,
    files,
    omissions,
  });
  const readmeFile: Omit<HandoffFile, "summary"> = {
    name: "README.txt",
    kind: "readme",
    mediaType: "text/plain",
    note: "What this package is, what is in it, what is not, and what a professional still does.",
    bytes: byteLength(readme),
    hash: hashText(readme),
    content: readme,
  };

  const assembled: HandoffFile[] = [
    { ...readmeFile, summary: [`${readme.split("\n").length} lines of plain text`] },
    ...files.map((file, i) => ({ ...file, summary: summaries[i] })),
  ];

  const body: Omit<HandoffPackage, "packageHash"> = {
    format: HANDOFF_PACKAGE_FORMAT,
    version: HANDOFF_PACKAGE_VERSION,
    generator: HANDOFF_GENERATOR,
    issuedISO,
    projectName,
    designHash,
    budgetHash,
    geometryMode: doc.geometry.kind,
    project: JSON.parse(canonicalBuilderDocumentJson(doc)) as unknown,
    files: assembled,
    cost,
    omissions,
    limitations,
  };

  const pkg: HandoffPackage = { ...body, packageHash: hashText(canonicalJson(body)) };
  const json = `${JSON.stringify(canonicalValue(pkg), null, 2)}\n`;

  /* THE GUARANTEE, EXECUTED. Nothing leaves this function without passing the
     same reader a recipient would run. If a future edit ever let the stated
     hashes drift from the contents, this throws here instead of shipping. */
  const verified = readHandoffPackage(json);
  if (!verified.ok) {
    throw new Error(
      `[aura/handoff] refusing to hand back a package that fails its own check: ${verified.problem}`,
    );
  }

  const blob = new Blob([json], { type: "application/json" });
  return {
    package: pkg,
    json,
    artifact: {
      blob,
      filename: exportFilename(doc.spec, "handoff.json"),
      mimeType: "application/json",
      byteLength: blob.size,
      note: `Complete handoff package · ${assembled.length} files · design hash ${designHash} · package hash ${pkg.packageHash}`,
    },
  };
}

/* --------------------------------------------------------------- the reader */

const HEX_32 = /^0x[0-9a-f]{64}$/;

/**
 * Read a package back, refusing anything whose stated hashes disagree with
 * what it carries.
 *
 * Held to the same standard as a share link and a project file: a file off
 * somebody's disk is exactly as untrusted as a URL off the internet. Every
 * refusal names the specific disagreement, because "invalid package" tells a
 * recipient nothing about which part was edited.
 */
export function readHandoffPackage(text: string): HandoffPackageRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, problem: `This file is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!isObject(parsed)) return { ok: false, problem: "A handoff package must be a JSON object." };
  if (parsed.format !== HANDOFF_PACKAGE_FORMAT) {
    return {
      ok: false,
      problem: `This is not an Aura handoff package — its format is ${JSON.stringify(parsed.format)}.`,
    };
  }
  if (typeof parsed.version !== "number") {
    return { ok: false, problem: "This package does not declare a version." };
  }
  if (parsed.version > HANDOFF_PACKAGE_VERSION) {
    return {
      ok: false,
      problem: `This package was written by a newer build (package v${parsed.version}; this build reads v${HANDOFF_PACKAGE_VERSION}). Nothing was imported.`,
    };
  }
  if (parsed.version !== HANDOFF_PACKAGE_VERSION) {
    return {
      ok: false,
      problem: `This package is v${parsed.version}; this build reads v${HANDOFF_PACKAGE_VERSION}.`,
    };
  }
  if (typeof parsed.designHash !== "string" || !HEX_32.test(parsed.designHash)) {
    return { ok: false, problem: "This package does not carry a well-formed design hash." };
  }
  if (typeof parsed.packageHash !== "string" || !HEX_32.test(parsed.packageHash)) {
    return { ok: false, problem: "This package does not carry a well-formed package hash." };
  }

  /* 1. The project, and the claim the whole package rests on. */
  const checked = validateBuilderDocument(parsed.project);
  if (!checked.ok) {
    return { ok: false, problem: `The project inside this package is not readable — ${checked.problem}` };
  }
  const designHash = hashBuilderDocument(checked.document);
  if (designHash !== parsed.designHash) {
    return {
      ok: false,
      problem: `This package states design hash ${parsed.designHash} but the project inside it hashes to ${designHash}. It was edited after it was written.`,
    };
  }

  /* 2. Every file against its own stated size and hash. */
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    return { ok: false, problem: "This package carries no files." };
  }
  for (const entry of parsed.files) {
    if (!isObject(entry) || typeof entry.name !== "string" || typeof entry.content !== "string") {
      return { ok: false, problem: "A file entry in this package is malformed." };
    }
    const bytes = byteLength(entry.content);
    if (entry.bytes !== bytes) {
      return {
        ok: false,
        problem: `${entry.name} states ${String(entry.bytes)} bytes and holds ${bytes}. It was edited after it was written.`,
      };
    }
    const hash = hashText(entry.content);
    if (entry.hash !== hash) {
      return {
        ok: false,
        problem: `${entry.name} states hash ${String(entry.hash)} and hashes to ${hash}. It was edited after it was written.`,
      };
    }
  }

  /* 3. The embedded project FILE must be the same project as the embedded
        project OBJECT, or the recipient's .aura.json is not what the hash
        describes. */
  const projectFile = parsed.files.find(
    (entry): entry is Record<string, unknown> => isObject(entry) && entry.kind === "project",
  );
  if (!projectFile) {
    return { ok: false, problem: "This package carries no project file." };
  }
  let fileProject: unknown;
  try {
    fileProject = JSON.parse(String(projectFile.content));
  } catch {
    return { ok: false, problem: `${String(projectFile.name)} does not parse as JSON.` };
  }
  const fileChecked = validateBuilderDocument(fileProject);
  if (!fileChecked.ok || hashBuilderDocument(fileChecked.document) !== designHash) {
    return {
      ok: false,
      problem: `${String(projectFile.name)} is not the project this package states it carries.`,
    };
  }

  /* 4. The cost snapshot, against its own basis and against this design. */
  if (parsed.cost !== null) {
    if (!isObject(parsed.cost)) {
      return { ok: false, problem: "The cost snapshot in this package is malformed." };
    }
    const budget = parsed.cost as unknown as ProjectBudget;
    if (budget.designHash !== designHash) {
      return {
        ok: false,
        problem: "The cost snapshot in this package was computed for a different design.",
      };
    }
    if (hashProjectBudget(budget) !== budget.budgetHash) {
      return {
        ok: false,
        problem: "The cost snapshot's stated hash does not match its own planning basis.",
      };
    }
    if (parsed.budgetHash !== budget.budgetHash) {
      return {
        ok: false,
        problem: "This package's stated budget hash does not match the cost snapshot it carries.",
      };
    }
  } else if (parsed.budgetHash !== null) {
    return { ok: false, problem: "This package states a budget hash but carries no cost snapshot." };
  }

  /* 5. Everything else, in one hash over the whole body. */
  const { packageHash, ...body } = parsed;
  const recomputed = hashText(canonicalJson(body));
  if (recomputed !== packageHash) {
    return {
      ok: false,
      problem: `This package states package hash ${String(packageHash)} and its contents hash to ${recomputed}. It was edited after it was written.`,
    };
  }

  return {
    ok: true,
    package: parsed as unknown as HandoffPackage,
    document: checked.document,
    designHash,
  };
}

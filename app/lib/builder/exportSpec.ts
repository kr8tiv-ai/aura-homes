/* ===========================================================================
   EXPORT — because a home you cannot take with you is a toy.

   The builder's whole claim is that the thing you play with becomes the thing
   you build. That claim dies at the moment the owner wants to hand their house
   to somebody who does not use our software. So this file has exactly one job:
   get the design OUT, in formats that outlive us.

   FOUR DOORS, IN ORDER OF HOW MUCH THEY PRESERVE
   ----------------------------------------------
   1. JSON — the HomeSpec itself. The open, readable source of truth: every
      dimension, every opening, in feet, with the version stamped on it. It is
      the only export that round-trips back into the builder, and the only one
      a human can read and correct in a text editor.

   2. glTF 2.0 binary (.glb) — the model. Written with three.js's own
      GLTFExporter, which already ships in this repo's `three` dependency
      (MIT), so this costs no new package and no new licence.

      WHY glTF AND NOT SOMETHING NATIVE. glTF is a Khronos Group open standard
      (ISO/IEC-track, royalty-free, no vendor gate). Blender, SketchUp,
      Rhino, 3ds Max, Cinema 4D, Unreal, Unity, Godot, macOS Preview, Windows
      3D Viewer and every free web viewer read it. That means the owner can
      hand this file to a designer who uses NONE of our tools and the designer
      opens it in whatever they already own. A format only our software reads
      would make the export a gesture rather than a handoff.

   3. OBJ — the lowest common denominator. Older CAD, student software, and
      the one machine in every shop that runs something from 2009 read OBJ and
      nothing else. It carries geometry and nothing else — no materials, no
      hierarchy semantics — and that is exactly why it always opens.

   4. IFC — deliberately NOT here. See the block at the bottom of this file
      for the research, the numbers, and the recommendation.

   WHAT THESE FILES ARE NOT. Massing and layout. Not a permit set, not a
   structural design, not an engineered drawing, and not a check that anything
   here complies with anything. Every export carries that sentence in its own
   body — in the JSON, in the glTF `extras`, in the OBJ header — so the
   disclaimer travels with the file instead of living on a web page the
   recipient never saw.

   DETERMINISTIC. No timestamps, no random ids, no `Date.now()` anywhere: the
   same spec and the same scene produce byte-identical files. That is what
   makes an export diffable, and a diffable export is how somebody notices
   that the house changed.
   =========================================================================== */

import {
  glazedAreaSqFt,
  groundFootprintSqFt,
  ridgeHeightFt,
  SPEC_VERSION,
  totalFloorAreaSqFt,
  type HomeSpec,
} from "./spec";
import { validateHomeSpec } from "./share";
import {
  exportSourceLimitation,
  resolveBuilderExportSource,
  type BuilderExportSource,
} from "./exportSource";
/* TYPE-ONLY. Nothing from three is imported at runtime by this module — the
   exporters are pulled in with dynamic `import()` inside the functions that
   need them, so a page that merely offers a Download button does not pay for
   GLTFExporter until somebody presses it. */
import type * as THREE from "three";

/** One line, repeated in every artifact this file produces. The honesty policy
 *  is not a banner on a page; it is a property of the file. */
export const EXPORT_DISCLAIMER =
  "Massing and layout study produced by the Aura Homes builder. Not a permit set, not a structural design, and not an engineered drawing. Dimensions are nominal and must be confirmed by a qualified designer or engineer before construction.";

/** The one place feet become metres. glTF's convention is metres, and an
 *  importer has no way to ask; a house that arrives 3.28x too big is the
 *  single most common complaint about hobby exporters. Exactly 0.3048 by
 *  international definition, since 1959. */
export const FEET_TO_METRES = 0.3048;

/* ---------------------------------------------------------------------------
   artifacts
   --------------------------------------------------------------------------- */

export interface ExportArtifact {
  blob: Blob;
  /** suggested download name, extension included */
  filename: string;
  mimeType: string;
  byteLength: number;
  /** one short factual line for the UI to show beside the download control */
  note: string;
}

/**
 * What world units the three.js object you are handing over is built in.
 *
 * There is no way to detect this, and guessing wrong scales the house by
 * 3.28. The spec is in feet, so a scene built straight from the spec is in
 * feet and that is the default — but say so explicitly at the call site if
 * the builder's geometry converts to metres first.
 */
export type SceneUnits = "feet" | "metres";

export interface ModelExportOptions {
  /** default `"feet"`, matching the HomeSpec's own units */
  sceneUnits?: SceneUnits;
  /** write the HomeSpec into the file's metadata. Default true. */
  embedSpec?: boolean;
  /** three's own `onlyVisible` — skip anything toggled off. Default true. */
  onlyVisible?: boolean;
}

/* ---------------------------------------------------------------------------
   derived numbers — spec.ts owns every one of these definitions
   --------------------------------------------------------------------------- */

export interface SpecSummary {
  totalFloorAreaSqFt: number;
  groundFootprintSqFt: number;
  glazedAreaSqFt: number;
  tallestRidgeHeightFt: number;
  volumeCount: number;
  storeys: number[];
}

/**
 * The quantities worth writing into a file, every one of them taken from
 * `spec.ts` rather than recomputed here.
 *
 * This is a rule, not a preference. The moment a second file works out floor
 * area with its own multiplication, the drawing and the export can disagree
 * about the same house — and they will, quietly, for months.
 *
 * NOTE what is missing: no FDWR, no glazing ratio. Those need gross wall area,
 * which the spec does not define and this file has no business inventing. The
 * plan engine computes FDWR against NBC 9.36 and is the only thing that
 * should.
 */
export function specSummary(spec: HomeSpec): SpecSummary {
  return {
    totalFloorAreaSqFt: totalFloorAreaSqFt(spec),
    groundFootprintSqFt: groundFootprintSqFt(spec),
    glazedAreaSqFt: glazedAreaSqFt(spec),
    tallestRidgeHeightFt: spec.volumes.length ? Math.max(...spec.volumes.map(ridgeHeightFt)) : 0,
    volumeCount: spec.volumes.length,
    storeys: spec.volumes.map((v) => v.storeys),
  };
}

/* ---------------------------------------------------------------------------
   filenames
   --------------------------------------------------------------------------- */

/** ASCII, lowercase, hyphenated, never empty — safe on every filesystem
 *  including the ones that still dislike spaces and colons. */
function slug(name: string): string {
  const s = name
    // NFKD splits "é" into "e" + a combining accent; dropping the accent keeps
    // the letter, where the ASCII filter below would have turned it into "-"
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "home";
}

/** Deterministic: the same spec always writes the same filename, so saving
 *  twice overwrites rather than littering `home (3).glb` across a folder. */
export function exportFilename(spec: HomeSpec, extension: string): string {
  return `aura-${slug(spec.name)}.${extension}`;
}

const artifact = (
  blob: Blob,
  filename: string,
  mimeType: string,
  note: string,
): ExportArtifact => ({ blob, filename, mimeType, byteLength: blob.size, note });

const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------------------------------------------------------------------------
   1. JSON — the source of truth
   --------------------------------------------------------------------------- */

/** The envelope written to disk. The spec sits under its own key so a reader
 *  can never confuse the wrapper's convenience numbers with the contract, and
 *  so `derived` can grow without ever colliding with a HomeSpec field. */
export interface SpecFile {
  format: "aura-home-spec";
  specVersion: typeof SPEC_VERSION;
  generator: string;
  units: "feet (wall thickness in mm, per lib/design/materials.ts)";
  disclaimer: string;
  spec: HomeSpec;
  /** convenience only — every value is defined in `lib/builder/spec.ts` */
  derived: SpecSummary;
}

/** The exact text written to the .json file. Separated from the Blob so a
 *  caller can put the same bytes in a clipboard, a POST body, or a test. */
export function specToJson(spec: HomeSpec): string {
  const s = specSummary(spec);
  const file: SpecFile = {
    format: "aura-home-spec",
    specVersion: SPEC_VERSION,
    generator: "Aura Homes builder",
    units: "feet (wall thickness in mm, per lib/design/materials.ts)",
    disclaimer: EXPORT_DISCLAIMER,
    spec,
    derived: {
      totalFloorAreaSqFt: round2(s.totalFloorAreaSqFt),
      groundFootprintSqFt: round2(s.groundFootprintSqFt),
      glazedAreaSqFt: round2(s.glazedAreaSqFt),
      tallestRidgeHeightFt: round2(s.tallestRidgeHeightFt),
      volumeCount: s.volumeCount,
      storeys: s.storeys,
    },
  };
  // two-space indent and a trailing newline: readable in an editor, and a
  // well-formed text file for anything that reads line by line
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function exportSpecJson(source: BuilderExportSource): ExportArtifact {
  const resolved = resolveBuilderExportSource(source);
  const { document, spec } = resolved;
  if (!resolved.migratedFromLegacySpec) {
    const text = `${resolved.canonicalJson}\n`;
    return artifact(
      new Blob([text], { type: "application/json" }),
      exportFilename(spec, "aura.json"),
      "application/json",
      `Complete Aura project · document v${document.version} · design hash ${resolved.hash} · re-openable in the builder`,
    );
  }

  const text = specToJson(spec);
  const s = specSummary(spec);
  return artifact(
    new Blob([text], { type: "application/json" }),
    exportFilename(spec, "json"),
    "application/json",
    `HomeSpec v${SPEC_VERSION} · ${s.volumeCount} volume${s.volumeCount === 1 ? "" : "s"} · ${round2(
      s.totalFloorAreaSqFt,
    )} sq ft · re-openable in the builder`,
  );
}

/**
 * Read a .json export (or a bare HomeSpec) back in.
 *
 * Held to the SAME gate as a share link — `validateHomeSpec` — because a file
 * off somebody's disk is exactly as untrusted as a URL off the internet, and
 * two different standards for "is this a house" is how the two paths start
 * disagreeing. Returns null and says why rather than loading a partial house.
 */
export function parseSpecJson(text: string): HomeSpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("[aura/export] file is not valid JSON:", err);
    return null;
  }
  // accept both the envelope this file writes and a bare HomeSpec, since
  // people will hand-write the bare form
  const candidate =
    typeof parsed === "object" && parsed !== null && "spec" in parsed
      ? (parsed as { spec: unknown }).spec
      : parsed;
  const check = validateHomeSpec(candidate);
  if (!check.ok) {
    console.error(`[aura/export] refusing to load a half-understood house — ${check.problem}`);
    return null;
  }
  return check.spec;
}

/* ---------------------------------------------------------------------------
   preparing a scene for export
   --------------------------------------------------------------------------- */

/** Mark anything in the builder's 3D view that belongs to the EDITOR rather
 *  than to the HOUSE — the ground plane, the grid, selection outlines, drag
 *  handles, the compass rose — and it stays out of every model export.
 *
 *      grid.userData[EXPORT_IGNORE] = true;
 */
export const EXPORT_IGNORE = "auraExportIgnore";

/**
 * A detached, export-ready copy of the caller's object.
 *
 * CLONED, NEVER MUTATED. The object handed in is live in a running R3F scene;
 * reparenting it into a wrapper, scaling it, or writing userData onto it would
 * change what the user is looking at. `clone(true)` copies the graph and
 * SHARES geometries and materials, so this costs a walk of the tree and no
 * buffer copies.
 *
 * The scale-and-position move is the whole unit conversion, and it is exact:
 * for a node with transform T·R·S, scaling the world by k means T' = kT and
 * S' = kS with R untouched. Every descendant inherits it, so one node carries
 * the conversion for the entire house.
 */
function prepareForExport(
  root: THREE.Object3D,
  source: BuilderExportSource,
  opts: ModelExportOptions,
): THREE.Object3D {
  const resolved = resolveBuilderExportSource(source);
  const { document, spec } = resolved;
  let clone: THREE.Object3D;
  try {
    clone = root.clone(true);
  } catch (err) {
    /* three's Object3D.copy() does `JSON.parse(JSON.stringify(userData))`, so
       one object anywhere in the tree holding a function, a circular
       reference, or a three object in `userData` makes the whole clone throw —
       with a message about JSON that says nothing about 3D. Name the culprit
       instead of passing the confusion on. */
    const culprit = findUnserialisableUserData(root);
    throw new Error(
      culprit
        ? `[aura/export] cannot copy the scene for export: userData on "${culprit}" is not JSON-serialisable (three clones userData through JSON). Keep scene userData to plain values, or hand exportGlb a subtree that excludes it.`
        : `[aura/export] cannot copy the scene for export: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const k = (opts.sceneUnits ?? "feet") === "feet" ? FEET_TO_METRES : 1;
  if (k !== 1) {
    clone.position.multiplyScalar(k);
    clone.scale.multiplyScalar(k);
  }

  // editor furniture, lights, cameras, billboards and helpers are not the house
  const drop: THREE.Object3D[] = [];
  clone.traverse((o) => {
    const any = o as unknown as {
      isLight?: boolean;
      isCamera?: boolean;
      isSprite?: boolean;
      type?: string;
    };
    if (
      o.userData?.[EXPORT_IGNORE] === true ||
      any.isLight === true ||
      any.isCamera === true ||
      any.isSprite === true ||
      (typeof any.type === "string" && any.type.endsWith("Helper"))
    ) {
      drop.push(o);
    }
  });
  for (const o of drop) o.removeFromParent();

  if (opts.embedSpec !== false) {
    /* glTF carries this through to `extras` on the node (three's GLTFExporter
       serialises userData there), so the spec that produced the geometry is
       INSIDE the model file. A designer who receives only the .glb still has
       every dimension, and can hand it back to us to reopen. */
    clone.userData = {
      ...clone.userData,
      aura: {
        format: document.format,
        documentVersion: document.version,
        documentHash: resolved.hash,
        specVersion: SPEC_VERSION,
        generator: "Aura Homes builder",
        disclaimer: EXPORT_DISCLAIMER,
        // the model's units, said accurately for both cases — a metadata line
        // that claims a conversion that did not happen is a lie in a file
        units:
          k === 1
            ? "metres (the scene was already in metres)"
            : `metres (converted from the HomeSpec's feet at exactly ${FEET_TO_METRES} m/ft)`,
        specUnits: "feet (wall thickness in mm, per lib/design/materials.ts)",
        document: JSON.parse(resolved.canonicalJson) as unknown,
        spec,
        derived: specSummary(spec),
        durableDocumentDetailCounts: resolved.durableDetailCounts,
        geometryLimitation: exportSourceLimitation(source, "rendered-scene"),
      },
    };
  }

  clone.updateMatrixWorld(true);
  return clone;
}

/** Walk the ORIGINAL tree looking for the object whose userData will not
 *  survive a JSON round-trip. Only ever called on the failure path, so the
 *  cost of the second traversal is paid by nobody who succeeds. */
function findUnserialisableUserData(root: THREE.Object3D): string | null {
  let found: string | null = null;
  root.traverse((o) => {
    if (found !== null || !o.userData) return;
    try {
      JSON.stringify(o.userData);
    } catch {
      found = o.name || o.type || "(unnamed object)";
    }
  });
  return found;
}

/** Free the cloned graph. The clone shares geometries and materials with the
 *  live scene, so this must NOT dispose them — only drop the references. */
function releaseClone(clone: THREE.Object3D): void {
  clone.clear();
}

/* ---------------------------------------------------------------------------
   2. glTF — the standard
   --------------------------------------------------------------------------- */

async function parseGltf(
  root: THREE.Object3D,
  source: BuilderExportSource,
  opts: ModelExportOptions,
  binary: boolean,
): Promise<ArrayBuffer | Record<string, unknown>> {
  /* three's own exporter, from the `three` package already in this repo's
     dependencies. MIT, © three.js authors. No new package, no new licence. */
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const scene = prepareForExport(root, source, opts);
  try {
    const result = await new GLTFExporter().parseAsync(scene, {
      binary,
      onlyVisible: opts.onlyVisible ?? true,
      /* `trs: false` bakes each node's transform into a single matrix, which
         is what the unit conversion above relies on and what every importer
         handles identically. `embedImages` keeps textures inside the file so
         a .glb is genuinely one self-contained thing to email. */
      trs: false,
      embedImages: true,
      includeCustomExtensions: true,
    });
    return result as ArrayBuffer | Record<string, unknown>;
  } finally {
    releaseClone(scene);
  }
}

/**
 * glTF 2.0 binary — the one to reach for.
 *
 * One self-contained file: geometry, materials and any textures, plus the
 * HomeSpec itself riding along in `extras`. Opens in Blender, SketchUp (via
 * its glTF importer), Rhino, Unreal, Unity, Godot, macOS Quick Look, Windows
 * 3D Viewer, and every free web viewer.
 */
export async function exportGlb(
  root: THREE.Object3D,
  source: BuilderExportSource,
  opts: ModelExportOptions = {},
): Promise<ExportArtifact> {
  const { spec } = resolveBuilderExportSource(source);
  const result = await parseGltf(root, source, opts, true);
  if (!(result instanceof ArrayBuffer)) {
    // GLTFExporter contract: binary:true resolves with an ArrayBuffer. If that
    // ever stops being true, say so instead of writing a broken .glb.
    throw new Error("[aura/export] GLTFExporter returned JSON when binary output was requested");
  }
  return artifact(
    new Blob([result], { type: "model/gltf-binary" }),
    exportFilename(spec, "glb"),
    "model/gltf-binary",
    "glTF 2.0 binary · metres · Khronos open standard · opens in Blender, SketchUp, Rhino and any free viewer",
  );
}

/**
 * glTF 2.0 as readable JSON (.gltf).
 *
 * Same standard, same content, human-inspectable. Worth having for anyone who
 * wants to see what we actually wrote, or whose pipeline diffs its assets.
 */
export async function exportGltf(
  root: THREE.Object3D,
  source: BuilderExportSource,
  opts: ModelExportOptions = {},
): Promise<ExportArtifact> {
  const { spec } = resolveBuilderExportSource(source);
  const result = await parseGltf(root, source, opts, false);
  if (result instanceof ArrayBuffer) {
    throw new Error("[aura/export] GLTFExporter returned binary when JSON output was requested");
  }
  const text = `${JSON.stringify(result, null, 2)}\n`;
  return artifact(
    new Blob([text], { type: "model/gltf+json" }),
    exportFilename(spec, "gltf"),
    "model/gltf+json",
    "glTF 2.0 JSON · metres · same standard as .glb, readable in a text editor",
  );
}

/* ---------------------------------------------------------------------------
   3. OBJ — the fallback that always opens
   --------------------------------------------------------------------------- */

/**
 * Wavefront OBJ.
 *
 * HONEST ABOUT WHAT IT LOSES: three's OBJExporter writes vertices, normals,
 * UVs and object names. It writes no materials and no companion .mtl, so
 * everything arrives untextured and grey, and OBJ has no concept of the
 * metadata the glTF carries — the spec cannot ride inside it. What it does
 * have is universal support, which is the entire point of keeping it.
 *
 * OBJ is also unitless by specification. The same feet-to-metres conversion is
 * applied so the two model exports agree, and the header says so in words,
 * because "unitless" in practice means "whatever the importer assumes" and the
 * common assumption is metres.
 */
export async function exportObj(
  root: THREE.Object3D,
  source: BuilderExportSource,
  opts: ModelExportOptions = {},
): Promise<ExportArtifact> {
  const resolved = resolveBuilderExportSource(source);
  const { document, spec } = resolved;
  const { OBJExporter } = await import("three/examples/jsm/exporters/OBJExporter.js");
  const scene = prepareForExport(root, source, { ...opts, embedSpec: false });
  let body: string;
  try {
    body = new OBJExporter().parse(scene);
  } finally {
    releaseClone(scene);
  }

  const s = specSummary(spec);
  const header = [
    `# ${spec.name}`,
    `# Aura Homes builder — document v${document.version} / HomeSpec v${SPEC_VERSION}`,
    `# design hash: ${resolved.hash}`,
    `# units: metres (converted from feet at exactly ${FEET_TO_METRES} m/ft)`,
    `# total floor area: ${round2(s.totalFloorAreaSqFt)} sq ft over ${s.volumeCount} volume${
      s.volumeCount === 1 ? "" : "s"
    }`,
    `# ground footprint: ${round2(s.groundFootprintSqFt)} sq ft`,
    `# tallest ridge: ${round2(s.tallestRidgeHeightFt)} ft above finished floor`,
    "#",
    `# ${EXPORT_DISCLAIMER}`,
    ...(exportSourceLimitation(source, "rendered-scene")
      ? [`# ${exportSourceLimitation(source, "rendered-scene")}`]
      : []),
    "#",
    "# OBJ carries geometry only. For materials, and for the full editable",
    "# specification, use the glTF (.glb) or the JSON export.",
    "",
  ].join("\n");

  return artifact(
    new Blob([header + body], { type: "model/obj" }),
    exportFilename(spec, "obj"),
    "model/obj",
    "Wavefront OBJ · metres · geometry only, no materials · opens in essentially everything",
  );
}

/* ---------------------------------------------------------------------------
   the download helper
   --------------------------------------------------------------------------- */

/**
 * Hand an artifact to the browser's downloads.
 *
 * Returns false rather than throwing when there is no DOM (a server render, a
 * worker) — a download is a side effect on a page, and a page that is not
 * there is not an error worth crashing a render over.
 */
export function downloadArtifact(a: ExportArtifact): boolean {
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") {
    console.error("[aura/export] downloadArtifact needs a browser document");
    return false;
  }
  const url = URL.createObjectURL(a.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = a.filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  /* Revoked on a delay, not immediately: some browsers read the object URL
     asynchronously after the synthetic click, and revoking in the same tick
     produces a download that silently fails. A few seconds is long enough for
     every engine and short enough that the blob is not held for the session. */
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
  return true;
}

/* ===========================================================================
   IFC — RESEARCHED, COSTED, AND DELIBERATELY NOT ADDED IN THIS PASS

   Verified August 2026 against the packages themselves, not from memory.

   WHAT IT WOULD BUY. IFC (ISO 16739) is the format a building department, a
   BIM-using architect, an energy modeller and a quantity surveyor actually
   speak. glTF hands over SHAPE; IFC hands over a BUILDING — this is a wall,
   it is 168 mm of SIP, it has an opening in it, it belongs to storey 1. That
   is the difference between "your designer can look at it" and "your designer
   can work in it", and it is the format the repo's own Phase-5 compliance
   scorecard is designed to run rules against.

   THE PACKAGES, AND A CORRECTION TO THE FRAMING.
   · web-ifc (ThatOpen `engine_web-ifc`) — the one that can WRITE IFC:
     `CreateModel(NewIfcModel)`, `WriteLine`, `WriteLines`, `SaveModel(): Uint8Array`.
     Licence **MPL-2.0** — NOT MIT. This matters and is worth stating plainly:
     MPL is file-level copyleft. Using it unmodified as a dependency of an MIT
     app is fine; any web-ifc file we MODIFIED would have to stay MPL-2.0 and
     be published. The repo's own AI-TOOLS-RESEARCH.md gets this right; the
     shorthand "it is MIT and three.js-native" conflates web-ifc with the
     toolkit that sits on top of it.
   · @thatopen/components 3.4.8 — **MIT**, and genuinely three.js-native.
     Toolkit for LOADING, viewing, navigating, clipping, measuring, plan
     generation and DXF export. It is not an IFC AUTHORING library. It would
     not write our file; web-ifc would.
   · @thatopen/fragments 3.4.7 — **MIT** (this resolves the "verify per-package"
     flag left open in docs/AI-TOOLS-RESEARCH.md line ~606).

   THE NUMBERS.
   · web-ifc@0.0.77 — 3.54 MB minified JS, **391 kB gzipped**, 0 dependencies,
     PLUS a **1.3 MB** `web-ifc.wasm` fetched at runtime (roughly 500-600 kB
     over the wire compressed). Call it **~0.9-1.0 MB of transfer** for the
     write path alone.
   · @thatopen/components@3.4.8 — 482 kB minified, **139 kB gzipped**,
     3 dependencies (fast-xml-parser, jszip, three-mesh-bvh — all MIT).

   For comparison: the entire current export surface — GLTFExporter plus
   OBJExporter — is roughly 20 kB gzipped and already paid for. IFC is a
   fifty-fold increase for one button.

   THE BLOCKER NOBODY EXPECTS. @thatopen/components@3.4.8 declares
   `three >= 0.182.0` as a peer dependency. This app is on three@0.169.0 with
   @react-three/fiber@8 and @react-three/drei@9. Adopting the toolkit means a
   thirteen-minor three upgrade underneath a working R3F 8 scene — the landing
   page's whole camera journey, its postprocessing stack and its custom shader
   injection all ride on that. That is a rendering-stack migration wearing an
   export button's clothes. (web-ifc ALONE has zero dependencies and no three
   peer, so the write path does not force this; only the toolkit does.)

   THE PART THAT IS NOT A DEPENDENCY AT ALL. `npm i` does not produce an IFC
   file. Authoring one means building the entity graph by hand: IfcProject,
   IfcOwnerHistory, an IfcUnitAssignment, geometric representation contexts,
   IfcSite / IfcBuilding / IfcBuildingStorey with IfcRelAggregates between
   them, IfcWallStandardCase over IfcExtrudedAreaSolid for every wall,
   IfcOpeningElement plus IfcRelVoidsElement for every window and door,
   IfcRelContainedInSpatialStructure to hang elements on a storey, and a chain
   of IfcLocalPlacement to position all of it. Every one of those has to be
   right or the file opens as an empty tree in Revit and reads as broken
   software. Realistically that is days, not an afternoon, and it wants a
   round-trip test against a real IFC viewer before it ships.

   RECOMMENDATION — NOT YET, AND HERE IS THE TRIGGER.
   Add IFC when a real user is blocked by its absence: a designer asking for
   IFC rather than glTF, or the Phase-5 compliance work starting, whichever
   comes first. Until then glTF carries the handoff at 2% of the weight, and
   the honest position is that we export a MASSING MODEL — which is what this
   builder produces — rather than a BIM model we would be implying we had.

   WHEN IT IS TIME, THE SHAPE IS:
   · `web-ifc` only, dynamically imported behind the same `await import()`
     pattern used above, so the 1 MB never touches the main bundle and a user
     who does not press the button never downloads it. Used UNMODIFIED, so the
     MPL-2.0 obligation stays satisfied by attribution alone.
   · The wasm served from our own origin (`/wasm/`), never a CDN — this is a
     static export and a third-party CDN would be a new runtime dependency and
     a new privacy surface.
   · Add both licences to docs/CREDITS.md: web-ifc MPL-2.0 © That Open
     Company; @thatopen/* MIT © That Open Company.
   · Skip @thatopen/components entirely unless the plan-vs-3D toggle and DXF
     export are wanted at the same time — and if they are, price the three
     upgrade as its own piece of work first.
   =========================================================================== */

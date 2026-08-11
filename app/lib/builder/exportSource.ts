import {
  BUILDER_DOCUMENT_FORMAT,
  builderDocumentFromLegacySpec,
  canonicalBuilderDocumentJson,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import type { HomeSpec } from "./spec";

/**
 * Public export boundaries accept the durable document while continuing to
 * read legacy HomeSpec callers. The migration happens in one place so the
 * DXF, IFC, semantic, drawing and model writers cannot disagree about which
 * project they received.
 */
export type BuilderExportSource = BuilderDocument | HomeSpec;

export interface DurableDetailCounts {
  /** Durable details whose representation varies by export format. */
  partitions: number;
  finishes: number;
  fixtures: number;
  quarantinedItems: number;
}

export interface ResolvedBuilderExportSource {
  document: BuilderDocument;
  spec: HomeSpec;
  canonicalJson: string;
  hash: ReturnType<typeof hashBuilderDocument>;
  migratedFromLegacySpec: boolean;
  durableDetailCounts: DurableDetailCounts;
}

const looksLikeDocument = (source: BuilderExportSource): source is BuilderDocument =>
  "format" in source && source.format === BUILDER_DOCUMENT_FORMAT;

export function resolveBuilderExportSource(
  source: BuilderExportSource,
): ResolvedBuilderExportSource {
  const migratedFromLegacySpec = !looksLikeDocument(source);
  const result = migratedFromLegacySpec
    ? { ok: true as const, document: builderDocumentFromLegacySpec(source) }
    : validateBuilderDocument(source);

  if (!result.ok) {
    throw new Error(`Cannot export this Aura project: ${result.problem}`);
  }

  const document = result.document;
  return {
    document,
    spec: document.spec,
    canonicalJson: canonicalBuilderDocumentJson(document),
    hash: hashBuilderDocument(document),
    migratedFromLegacySpec,
    durableDetailCounts: {
      partitions: document.partitions.length,
      finishes: Object.keys(document.finishes).length,
      fixtures: document.fixtures.items.length,
      quarantinedItems: document.quarantine.entries.length,
    },
  };
}

/**
 * Boundary for writers that have not moved to BuildingGraph yet. Refusing is
 * safer than exporting `legacyRecovery` and labelling it as the current home.
 */
export function resolveLegacyGeometryExportSource(
  source: BuilderExportSource,
): ResolvedBuilderExportSource {
  const resolved = resolveBuilderExportSource(source);
  if (resolved.document.geometry.kind === "building-graph") {
    throw new Error(
      "This writer does not support planar BuildingGraph geometry yet. Export the current 3D scene or the complete .aura.json project instead; the recovery HomeSpec was not substituted.",
    );
  }
  return resolved;
}

export function exportSourceLimitation(
  source: BuilderExportSource,
  representation: "legacy-volume" | "rendered-scene" = "legacy-volume",
): string | null {
  const { durableDetailCounts: omitted } = resolveBuilderExportSource(source);
  const details = [
    omitted.partitions ? `${omitted.partitions} partition(s)` : null,
    representation === "legacy-volume" && omitted.finishes
      ? `${omitted.finishes} finish override(s)`
      : null,
    representation === "legacy-volume" && omitted.fixtures
      ? `${omitted.fixtures} fixture(s)`
      : null,
    omitted.quarantinedItems ? `${omitted.quarantinedItems} quarantined item(s)` : null,
  ].filter((value): value is string => value !== null);
  return details.length
    ? `The complete Aura document retains ${details.join(", ")}; this ${
        representation === "legacy-volume" ? "legacy-volume geometry writer" : "rendered scene"
      } does not represent them.`
    : null;
}

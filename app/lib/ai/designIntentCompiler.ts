import { keccak256, stringToHex, type Hex } from "viem";

import {
  DESIGN_INTENT_VERSION,
  parseDesignIntent,
  type CardinalDirection,
  type DesignIntent,
  type DesignIntentField,
  type MaterialPreference,
} from "./designIntent";
import {
  addGraphOpening,
  addPartitionEdge,
  duplicateGraphStorey,
  renameGraphRoom,
  setGraphRoofForm,
  singleStoreyGraphFromPolygon,
  splitWallAt,
  validateBuildingGraph,
  type BuildingGraph,
  type GraphRoofForm,
  type GraphStorey,
  type GraphWallEdge,
} from "../builder/buildingGraph";
import {
  builderDocumentFromLegacySpec,
  canonicalBuilderDocumentJson,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "../builder/document";
import { wallThicknessFt } from "../builder/geometry";
import { SPEC_VERSION, type HomeSpec, type RoofForm } from "../builder/spec";
import type { ClimateZone, EcoMaterial } from "../designApi";

export const DESIGN_INTENT_COMPILER_VERSION = "aura-design-intent-compiler/v1" as const;
export const COMPILED_DESIGN_INTENT_PROJECT_VERSION = 1 as const;

export type DesignIntentCompilerErrorCode =
  | "invalid-intent"
  | "unsupported-storeys"
  | "unsupported-split-level"
  | "unsupported-roof"
  | "program-does-not-fit"
  | "openings-do-not-fit"
  | "factory-refused"
  | "document-invalid";

export interface DesignIntentCompilerError {
  code: DesignIntentCompilerErrorCode;
  problem: string;
}

export interface DesignIntentCompilerDecision {
  code: string;
  field: DesignIntentField;
  statement: string;
}

export interface CompiledDesignIntentProject {
  format: "aura-compiled-design-intent-project";
  version: typeof COMPILED_DESIGN_INTENT_PROJECT_VERSION;
  compilerVersion: typeof DESIGN_INTENT_COMPILER_VERSION;
  intentVersion: typeof DESIGN_INTENT_VERSION;
  intentHash: Hex;
  document: BuilderDocument;
  documentHash: Hex;
  sourceFingerprints: string[];
  decisions: DesignIntentCompilerDecision[];
  unresolved: Array<{ id: string; field: DesignIntentField; question: string }>;
  projectHash: Hex;
}

export type DesignIntentCompilationResult =
  | { ok: true; project: CompiledDesignIntentProject }
  | { ok: false; error: DesignIntentCompilerError };

class CompilerRefusal extends Error {
  readonly code: DesignIntentCompilerErrorCode;

  constructor(code: DesignIntentCompilerErrorCode, problem: string) {
    super(problem);
    this.code = code;
  }
}

const M2_TO_SQFT = 10.763910416709722;
const DEFAULT_FOOTPRINT_M2 = 74.23;
const ASPECT_RATIO = 1.45;
const STOREY_HEIGHT_FT = 9.5;
const MIN_ROOM_WIDTH_FT = 4;

const refuse = (code: DesignIntentCompilerErrorCode, problem: string): never => {
  throw new CompilerRefusal(code, problem);
};

const failed = (
  code: DesignIntentCompilerErrorCode,
  problem: string,
): DesignIntentCompilationResult => ({ ok: false, error: { code, problem } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalValue(value[key]);
  return output;
}

const canonicalHash = (value: unknown): Hex =>
  keccak256(stringToHex(JSON.stringify(canonicalValue(value))));

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

const halfFoot = (value: number): number => Math.round(value * 2) / 2;

function footprint(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): { targetM2: number; widthFt: number; depthFt: number } {
  const source = intent.approximateFootprint;
  let targetM2: number;
  if (source.targetM2 !== null) {
    targetM2 = source.targetM2;
  } else if (source.minimumM2 !== null && source.maximumM2 !== null) {
    targetM2 = (source.minimumM2 + source.maximumM2) / 2;
    decisions.push({
      code: "range-midpoint-footprint",
      field: "approximateFootprint",
      statement: "Used the midpoint of the stated footprint range.",
    });
  } else if (source.minimumM2 !== null) {
    targetM2 = source.minimumM2;
    decisions.push({
      code: "minimum-footprint",
      field: "approximateFootprint",
      statement: "Used the stated minimum because no target or maximum was provided.",
    });
  } else if (source.maximumM2 !== null) {
    targetM2 = source.maximumM2;
    decisions.push({
      code: "maximum-footprint",
      field: "approximateFootprint",
      statement: "Used the stated maximum because no target or minimum was provided.",
    });
  } else {
    targetM2 = DEFAULT_FOOTPRINT_M2;
    decisions.push({
      code: "default-footprint",
      field: "approximateFootprint",
      statement: `Used the compiler's ${DEFAULT_FOOTPRINT_M2} m2 cabin starting footprint.`,
    });
  }
  const targetSqFt = targetM2 * M2_TO_SQFT;
  const widthFt = halfFoot(Math.sqrt(targetSqFt * ASPECT_RATIO));
  const depthFt = halfFoot(targetSqFt / widthFt);
  return { targetM2, widthFt, depthFt };
}

function storeyCount(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): 1 | 2 {
  if (intent.storeys.splitLevel === true) {
    refuse("unsupported-split-level", "Split-level intent needs an explicit level and stair contract before compilation.");
  }
  const count = intent.storeys.count;
  if (count === null) {
    decisions.push({
      code: "default-storeys",
      field: "storeys",
      statement: "Used one storey because no storey count was stated.",
    });
    return 1;
  }
  if (count !== 1 && count !== 2) {
    return refuse("unsupported-storeys", "This compiler version supports one or two storeys without inventing circulation.");
  }
  return count as 1 | 2;
}

function material(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): EcoMaterial {
  const preferences = new Set<MaterialPreference>(intent.materials.preferences);
  let selected: EcoMaterial | null = null;
  if (preferences.has("timber") || preferences.has("reclaimed") || preferences.has("bio-based")) {
    selected = "timber_frame";
  } else if (preferences.has("earth")) {
    selected = "rammed_earth";
  } else if (preferences.has("low-carbon")) {
    selected = "clt";
  }
  if (selected === null) {
    selected = "sip";
    decisions.push({
      code: "default-material",
      field: "materials",
      statement: "Used the SIP shell baseline because the stated preferences do not identify a supported structural shell.",
    });
  }
  decisions.push({
    code: "selected-material",
    field: "materials",
    statement: `Mapped the structural shell to ${selected}.`,
  });
  return selected;
}

function climate(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): ClimateZone {
  let zone: ClimateZone;
  if (intent.climate.country === "CR" || intent.climate.profile === "tropical-humid" || intent.climate.profile === "tropical-dry") {
    zone = "4";
  } else if (intent.climate.profile === "marine") {
    zone = "5";
  } else if (intent.climate.profile === "cold-continental" || intent.climate.profile === "mountain") {
    zone = "7A";
  } else {
    zone = "7A";
    decisions.push({
      code: "default-climate",
      field: "climate",
      statement: "Used the Alberta 7A baseline because no supported climate profile was stated.",
    });
  }
  decisions.push({
    code: "selected-climate",
    field: "climate",
    statement: `Mapped the envelope baseline to climate zone ${zone}.`,
  });
  return zone;
}

const orientationDegrees: Readonly<Record<CardinalDirection, number>> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

function siting(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): HomeSpec["siting"] {
  const orientation = intent.siting.orientationPreference;
  const frontFacesDeg = orientation === "none" || orientation === "unknown"
    ? 180
    : orientationDegrees[orientation];
  if (orientation === "none" || orientation === "unknown") {
    decisions.push({
      code: "default-orientation",
      field: "siting",
      statement: "Used south as the editable starting orientation because none was stated.",
    });
  }
  const slope = intent.siting.slope === "unknown" ? "flat" : intent.siting.slope;
  if (intent.siting.slope === "unknown") {
    decisions.push({
      code: "default-slope",
      field: "siting",
      statement: "Used a flat editable starting site because slope is unresolved.",
    });
  }
  return { frontFacesDeg, slope };
}

function roof(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): { graphForm: GraphRoofForm; legacyForm: RoofForm; pitchDeg: number } {
  const requested = intent.roof.forms[0] ?? "unknown";
  if (intent.roof.forms.length > 1) {
    decisions.push({
      code: "selected-roof-form",
      field: "roof",
      statement: `Used the first stated roof form, ${requested}, for this single-shell proposal.`,
    });
  }
  if (requested === "a-frame") {
    return refuse("unsupported-roof", "A-frame intent remains blocked until the editable graph owns that roof topology.");
  }
  let graphForm: GraphRoofForm;
  if (requested === "unknown") {
    graphForm = "gable";
    decisions.push({
      code: "default-roof",
      field: "roof",
      statement: "Used a gable roof because roof form is unresolved.",
    });
  } else {
    graphForm = requested as GraphRoofForm;
  }
  const defaultPitch = graphForm === "flat" ? 0 : graphForm === "shed" ? 18 : 35;
  const pitchDeg = intent.roof.preferredPitchDegrees ?? defaultPitch;
  if (graphForm === "flat" && pitchDeg !== 0) {
    refuse("unsupported-roof", "A flat graph roof requires a zero-degree authored zone in this compiler version.");
  }
  if (graphForm !== "flat" && pitchDeg <= 0) {
    refuse("unsupported-roof", "A sloped graph roof needs a positive pitch.");
  }
  const legacyForm: RoofForm = graphForm === "hipped" ? "gable" : graphForm;
  if (graphForm === "hipped") {
    decisions.push({
      code: "recovery-roof-approximation",
      field: "roof",
      statement: "The editable graph owns the hipped roof; the recovery shell keeps the nearest gable form and is not the active geometry.",
    });
  }
  return { graphForm, legacyForm, pitchDeg };
}

interface RoomInstance {
  name: string;
  minimumAreaSqFt: number;
}

const title = (value: string): string =>
  value.split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");

function roomInstances(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): RoomInstance[] {
  const output: RoomInstance[] = [];
  for (const room of intent.rooms) {
    const base = room.label ?? title(room.use);
    if (base.trim().length > 36) {
      refuse("program-does-not-fit", "A requested room label is too long for the editable plan face.");
    }
    for (let index = 0; index < room.count; index += 1) {
      output.push({
        name: room.count === 1 ? base : `${base} ${index + 1}`,
        minimumAreaSqFt: (room.minimumAreaM2 ?? 0) * M2_TO_SQFT,
      });
    }
  }
  if (output.length === 0) {
    decisions.push({
      code: "default-room",
      field: "rooms",
      statement: "Created one open-plan room because no room program was stated.",
    });
    output.push({ name: "Open plan", minimumAreaSqFt: 0 });
  }
  return output;
}

function wallDirection(storey: GraphStorey, wall: GraphWallEdge): CardinalDirection {
  const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) return refuse("factory-refused", "An editable wall lost one of its vertices.");
  if (Math.abs(start.zFt - end.zFt) < 1e-8) return (start.zFt + end.zFt) / 2 < 0 ? "south" : "north";
  return (start.xFt + end.xFt) / 2 > 0 ? "east" : "west";
}

function requiredWall(storey: GraphStorey, direction: CardinalDirection): GraphWallEdge {
  const wall = storey.walls.find((candidate) => candidate.kind === "external" && wallDirection(storey, candidate) === direction);
  if (!wall) return refuse("factory-refused", `The ${direction} shell edge is unavailable.`);
  return wall;
}

function applyGraph(result: { ok: true; graph: BuildingGraph } | { ok: false; problem: string }, code: DesignIntentCompilerErrorCode): BuildingGraph {
  if (!result.ok) return refuse(code, result.problem);
  return result.graph;
}

function roomCentreX(storey: GraphStorey, room: GraphStorey["rooms"][number]): number {
  const walls = new Map(storey.walls.map((wall) => [wall.id, wall]));
  const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
  const xs: number[] = [];
  for (const edge of room.boundary) {
    const wall = walls.get(edge.wallId);
    if (!wall) continue;
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);
    if (start) xs.push(start.xFt);
    if (end) xs.push(end.xFt);
  }
  return xs.length === 0 ? 0 : (Math.min(...xs) + Math.max(...xs)) / 2;
}

function layoutRooms(
  source: BuildingGraph,
  storeyId: string,
  rooms: RoomInstance[],
  widthFt: number,
  depthFt: number,
): BuildingGraph {
  let graph = source;
  const actualArea = widthFt * depthFt;
  const minimumTotal = rooms.reduce((sum, room) => sum + room.minimumAreaSqFt, 0);
  if (minimumTotal > actualArea + 0.01) {
    refuse("program-does-not-fit", "Requested minimum room areas exceed the compiled storey footprint.");
  }
  const remaining = Math.max(0, actualArea - minimumTotal);
  const widths = rooms.map((room) => (room.minimumAreaSqFt + remaining / rooms.length) / depthFt);
  if (widths.some((value) => value < MIN_ROOM_WIDTH_FT)) {
    refuse("program-does-not-fit", "The requested room program would create a stripe narrower than four feet.");
  }
  if (rooms.length > 1) {
    const initial = graph.storeys.find((storey) => storey.id === storeyId);
    if (!initial) return refuse("factory-refused", `Storey ${storeyId} is unavailable.`);
    let southWallId = requiredWall(initial, "south").id;
    const southVertices = new Map<number, string>();
    for (let boundary = 1; boundary < rooms.length; boundary += 1) {
      const vertexId = `${storeyId}:room-boundary-${boundary}:south`;
      graph = applyGraph(splitWallAt(graph, storeyId, southWallId, widths[boundary - 1], vertexId), "factory-refused");
      southVertices.set(boundary, vertexId);
      southWallId = `${southWallId}-split-${vertexId}`;
    }
    const withSouth = graph.storeys.find((storey) => storey.id === storeyId);
    if (!withSouth) return refuse("factory-refused", `Storey ${storeyId} is unavailable.`);
    let northWallId = requiredWall(withSouth, "north").id;
    const northVertices = new Map<number, string>();
    for (let boundary = rooms.length - 1; boundary >= 1; boundary -= 1) {
      const vertexId = `${storeyId}:room-boundary-${boundary}:north`;
      graph = applyGraph(splitWallAt(graph, storeyId, northWallId, widths[boundary], vertexId), "factory-refused");
      northVertices.set(boundary, vertexId);
      northWallId = `${northWallId}-split-${vertexId}`;
    }
    for (let boundary = 1; boundary < rooms.length; boundary += 1) {
      graph = applyGraph(addPartitionEdge(
        graph,
        storeyId,
        `${storeyId}:partition-${boundary}`,
        southVertices.get(boundary)!,
        northVertices.get(boundary)!,
      ), "factory-refused");
    }
  }
  const storey = graph.storeys.find((candidate) => candidate.id === storeyId);
  if (!storey) return refuse("factory-refused", `Storey ${storeyId} is unavailable.`);
  if (storey.rooms.length !== rooms.length) {
    return refuse("factory-refused", "Room derivation did not preserve the requested room count.");
  }
  const ordered = [...storey.rooms].sort((left, right) => roomCentreX(storey, left) - roomCentreX(storey, right));
  for (let index = 0; index < ordered.length; index += 1) {
    graph = applyGraph(renameGraphRoom(graph, storeyId, ordered[index].id, rooms[index].name), "factory-refused");
  }
  return graph;
}

function wallLength(storey: GraphStorey, wall: GraphWallEdge): number {
  const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) return refuse("factory-refused", "An editable wall lost one of its vertices.");
  return Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
}

function openingCounts(
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): { doors: number; windows: number; directions: CardinalDirection[] } {
  const doors = intent.openings.exteriorDoorCount ?? 1;
  if (intent.openings.exteriorDoorCount === null) {
    decisions.push({ code: "default-door-count", field: "openings", statement: "Used one exterior door because no count was stated." });
  }
  const windowRule = intent.openings.glazingLevel === "minimal"
    ? 2
    : intent.openings.glazingLevel === "generous"
      ? 8
      : 4;
  const windows = intent.openings.windowCount ?? windowRule;
  if (intent.openings.windowCount === null) {
    decisions.push({ code: "default-window-count", field: "openings", statement: `Used ${windowRule} windows from the stated glazing level.` });
  }
  const directions: CardinalDirection[] = intent.openings.orientationPriorities.length > 0
    ? [...intent.openings.orientationPriorities]
    : ["south", "east", "west", "north"];
  if (intent.openings.orientationPriorities.length === 0) {
    decisions.push({ code: "default-opening-orientation", field: "openings", statement: "Used the compiler's south-first opening order because no priority was stated." });
  }
  return { doors, windows, directions };
}

function addOpenings(
  source: BuildingGraph,
  intent: DesignIntent,
  decisions: DesignIntentCompilerDecision[],
): BuildingGraph {
  const { doors, windows, directions } = openingCounts(intent, decisions);
  const storey = source.storeys[0];
  const openingWidthFt = 3;
  const marginFt = 0.75;
  const gapFt = 0.75;
  const slots: Array<{ wallId: string; offsetFt: number }> = [];
  for (const direction of directions) {
    const walls = storey.walls
      .filter((wall) => wall.kind === "external" && wallDirection(storey, wall) === direction)
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const wall of walls) {
      const length = wallLength(storey, wall);
      const capacity = Math.max(0, Math.floor((length - marginFt * 2 + gapFt) / (openingWidthFt + gapFt)));
      for (let index = 0; index < capacity; index += 1) {
        slots.push({ wallId: wall.id, offsetFt: marginFt + index * (openingWidthFt + gapFt) });
      }
    }
  }
  if (slots.length < doors + windows) {
    refuse("openings-do-not-fit", "The requested opening count does not fit the stated priority faces with safe spacing.");
  }
  let graph = source;
  for (let index = 0; index < doors + windows; index += 1) {
    const isDoor = index < doors;
    const sequence = isDoor ? index + 1 : index - doors + 1;
    graph = applyGraph(addGraphOpening(graph, storey.id, slots[index].wallId, {
      id: `${isDoor ? "door" : "window"}-${sequence}`,
      kind: isDoor ? "door" : "window",
      offsetFt: slots[index].offsetFt,
      widthFt: openingWidthFt,
      heightFt: isDoor ? 6.8 : 4,
      sillFt: isDoor ? 0 : 3,
    }), "openings-do-not-fit");
  }
  return graph;
}

function compile(intent: DesignIntent): CompiledDesignIntentProject {
  const decisions: DesignIntentCompilerDecision[] = [];
  const dimensions = footprint(intent, decisions);
  const levels = storeyCount(intent, decisions);
  const selectedMaterial = material(intent, decisions);
  const selectedClimate = climate(intent, decisions);
  const selectedSiting = siting(intent, decisions);
  const selectedRoof = roof(intent, decisions);
  const rooms = roomInstances(intent, decisions);

  const spec: HomeSpec = {
    version: SPEC_VERSION,
    name: intent.requestedUse.category === "cabin" ? "Aura cabin proposal" : "Aura home proposal",
    material: selectedMaterial,
    climateZone: selectedClimate,
    volumes: [{
      id: "main",
      name: "Main volume",
      widthFt: dimensions.widthFt,
      depthFt: dimensions.depthFt,
      x: 0,
      z: 0,
      rotationDeg: 0,
      storeys: levels,
      wallHeightFt: STOREY_HEIGHT_FT,
      roof: { form: selectedRoof.legacyForm, pitchDeg: selectedRoof.pitchDeg, overhangFt: 1.5 },
      openings: [],
    }],
    deck: null,
    siting: selectedSiting,
    notes: intent.materials.notes ?? "Compiled from a design-intent proposal.",
  };

  const made = singleStoreyGraphFromPolygon([
    [-dimensions.widthFt / 2, -dimensions.depthFt / 2],
    [dimensions.widthFt / 2, -dimensions.depthFt / 2],
    [dimensions.widthFt / 2, dimensions.depthFt / 2],
    [-dimensions.widthFt / 2, dimensions.depthFt / 2],
  ], { heightFt: STOREY_HEIGHT_FT, wallThicknessFt: wallThicknessFt(selectedMaterial) });
  if (!made.ok) return refuse("factory-refused", made.problem);
  let graph = made.graph;
  if (levels === 2) {
    graph = applyGraph(duplicateGraphStorey(graph, "storey-1", {
      id: "storey-2",
      name: "Upper floor",
      elevationFt: STOREY_HEIGHT_FT,
      heightFt: STOREY_HEIGHT_FT,
    }), "factory-refused");
  }
  const roofStoreyId = levels === 2 ? "storey-2" : "storey-1";
  graph = applyGraph(setGraphRoofForm(graph, roofStoreyId, selectedRoof.graphForm, selectedRoof.pitchDeg), "factory-refused");

  const roomsByStorey = Array.from({ length: levels }, (): RoomInstance[] => []);
  rooms.forEach((room, index) => roomsByStorey[index % levels].push(room));
  roomsByStorey.forEach((assigned, index) => {
    if (assigned.length === 0) {
      assigned.push({ name: index === 0 ? "Open plan" : "Upper open plan", minimumAreaSqFt: 0 });
      decisions.push({
        code: "default-room",
        field: "rooms",
        statement: `Created an open-plan room on storey ${index + 1} because no requested room was assigned there.`,
      });
    }
  });
  for (let index = 0; index < levels; index += 1) {
    graph = layoutRooms(graph, `storey-${index + 1}`, roomsByStorey[index], dimensions.widthFt, dimensions.depthFt);
  }
  graph = addOpenings(graph, intent, decisions);
  const checkedGraph = validateBuildingGraph(graph);
  if (!checkedGraph.ok) return refuse("factory-refused", checkedGraph.problem);

  const legacy = builderDocumentFromLegacySpec(spec);
  const candidate: BuilderDocument = {
    ...legacy,
    geometry: {
      kind: "building-graph",
      graph: checkedGraph.graph,
      legacyRecovery: spec,
      migrationWarnings: [],
    },
  };
  const checkedDocument = validateBuilderDocument(candidate);
  if (!checkedDocument.ok) return refuse("document-invalid", checkedDocument.problem);
  const document = JSON.parse(canonicalBuilderDocumentJson(checkedDocument.document)) as BuilderDocument;
  const documentHash = hashBuilderDocument(document);
  const intentHash = canonicalHash(intent);
  const sourceFingerprints = Array.from(new Set(intent.sources.map((source) => source.fingerprint))).sort();
  const unresolved = intent.unresolved.map((item) => ({ ...item }));
  const hashBasis = {
    format: "aura-compiled-design-intent-project" as const,
    version: COMPILED_DESIGN_INTENT_PROJECT_VERSION,
    compilerVersion: DESIGN_INTENT_COMPILER_VERSION,
    intentVersion: DESIGN_INTENT_VERSION,
    intentHash,
    documentHash,
    sourceFingerprints,
    decisions,
    unresolved,
  };
  return deepFreeze({
    ...hashBasis,
    document,
    projectHash: canonicalHash(hashBasis),
  });
}

export function compileDesignIntentToProject(value: unknown): DesignIntentCompilationResult {
  let intent: DesignIntent;
  try {
    intent = parseDesignIntent(value);
  } catch {
    return failed("invalid-intent", "The design intent did not pass the strict contract.");
  }
  try {
    return { ok: true, project: compile(intent) };
  } catch (error) {
    if (error instanceof CompilerRefusal) return failed(error.code, error.message);
    return failed("factory-refused", "The deterministic compiler could not create a complete editable proposal.");
  }
}

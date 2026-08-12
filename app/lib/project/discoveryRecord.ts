import { validateAuraProject, type AuraProject } from "./document";

export type DiscoveryAccess = "live" | "pilot" | "user-supplied" | "external" | "demonstration";
export type DiscoveryConfidence = "unverified" | "declared" | "source-checked" | "authority-verified";
export type DiscoveryKind = "land" | "contractors" | "manufacturers";

export interface DiscoveryRecord<T> {
  format: "aura-discovery-record";
  version: 1;
  id: string;
  subjectId: string;
  access: DiscoveryAccess;
  sourceLabel: string;
  sourceUrl: string | null;
  collectedAtISO: string;
  expiresAtISO: string | null;
  confidence: DiscoveryConfidence;
  data: T;
}

type NewDiscoveryRecord<T> = Omit<DiscoveryRecord<T>, "format" | "version">;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validISO = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);

export function validateDiscoveryRecord<T = unknown>(value: unknown):
  | { ok: true; record: DiscoveryRecord<T> }
  | { ok: false; problem: string } {
  if (!isObject(value) || value.format !== "aura-discovery-record" || value.version !== 1)
    return { ok: false, problem: "Discovery record format is not supported." };
  if (!validId(value.id) || !validId(value.subjectId))
    return { ok: false, problem: "Discovery record and subject ids must be stable identifiers." };
  if (!["live", "pilot", "user-supplied", "external", "demonstration"].includes(String(value.access)))
    return { ok: false, problem: "Discovery access classification is invalid." };
  if (typeof value.sourceLabel !== "string" || !value.sourceLabel.trim())
    return { ok: false, problem: "Discovery source label is missing." };
  if (value.sourceUrl !== null && (typeof value.sourceUrl !== "string" || !/^https?:\/\//.test(value.sourceUrl)))
    return { ok: false, problem: "Discovery source URL is invalid." };
  if (!validISO(value.collectedAtISO) || (value.expiresAtISO !== null && !validISO(value.expiresAtISO)))
    return { ok: false, problem: "Discovery evidence dates are invalid." };
  if (!["unverified", "declared", "source-checked", "authority-verified"].includes(String(value.confidence)))
    return { ok: false, problem: "Discovery confidence is invalid." };
  if (!("data" in value)) return { ok: false, problem: "Discovery record data is missing." };
  return { ok: true, record: structuredClone(value) as unknown as DiscoveryRecord<T> };
}

export function createDiscoveryRecord<T>(input: NewDiscoveryRecord<T>): DiscoveryRecord<T> {
  const checked = validateDiscoveryRecord<T>({ format: "aura-discovery-record", version: 1, ...input });
  if (!checked.ok) throw new Error(checked.problem);
  return checked.record;
}

function checkedProject(project: AuraProject): AuraProject {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`Cannot update discovery: ${checked.problem}`);
  return checked.project;
}

export function projectDiscoveryRecords<T>(project: AuraProject, kind: DiscoveryKind): DiscoveryRecord<T>[] {
  return (project.discovery[kind].records ?? []).flatMap((value) => {
    const checked = validateDiscoveryRecord<T>(value);
    return checked.ok ? [checked.record] : [];
  });
}

export function upsertProjectDiscoveryRecord<T>(
  project: AuraProject,
  kind: DiscoveryKind,
  record: DiscoveryRecord<T>,
  now: Date,
): AuraProject {
  const current = checkedProject(project);
  const checked = validateDiscoveryRecord<T>(record);
  if (!checked.ok) throw new Error(`Cannot save discovery record: ${checked.problem}`);
  const records = projectDiscoveryRecords(current, kind)
    .filter((item) => item.id !== checked.record.id)
    .concat(checked.record)
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    ...current,
    updatedAtISO: now.toISOString(),
    discovery: {
      ...current.discovery,
      [kind]: { ...current.discovery[kind], records },
    },
  };
}

export function setProjectShortlist(
  project: AuraProject,
  kind: DiscoveryKind,
  subjectId: string,
  selected: boolean,
  now: Date,
): AuraProject {
  const current = checkedProject(project);
  if (!validId(subjectId)) throw new Error("Cannot shortlist an invalid subject id.");
  const shortlist = new Set(current.discovery[kind].shortlist);
  selected ? shortlist.add(subjectId) : shortlist.delete(subjectId);
  return {
    ...current,
    updatedAtISO: now.toISOString(),
    discovery: {
      ...current.discovery,
      [kind]: {
        ...current.discovery[kind],
        shortlist: Array.from(shortlist).sort(),
      },
    },
  };
}

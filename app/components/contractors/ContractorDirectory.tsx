"use client";

import { useMemo, useState } from "react";
import { GrowBar, Reveal } from "@/components/Reveal";
import { useAuraProject } from "@/components/project/ProjectContext";
import {
  DEMO_CONTRACTORS,
  contractorEvidenceScore,
  type ContractorEvidence,
  type ContractorProfile,
} from "@/lib/marketplace/discovery";
import {
  createDiscoveryRecord,
  projectDiscoveryRecords,
  setProjectShortlist,
  upsertProjectDiscoveryRecord,
} from "@/lib/project/discoveryRecord";
import RfqWorkbench from "./RfqWorkbench";

type Trade = ContractorProfile["trades"][number];

const TRADE_LABELS: Record<Trade, string> = {
  "whole-home-builder": "Whole home",
  "timber-and-envelope": "Timber + envelope",
  "site-and-foundation": "Site + foundation",
  "off-grid-systems": "Off-grid systems",
  interiors: "Interiors",
};
const READINESS_LABEL = {
  "shortlist-ready": "Evidence-ready",
  "manual-review": "Evidence incomplete",
  "not-ready": "Evidence expired / negative",
} as const;
const REGISTRY = "https://residentialprotection.alberta.ca/public-registry/Builder";
const WCB = "https://www.wcb.ab.ca/insurance-and-premiums/clearance-letters/";
const LICENCE = "https://www.servicealberta.gov.ab.ca/consumer/business_search/index.cfm";
const caseId = () => typeof crypto !== "undefined" && crypto.randomUUID
  ? `contractor-${crypto.randomUUID()}`
  : `contractor-${Date.now().toString(36)}`;

export default function ContractorDirectory() {
  const { project, update } = useAuraProject();
  const [trade, setTrade] = useState<"all" | Trade>("all");
  const [region, setRegion] = useState("all");
  const [legalName, setLegalName] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [caseLegalName, setCaseLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [caseRegion, setCaseRegion] = useState(project?.requirements.location.municipality || "Alberta");
  const [caseTrade, setCaseTrade] = useState<Trade>("whole-home-builder");
  const [website, setWebsite] = useState("");
  const [registryChecked, setRegistryChecked] = useState(false);
  const [wcbChecked, setWcbChecked] = useState(false);
  const [insuranceChecked, setInsuranceChecked] = useState(false);
  const [projectsChecked, setProjectsChecked] = useState(false);
  const [reviewsChecked, setReviewsChecked] = useState(false);
  const [wcbExpiry, setWcbExpiry] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const userProfiles = useMemo(
    () => project ? projectDiscoveryRecords<ContractorProfile>(project, "contractors").map((record) => record.data) : [],
    [project],
  );
  const sourceProfiles = demoMode ? DEMO_CONTRACTORS : userProfiles;
  const profiles = useMemo(
    () => sourceProfiles.map((profile) => contractorEvidenceScore(profile, now))
      .filter((result) => trade === "all" || result.profile.trades.includes(trade))
      .filter((result) => region === "all" || result.profile.region === region)
      .sort((a, b) => b.score - a.score || a.profile.displayName.localeCompare(b.profile.displayName)),
    [now, region, sourceProfiles, trade],
  );
  const regions = Array.from(new Set(sourceProfiles.map((profile) => profile.region)));
  const shortlisted = new Set(project?.discovery.contractors.shortlist ?? []);

  async function addCaseFile(event: React.FormEvent) {
    event.preventDefault();
    if (!project) { setProblem("Start a project before adding a contractor case file."); return; }
    setProblem(null);
    const checkedAtISO = new Date().toISOString();
    const evidence: ContractorEvidence[] = [];
    if (registryChecked) evidence.push({ kind: "alberta-builder-registry", status: "confirmed", label: "Project owner matched the exact legal name in the Alberta builder registry", sourceUrl: REGISTRY, checkedAtISO, expiresAtISO: null });
    if (wcbChecked) evidence.push({ kind: "wcb-clearance", status: "confirmed", label: "Project owner recorded a current WCB clearance", sourceUrl: WCB, checkedAtISO, expiresAtISO: wcbExpiry ? new Date(`${wcbExpiry}T23:59:59`).toISOString() : null });
    if (insuranceChecked) evidence.push({ kind: "liability-insurance", status: "confirmed", label: "Project owner recorded a liability insurance certificate", sourceUrl: null, checkedAtISO, expiresAtISO: insuranceExpiry ? new Date(`${insuranceExpiry}T23:59:59`).toISOString() : null });
    if (projectsChecked) evidence.push({ kind: "comparable-projects", status: "confirmed", label: "Project owner recorded comparable work and references", sourceUrl: null, checkedAtISO, expiresAtISO: null });
    if (reviewsChecked) evidence.push({ kind: "independent-reviews", status: "self-declared", label: "Independent review sources recorded for follow-up", sourceUrl: null, checkedAtISO, expiresAtISO: null });
    const subjectId = caseId();
    const profile: ContractorProfile = {
      id: subjectId,
      legalName: caseLegalName.trim(),
      displayName: displayName.trim() || caseLegalName.trim(),
      region: caseRegion.trim(),
      trades: [caseTrade],
      websiteUrl: website.trim() || null,
      demonstration: false,
      evidence,
    };
    try {
      const record = createDiscoveryRecord({
        id: `record-${subjectId}`,
        subjectId,
        access: "user-supplied",
        sourceLabel: "Entered and checked by project owner",
        sourceUrl: profile.websiteUrl,
        collectedAtISO: checkedAtISO,
        expiresAtISO: null,
        confidence: evidence.length ? "source-checked" : "unverified",
        data: profile,
      });
      await update((current) => upsertProjectDiscoveryRecord(current, "contractors", record, new Date()));
      setAdding(false); setCaseLegalName(""); setDisplayName(""); setWebsite("");
      setRegistryChecked(false); setWcbChecked(false); setInsuranceChecked(false); setProjectsChecked(false); setReviewsChecked(false); setWcbExpiry(""); setInsuranceExpiry("");
    } catch (error) { setProblem(error instanceof Error ? error.message : String(error)); }
  }

  async function toggleShortlist(profile: ContractorProfile, ready: boolean) {
    if (!project || profile.demonstration || !ready) return;
    setProblem(null);
    try {
      await update((current) => setProjectShortlist(current, "contractors", profile.id, !current.discovery.contractors.shortlist.includes(profile.id), new Date()));
    } catch (error) { setProblem(error instanceof Error ? error.message : String(error)); }
  }

  return (
    <>
      <Reveal y={12} className="mt-9">
        <div className="aura-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="aura-label">What this score means</p><p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/75">It measures evidence completeness, not quality and not Aura endorsement. Licence, WCB and insurance are mandatory gates. Reopen the exact sources before sending an RFQ or signing anything.</p></div>
            <button type="button" aria-pressed={demoMode} onClick={() => setDemoMode((value) => !value)} className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label">{demoMode ? "Return to project files" : "Open demonstration profiles"}</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <a href={REGISTRY} target="_blank" rel="noreferrer" className="rounded-md border aura-hairline p-4 text-xs leading-relaxed hover:border-aura-emerald"><span className="aura-label block">Official source</span><span className="mt-2 block">Alberta builder registry ↗</span></a>
            <a href={WCB} target="_blank" rel="noreferrer" className="rounded-md border aura-hairline p-4 text-xs leading-relaxed hover:border-aura-emerald"><span className="aura-label block">Official source</span><span className="mt-2 block">WCB clearance letters ↗</span></a>
            <a href={LICENCE} target="_blank" rel="noreferrer" className="rounded-md border aura-hairline p-4 text-xs leading-relaxed hover:border-aura-emerald"><span className="aura-label block">Official source</span><span className="mt-2 block">Service Alberta search ↗</span></a>
          </div>
        </div>
      </Reveal>

      <Reveal y={12} className="mt-7">
        <section className="aura-panel p-6 sm:p-7" aria-labelledby="contractor-search-heading">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="aura-label">{demoMode ? "Explicit demo mode" : "Your project evidence"}</p><h2 id="contractor-search-heading" className="mt-2 font-display text-xl font-medium">Build-team evidence desk</h2></div>{!demoMode ? <button type="button" onClick={() => setAdding((value) => !value)} className="rounded-md bg-aura-ink px-4 py-2 text-xs uppercase tracking-label text-aura-paper" disabled={!project}>{adding ? "Close case form" : "+ Add contractor"}</button> : <span className="rounded-full border border-aura-violet px-3 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">Fictional profiles</span>}</div>
          {!project && !demoMode ? <p className="mt-4 text-sm text-aura-text/65">Start a project to preserve contractor evidence, shortlists and RFQs in one portable file.</p> : null}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label><span className="aura-label mb-2 block">Trade</span><select value={trade} onChange={(event) => setTrade(event.target.value as "all" | Trade)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm"><option value="all">All trades</option>{(Object.keys(TRADE_LABELS) as Trade[]).map((id) => <option key={id} value={id}>{TRADE_LABELS[id]}</option>)}</select></label>
            <label><span className="aura-label mb-2 block">Region</span><select value={region} onChange={(event) => setRegion(event.target.value)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm"><option value="all">All saved regions</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span className="aura-label mb-2 block">Exact legal name to verify</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Name printed on the quote" className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm" /></label>
          </div>
          {legalName.trim() ? <div className="mt-5 rounded-md border aura-hairline p-4"><p className="text-sm font-medium">Verify “{legalName.trim()}” as an exact legal name</p><p className="mt-2 text-xs leading-relaxed text-aura-text/65">Search the same legal entity in each applicable official source. A similar name is not the same contractor.</p></div> : null}
        </section>
      </Reveal>

      {adding && !demoMode ? (
        <form className="contractor-case-form aura-panel mt-5" onSubmit={addCaseFile}>
          <div className="budget-section-head"><div><span>New</span><h2>Contractor case file</h2></div><p>User-supplied</p></div>
          <div className="contractor-case-fields">
            <label>Exact legal name<input value={caseLegalName} onChange={(event) => setCaseLegalName(event.target.value)} required /></label>
            <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" /></label>
            <label>Service region<input value={caseRegion} onChange={(event) => setCaseRegion(event.target.value)} required /></label>
            <label>Primary trade<select value={caseTrade} onChange={(event) => setCaseTrade(event.target.value as Trade)}>{(Object.keys(TRADE_LABELS) as Trade[]).map((id) => <option key={id} value={id}>{TRADE_LABELS[id]}</option>)}</select></label>
            <label>Website<input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" /></label>
          </div>
          <fieldset><legend>Evidence you personally checked</legend><p>These checks are saved as owner-supplied evidence, never as an Aura endorsement.</p><div className="contractor-evidence-checks">
            <label><input type="checkbox" checked={registryChecked} onChange={(event) => setRegistryChecked(event.target.checked)} />Exact legal name appears in the Alberta builder registry</label>
            <label><input type="checkbox" checked={wcbChecked} onChange={(event) => setWcbChecked(event.target.checked)} />Current WCB clearance recorded</label>
            <label>WCB expiry<input type="date" value={wcbExpiry} onChange={(event) => setWcbExpiry(event.target.value)} disabled={!wcbChecked} /></label>
            <label><input type="checkbox" checked={insuranceChecked} onChange={(event) => setInsuranceChecked(event.target.checked)} />Liability insurance certificate recorded</label>
            <label>Insurance expiry<input type="date" value={insuranceExpiry} onChange={(event) => setInsuranceExpiry(event.target.value)} disabled={!insuranceChecked} /></label>
            <label><input type="checkbox" checked={projectsChecked} onChange={(event) => setProjectsChecked(event.target.checked)} />Comparable projects and references recorded</label>
            <label><input type="checkbox" checked={reviewsChecked} onChange={(event) => setReviewsChecked(event.target.checked)} />Independent review sources recorded</label>
          </div></fieldset>
          <button type="submit">Save case file</button>
        </form>
      ) : null}

      {problem ? <p role="alert" className="mt-4 text-sm text-aura-violet">{problem}</p> : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        {profiles.map((result) => {
          const isReady = result.readiness === "shortlist-ready";
          const isSaved = shortlisted.has(result.profile.id);
          return <article key={result.profile.id} className="aura-panel aura-panel-lift h-full p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-base font-semibold">{result.profile.displayName}</p><p className="mt-1 text-xs text-aura-text/60">{result.profile.region}</p><p className={`mt-2 text-[0.62rem] uppercase tracking-label ${result.profile.demonstration ? "text-aura-violet" : "text-aura-emerald"}`}>{result.profile.demonstration ? "Fictional demonstration · not a referral" : "User-supplied project case file"}</p></div><div className="text-right"><p className="font-display text-2xl tabular-nums">{result.score}<span className="text-sm text-aura-text/45">/100</span></p><p className={`mt-1 text-[0.62rem] uppercase tracking-label ${isReady ? "text-aura-emerald" : "text-aura-violet"}`}>{READINESS_LABEL[result.readiness]}</p></div></div>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-aura-ink/10"><GrowBar pct={result.score} className={`h-full ${isReady ? "bg-aura-emerald" : "bg-aura-violet"}`} /></div>
            <div className="mt-4 flex flex-wrap gap-2">{result.profile.trades.map((item) => <span key={item} className="rounded-full border aura-hairline px-3 py-1 text-[0.62rem] uppercase tracking-label text-aura-text/60">{TRADE_LABELS[item]}</span>)}</div>
            <div className="mt-5 space-y-2">{result.contributions.map((item) => <div key={item.kind} className="flex items-start justify-between gap-4 border-b aura-hairline py-2.5 last:border-b-0"><div><p className="text-xs font-medium">{item.label}</p><p className={`mt-1 font-mono text-[0.58rem] uppercase tracking-label ${item.state === "confirmed" ? "text-aura-emerald" : item.state === "negative" || item.state === "expired" ? "text-aura-violet" : "text-aura-text/45"}`}>{item.state}</p></div><div className="flex shrink-0 items-center gap-3">{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[0.6rem] uppercase tracking-label text-aura-emerald underline underline-offset-4">Reopen</a> : null}<span className="font-mono text-[0.65rem] text-aura-text/55">+{item.points}/{item.possiblePoints}</span></div></div>)}</div>
            {result.blockers.length ? <div className="mt-5 rounded-md border border-aura-violet p-4"><p className="aura-label text-aura-violet">Before shortlisting</p><ul className="mt-2 space-y-1 text-xs leading-relaxed text-aura-text/70">{result.blockers.map((item) => <li key={item}>· {item}</li>)}</ul></div> : null}
            <button type="button" disabled={result.profile.demonstration || !isReady || !project} aria-pressed={isSaved} onClick={() => void toggleShortlist(result.profile, isReady)} className="mt-5 w-full rounded-md bg-aura-ink px-4 py-2.5 text-xs font-medium uppercase tracking-label text-aura-paper disabled:cursor-not-allowed disabled:opacity-40">{result.profile.demonstration ? "Demo profiles cannot be shortlisted" : !isReady ? "Complete mandatory evidence first" : isSaved ? "Saved to project shortlist" : "Add to project shortlist"}</button>
          </article>;
        })}
      </div>

      {profiles.length === 0 ? <div className="aura-panel mt-7 p-9 text-center"><h2 className="font-display text-xl font-medium">{demoMode ? "No demo profile matches those filters." : "No contractor case files yet."}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-aura-text/65">{demoMode ? "Change the trade or region without broadening the result silently." : "Add a real company from a quote, referral or registry search. Aura will preserve what you checked and what is still missing."}</p></div> : null}

      <RfqWorkbench />
    </>
  );
}

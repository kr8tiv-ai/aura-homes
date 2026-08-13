"use client";

import { useMemo, useState } from "react";
import { useAuraProject } from "@/components/project/ProjectContext";
import type { ContractorProfile } from "@/lib/marketplace/discovery";
import { projectBudgetForProject } from "@/lib/project/document";
import { projectDiscoveryRecords } from "@/lib/project/discoveryRecord";
import { createProjectRfq, validateProjectRfq, type ProjectRfq, type RfqScope } from "@/lib/project/rfq";

const SCOPE_LABELS: Record<RfqScope, string> = {
  "whole-home": "Whole home / general contracting",
  "site-foundation": "Site + foundation",
  "shell-envelope": "Shell + envelope",
  "mechanical-electrical-plumbing": "Mechanical, electrical + plumbing",
  "energy-water-waste": "Energy, water + wastewater",
  interiors: "Interiors + finishes",
};
const cad = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
const newId = () => typeof crypto !== "undefined" && crypto.randomUUID ? `rfq-${crypto.randomUUID()}` : `rfq-${Date.now().toString(36)}`;
const savedRfqs = (values: readonly unknown[]) => values.flatMap((value) => {
  const checked = validateProjectRfq(value);
  return checked.ok ? [checked.rfq] : [];
});

export default function RfqWorkbench() {
  const { project, update } = useAuraProject();
  const [scope, setScope] = useState<RfqScope>("whole-home");
  const [contractorId, setContractorId] = useState("");
  const [responseDue, setResponseDue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const records = useMemo(() => project ? projectDiscoveryRecords<ContractorProfile>(project, "contractors") : [], [project]);
  const contractorById = new Map(records.map((record) => [record.subjectId, record.data]));
  const shortlist = (project?.discovery.contractors.shortlist ?? []).map((id) => contractorById.get(id)).filter((item): item is ContractorProfile => !!item);
  const rfqs = savedRfqs(project?.delivery.rfqs ?? []);
  const budget = useMemo(() => project ? projectBudgetForProject(project) : null, [project]);

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !budget) { setProblem("Start a project before preparing an RFQ."); return; }
    setBusy(true); setProblem(null);
    try {
      const now = new Date();
      const rfq = createProjectRfq({
        id: newId(), project, budget, scope, contractorId: contractorId || null,
        responseDueISO: responseDue ? new Date(`${responseDue}T23:59:59`).toISOString() : null,
        createdAtISO: now.toISOString(),
      });
      await update((current) => ({ ...current, delivery: { ...current.delivery, rfqs: [...current.delivery.rfqs, rfq] }, updatedAtISO: now.toISOString() }));
    } catch (error) { setProblem(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  function download(rfq: ProjectRfq) {
    const blob = new Blob([JSON.stringify(rfq, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${rfq.projectId}-${rfq.scope}.aura-rfq.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="rfq-workbench">
      <div className="budget-lines-head"><div><p className="aura-label">Comparable procurement</p><h2>One scope. Same questions.</h2></div><p className="quote-workbench-intro">Send every bidder the same design hash, line-item basis, assumptions, exclusions and response template.</p></div>
      <div className="rfq-layout">
        <form className="aura-panel rfq-form" onSubmit={prepare}>
          <div className="budget-section-head"><div><span>A</span><h2>Prepare package</h2></div><p>Human sends it</p></div>
          <label>Scope<select value={scope} onChange={(event) => setScope(event.target.value as RfqScope)}>{(Object.keys(SCOPE_LABELS) as RfqScope[]).map((id) => <option key={id} value={id}>{SCOPE_LABELS[id]}</option>)}</select></label>
          <label>Intended contractor<select value={contractorId} onChange={(event) => setContractorId(event.target.value)}><option value="">Open package / not assigned</option>{shortlist.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.displayName}</option>)}</select></label>
          <label>Response due<input type="date" value={responseDue} onChange={(event) => setResponseDue(event.target.value)} /></label>
          {project ? <div className="rfq-basis"><span>Bound to</span><strong>{project.name}</strong><p>{project.design.documentHash.slice(0, 14)}… · {project.discovery.land.shortlist.length} saved land comparison{project.discovery.land.shortlist.length === 1 ? "" : "s"} · {shortlist.length} contractor{shortlist.length === 1 ? "" : "s"}</p></div> : null}
          {problem ? <p role="alert" className="quote-problem">{problem}</p> : null}
          <button type="submit" disabled={!project || busy}>{busy ? "Preparing…" : project ? "Prepare RFQ package" : "Start a project first"}</button>
        </form>
        <div className="rfq-results">
          <div className="budget-section-head"><div><span>B</span><h2>Prepared packages</h2></div><p>{rfqs.length} ready</p></div>
          {rfqs.length === 0 ? <div className="quote-empty"><strong>No RFQ package yet.</strong><p>Add evidence, build a shortlist, then create comparable scopes without contacting anyone automatically.</p></div> : rfqs.map((rfq) => (
            <article key={rfq.id} className="aura-panel rfq-card">
              <div><span>{SCOPE_LABELS[rfq.scope]}</span><strong>{cad(rfq.budgetBasis.planningMidCad)}</strong></div>
              <h3>{rfq.contractorId ? contractorById.get(rfq.contractorId)?.displayName ?? "Assigned contractor" : "Open package"}</h3>
              <p>{rfq.designSummary.floorAreaSqFt.toLocaleString("en-CA")} sq ft · {rfq.budgetLines.length} modelled scope{rfq.budgetLines.length === 1 ? "" : "s"} · {rfq.designHash.slice(0, 12)}…</p>
              <ul>{rfq.requestedInclusions.map((item) => <li key={item}>{item}</li>)}</ul>
              <div className="rfq-card-actions"><button type="button" onClick={() => download(rfq)}>Download JSON package</button><span>{rfq.canonicalHash.slice(0, 15)}…</span></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

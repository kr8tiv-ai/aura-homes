"use client";

import { useMemo, useState } from "react";
import type { ProjectBudget } from "@/lib/builder/projectBudget";
import {
  evidenceFromFile,
  PROJECT_QUOTE_FORMAT,
  PROJECT_QUOTE_VERSION,
  projectQuotesFromUnknown,
  reconcileProjectQuote,
  validateProjectQuote,
  type ProjectQuoteLine,
  type QuoteEvidence,
} from "@/lib/project/quoteReconciliation";
import { useAuraProject } from "./ProjectContext";

const cad = (value: number) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD", maximumFractionDigits: 0,
}).format(value);
const id = (prefix: string) => typeof crypto !== "undefined" && crypto.randomUUID
  ? `${prefix}-${crypto.randomUUID()}`
  : `${prefix}-${Date.now().toString(36)}`;
const blankLine = (): ProjectQuoteLine => ({ id: id("line"), budgetLineId: null, description: "", amountCad: 0, allowance: false });

export default function QuoteWorkbench({ budget }: { budget: ProjectBudget }) {
  const { project, update } = useAuraProject();
  const [vendor, setVendor] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ProjectQuoteLine[]>([blankLine()]);
  const [evidence, setEvidence] = useState<QuoteEvidence | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const quotes = useMemo(() => projectQuotesFromUnknown(project?.delivery.quotes ?? []), [project?.delivery.quotes]);
  const reconciled = useMemo(
    () => quotes.map((quote) => reconcileProjectQuote(budget, quote, new Date().toISOString())),
    [budget, quotes],
  );

  function changeLine(lineId: string, change: Partial<ProjectQuoteLine>) {
    setLines((current) => current.map((line) => line.id === lineId ? { ...line, ...change } : line));
  }

  async function chooseEvidence(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    try { setEvidence(await evidenceFromFile(file)); }
    catch (error) { setProblem(error instanceof Error ? error.message : String(error)); }
  }

  async function saveQuote(event: React.FormEvent) {
    event.preventDefault();
    if (!project) { setProblem("Start a project before saving a quote."); return; }
    setSaving(true);
    setProblem(null);
    const now = new Date();
    const checked = validateProjectQuote({
      format: PROJECT_QUOTE_FORMAT,
      version: PROJECT_QUOTE_VERSION,
      id: id("quote"),
      vendorName: vendor,
      capturedAtISO: now.toISOString(),
      validUntilISO: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
      currency: "CAD",
      designHash: budget.designHash,
      modelTotalMidCad: budget.total.mid,
      evidence,
      notes,
      lines,
    });
    if (!checked.ok) { setProblem(checked.problem); setSaving(false); return; }
    try {
      await update((current) => ({
        ...current,
        delivery: { ...current.delivery, quotes: [...current.delivery.quotes, checked.quote] },
        updatedAtISO: now.toISOString(),
      }));
      setVendor(""); setValidUntil(""); setNotes(""); setLines([blankLine()]); setEvidence(null);
    } catch (error) { setProblem(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  return (
    <section className="quote-workbench">
      <div className="budget-lines-head">
        <div><p className="aura-label">04 · Real quotes</p><h2>Reconcile, don’t replace.</h2></div>
        <p className="quote-workbench-intro">Map each vendor line to the Aura scope it covers. Missing work, allowances and stale dates remain visible.</p>
      </div>

      <div className="quote-layout">
        <form className="quote-capture aura-panel" onSubmit={saveQuote}>
          <div className="budget-section-head"><div><span>A</span><h2>Add a quote</h2></div><p>Saved locally</p></div>
          <div className="quote-meta">
            <label>Vendor or contractor<input value={vendor} onChange={(event) => setVendor(event.target.value)} required /></label>
            <label>Valid until<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
          </div>
          <div className="quote-line-head"><span>Quote lines</span><button type="button" onClick={() => setLines((current) => [...current, blankLine()])}>+ Add line</button></div>
          <div className="quote-lines">
            {lines.map((line, index) => (
              <fieldset key={line.id}>
                <legend>Line {index + 1}</legend>
                <label>Description<input value={line.description} onChange={(event) => changeLine(line.id, { description: event.target.value })} required /></label>
                <label>Amount CAD<input type="number" min="0" step="0.01" value={line.amountCad || ""} onChange={(event) => changeLine(line.id, { amountCad: Number(event.target.value) })} required /></label>
                <label>Aura scope<select value={line.budgetLineId ?? ""} onChange={(event) => changeLine(line.id, { budgetLineId: event.target.value || null })}>
                  <option value="">Not mapped yet</option>
                  {budget.lines.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}
                </select></label>
                <label className="quote-checkbox"><input type="checkbox" checked={line.allowance} onChange={(event) => changeLine(line.id, { allowance: event.target.checked })} />Allowance, not fixed</label>
                {lines.length > 1 ? <button type="button" className="quote-remove" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove line</button> : null}
              </fieldset>
            ))}
          </div>
          <label className="quote-notes">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Exclusions, taxes, freight, deposit terms…" /></label>
          <label className="quote-file">Original quote file<input type="file" accept=".pdf,.json,.txt,image/*" onChange={(event) => void chooseEvidence(event.target.files?.[0])} /><span>{evidence ? `${evidence.name} · SHA-256 ${evidence.sha256.slice(0, 12)}…` : "PDF, JSON, text or image · 5 MB maximum"}</span></label>
          {problem ? <p className="quote-problem" role="alert">{problem}</p> : null}
          <button className="quote-save" type="submit" disabled={saving || !project}>{saving ? "Saving quote…" : project ? "Save and reconcile" : "Start a project to save"}</button>
        </form>

        <div className="quote-results">
          <div className="budget-section-head"><div><span>B</span><h2>Saved comparisons</h2></div><p>{reconciled.length} quote{reconciled.length === 1 ? "" : "s"}</p></div>
          {reconciled.length === 0 ? <div className="quote-empty"><strong>No supplier evidence yet.</strong><p>Add the first quote without pretending it covers the whole build. Aura will compare only the scopes you map.</p></div> : reconciled.map((result) => (
            <article key={result.quote.id} className="quote-result aura-panel">
              <div className="quote-result-head"><div><span>{result.stale ? "Expired quote" : "Captured quote"}</span><h3>{result.quote.vendorName}</h3></div><strong>{cad(result.quotedTotalCad)}</strong></div>
              <div className="quote-result-flags">
                {result.designChanged ? <span className="is-risk">Design changed after quote</span> : <span>Matches current design</span>}
                {result.unmappedLines.length ? <span className="is-risk">{result.unmappedLines.length} unmapped</span> : null}
                {result.allowances.length ? <span>{result.allowances.length} allowance{result.allowances.length === 1 ? "" : "s"}</span> : null}
              </div>
              <dl>
                <div><dt>Aura midpoint for covered scopes</dt><dd>{cad(result.modelCoveredMidCad)}</dd></div>
                <div><dt>Variance</dt><dd>{result.varianceCad >= 0 ? "+" : ""}{cad(result.varianceCad)}{result.variancePct !== null ? ` · ${result.variancePct}%` : ""}</dd></div>
                <div><dt>Uncovered Aura scopes</dt><dd>{result.omittedBudgetLineIds.length}</dd></div>
              </dl>
              {result.quote.notes ? <p>{result.quote.notes}</p> : null}
              {result.quote.evidence ? <a href={result.quote.evidence.dataUrl} download={result.quote.evidence.name}>Download original · {result.quote.evidence.sha256.slice(0, 12)}…</a> : <span className="quote-no-file">No original file attached</span>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

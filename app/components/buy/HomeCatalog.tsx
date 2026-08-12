"use client";

/* The catalog: filters, cards, compare, and the project wiring.

   Client component because filtering, comparing and project state are all
   interaction. The models themselves are static data mapped from the
   research record — this file only decides what is visible and forwards
   save / request-quote intents into the AuraProject document through the
   helpers in lib/marketplace/homeModels. */

import { useMemo, useState } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { useAuraProject } from "@/components/project/ProjectContext";
import HomeCard from "./HomeCard";
import CompareDrawer from "./CompareDrawer";
import {
  CONSTRUCTION_LABELS,
  DEFAULT_FILTERS,
  FINISHED_HOME_MODELS,
  REGION_LABELS,
  filterHomes,
  hiddenForMissingData,
  homeProjectState,
  toggleCompare,
  withHomeQuoteRequested,
  withHomeSaved,
  type BedroomsFilter,
  type CatalogFilters,
  COMPARE_LIMIT,
  type FinishedHomeModel,
  type HomeConstructionType,
  type PriceFilter,
  type SizeBand,
  type TargetRegion,
} from "@/lib/marketplace/homeModels";
import type { ManufacturerInquiry } from "@/lib/project/manufacturerInquiry";

const DESTINATION_OPTIONS: Array<{ id: TargetRegion; label: string }> = [
  { id: "any", label: "Anywhere" },
  ...(Object.keys(REGION_LABELS) as Array<keyof typeof REGION_LABELS>).map((id) => ({
    id: id as TargetRegion,
    label: REGION_LABELS[id],
  })),
];

const SIZE_OPTIONS: Array<{ id: SizeBand; label: string }> = [
  { id: "any", label: "Any size" },
  { id: "under-500", label: "Under 500 sq ft" },
  { id: "500-1500", label: "500–1,500 sq ft" },
  { id: "over-1500", label: "Over 1,500 sq ft" },
];

const BEDROOM_OPTIONS: Array<{ id: BedroomsFilter; label: string }> = [
  { id: "any", label: "Any bedrooms" },
  { id: "1", label: "1 bedroom" },
  { id: "2", label: "2 bedrooms" },
  { id: "3-plus", label: "3 or more" },
];

const CONSTRUCTION_OPTIONS: Array<{ id: "any" | HomeConstructionType; label: string }> = [
  { id: "any", label: "Any construction" },
  ...(Object.keys(CONSTRUCTION_LABELS) as HomeConstructionType[]).map((id) => ({
    id,
    label: CONSTRUCTION_LABELS[id],
  })),
];

const PRICE_OPTIONS: Array<{ id: PriceFilter; label: string }> = [
  { id: "any", label: "Any price state" },
  { id: "published", label: "Published price" },
  { id: "quote-required", label: "Quote required" },
];

const SELECT_CLASS =
  "min-h-11 w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm";

export default function HomeCatalog() {
  const { project, update } = useAuraProject();
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyHomeId, setBusyHomeId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const shown = useMemo(() => filterHomes(FINISHED_HOME_MODELS, filters), [filters]);
  const hiddenCount = useMemo(
    () => hiddenForMissingData(FINISHED_HOME_MODELS, filters),
    [filters],
  );
  const compared = useMemo(
    () => compareIds.flatMap((id) => FINISHED_HOME_MODELS.filter((home) => home.id === id)),
    [compareIds],
  );

  function setFilter<K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function saveHome(home: FinishedHomeModel) {
    if (!project) return;
    const selected = !project.discovery.manufacturers.shortlist.includes(home.id);
    setBusyHomeId(home.id);
    setProblem(null);
    try {
      await update((current) => withHomeSaved(current, home, selected, new Date()));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyHomeId(null);
    }
  }

  async function requestQuote(home: FinishedHomeModel) {
    if (!project) return;
    setBusyHomeId(home.id);
    setProblem(null);
    try {
      await update((current) =>
        withHomeQuoteRequested(current, home, filters.destination, new Date()),
      );
      setExpandedId(home.id);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyHomeId(null);
    }
  }

  function downloadInquiry(inquiry: ManufacturerInquiry) {
    const blob = new Blob([JSON.stringify(inquiry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${inquiry.projectId}-${inquiry.providerSubjectId}.aura-inquiry.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      {/* ------------------------------------------------------------ filters */}
      <Reveal y={10} className="mt-12">
        <div className="aura-panel p-6 sm:p-7">
          <p className="aura-label">Narrow the catalog</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label>
              <span className="aura-label mb-2 block">Destination</span>
              <select
                value={filters.destination}
                onChange={(event) => setFilter("destination", event.target.value as TargetRegion)}
                className={SELECT_CLASS}
              >
                {DESTINATION_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="aura-label mb-2 block">Size</span>
              <select
                value={filters.size}
                onChange={(event) => setFilter("size", event.target.value as SizeBand)}
                className={SELECT_CLASS}
              >
                {SIZE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="aura-label mb-2 block">Bedrooms</span>
              <select
                value={filters.bedrooms}
                onChange={(event) => setFilter("bedrooms", event.target.value as BedroomsFilter)}
                className={SELECT_CLASS}
              >
                {BEDROOM_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="aura-label mb-2 block">Construction</span>
              <select
                value={filters.construction}
                onChange={(event) =>
                  setFilter("construction", event.target.value as "any" | HomeConstructionType)
                }
                className={SELECT_CLASS}
              >
                {CONSTRUCTION_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="aura-label mb-2 block">Price</span>
              <select
                value={filters.price}
                onChange={(event) => setFilter("price", event.target.value as PriceFilter)}
                className={SELECT_CLASS}
              >
                {PRICE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          {hiddenCount > 0 ? (
            <p className="mt-4 text-xs leading-relaxed text-aura-dim">
              {hiddenCount} home{hiddenCount === 1 ? "" : "s"} hidden by this filter only because
              the research record holds no size or bedroom figure — the maker would have to answer
              that question.
            </p>
          ) : null}
        </div>
      </Reveal>

      {problem ? (
        <p role="alert" className="mt-5 rounded-md border border-aura-violet px-4 py-3 text-sm text-aura-violet">
          {problem}
        </p>
      ) : null}

      {/* -------------------------------------------------------------- cards */}
      {shown.length > 0 ? (
        <Stagger className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((home) => {
            const state = homeProjectState(project, home);
            return (
              <StaggerItem key={home.id} className="h-full">
                <HomeCard
                  home={home}
                  destination={filters.destination}
                  expanded={expandedId === home.id}
                  onView={() => setExpandedId((current) => (current === home.id ? null : home.id))}
                  projectState={{
                    ...state,
                    busy: busyHomeId === home.id,
                    onSave: () => void saveHome(home),
                    onRequestQuote: () => void requestQuote(home),
                    onDownloadInquiry: state.latestInquiry
                      ? () => downloadInquiry(state.latestInquiry as ManufacturerInquiry)
                      : undefined,
                  }}
                  compare={{
                    selected: compareIds.includes(home.id),
                    full: compareIds.length >= COMPARE_LIMIT,
                    onToggle: () => setCompareIds((current) => toggleCompare(current, home.id)),
                  }}
                />
              </StaggerItem>
            );
          })}
        </Stagger>
      ) : (
        <Reveal y={12} className="mt-8">
          <div className="aura-panel p-8">
            <p className="aura-label mb-2">No homes match, and that is the finding</p>
            <p className="max-w-2xl text-sm leading-relaxed text-aura-text/75">
              Nothing in the research record fits those filters. Loosen one, or read the legacy
              research below to see what was checked. Aura does not pad a thin catalog with
              listings the evidence cannot support.
            </p>
          </div>
        </Reveal>
      )}

      <CompareDrawer
        homes={compared}
        onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))}
        onClear={() => setCompareIds([])}
      />
    </>
  );
}

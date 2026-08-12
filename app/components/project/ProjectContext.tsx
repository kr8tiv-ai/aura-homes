"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { withProjectDesign, type AuraProject } from "@/lib/project/document";
import type { BuilderDocument } from "@/lib/builder/document";
import { readActiveAuraProject, saveAuraProject } from "@/lib/project/store";

interface ProjectContextValue {
  project: AuraProject | null;
  ready: boolean;
  problem: string | null;
  save: (project: AuraProject) => Promise<void>;
  update: (change: (project: AuraProject) => AuraProject) => Promise<void>;
  syncDesign: (document: BuilderDocument) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function AuraProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<AuraProject | null>(null);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const currentProject = useRef<AuraProject | null>(null);

  useEffect(() => {
    let live = true;
    void readActiveAuraProject().then(
      (value) => {
        if (!live) return;
        currentProject.current = value;
        setProject(value);
        setReady(true);
      },
      (error) => {
        if (!live) return;
        setProblem(error instanceof Error ? error.message : String(error));
        setReady(true);
      },
    );
    return () => { live = false; };
  }, []);

  const save = useCallback(async (value: AuraProject) => {
    const saved = await saveAuraProject(value, true);
    currentProject.current = saved;
    setProject(saved);
    setProblem(null);
  }, []);

  const update = useCallback(async (change: (value: AuraProject) => AuraProject) => {
    if (!currentProject.current) throw new Error("Start or open a project before changing project-wide details.");
    await save(change(currentProject.current));
  }, [save]);

  const syncDesign = useCallback(async (document: BuilderDocument) => {
    const active = currentProject.current;
    if (!active) return;
    const next = withProjectDesign(active, document, new Date());
    if (next.design.documentHash === active.design.documentHash) return;
    await save(next);
  }, [save]);

  const value = useMemo(
    () => ({ project, ready, problem, save, update, syncDesign }),
    [problem, project, ready, save, syncDesign, update],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useAuraProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useAuraProject must be used inside AuraProjectProvider.");
  return value;
}

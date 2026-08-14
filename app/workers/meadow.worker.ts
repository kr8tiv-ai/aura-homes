/// <reference lib="webworker" />

import { createMeadowSchedule, type MeadowPlan, type MeadowPageTask } from "@/lib/three/meadow/contract";
import { buildMeadowPage, meadowTransferList } from "@/lib/three/meadow/generator";

type StartMessage = { type: "start"; runId: string; plan: MeadowPlan };
type AckMessage = { type: "ack"; runId: string };
type CancelMessage = { type: "cancel"; runId: string };
type IncomingMessage = StartMessage | AckMessage | CancelMessage;

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let activeRunId: string | null = null;
let schedule: MeadowPageTask[] = [];
let cursor = 0;

function postNextPage(): void {
  if (!activeRunId) return;
  const task = schedule[cursor];
  if (!task) {
    workerScope.postMessage({ type: "done", runId: activeRunId });
    activeRunId = null;
    return;
  }

  const startedAt = performance.now();
  const page = buildMeadowPage(task);
  cursor += 1;
  const transfer = meadowTransferList(page);
  workerScope.postMessage(
    { type: "page", runId: activeRunId, page, workerMs: performance.now() - startedAt },
    transfer,
  );
}

workerScope.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  if (message.type === "start") {
    activeRunId = message.runId;
    schedule = createMeadowSchedule(message.plan);
    cursor = 0;
    postNextPage();
    return;
  }

  if (message.type === "cancel") {
    if (message.runId === activeRunId) activeRunId = null;
    return;
  }

  if (message.runId === activeRunId) postNextPage();
};

export {};

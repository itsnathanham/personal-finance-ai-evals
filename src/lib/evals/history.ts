import type { RunSummaryMetrics } from "@/lib/models/pricing";

export type HistoryRunSummary = {
  id: string;
  status: string;
  suiteIds: string[];
  modelIds: string[];
  totalCases: number;
  completedCases: number;
  passedCases: number;
  failedCases: number;
  errorCases: number;
  currentLabel: string | null;
  passRate: number | null;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  summary?: RunSummaryMetrics | null;
};

export type HistoryCaseResult = {
  id: string;
  suiteId: string;
  caseId: string;
  description: string;
  modelId: string;
  prompt: string;
  output: string | null;
  toolsUsed: string[];
  pass: boolean;
  failReasons: string[];
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
};

export type HistoryEntry = {
  run: HistoryRunSummary;
  cases: HistoryCaseResult[];
};

const HISTORY_KEY_V2 = "hfc_eval_history_v2";
const HISTORY_KEY_V1 = "hfc_eval_history_v1";
const HISTORY_CAP = 80;

function parseEntries(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Load eval history from localStorage (v2), migrating sessionStorage v1 once. */
export function loadEvalHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];

  const fromV2 = parseEntries(localStorage.getItem(HISTORY_KEY_V2));
  if (fromV2.length > 0) return fromV2;

  const fromSession = parseEntries(sessionStorage.getItem(HISTORY_KEY_V1));
  if (fromSession.length > 0) {
    saveEvalHistory(fromSession);
    sessionStorage.removeItem(HISTORY_KEY_V1);
    return fromSession;
  }

  return [];
}

export function saveEvalHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    HISTORY_KEY_V2,
    JSON.stringify(entries.slice(0, HISTORY_CAP)),
  );
}

export function upsertEvalHistoryEntry(entry: HistoryEntry) {
  const history = loadEvalHistory().filter((e) => e.run.id !== entry.run.id);
  history.unshift(entry);
  saveEvalHistory(history);
  sessionStorage.setItem(
    `hfc_eval_run_${entry.run.id}`,
    JSON.stringify(entry),
  );
}

export function mergeRunSummaries(
  serverRuns: HistoryRunSummary[],
): HistoryRunSummary[] {
  const local = loadEvalHistory().map((e) => e.run);
  const byId = new Map<string, HistoryRunSummary>();
  for (const r of [...local, ...serverRuns]) byId.set(r.id, r);
  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

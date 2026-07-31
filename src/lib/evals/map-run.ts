import type { listPersistedRuns } from "@/lib/evals/job-runner";

type PersistedRun = Awaited<ReturnType<typeof listPersistedRuns>>[number];

export function mapPersistedRun(r: PersistedRun) {
  return {
    id: r.id,
    status: r.status,
    suiteIds: JSON.parse(r.suiteIdsJson) as string[],
    modelIds: JSON.parse(r.modelIdsJson) as string[],
    totalCases: r.totalCases,
    completedCases: r.completedCases,
    passedCases: r.passedCases,
    failedCases: r.failedCases,
    errorCases: r.errorCases,
    currentLabel: r.currentLabel,
    summary: r.summaryJson ? JSON.parse(r.summaryJson) : null,
    errorMessage: r.errorMessage,
    startedAt:
      r.startedAt instanceof Date
        ? r.startedAt.toISOString()
        : String(r.startedAt),
    finishedAt: r.finishedAt
      ? r.finishedAt instanceof Date
        ? r.finishedAt.toISOString()
        : String(r.finishedAt)
      : null,
    passRate:
      r.completedCases > 0
        ? Number(((r.passedCases / r.completedCases) * 100).toFixed(1))
        : null,
  };
}

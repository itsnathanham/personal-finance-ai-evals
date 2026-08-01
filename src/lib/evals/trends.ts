import type { ModelRunStats, RunSummaryMetrics } from "@/lib/models/pricing";
import type { HistoryRunSummary } from "@/lib/evals/history";
import type { SuiteId } from "@/lib/evals/load-suites";

export type SuiteFilter = "all" | SuiteId;

export type TrendPoint = {
  at: string;
  runId: string;
  passRate: number;
  failRate: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
  total: number;
};

export type TrendSeries = {
  modelId: string;
  points: TrendPoint[];
};

export type TrendKpis = {
  pointCount: number;
  runCount: number;
  avgPassRate: number | null;
  avgFailRate: number | null;
  totalEstimatedCostUsd: number;
  avgLatencyMs: number | null;
};

function statsForFilter(
  run: HistoryRunSummary,
  modelId: string,
  suite: SuiteFilter,
): ModelRunStats | null {
  const summary = run.summary;
  if (!summary) return null;

  if (suite === "all") {
    return summary.perModel[modelId] ?? null;
  }

  const nested = summary.perModelSuite?.[modelId]?.[suite];
  if (nested) return nested;

  // Legacy summaries without perModelSuite: only usable for suite=all
  return null;
}

function withFailRate(stats: ModelRunStats): ModelRunStats {
  if (typeof stats.failRate === "number") return stats;
  const failRate =
    stats.total === 0
      ? 0
      : Number((((stats.total - stats.passed) / stats.total) * 100).toFixed(1));
  return { ...stats, failRate };
}

/**
 * Build one time series per selected model from historical runs.
 * Suite filter uses perModelSuite when present.
 */
export function buildTrendSeries(
  runs: HistoryRunSummary[],
  options: { modelIds: string[]; suite: SuiteFilter },
): { series: TrendSeries[]; kpis: TrendKpis; usedLegacyFallback: boolean } {
  const modelSet = new Set(options.modelIds);
  let usedLegacyFallback = false;

  const chronological = [...runs].sort(
    (a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  const byModel = new Map<string, TrendPoint[]>();

  for (const run of chronological) {
    if (run.status !== "completed") continue;
    for (const modelId of run.modelIds) {
      if (!modelSet.has(modelId)) continue;

      let stats = statsForFilter(run, modelId, options.suite);
      if (!stats) {
        if (options.suite !== "all" && run.summary?.perModel?.[modelId]) {
          usedLegacyFallback = true;
        }
        continue;
      }
      stats = withFailRate(stats);
      if (stats.total === 0) continue;

      const points = byModel.get(modelId) ?? [];
      points.push({
        at: run.startedAt,
        runId: run.id,
        passRate: stats.passRate,
        failRate: stats.failRate,
        estimatedCostUsd: stats.estimatedCostUsd,
        avgLatencyMs: stats.avgLatencyMs,
        total: stats.total,
      });
      byModel.set(modelId, points);
    }
  }

  const series: TrendSeries[] = options.modelIds
    .filter((id) => byModel.has(id))
    .map((modelId) => ({
      modelId,
      points: byModel.get(modelId)!,
    }));

  const allPoints = series.flatMap((s) => s.points);
  const runIds = new Set(allPoints.map((p) => p.runId));

  const kpis: TrendKpis = {
    pointCount: allPoints.length,
    runCount: runIds.size,
    avgPassRate:
      allPoints.length === 0
        ? null
        : Number(
            (
              allPoints.reduce((n, p) => n + p.passRate, 0) / allPoints.length
            ).toFixed(1),
          ),
    avgFailRate:
      allPoints.length === 0
        ? null
        : Number(
            (
              allPoints.reduce((n, p) => n + p.failRate, 0) / allPoints.length
            ).toFixed(1),
          ),
    totalEstimatedCostUsd: Number(
      allPoints
        .reduce((n, p) => n + p.estimatedCostUsd, 0)
        .toFixed(6),
    ),
    avgLatencyMs:
      allPoints.length === 0
        ? null
        : Math.round(
            allPoints.reduce((n, p) => n + p.avgLatencyMs, 0) /
              allPoints.length,
          ),
  };

  return { series, kpis, usedLegacyFallback };
}

/** Ensure summary shape is safe for trends UI (fills missing nested maps). */
export function normalizeSummary(
  summary: RunSummaryMetrics | null | undefined,
): RunSummaryMetrics | null {
  if (!summary) return null;
  return {
    ...summary,
    failRate:
      typeof summary.failRate === "number"
        ? summary.failRate
        : summary.passRate != null
          ? Number((100 - summary.passRate).toFixed(1))
          : 0,
    perModel: summary.perModel ?? {},
    perSuite: summary.perSuite ?? {},
    perModelSuite: summary.perModelSuite ?? {},
  };
}

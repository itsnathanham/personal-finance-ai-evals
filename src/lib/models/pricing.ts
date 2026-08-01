import { getModelDefinition } from "@/lib/models/registry";

/** Anthropic list prices ($ per million tokens). Cache/batch discounts ignored. */
export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
};

/** Sonnet 5 intro pricing through 2026-08-31; then $3 / $15. */
const SONNET_5_INTRO_ENDS = Date.UTC(2026, 7, 31, 23, 59, 59, 999);

export function pricingForModel(modelId: string, at = Date.now()): ModelPricing | null {
  const def = getModelDefinition(modelId);
  if (!def) return null;

  if (modelId === "claude-sonnet-5" && at <= SONNET_5_INTRO_ENDS) {
    return { inputPerMTok: 2, outputPerMTok: 10 };
  }

  return {
    inputPerMTok: def.inputPerMTok,
    outputPerMTok: def.outputPerMTok,
  };
}

export function estimateCostUsd(
  modelId: string,
  usage: { inputTokens?: number | null; outputTokens?: number | null },
  at = Date.now(),
): number | null {
  const pricing = pricingForModel(modelId, at);
  if (!pricing) return null;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  if (input === 0 && output === 0) return 0;
  return (
    (input / 1_000_000) * pricing.inputPerMTok +
    (output / 1_000_000) * pricing.outputPerMTok
  );
}

export function roundCostUsd(value: number): number {
  return Number(value.toFixed(6));
}

export type ModelRunStats = {
  passed: number;
  total: number;
  passRate: number;
  failRate: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
};

export type RunSummaryMetrics = {
  passRate: number;
  failRate: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  perModel: Record<string, ModelRunStats>;
  perSuite: Record<string, ModelRunStats>;
  perModelSuite: Record<string, Record<string, ModelRunStats>>;
};

type AccBucket = {
  passed: number;
  total: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalLatencyMs: number;
  latencyCount: number;
};

function emptyBucket(): AccBucket {
  return {
    passed: 0,
    total: 0,
    estimatedCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalLatencyMs: 0,
    latencyCount: 0,
  };
}

function addToBucket(
  bucket: AccBucket,
  row: {
    pass: boolean;
    latencyMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCostUsd?: number | null;
  },
) {
  bucket.total += 1;
  if (row.pass) bucket.passed += 1;
  bucket.estimatedCostUsd += row.estimatedCostUsd ?? 0;
  bucket.inputTokens += row.inputTokens ?? 0;
  bucket.outputTokens += row.outputTokens ?? 0;
  if (row.latencyMs != null) {
    bucket.totalLatencyMs += row.latencyMs;
    bucket.latencyCount += 1;
  }
}

function finalizeBucket(v: AccBucket): ModelRunStats {
  const passRate =
    v.total === 0 ? 0 : Number(((v.passed / v.total) * 100).toFixed(1));
  const failRate =
    v.total === 0
      ? 0
      : Number((((v.total - v.passed) / v.total) * 100).toFixed(1));
  return {
    passed: v.passed,
    total: v.total,
    passRate,
    failRate,
    estimatedCostUsd: roundCostUsd(v.estimatedCostUsd),
    inputTokens: v.inputTokens,
    outputTokens: v.outputTokens,
    totalLatencyMs: v.totalLatencyMs,
    avgLatencyMs:
      v.latencyCount === 0
        ? 0
        : Math.round(v.totalLatencyMs / v.latencyCount),
  };
}

export function buildRunSummary(
  results: Array<{
    modelId: string;
    suiteId?: string | null;
    pass: boolean;
    latencyMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCostUsd?: number | null;
  }>,
): RunSummaryMetrics {
  const completed = results.length;
  const passed = results.filter((r) => r.pass).length;
  const passRate =
    completed === 0 ? 0 : Number(((passed / completed) * 100).toFixed(1));
  const failRate =
    completed === 0
      ? 0
      : Number((((completed - passed) / completed) * 100).toFixed(1));

  let estimatedCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalLatencyMs = 0;
  let latencyCount = 0;

  const perModel: Record<string, AccBucket> = {};
  const perSuite: Record<string, AccBucket> = {};
  const perModelSuite: Record<string, Record<string, AccBucket>> = {};

  for (const row of results) {
    estimatedCostUsd += row.estimatedCostUsd ?? 0;
    inputTokens += row.inputTokens ?? 0;
    outputTokens += row.outputTokens ?? 0;
    if (row.latencyMs != null) {
      totalLatencyMs += row.latencyMs;
      latencyCount += 1;
    }

    const modelBucket = perModel[row.modelId] ?? emptyBucket();
    addToBucket(modelBucket, row);
    perModel[row.modelId] = modelBucket;

    const suiteId = row.suiteId?.trim();
    if (suiteId) {
      const suiteBucket = perSuite[suiteId] ?? emptyBucket();
      addToBucket(suiteBucket, row);
      perSuite[suiteId] = suiteBucket;

      const bySuite = perModelSuite[row.modelId] ?? {};
      const msBucket = bySuite[suiteId] ?? emptyBucket();
      addToBucket(msBucket, row);
      bySuite[suiteId] = msBucket;
      perModelSuite[row.modelId] = bySuite;
    }
  }

  return {
    passRate,
    failRate,
    estimatedCostUsd: roundCostUsd(estimatedCostUsd),
    inputTokens,
    outputTokens,
    totalLatencyMs,
    avgLatencyMs:
      latencyCount === 0 ? 0 : Math.round(totalLatencyMs / latencyCount),
    perModel: Object.fromEntries(
      Object.entries(perModel).map(([id, v]) => [id, finalizeBucket(v)]),
    ),
    perSuite: Object.fromEntries(
      Object.entries(perSuite).map(([id, v]) => [id, finalizeBucket(v)]),
    ),
    perModelSuite: Object.fromEntries(
      Object.entries(perModelSuite).map(([modelId, suites]) => [
        modelId,
        Object.fromEntries(
          Object.entries(suites).map(([suiteId, v]) => [
            suiteId,
            finalizeBucket(v),
          ]),
        ),
      ]),
    ),
  };
}

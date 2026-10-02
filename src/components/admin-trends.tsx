"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatEstCost,
  formatLatency,
} from "@/lib/evals/format-metrics";
import {
  mergeRunSummaries,
  type HistoryRunSummary,
} from "@/lib/evals/history";
import {
  buildTrendSeries,
  normalizeSummary,
  type SuiteFilter,
} from "@/lib/evals/trends";
import {
  getModelLabel,
  getModelProvider,
  type ModelProvider,
} from "@/lib/models/registry";

const CHART_COLORS = ["#7ec8b0", "#e8a87c", "#8aa4d4", "#d4a5c9", "#c4d47a"];

type CatalogModels = Array<{
  id: string;
  label: string;
  provider?: ModelProvider;
  configured?: boolean;
  retired?: boolean;
}>;

type FilterModel = {
  id: string;
  label: string;
  provider: ModelProvider;
  configured: boolean;
  retired: boolean;
};

function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function providerTitle(provider: ModelProvider) {
  switch (provider) {
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "google":
      return "Google Gemini";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

function buildChartRows(
  series: ReturnType<typeof buildTrendSeries>["series"],
  metric: "passRate" | "failRate" | "estimatedCostUsd" | "avgLatencyMs",
) {
  const times = new Set<string>();
  for (const s of series) {
    for (const p of s.points) times.add(p.at);
  }
  const sorted = [...times].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  return sorted.map((at) => {
    const row: Record<string, string | number | null> = {
      at,
      label: shortTime(at),
    };
    for (const s of series) {
      const point = s.points.find((p) => p.at === at);
      row[s.modelId] = point ? point[metric] : null;
    }
    return row;
  });
}

function TrendChart({
  title,
  series,
  metric,
  yFormatter,
  labelFor,
}: {
  title: string;
  series: ReturnType<typeof buildTrendSeries>["series"];
  metric: "passRate" | "failRate" | "estimatedCostUsd" | "avgLatencyMs";
  yFormatter: (v: number) => string;
  labelFor: (modelId: string) => string;
}) {
  const data = useMemo(
    () => buildChartRows(series, metric),
    [series, metric],
  );

  if (series.every((s) => s.points.length === 0)) {
    return (
      <div className="trend-chart admin-card">
        <h3>{title}</h3>
        <p className="muted">No points for this filter.</p>
      </div>
    );
  }

  return (
    <div className="trend-chart admin-card">
      <h3>{title}</h3>
      <div className="trend-chart-body">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickFormatter={yFormatter}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--stroke)",
                borderRadius: 8,
              }}
              labelStyle={{ color: "var(--muted)" }}
              formatter={(value) =>
                typeof value === "number" ? yFormatter(value) : String(value ?? "—")
              }
            />
            <Legend />
            {series.map((s, i) => (
              <Line
                key={s.modelId}
                type="monotone"
                dataKey={s.modelId}
                name={labelFor(s.modelId)}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function modelsWithHistory(runs: HistoryRunSummary[]): Set<string> {
  const ids = new Set<string>();
  for (const run of runs) {
    for (const id of run.modelIds) ids.add(id);
    const perModel = run.summary?.perModel;
    if (perModel) {
      for (const id of Object.keys(perModel)) ids.add(id);
    }
  }
  return ids;
}

function buildFilterModels(
  catalog: CatalogModels,
  runs: HistoryRunSummary[],
): FilterModel[] {
  const byId = new Map<string, FilterModel>();

  for (const m of catalog) {
    const provider = m.provider ?? getModelProvider(m.id);
    if (!provider) continue;
    byId.set(m.id, {
      id: m.id,
      label: m.label,
      provider,
      configured: m.configured !== false,
      retired: Boolean(m.retired),
    });
  }

  for (const id of modelsWithHistory(runs)) {
    if (byId.has(id)) continue;
    const provider = getModelProvider(id);
    if (!provider) continue;
    byId.set(id, {
      id,
      label: getModelLabel(id),
      provider,
      configured: false,
      retired: true,
    });
  }

  const order: ModelProvider[] = ["anthropic", "openai", "google"];
  return [...byId.values()].sort((a, b) => {
    const pi = order.indexOf(a.provider) - order.indexOf(b.provider);
    if (pi !== 0) return pi;
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
}

function defaultSelectedModelIds(
  filterModels: FilterModel[],
  runs: HistoryRunSummary[],
): string[] {
  const historyIds = modelsWithHistory(runs);
  const fromHistory = filterModels
    .filter((m) => historyIds.has(m.id))
    .map((m) => m.id);
  if (fromHistory.length > 0) return fromHistory;

  const configured = filterModels
    .filter((m) => m.configured && !m.retired)
    .map((m) => m.id);
  if (configured.length > 0) return configured;

  return filterModels.filter((m) => !m.retired).map((m) => m.id);
}

export function AdminTrends({
  models,
  initialRuns = [],
}: {
  models: CatalogModels;
  initialRuns?: HistoryRunSummary[];
}) {
  const [runs, setRuns] = useState<HistoryRunSummary[]>([]);
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [suite, setSuite] = useState<SuiteFilter>("all");
  const [modelsOpen, setModelsOpen] = useState(true);
  const [defaultsReady, setDefaultsReady] = useState(false);

  useEffect(() => {
    const normalized = initialRuns.map((r) => ({
      ...r,
      summary: normalizeSummary(r.summary),
    }));
    const merged = mergeRunSummaries(normalized);
    setRuns(merged);
    const filterModels = buildFilterModels(models, merged);
    setModelIds(defaultSelectedModelIds(filterModels, merged));
    setDefaultsReady(true);
  }, [initialRuns, models]);

  const filterModels = useMemo(
    () => buildFilterModels(models, runs),
    [models, runs],
  );

  const selectedModels = useMemo(
    () => filterModels.filter((m) => modelIds.includes(m.id)),
    [filterModels, modelIds],
  );

  const selectedByProvider = useMemo(() => {
    const counts: Record<ModelProvider, number> = {
      anthropic: 0,
      openai: 0,
      google: 0,
    };
    for (const m of selectedModels) counts[m.provider] += 1;
    return counts;
  }, [selectedModels]);

  const { series, kpis, usedLegacyFallback } = useMemo(
    () =>
      buildTrendSeries(runs, {
        modelIds,
        suite,
      }),
    [runs, modelIds, suite],
  );

  const labelFor = (modelId: string) =>
    filterModels.find((m) => m.id === modelId)?.label ?? getModelLabel(modelId);

  function toggleModel(id: string) {
    setModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    setModelIds(filterModels.map((m) => m.id));
  }

  function selectNone() {
    setModelIds([]);
  }

  function selectWithHistory() {
    setModelIds(defaultSelectedModelIds(filterModels, runs));
  }

  const summaryBits = [
    `${selectedModels.length} selected`,
    selectedByProvider.anthropic
      ? `Anthropic ${selectedByProvider.anthropic}`
      : null,
    selectedByProvider.openai ? `OpenAI ${selectedByProvider.openai}` : null,
    selectedByProvider.google ? `Gemini ${selectedByProvider.google}` : null,
  ].filter(Boolean);

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="brand">Eval Trends</p>
          <p className="sub">
            Compare models over time on pass rate, fail rate, cost, and latency
          </p>
        </div>
        <div className="admin-top-actions">
          <Link href="/admin">Run evals</Link>
          <Link href="/">Copilot</Link>
        </div>
      </header>

      <section className="admin-card trends-filters">
        <div className="trends-filter-bar">
          <div className="trends-filter-main">
            <h2>Filters</h2>
            <p className="admin-help trends-filter-help">
              History is stored in this browser and merged with server runs.
              Retired models still appear when they have past data.
            </p>
          </div>
          <div className="filter-pills trends-suite-pills">
            {(
              [
                ["all", "All"],
                ["goldens", "Goldens"],
                ["policy", "Policy"],
                ["redteam", "Red team"],
                ["finance", "Promptfoo Finance"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={suite === id ? "active" : ""}
                onClick={() => setSuite(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="trends-models-summary">
          <button
            type="button"
            className="trends-models-toggle"
            aria-expanded={modelsOpen}
            onClick={() => setModelsOpen((open) => !open)}
          >
            <span>
              <strong>Models</strong>
              <em>{summaryBits.join(" · ")}</em>
            </span>
            <span className="trends-models-chevron" aria-hidden>
              <span className="trends-models-chevron-label">
                {modelsOpen ? "Collapse" : "Expand"}
              </span>
              <svg
                className="trends-models-chevron-icon"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {modelsOpen ? (
                  <path d="M3 10.5 8 5.5l5 5" />
                ) : (
                  <path d="M3 5.5 8 10.5l5-5" />
                )}
              </svg>
            </span>
          </button>
          {!modelsOpen && selectedModels.length > 0 && (
            <p className="trends-models-inline muted">
              {selectedModels.map((m) => m.label).join(" · ")}
            </p>
          )}
        </div>

        {modelsOpen && (
          <div className="trends-models-panel">
            <div className="trends-models-actions">
              <button type="button" onClick={selectWithHistory}>
                With history
              </button>
              <button type="button" onClick={selectAllVisible}>
                Select all
              </button>
              <button type="button" onClick={selectNone}>
                Clear
              </button>
            </div>
            <div className="trends-provider-columns">
              {(["anthropic", "openai", "google"] as const).map((provider) => {
                const group = filterModels.filter((m) => m.provider === provider);
                if (group.length === 0) return null;
                return (
                  <div key={provider} className="model-provider-block">
                    <h4>
                      {providerTitle(provider)}
                      <span className="model-provider-count">
                        {
                          group.filter((m) => modelIds.includes(m.id)).length
                        }
                        /{group.length}
                      </span>
                    </h4>
                    <div className="chip-grid chip-grid-compact chip-grid-columns">
                      {group.map((model) => (
                        <label
                          key={model.id}
                          className={[
                            "chip",
                            model.configured === false || model.retired
                              ? "chip-muted"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={model.id}
                        >
                          <input
                            type="checkbox"
                            checked={modelIds.includes(model.id)}
                            onChange={() => toggleModel(model.id)}
                          />
                          <span>
                            <strong>{model.label}</strong>
                            {model.retired ? <em>retired · history</em> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {usedLegacyFallback && suite !== "all" && (
          <p className="muted trends-note">
            Some older runs lack per-suite breakdowns and are omitted from this
            suite filter. Re-run evals to include them.
          </p>
        )}
      </section>

      {!defaultsReady ? (
        <section className="admin-card">
          <p className="muted">Loading trends…</p>
        </section>
      ) : runs.length === 0 ? (
        <section className="admin-card">
          <p className="muted">
            No eval history yet.{" "}
            <Link href="/admin">Run evals</Link> a few times, then return here
            to see trends.
          </p>
        </section>
      ) : modelIds.length === 0 ? (
        <section className="admin-card">
          <p className="muted">Select at least one model to plot.</p>
        </section>
      ) : kpis.pointCount === 0 ? (
        <section className="admin-card">
          <p className="muted">
            No matching points for this filter. Try suite = All or run more
            evals with the selected models.
          </p>
        </section>
      ) : (
        <>
          <div className="metric-row">
            <div className="metric">
              <span>Avg pass</span>
              <strong>
                {kpis.avgPassRate != null ? `${kpis.avgPassRate}%` : "—"}
              </strong>
            </div>
            <div className="metric">
              <span>Avg fail</span>
              <strong>
                {kpis.avgFailRate != null ? `${kpis.avgFailRate}%` : "—"}
              </strong>
            </div>
            <div className="metric">
              <span>Total est. cost</span>
              <strong>{formatEstCost(kpis.totalEstimatedCostUsd)}</strong>
            </div>
            <div className="metric">
              <span>Avg latency</span>
              <strong>{formatLatency(kpis.avgLatencyMs)}</strong>
            </div>
            <div className="metric">
              <span>Runs / points</span>
              <strong>
                {kpis.runCount}/{kpis.pointCount}
              </strong>
            </div>
          </div>

          <div className="trends-grid">
            <TrendChart
              title="Pass rate %"
              series={series}
              metric="passRate"
              yFormatter={(v) => `${v}%`}
              labelFor={labelFor}
            />
            <TrendChart
              title="Fail rate %"
              series={series}
              metric="failRate"
              yFormatter={(v) => `${v}%`}
              labelFor={labelFor}
            />
            <TrendChart
              title="Est. cost (USD)"
              series={series}
              metric="estimatedCostUsd"
              yFormatter={(v) => formatEstCost(v)}
              labelFor={labelFor}
            />
            <TrendChart
              title="Avg latency"
              series={series}
              metric="avgLatencyMs"
              yFormatter={(v) => formatLatency(v)}
              labelFor={labelFor}
            />
          </div>
        </>
      )}
    </div>
  );
}

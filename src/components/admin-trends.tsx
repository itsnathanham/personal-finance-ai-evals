"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const CHART_COLORS = ["#7ec8b0", "#e8a87c", "#8aa4d4", "#d4a5c9", "#c4d47a"];

type CatalogModels = Array<{
  id: string;
  label: string;
  provider?: "anthropic" | "openai" | "google";
  configured?: boolean;
}>;

function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
}: {
  title: string;
  series: ReturnType<typeof buildTrendSeries>["series"];
  metric: "passRate" | "failRate" | "estimatedCostUsd" | "avgLatencyMs";
  yFormatter: (v: number) => string;
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
                name={s.modelId}
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

export function AdminTrends({
  models,
  initialRuns = [],
}: {
  models: CatalogModels;
  initialRuns?: HistoryRunSummary[];
}) {
  const router = useRouter();
  const [runs, setRuns] = useState<HistoryRunSummary[]>([]);
  const [modelIds, setModelIds] = useState<string[]>(() =>
    models.map((m) => m.id),
  );
  const [suite, setSuite] = useState<SuiteFilter>("all");

  useEffect(() => {
    const normalized = initialRuns.map((r) => ({
      ...r,
      summary: normalizeSummary(r.summary),
    }));
    setRuns(mergeRunSummaries(normalized));
  }, [initialRuns]);

  const { series, kpis, usedLegacyFallback } = useMemo(
    () =>
      buildTrendSeries(runs, {
        modelIds,
        suite,
      }),
    [runs, modelIds, suite],
  );

  function toggleModel(id: string) {
    setModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

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
          <Link href="/">Back to app</Link>
          <button type="button" className="ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      <section className="admin-card trends-filters">
        <h2>Filters</h2>
        <p className="admin-help">
          History is stored in this browser (localStorage) and merged with any
          server runs still available. Suite filters use per-suite aggregates
          from each run.
        </p>

        <h3>Models</h3>
        <div className="chip-grid">
          {models.map((model) => (
            <label key={model.id} className="chip">
              <input
                type="checkbox"
                checked={modelIds.includes(model.id)}
                onChange={() => toggleModel(model.id)}
              />
              <span>
                <strong>{model.label}</strong>
                <em>{model.id}</em>
              </span>
            </label>
          ))}
        </div>

        <h3>Suite</h3>
        <div className="filter-pills">
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

        {usedLegacyFallback && suite !== "all" && (
          <p className="muted trends-note">
            Some older runs lack per-suite breakdowns and are omitted from this
            suite filter. Re-run evals to include them.
          </p>
        )}
      </section>

      {runs.length === 0 ? (
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
            />
            <TrendChart
              title="Fail rate %"
              series={series}
              metric="failRate"
              yFormatter={(v) => `${v}%`}
            />
            <TrendChart
              title="Est. cost (USD)"
              series={series}
              metric="estimatedCostUsd"
              yFormatter={(v) => formatEstCost(v)}
            />
            <TrendChart
              title="Avg latency"
              series={series}
              metric="avgLatencyMs"
              yFormatter={(v) => formatLatency(v)}
            />
          </div>
        </>
      )}
    </div>
  );
}

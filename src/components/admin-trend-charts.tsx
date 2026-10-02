"use client";

import { useMemo } from "react";
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
import type { buildTrendSeries } from "@/lib/evals/trends";

const CHART_COLORS = ["#7ec8b0", "#e8a87c", "#8aa4d4", "#d4a5c9", "#c4d47a"];

type Series = ReturnType<typeof buildTrendSeries>["series"];
type Kpis = ReturnType<typeof buildTrendSeries>["kpis"];

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
  series: Series,
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
  series: Series;
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

export function TrendChartsPanel({
  series,
  kpis,
  labelFor,
}: {
  series: Series;
  kpis: Kpis;
  labelFor: (modelId: string) => string;
}) {
  return (
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
  );
}

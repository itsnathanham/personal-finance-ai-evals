"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatEstCost,
  formatLatency,
  formatTokens,
} from "@/lib/evals/format-metrics";
import type { RunSummaryMetrics } from "@/lib/models/pricing";

type RunDetail = {
  run: {
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
    summary: RunSummaryMetrics | null;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  cases: Array<{
    id: string;
    suiteId: string;
    caseId: string;
    description: string;
    modelId: string;
    prompt: string;
    output: string | null;
    toolsUsed: string[];
    pass: boolean | null;
    failReasons: string[];
    latencyMs: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    estimatedCostUsd?: number | null;
    errorMessage: string | null;
  }>;
};

export function AdminRunDetail({ runId }: { runId: string }) {
  const [data, setData] = useState<RunDetail | null>(null);
  const [filter, setFilter] = useState<"all" | "pass" | "fail">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const localRaw = sessionStorage.getItem(`hfc_eval_run_${runId}`);
      if (localRaw) {
        try {
          const local = JSON.parse(localRaw) as RunDetail;
          if (!cancelled) setData(local);
          return;
        } catch {
          // fall through to API
        }
      }

      const res = await fetch(`/api/admin/eval-runs/${runId}`);
      if (!res.ok) {
        if (!cancelled) {
          setError(
            "Run not found (server history is ephemeral without DATABASE_URL).",
          );
        }
        return;
      }
      const json = await res.json();
      if (json.localOnly) {
        if (!cancelled) {
          setError("This run was only stored in this browser session.");
        }
        return;
      }
      if (!cancelled) setData(json);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "pass") return data.cases.filter((c) => c.pass === true);
    if (filter === "fail") return data.cases.filter((c) => c.pass === false);
    return data.cases;
  }, [data, filter]);

  if (error && !data) {
    return (
      <div className="admin-shell">
        <p className="admin-error">{error}</p>
        <Link href="/admin">Back to admin</Link>
      </div>
    );
  }

  if (!data) {
    return <p className="admin-loading">Loading run…</p>;
  }

  const { run } = data;
  const summary = run.summary;

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="brand">Run detail</p>
          <p className="sub">
            {run.status} · {run.suiteIds.join(", ")} · {run.modelIds.length}{" "}
            model{run.modelIds.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin">Back to admin</Link>
      </header>

      <div className="metric-row">
        <div className="metric">
          <span>Pass rate</span>
          <strong>{run.passRate != null ? `${run.passRate}%` : "—"}</strong>
        </div>
        <div className="metric">
          <span>Est. cost</span>
          <strong>{formatEstCost(summary?.estimatedCostUsd)}</strong>
        </div>
        <div className="metric">
          <span>Avg latency</span>
          <strong>{formatLatency(summary?.avgLatencyMs)}</strong>
        </div>
        <div className="metric">
          <span>Tokens</span>
          <strong>
            {formatTokens(
              summary
                ? summary.inputTokens + summary.outputTokens
                : null,
            )}
          </strong>
        </div>
        <div className="metric">
          <span>Passed / failed</span>
          <strong>
            {run.passedCases}/{run.failedCases}
            {run.errorCases > 0 ? ` · ${run.errorCases} err` : ""}
          </strong>
        </div>
      </div>

      {summary?.perModel && (
        <section className="admin-card">
          <h2>By model</h2>
          <div className="model-compare">
            <div className="model-compare-head">
              <span>Model</span>
              <span>Pass</span>
              <span>Est. cost</span>
              <span>Avg latency</span>
              <span>Tokens</span>
            </div>
            {Object.entries(summary.perModel).map(([modelId, stats]) => (
              <div key={modelId} className="model-compare-row">
                <strong>{modelId}</strong>
                <span>
                  {stats.passRate}% ({stats.passed}/{stats.total})
                </span>
                <span>{formatEstCost(stats.estimatedCostUsd)}</span>
                <span>{formatLatency(stats.avgLatencyMs)}</span>
                <span>
                  {formatTokens(stats.inputTokens + stats.outputTokens)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {run.errorMessage && (
        <p className="admin-error">Run error: {run.errorMessage}</p>
      )}

      <section className="admin-card">
        <div className="table-head">
          <h2>Cases</h2>
          <div className="filter-pills">
            {(["all", "pass", "fail"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <ul className="case-list">
          {filtered.map((c) => (
            <li key={c.id} className={c.pass ? "pass" : "fail"}>
              <button
                type="button"
                className="case-row"
                onClick={() =>
                  setExpanded((id) => (id === c.id ? null : c.id))
                }
              >
                <span className="badge">{c.pass ? "PASS" : "FAIL"}</span>
                <span className="case-main">
                  <strong>{c.description}</strong>
                  <em>
                    {c.suiteId} · {c.modelId}
                    {c.latencyMs != null
                      ? ` · ${formatLatency(c.latencyMs)}`
                      : ""}
                    {c.estimatedCostUsd != null
                      ? ` · ${formatEstCost(c.estimatedCostUsd)}`
                      : ""}
                  </em>
                </span>
              </button>
              {expanded === c.id && (
                <div className="case-detail">
                  <p>
                    <strong>Prompt</strong>
                  </p>
                  <pre>{c.prompt}</pre>
                  <p>
                    <strong>Output</strong>
                  </p>
                  <pre>{c.output ?? c.errorMessage ?? "—"}</pre>
                  <p>
                    <strong>Tools</strong>:{" "}
                    {c.toolsUsed.length ? c.toolsUsed.join(", ") : "none"}
                  </p>
                  <p>
                    <strong>Usage</strong>:{" "}
                    {formatTokens(c.inputTokens)} in /{" "}
                    {formatTokens(c.outputTokens)} out ·{" "}
                    {formatEstCost(c.estimatedCostUsd)} est. ·{" "}
                    {formatLatency(c.latencyMs)}
                  </p>
                  {c.failReasons?.length > 0 && (
                    <p>
                      <strong>Fail reasons</strong>:{" "}
                      {c.failReasons.join("; ")}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

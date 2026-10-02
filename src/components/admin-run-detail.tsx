"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminAuthModal,
  checkAdminSession,
} from "@/components/admin-auth-modal";
import {
  formatEstCost,
  formatLatency,
  formatTokens,
} from "@/lib/evals/format-metrics";
import {
  loadLocalRunEntry,
  removeEvalHistoryEntry,
} from "@/lib/evals/history";
import type { RunSummaryMetrics } from "@/lib/models/pricing";
import { getModelLabel } from "@/lib/models/registry";

type RunCase = {
  id: string;
  suiteId: string;
  caseId: string;
  description: string;
  modelId: string;
  prompt: string;
  output: string | null;
  toolsUsed: string[];
  toolResults?: Array<{
    toolName: string;
    args?: unknown;
    output?: unknown;
  }>;
  pass: boolean | null;
  failReasons: string[];
  latencyMs: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  errorMessage: string | null;
};

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
  cases: RunCase[];
};

type SortKey = "model" | "pass" | "cost" | "latency" | "tokens";
type SortDir = "asc" | "desc";
type ResultFilter = "all" | "pass" | "fail";

function ExpandChevron({ open }: { open: boolean }) {
  return (
    <span className="trends-models-chevron" aria-hidden>
      <span className="trends-models-chevron-label">
        {open ? "Collapse" : "Expand"}
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
        {open ? <path d="M3 10.5 8 5.5l5 5" /> : <path d="M3 5.5 8 10.5l5-5" />}
      </svg>
    </span>
  );
}

export function AdminRunDetail({ runId }: { runId: string }) {
  const router = useRouter();
  const [data, setData] = useState<RunDetail | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [suiteFilter, setSuiteFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modelsOpen, setModelsOpen] = useState(true);
  const [casesOpen, setCasesOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("pass");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [authOpen, setAuthOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pendingActionRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = loadLocalRunEntry(runId);

      try {
        const res = await fetch(`/api/admin/eval-runs/${runId}`);
        if (res.ok) {
          const json = await res.json();
          if (!json.localOnly && json.run) {
            if (!cancelled) {
              setData(json as RunDetail);
              setError(null);
            }
            return;
          }
        }
      } catch {
        // fall through to local
      }

      if (local) {
        if (!cancelled) {
          setData(local as RunDetail);
          setError(null);
        }
        return;
      }

      if (!cancelled) {
        setError(
          "Run not found. It may only exist in another browser, or the server has no durable DATABASE_URL.",
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const suiteOptions = useMemo(() => {
    if (!data) return [] as string[];
    return [...new Set(data.cases.map((c) => c.suiteId))].sort();
  }, [data]);

  const modelOptions = useMemo(() => {
    if (!data) return [] as string[];
    return [...new Set(data.cases.map((c) => c.modelId))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as RunCase[];
    return data.cases.filter((c) => {
      if (resultFilter === "pass" && c.pass !== true) return false;
      if (resultFilter === "fail" && c.pass !== false) return false;
      if (suiteFilter !== "all" && c.suiteId !== suiteFilter) return false;
      if (modelFilter !== "all" && c.modelId !== modelFilter) return false;
      return true;
    });
  }, [data, resultFilter, suiteFilter, modelFilter]);

  const modelRows = useMemo(() => {
    const perModel = data?.run.summary?.perModel;
    if (!perModel) return [];
    const rows = Object.entries(perModel).map(([modelId, stats]) => ({
      modelId,
      label: getModelLabel(modelId),
      passRate: stats.passRate,
      passed: stats.passed,
      total: stats.total,
      estimatedCostUsd: stats.estimatedCostUsd,
      avgLatencyMs: stats.avgLatencyMs,
      tokens: stats.inputTokens + stats.outputTokens,
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sortKey) {
        case "model":
          return a.label.localeCompare(b.label) * dir;
        case "pass":
          return (a.passRate - b.passRate) * dir;
        case "cost":
          return (a.estimatedCostUsd - b.estimatedCostUsd) * dir;
        case "latency":
          return (a.avgLatencyMs - b.avgLatencyMs) * dir;
        case "tokens":
          return (a.tokens - b.tokens) * dir;
        default: {
          const _exhaustive: never = sortKey;
          return _exhaustive;
        }
      }
    });
    return rows;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "model" ? "asc" : "desc");
    }
  }

  function sortLabel(key: SortKey, label: string) {
    if (sortKey !== key) return label;
    return `${label} ${sortDir === "asc" ? "↑" : "↓"}`;
  }

  async function requireAuthThen(action: () => void) {
    if (await checkAdminSession()) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setAuthOpen(true);
  }

  function onAuthSuccess() {
    setAuthOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }

  async function deleteRun() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/eval-runs/${runId}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        throw new Error("Unauthorized");
      }
      if (!res.ok && res.status !== 404) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Delete failed");
      }
      removeEvalHistoryEntry(runId);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (error && !data) {
    return (
      <div className="admin-shell">
        <header className="admin-top">
          <div>
            <p className="brand">Run detail</p>
            <p className="sub">Inspect a completed eval run</p>
          </div>
          <div className="admin-top-actions">
            <Link href="/admin">Run evals</Link>
            <Link href="/admin/trends">Eval trends</Link>
            <Link href="/">Copilot</Link>
          </div>
        </header>
        <p className="admin-error">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-shell">
        <header className="admin-top">
          <div>
            <p className="brand">Run detail</p>
            <p className="sub">Loading…</p>
          </div>
          <div className="admin-top-actions">
            <Link href="/admin">Run evals</Link>
            <Link href="/admin/trends">Eval trends</Link>
            <Link href="/">Copilot</Link>
          </div>
        </header>
        <p className="admin-loading">Loading run…</p>
      </div>
    );
  }

  const { run } = data;
  const summary = run.summary;
  const passCount = data.cases.filter((c) => c.pass === true).length;
  const failCount = data.cases.filter((c) => c.pass === false).length;

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="brand">Run detail</p>
          <p className="sub">
            {run.status} · {new Date(run.startedAt).toLocaleString()} ·{" "}
            {run.modelIds.length} model
            {run.modelIds.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="admin-top-actions">
          <Link href="/admin">Run evals</Link>
          <Link href="/admin/trends">Eval trends</Link>
          <Link href="/">Copilot</Link>
          <button
            type="button"
            className="ghost danger-text"
            disabled={deleting}
            onClick={() =>
              void requireAuthThen(() => {
                setConfirmDelete(true);
              })
            }
          >
            Delete run
          </button>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card trends-filters">
        <div className="trends-filter-bar">
          <div className="trends-filter-main">
            <h2>Summary</h2>
            <p className="admin-help trends-filter-help">
              Suites: {run.suiteIds.join(", ") || "—"}. Models:{" "}
              {run.modelIds.map((id) => getModelLabel(id)).join(" · ")}
            </p>
          </div>
          <div className="filter-pills trends-suite-pills run-detail-status-pills">
            <span className="status-pill">{run.status}</span>
            <span className="status-pill">{passCount} pass</span>
            <span className="status-pill">{failCount} fail</span>
          </div>
        </div>

        <div className="metric-row run-detail-metrics">
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
                summary ? summary.inputTokens + summary.outputTokens : null,
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

        {run.errorMessage && (
          <p className="admin-error">Run error: {run.errorMessage}</p>
        )}
      </section>

      {modelRows.length > 0 && (
        <section className="admin-card trends-filters">
          <div className="trends-models-summary">
            <button
              type="button"
              className="trends-models-toggle"
              aria-expanded={modelsOpen}
              onClick={() => setModelsOpen((open) => !open)}
            >
              <span>
                <strong>By model</strong>
                <em>
                  {modelRows.length} model
                  {modelRows.length === 1 ? "" : "s"} · click headers to sort
                </em>
              </span>
              <ExpandChevron open={modelsOpen} />
            </button>
          </div>

          {modelsOpen && (
            <div className="trends-models-panel">
              <div className="model-compare">
                <div className="model-compare-head sortable">
                  <button type="button" onClick={() => toggleSort("model")}>
                    {sortLabel("model", "Model")}
                  </button>
                  <button type="button" onClick={() => toggleSort("pass")}>
                    {sortLabel("pass", "Pass")}
                  </button>
                  <button type="button" onClick={() => toggleSort("cost")}>
                    {sortLabel("cost", "Est. cost")}
                  </button>
                  <button type="button" onClick={() => toggleSort("latency")}>
                    {sortLabel("latency", "Avg latency")}
                  </button>
                  <button type="button" onClick={() => toggleSort("tokens")}>
                    {sortLabel("tokens", "Tokens")}
                  </button>
                </div>
                {modelRows.map((row) => (
                  <div key={row.modelId} className="model-compare-row">
                    <strong title={row.modelId}>{row.label}</strong>
                    <span>
                      {row.passRate}% ({row.passed}/{row.total})
                    </span>
                    <span>{formatEstCost(row.estimatedCostUsd)}</span>
                    <span>{formatLatency(row.avgLatencyMs)}</span>
                    <span>{formatTokens(row.tokens)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="admin-card trends-filters">
        <div className="trends-filter-bar">
          <div className="trends-filter-main">
            <h2>Cases</h2>
            <p className="admin-help trends-filter-help">
              Showing {filtered.length} of {data.cases.length}. Expand a row for
              prompt, output, and tool traces.
            </p>
          </div>
          <div className="filter-pills trends-suite-pills">
            {(
              [
                ["all", `All ${data.cases.length}`],
                ["pass", `Pass ${passCount}`],
                ["fail", `Fail ${failCount}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={resultFilter === id ? "active" : ""}
                onClick={() => setResultFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="run-detail-secondary-filters">
          <div className="filter-pills">
            <button
              type="button"
              className={suiteFilter === "all" ? "active" : ""}
              onClick={() => setSuiteFilter("all")}
            >
              All suites
            </button>
            {suiteOptions.map((suiteId) => (
              <button
                key={suiteId}
                type="button"
                className={suiteFilter === suiteId ? "active" : ""}
                onClick={() => setSuiteFilter(suiteId)}
              >
                {suiteId}
              </button>
            ))}
          </div>
          <div className="filter-pills">
            <button
              type="button"
              className={modelFilter === "all" ? "active" : ""}
              onClick={() => setModelFilter("all")}
            >
              All models
            </button>
            {modelOptions.map((modelId) => (
              <button
                key={modelId}
                type="button"
                className={modelFilter === modelId ? "active" : ""}
                title={modelId}
                onClick={() => setModelFilter(modelId)}
              >
                {getModelLabel(modelId)}
              </button>
            ))}
          </div>
        </div>

        <div className="trends-models-summary">
          <button
            type="button"
            className="trends-models-toggle"
            aria-expanded={casesOpen}
            onClick={() => setCasesOpen((open) => !open)}
          >
            <span>
              <strong>Case results</strong>
              <em>
                {filtered.length} visible
                {expanded ? " · 1 expanded" : ""}
              </em>
            </span>
            <ExpandChevron open={casesOpen} />
          </button>
        </div>

        {casesOpen && (
          <ul className="case-list">
            {filtered.length === 0 ? (
              <li className="muted">No cases match these filters.</li>
            ) : (
              filtered.map((c) => {
                const open = expanded === c.id;
                return (
                  <li key={c.id} className={c.pass ? "pass" : "fail"}>
                    <button
                      type="button"
                      className="case-row"
                      aria-expanded={open}
                      onClick={() =>
                        setExpanded((id) => (id === c.id ? null : c.id))
                      }
                    >
                      <span className="badge">
                        {c.pass ? "PASS" : "FAIL"}
                      </span>
                      <span className="case-main">
                        <strong>{c.description}</strong>
                        <em>
                          {c.suiteId} · {getModelLabel(c.modelId)}
                          {c.latencyMs != null
                            ? ` · ${formatLatency(c.latencyMs)}`
                            : ""}
                          {c.estimatedCostUsd != null
                            ? ` · ${formatEstCost(c.estimatedCostUsd)}`
                            : ""}
                        </em>
                      </span>
                      <span className="case-row-chevron" aria-hidden>
                        {open ? "▴" : "▾"}
                      </span>
                    </button>
                    {open && (
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
                        {(c.toolResults?.length ?? 0) > 0 && (
                          <>
                            <p>
                              <strong>Tool calls</strong>
                            </p>
                            <pre>
                              {JSON.stringify(c.toolResults, null, 2)}
                            </pre>
                          </>
                        )}
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
                );
              })
            )}
          </ul>
        )}
      </section>

      <AdminAuthModal
        open={authOpen}
        title="Sign in to delete run"
        description="Admin password is required to delete eval history."
        onClose={() => {
          setAuthOpen(false);
          pendingActionRef.current = null;
        }}
        onSuccess={onAuthSuccess}
      />

      {confirmDelete && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-run-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-run-title">Delete this run?</h2>
            <p className="admin-help">
              Removes it from server history and this browser so it no longer
              appears in trends. This cannot be undone.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary danger"
                disabled={deleting}
                onClick={() => void deleteRun()}
              >
                {deleting ? "Deleting…" : "Delete run"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

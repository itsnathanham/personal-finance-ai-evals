"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
    summary: {
      passRate: number;
      perModel: Record<
        string,
        { passed: number; total: number; passRate: number }
      >;
    } | null;
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
    errorMessage: string | null;
  }>;
};

export function AdminRunDetail({ runId }: { runId: string }) {
  const [data, setData] = useState<RunDetail | null>(null);
  const [filter, setFilter] = useState<"all" | "pass" | "fail">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/admin/eval-runs/${runId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) setData(json);
    }
    void load();
    const timer = setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "pass") return data.cases.filter((c) => c.pass === true);
    if (filter === "fail") return data.cases.filter((c) => c.pass === false);
    return data.cases;
  }, [data, filter]);

  if (!data) {
    return <p className="admin-loading">Loading run…</p>;
  }

  const { run } = data;

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
          <span>Passed</span>
          <strong>{run.passedCases}</strong>
        </div>
        <div className="metric">
          <span>Failed</span>
          <strong>{run.failedCases}</strong>
        </div>
        <div className="metric">
          <span>Errors</span>
          <strong>{run.errorCases}</strong>
        </div>
        <div className="metric">
          <span>Progress</span>
          <strong>
            {run.completedCases}/{run.totalCases}
          </strong>
        </div>
      </div>

      {run.summary?.perModel && (
        <section className="admin-card">
          <h2>By model</h2>
          <ul className="model-scores">
            {Object.entries(run.summary.perModel).map(([modelId, stats]) => (
              <li key={modelId}>
                <strong>{modelId}</strong>
                <span>
                  {stats.passRate}% ({stats.passed}/{stats.total})
                </span>
              </li>
            ))}
          </ul>
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
                    {c.latencyMs != null ? ` · ${c.latencyMs}ms` : ""}
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

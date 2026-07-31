"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Catalog = {
  models: Array<{ id: string; label: string; description: string }>;
  suites: Array<{
    id: string;
    name: string;
    description: string;
    caseCount: number;
  }>;
};

type RunSummary = {
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
};

export function AdminDashboard() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [suiteIds, setSuiteIds] = useState<string[]>(["goldens"]);
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [catalogRes, runsRes] = await Promise.all([
      fetch("/api/admin/catalog"),
      fetch("/api/admin/eval-runs"),
    ]);
    if (catalogRes.status === 401 || runsRes.status === 401) {
      router.refresh();
      return;
    }
    const catalogJson = await catalogRes.json();
    const runsJson = await runsRes.json();
    setCatalog(catalogJson);
    setRuns(runsJson.runs ?? []);
    setModelIds((prev) =>
      prev.length > 0
        ? prev
        : catalogJson.models?.[0]
          ? [catalogJson.models[0].id]
          : [],
    );
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeRunId) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/admin/eval-runs/${activeRunId}`);
      if (!res.ok) return;
      const data = await res.json();
      const run = data.run as RunSummary;
      setRuns((prev) => {
        const others = prev.filter((r) => r.id !== run.id);
        return [run, ...others];
      });
      if (run.status === "completed" || run.status === "failed") {
        setActiveRunId(null);
        void load();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [activeRunId, load]);

  const activeRun = useMemo(
    () => runs.find((r) => r.id === activeRunId) ?? null,
    [runs, activeRunId],
  );

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function startRun() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/eval-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suiteIds, modelIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start run");
        return;
      }
      setActiveRunId(data.runId);
      await load();
    } catch {
      setError("Could not start eval run");
    } finally {
      setStarting(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const estimatedCases =
    (catalog?.suites
      .filter((s) => suiteIds.includes(s.id))
      .reduce((n, s) => n + s.caseCount, 0) ?? 0) * modelIds.length;

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="brand">Eval Admin</p>
          <p className="sub">
            Run goldens, policy, and red-team suites across Claude models
          </p>
        </div>
        <div className="admin-top-actions">
          <Link href="/">Back to copilot</Link>
          <button type="button" className="ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      <div className="admin-grid">
        <section className="admin-card">
          <h2>New run</h2>
          <p className="admin-help">
            Pick suites and one or more models. Each case runs once per model.
          </p>

          <h3>Suites</h3>
          <div className="chip-grid">
            {catalog?.suites.map((suite) => (
              <label key={suite.id} className="chip">
                <input
                  type="checkbox"
                  checked={suiteIds.includes(suite.id)}
                  onChange={() => toggle(suiteIds, suite.id, setSuiteIds)}
                />
                <span>
                  <strong>{suite.name}</strong>
                  <em>
                    {suite.caseCount} cases · {suite.description}
                  </em>
                </span>
              </label>
            ))}
          </div>

          <h3>Models</h3>
          <div className="chip-grid">
            {catalog?.models.map((model) => (
              <label key={model.id} className="chip">
                <input
                  type="checkbox"
                  checked={modelIds.includes(model.id)}
                  onChange={() => toggle(modelIds, model.id, setModelIds)}
                />
                <span>
                  <strong>{model.label}</strong>
                  <em>{model.description}</em>
                </span>
              </label>
            ))}
          </div>

          <p className="admin-estimate">
            Estimated cases this run: <strong>{estimatedCases}</strong>
          </p>

          <button
            type="button"
            className="primary"
            disabled={
              starting ||
              suiteIds.length === 0 ||
              modelIds.length === 0 ||
              Boolean(activeRunId)
            }
            onClick={() => void startRun()}
          >
            {starting ? "Starting…" : activeRunId ? "Run in progress…" : "Run evals"}
          </button>
          {error && <p className="admin-error">{error}</p>}

          {activeRun && (
            <div className="progress-panel">
              <div className="progress-bar">
                <div
                  style={{
                    width: `${
                      activeRun.totalCases === 0
                        ? 0
                        : (activeRun.completedCases / activeRun.totalCases) * 100
                    }%`,
                  }}
                />
              </div>
              <p>
                {activeRun.completedCases}/{activeRun.totalCases} ·{" "}
                {activeRun.passedCases} passed · {activeRun.failedCases} failed
              </p>
              <p className="muted">{activeRun.currentLabel}</p>
            </div>
          )}
        </section>

        <section className="admin-card">
          <h2>History</h2>
          {runs.length === 0 ? (
            <p className="muted">No runs yet. Start one on the left.</p>
          ) : (
            <ul className="run-list">
              {runs.map((run) => (
                <li key={run.id}>
                  <Link href={`/admin/runs/${run.id}`}>
                    <strong>
                      {run.passRate != null ? `${run.passRate}%` : "—"} ·{" "}
                      {run.status}
                    </strong>
                    <span>
                      {run.suiteIds.join(", ")} · {run.modelIds.length} model
                      {run.modelIds.length === 1 ? "" : "s"}
                    </span>
                    <em>{new Date(run.startedAt).toLocaleString()}</em>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

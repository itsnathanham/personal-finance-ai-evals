"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatEstCost,
  formatLatency,
} from "@/lib/evals/format-metrics";
import {
  buildRunSummary,
  type RunSummaryMetrics,
} from "@/lib/models/pricing";

type CatalogCase = {
  id: string;
  description: string;
  prompt: string;
};

export type Catalog = {
  models: Array<{ id: string; label: string; description: string }>;
  suites: Array<{
    id: string;
    name: string;
    description: string;
    caseCount: number;
    cases: CatalogCase[];
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
  summary?: RunSummaryMetrics | null;
};

type CaseResult = {
  id: string;
  suiteId: string;
  caseId: string;
  description: string;
  modelId: string;
  prompt: string;
  output: string | null;
  toolsUsed: string[];
  pass: boolean;
  failReasons: string[];
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
};

const LOCAL_HISTORY_KEY = "hfc_eval_history_v1";

function loadLocalHistory(): Array<{ run: RunSummary; cases: CaseResult[] }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Array<{ run: RunSummary; cases: CaseResult[] }>;
  } catch {
    return [];
  }
}

function saveLocalHistory(
  entries: Array<{ run: RunSummary; cases: CaseResult[] }>,
) {
  sessionStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
}

function mergeRuns(serverRuns: RunSummary[]): RunSummary[] {
  const local = loadLocalHistory().map((e) => e.run);
  const byId = new Map<string, RunSummary>();
  for (const r of [...local, ...serverRuns]) byId.set(r.id, r);
  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function AdminDashboard({
  initialCatalog,
  initialRuns = [],
}: {
  initialCatalog: Catalog;
  initialRuns?: RunSummary[];
}) {
  const router = useRouter();
  const [catalog] = useState(initialCatalog);
  const [runs, setRuns] = useState<RunSummary[]>(() => mergeRuns(initialRuns));
  const [suiteIds, setSuiteIds] = useState<string[]>(["goldens"]);
  const [modelIds, setModelIds] = useState<string[]>(() =>
    initialCatalog.models[0] ? [initialCatalog.models[0].id] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    passed: 0,
    failed: 0,
    label: "",
  });

  const refreshRuns = useCallback(async () => {
    const runsRes = await fetch("/api/admin/eval-runs");
    if (runsRes.status === 401) {
      router.refresh();
      return;
    }
    const runsJson = await runsRes.json();
    setRuns(mergeRuns((runsJson.runs ?? []) as RunSummary[]));
  }, [router]);

  useEffect(() => {
    setRuns(mergeRuns(initialRuns));
  }, [initialRuns]);

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const estimatedCases = useMemo(
    () =>
      catalog.suites
        .filter((s) => suiteIds.includes(s.id))
        .reduce((n, s) => n + s.caseCount, 0) * modelIds.length,
    [catalog, suiteIds, modelIds],
  );

  async function startRun() {
    setRunning(true);
    setError(null);

    const jobs: Array<{
      suiteId: string;
      suiteName: string;
      caseId: string;
      description: string;
      prompt: string;
      modelId: string;
    }> = [];

    for (const modelId of modelIds) {
      for (const suite of catalog.suites.filter((s) => suiteIds.includes(s.id))) {
        for (const c of suite.cases) {
          jobs.push({
            suiteId: suite.id,
            suiteName: suite.name,
            caseId: c.id,
            description: c.description,
            prompt: c.prompt,
            modelId,
          });
        }
      }
    }

    const startedAt = new Date().toISOString();
    const results: CaseResult[] = [];
    let passed = 0;
    let failed = 0;
    let errors = 0;

    setProgress({
      completed: 0,
      total: jobs.length,
      passed: 0,
      failed: 0,
      label: "Starting…",
    });

    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i]!;
        setProgress({
          completed: i,
          total: jobs.length,
          passed,
          failed,
          label: `${job.suiteName} · ${job.description} · ${job.modelId}`,
        });

        try {
          const evalRes = await fetch("/api/eval", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: job.prompt,
              modelId: job.modelId,
              householdId: "hh_jetski",
            }),
          });
          const evalJson = await evalRes.json();
          if (!evalRes.ok) {
            throw new Error(evalJson.error ?? "Eval request failed");
          }

          const gradeRes = await fetch("/api/admin/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: job.caseId, result: evalJson }),
          });
          const gradeJson = await gradeRes.json();
          const pass = Boolean(gradeJson.pass);
          if (pass) passed += 1;
          else failed += 1;

          results.push({
            id: `case_${i}_${Date.now()}`,
            suiteId: job.suiteId,
            caseId: job.caseId,
            description: job.description,
            modelId: job.modelId,
            prompt: job.prompt,
            output: evalJson.output ?? null,
            toolsUsed: evalJson.toolsUsed ?? [],
            pass,
            failReasons: gradeJson.failReasons ?? [],
            latencyMs: evalJson.latencyMs ?? null,
            inputTokens: evalJson.inputTokens ?? null,
            outputTokens: evalJson.outputTokens ?? null,
            totalTokens: evalJson.totalTokens ?? null,
            estimatedCostUsd: evalJson.estimatedCostUsd ?? null,
            errorMessage: null,
          });
        } catch (err) {
          errors += 1;
          failed += 1;
          results.push({
            id: `case_${i}_${Date.now()}`,
            suiteId: job.suiteId,
            caseId: job.caseId,
            description: job.description,
            modelId: job.modelId,
            prompt: job.prompt,
            output: null,
            toolsUsed: [],
            pass: false,
            failReasons: ["Runtime error"],
            latencyMs: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            estimatedCostUsd: null,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }

        setProgress({
          completed: i + 1,
          total: jobs.length,
          passed,
          failed,
          label: `${job.suiteName} · ${job.description} · ${job.modelId}`,
        });
      }

      const finishedAt = new Date().toISOString();
      const summary = buildRunSummary(results);

      const persistRes = await fetch("/api/admin/eval-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suiteIds,
          modelIds,
          results: results.map((r) => ({
            suiteId: r.suiteId,
            caseId: r.caseId,
            description: r.description,
            modelId: r.modelId,
            prompt: r.prompt,
            output: r.output,
            toolsUsed: r.toolsUsed,
            pass: r.pass,
            failReasons: r.failReasons,
            latencyMs: r.latencyMs,
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            totalTokens: r.totalTokens,
            estimatedCostUsd: r.estimatedCostUsd,
            errorMessage: r.errorMessage,
          })),
        }),
      });
      const persistJson = await persistRes.json();
      const runId =
        typeof persistJson.runId === "string" && persistJson.runId.length > 0
          ? persistJson.runId
          : `local_${Date.now()}`;

      const run: RunSummary = {
        id: runId,
        status: "completed",
        suiteIds,
        modelIds,
        totalCases: results.length,
        completedCases: results.length,
        passedCases: passed,
        failedCases: failed - errors,
        errorCases: errors,
        currentLabel: "Completed",
        passRate: summary.passRate,
        startedAt,
        finishedAt,
        errorMessage: null,
        summary,
      };

      const history = loadLocalHistory();
      history.unshift({ run, cases: results });
      saveLocalHistory(history);
      sessionStorage.setItem(
        `hfc_eval_run_${runId}`,
        JSON.stringify({ run, cases: results }),
      );

      if (persistJson.warning) {
        setError(persistJson.warning);
      }

      await refreshRuns();
      router.push(`/admin/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eval run failed");
    } finally {
      setRunning(false);
      setProgress({
        completed: 0,
        total: 0,
        passed: 0,
        failed: 0,
        label: "",
      });
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

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
            Pick suites and one or more models. Compare pass rate, est. cost,
            and avg latency across models.
          </p>

          <h3>Suites</h3>
          <div className="chip-grid">
            {catalog.suites.map((suite) => (
              <label key={suite.id} className="chip">
                <input
                  type="checkbox"
                  checked={suiteIds.includes(suite.id)}
                  onChange={() => toggle(suiteIds, suite.id, setSuiteIds)}
                  disabled={running}
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
            {catalog.models.map((model) => (
              <label key={model.id} className="chip">
                <input
                  type="checkbox"
                  checked={modelIds.includes(model.id)}
                  onChange={() => toggle(modelIds, model.id, setModelIds)}
                  disabled={running}
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
              running || suiteIds.length === 0 || modelIds.length === 0
            }
            onClick={() => void startRun()}
          >
            {running ? "Running evals…" : "Run evals"}
          </button>
          {error && <p className="admin-error">{error}</p>}

          {running && (
            <div className="progress-panel">
              <div className="progress-bar">
                <div
                  style={{
                    width: `${
                      progress.total === 0
                        ? 0
                        : (progress.completed / progress.total) * 100
                    }%`,
                  }}
                />
              </div>
              <p>
                {progress.completed}/{progress.total} · {progress.passed}{" "}
                passed · {progress.failed} failed
              </p>
              <p className="muted">{progress.label}</p>
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
                      {formatEstCost(run.summary?.estimatedCostUsd)} est. ·{" "}
                      {formatLatency(run.summary?.avgLatencyMs)} avg ·{" "}
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

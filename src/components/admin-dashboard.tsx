"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminAuthModal,
  checkAdminSession,
} from "@/components/admin-auth-modal";
import {
  formatEstCost,
  formatLatency,
} from "@/lib/evals/format-metrics";
import {
  mergeRunSummaries,
  upsertEvalHistoryEntry,
  type HistoryCaseResult,
  type HistoryRunSummary,
} from "@/lib/evals/history";
import { buildRunSummary } from "@/lib/models/pricing";

type CatalogCase = {
  id: string;
  description: string;
  prompt: string;
};

export type Catalog = {
  models: Array<{
    id: string;
    label: string;
    description: string;
    provider: "anthropic" | "openai" | "google";
    configured: boolean;
  }>;
  suites: Array<{
    id: string;
    name: string;
    description: string;
    caseCount: number;
    cases: CatalogCase[];
  }>;
};

type RunSummary = HistoryRunSummary;
type CaseResult = HistoryCaseResult;

const CASE_GAP_MS = 500;
const PROVIDER_SWITCH_GAP_MS = 900;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerOf(modelId: string): string {
  if (modelId.startsWith("claude")) return "anthropic";
  if (modelId.startsWith("gpt") || modelId.startsWith("o")) return "openai";
  if (modelId.startsWith("gemini")) return "google";
  return "other";
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
  const [runs, setRuns] = useState<RunSummary[]>(() =>
    mergeRunSummaries(initialRuns),
  );
  const [suiteIds, setSuiteIds] = useState<string[]>(["goldens"]);
  const [modelIds, setModelIds] = useState<string[]>(() => {
    const preferred =
      initialCatalog.models.find(
        (m) => m.configured && m.id === "claude-sonnet-5-5",
      ) ?? initialCatalog.models.find((m) => m.configured);
    return preferred ? [preferred.id] : [];
  });
  const [modelsOpen, setModelsOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    passed: 0,
    failed: 0,
    label: "",
  });
  const [authOpen, setAuthOpen] = useState(false);
  const pendingActionRef = useRef<null | (() => void)>(null);

  const refreshRuns = useCallback(async () => {
    const runsRes = await fetch("/api/admin/eval-runs");
    if (!runsRes.ok) return;
    const runsJson = await runsRes.json();
    setRuns(mergeRunSummaries((runsJson.runs ?? []) as RunSummary[]));
  }, []);

  useEffect(() => {
    setRuns(mergeRunSummaries(initialRuns));
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

  const configuredModels = useMemo(
    () => catalog.models.filter((m) => m.configured),
    [catalog.models],
  );

  const selectedModels = useMemo(
    () => catalog.models.filter((m) => modelIds.includes(m.id)),
    [catalog.models, modelIds],
  );

  const selectedByProvider = useMemo(() => {
    const counts = { anthropic: 0, openai: 0, google: 0 };
    for (const m of selectedModels) {
      if (m.provider in counts) counts[m.provider] += 1;
    }
    return counts;
  }, [selectedModels]);

  const modelSummaryBits = [
    `${selectedModels.length} selected`,
    selectedByProvider.anthropic
      ? `Anthropic ${selectedByProvider.anthropic}`
      : null,
    selectedByProvider.openai ? `OpenAI ${selectedByProvider.openai}` : null,
    selectedByProvider.google ? `Gemini ${selectedByProvider.google}` : null,
  ].filter(Boolean);

  function selectConfiguredModels() {
    setModelIds(configuredModels.map((m) => m.id));
  }

  function clearModels() {
    setModelIds([]);
  }

  function selectLatestPerProvider() {
    const picks: string[] = [];
    for (const provider of ["anthropic", "openai", "google"] as const) {
      const newest = configuredModels.find((m) => m.provider === provider);
      if (newest) picks.push(newest.id);
    }
    setModelIds(picks);
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
        const prev = jobs[i - 1];
        if (prev) {
          const gap =
            providerOf(prev.modelId) === providerOf(job.modelId)
              ? CASE_GAP_MS
              : PROVIDER_SWITCH_GAP_MS;
          await sleep(gap);
        }

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
          if (gradeRes.status === 401) {
            throw new Error("Unauthorized — sign in to grade eval results");
          }
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
            toolResults: evalJson.toolResults ?? [],
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
            toolResults: [],
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
            toolResults: r.toolResults ?? [],
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
      if (persistRes.status === 401) {
        throw new Error("Unauthorized — sign in to save eval runs");
      }
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

      upsertEvalHistoryEntry({ run, cases: results });

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

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div>
          <p className="brand">Run evals</p>
          <p className="sub">
            Run goldens, policy, red-team, or Promptfoo Finance suites across
            Anthropic, OpenAI, and Gemini models
          </p>
        </div>
        <div className="admin-top-actions">
          <Link href="/admin/trends">Eval trends</Link>
          <Link href="/">Copilot</Link>
        </div>
      </header>

      <section className="admin-card trends-filters">
        <div className="trends-filter-bar">
          <div className="trends-filter-main">
            <h2>New run</h2>
            <p className="admin-help trends-filter-help">
              Mix suites in one run. Admin password required to execute.
              Models are newest-first within each provider.
            </p>
          </div>
          <div className="filter-pills trends-suite-pills">
            {catalog.suites.map((suite) => (
              <button
                key={suite.id}
                type="button"
                className={suiteIds.includes(suite.id) ? "active" : ""}
                disabled={running}
                title={`${suite.caseCount} cases · ${suite.description}`}
                onClick={() => toggle(suiteIds, suite.id, setSuiteIds)}
              >
                {suite.name}
                <span className="suite-pill-count">{suite.caseCount}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="trends-models-summary">
          <button
            type="button"
            className="trends-models-toggle"
            aria-expanded={modelsOpen}
            disabled={running}
            onClick={() => setModelsOpen((open) => !open)}
          >
            <span>
              <strong>Models</strong>
              <em>{modelSummaryBits.join(" · ")}</em>
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
              <button
                type="button"
                disabled={running}
                onClick={selectLatestPerProvider}
              >
                Latest per provider
              </button>
              <button
                type="button"
                disabled={running}
                onClick={selectConfiguredModels}
              >
                Select all
              </button>
              <button type="button" disabled={running} onClick={clearModels}>
                Clear
              </button>
            </div>
            <div className="trends-provider-columns">
              {(["anthropic", "openai", "google"] as const).map((provider) => {
                const models = catalog.models.filter(
                  (m) => m.provider === provider,
                );
                if (models.length === 0) return null;
                const configured = models.filter((m) => m.configured);
                const missing = models.filter((m) => !m.configured);
                const title =
                  provider === "anthropic"
                    ? "Anthropic"
                    : provider === "openai"
                      ? "OpenAI"
                      : "Google Gemini";
                const envHint =
                  provider === "anthropic"
                    ? "ANTHROPIC_API_KEY"
                    : provider === "openai"
                      ? "OPENAI_API_KEY"
                      : "GOOGLE_GENERATIVE_AI_API_KEY";
                return (
                  <div key={provider} className="model-provider-block">
                    <h4>
                      {title}
                      <span className="model-provider-count">
                        {
                          configured.filter((m) => modelIds.includes(m.id))
                            .length
                        }
                        /{configured.length || models.length}
                      </span>
                    </h4>
                    {configured.length > 0 ? (
                      <div className="chip-grid chip-grid-compact chip-grid-columns">
                        {configured.map((model) => (
                          <label
                            key={model.id}
                            className="chip"
                            title={model.description}
                          >
                            <input
                              type="checkbox"
                              checked={modelIds.includes(model.id)}
                              onChange={() =>
                                toggle(modelIds, model.id, setModelIds)
                              }
                              disabled={running}
                            />
                            <span>
                              <strong>{model.label}</strong>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-help model-provider-missing">
                        No key — set <code>{envHint}</code> to enable{" "}
                        {models.length} model
                        {models.length === 1 ? "" : "s"}.
                      </p>
                    )}
                    {missing.length > 0 && configured.length > 0 ? (
                      <details className="model-provider-collapsed">
                        <summary>
                          {missing.length} unavailable (missing {envHint})
                        </summary>
                        <ul>
                          {missing.map((model) => (
                            <li key={model.id}>{model.label}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="run-evals-actions">
          <p className="admin-estimate">
            Estimated cases this run: <strong>{estimatedCases}</strong>
            {suiteIds.length > 0 ? (
              <em>
                {" "}
                ·{" "}
                {catalog.suites
                  .filter((s) => suiteIds.includes(s.id))
                  .map((s) => s.name)
                  .join(", ")}
              </em>
            ) : null}
          </p>
          <button
            type="button"
            className="primary"
            disabled={
              running || suiteIds.length === 0 || modelIds.length === 0
            }
            onClick={() => void requireAuthThen(() => void startRun())}
          >
            {running ? "Running evals…" : "Run evals"}
          </button>
        </div>
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
              {progress.completed}/{progress.total} · {progress.passed} passed ·{" "}
              {progress.failed} failed
            </p>
            <p className="muted">{progress.label}</p>
          </div>
        )}
      </section>

      <section className="admin-card run-history-card">
        <div className="trends-filter-bar">
          <div className="trends-filter-main">
            <h2>History</h2>
            <p className="admin-help trends-filter-help">
              Recent runs from this browser and the server. Open a run for
              case-level detail.
            </p>
          </div>
        </div>
        {runs.length === 0 ? (
          <p className="muted">No runs yet. Configure a suite and models above.</p>
        ) : (
          <ul className="run-list run-list-compact">
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

      <AdminAuthModal
        open={authOpen}
        title="Sign in to run evals"
        description="Admin password is required to execute eval runs."
        onClose={() => {
          setAuthOpen(false);
          pendingActionRef.current = null;
        }}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
}

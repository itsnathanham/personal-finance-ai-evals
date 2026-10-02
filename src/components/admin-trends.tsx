"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
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
  compareModelsByReleaseDesc,
  getModelLabel,
  getModelProvider,
  type ModelProvider,
} from "@/lib/models/registry";

const TrendChartsPanel = dynamic(
  () =>
    import("@/components/admin-trend-charts").then((m) => m.TrendChartsPanel),
  {
    ssr: false,
    loading: () => (
      <section className="admin-card">
        <p className="muted">Loading charts…</p>
      </section>
    ),
  },
);

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
    return compareModelsByReleaseDesc(a.id, b.id);
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
    let cancelled = false;

    async function load() {
      const normalized = initialRuns.map((r) => ({
        ...r,
        summary: normalizeSummary(r.summary),
      }));

      let serverRuns: HistoryRunSummary[] = [];
      try {
        const res = await fetch("/api/admin/eval-runs?limit=80");
        if (res.ok) {
          const json = (await res.json()) as { runs?: HistoryRunSummary[] };
          serverRuns = (json.runs ?? []).map((r) => ({
            ...r,
            summary: normalizeSummary(r.summary),
          }));
        }
      } catch {
        serverRuns = [];
      }

      if (cancelled) return;
      const merged = mergeRunSummaries([...normalized, ...serverRuns]);
      setRuns(merged);
      const nextFilters = buildFilterModels(models, merged);
      setModelIds(defaultSelectedModelIds(nextFilters, merged));
      setDefaultsReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
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
            No eval history in this browser yet. Trends merge localStorage with
            server runs — preview URLs do not share production history.{" "}
            <Link href="/admin">Run evals</Link> here, or open production to see
            prior charts.
          </p>
        </section>
      ) : modelIds.length === 0 ? (
        <section className="admin-card">
          <p className="muted">Select at least one model to plot.</p>
        </section>
      ) : kpis.pointCount === 0 ? (
        <section className="admin-card">
          <p className="muted">
            No points for the selected models/suite. Use <strong>With history</strong>{" "}
            above, switch suite to All, or run evals for these models.
          </p>
        </section>
      ) : (
        <TrendChartsPanel series={series} kpis={kpis} labelFor={labelFor} />
      )}
    </div>
  );
}

export type ModelProvider = "anthropic" | "openai" | "google";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  /** Approximate public release / GA date (YYYY-MM-DD) for UI ordering. */
  releasedAt: string;
  /** Standard list price ($/MTok). Cache/batch discounts ignored. */
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * Active text/chat models for the app + admin eval dashboard.
 * Prior-gen peers are kept so evals can compare progress over time.
 * Specialized audio/image/video/embedding models are intentionally omitted.
 *
 * Sources:
 * - https://platform.claude.com/docs/en/about-claude/models/overview
 * - https://developers.openai.com/api/docs/models
 * - https://ai.google.dev/gemini-api/docs/models
 *
 * Within each provider: newest release first so current models are easiest to pick.
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  // Anthropic — newest first
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    provider: "anthropic",
    description: "Highest Claude ceiling — long-horizon reasoning and hard evals",
    releasedAt: "2026-09-15",
    inputPerMTok: 10,
    outputPerMTok: 50,
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    provider: "anthropic",
    description: "Current Opus — long-running agentic coding and knowledge work",
    releasedAt: "2026-09-10",
    inputPerMTok: 4,
    outputPerMTok: 20,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    provider: "anthropic",
    description: "Current Sonnet — best Claude balance of speed and intelligence",
    releasedAt: "2026-09-08",
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    provider: "anthropic",
    description: "Prior-gen Opus — baseline vs Opus 5.5",
    releasedAt: "2026-05-20",
    inputPerMTok: 5,
    outputPerMTok: 25,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    description: "Prior-gen Sonnet — baseline vs Sonnet 5.5",
    releasedAt: "2026-05-15",
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest / cheapest Claude — cost and latency baseline",
    releasedAt: "2025-10-01",
    inputPerMTok: 1,
    outputPerMTok: 5,
  },

  // OpenAI — newest first
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    provider: "openai",
    description: "Most capable OpenAI model for hardest end-to-end work",
    releasedAt: "2026-09-20",
    inputPerMTok: 10,
    outputPerMTok: 50,
  },
  {
    id: "gpt-6.1-sol",
    label: "GPT-6.1 Sol",
    provider: "openai",
    description: "Current OpenAI balance — near-Astra at lower cost",
    releasedAt: "2026-09-18",
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    provider: "openai",
    description: "Current efficient OpenAI model for high-volume workloads",
    releasedAt: "2026-09-16",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
  },
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    provider: "openai",
    description: "Prior-gen mid/strong OpenAI — baseline vs GPT-6.1 Sol",
    releasedAt: "2026-04-10",
    inputPerMTok: 4,
    outputPerMTok: 20,
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    provider: "openai",
    description: "Prior-gen cheap OpenAI tier — baseline vs GPT-6 Luna",
    releasedAt: "2026-04-08",
    inputPerMTok: 0.2,
    outputPerMTok: 1.2,
  },

  // Google — newest first
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "google",
    description: "Current most intelligent Gemini Flash — long-horizon agents",
    releasedAt: "2026-09-25",
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    provider: "google",
    description: "Prior-gen Flash — baseline vs Gemini 3.8 Flash",
    releasedAt: "2026-08-15",
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    provider: "google",
    description: "Cheap/fast Gemini for high-throughput execution",
    releasedAt: "2026-07-01",
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    provider: "google",
    description: "Gemini Pro — complex problem-solving and agentic coding",
    releasedAt: "2026-06-15",
    inputPerMTok: 2,
    outputPerMTok: 12,
  },
];

/**
 * Labels for models removed from the active picker but still present in
 * historical eval runs / trends. Keeps charts readable without re-enabling
 * those IDs for new runs.
 */
export const RETIRED_MODEL_META: Record<
  string,
  { label: string; provider: ModelProvider; releasedAt: string }
> = {
  "gpt-5.6-terra": {
    label: "GPT-5.6 Terra",
    provider: "openai",
    releasedAt: "2026-04-09",
  },
  "gemini-3.6-flash": {
    label: "Gemini 3.6 Flash",
    provider: "google",
    releasedAt: "2026-07-20",
  },
  "gemini-3.5-flash": {
    label: "Gemini 3.5 Flash",
    provider: "google",
    releasedAt: "2026-06-01",
  },
  "gemini-3.1-flash-lite": {
    label: "Gemini 3.1 Flash-Lite",
    provider: "google",
    releasedAt: "2026-05-01",
  },
  "gemini-3-flash-preview": {
    label: "Gemini 3 Flash (preview)",
    provider: "google",
    releasedAt: "2026-04-01",
  },
};

export const DEFAULT_MODEL_ID =
  process.env.DEFAULT_MODEL ??
  process.env.ANTHROPIC_MODEL ??
  process.env.OPENAI_MODEL ??
  process.env.GOOGLE_MODEL ??
  "claude-sonnet-5-5";

export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

export function getModelLabel(modelId: string): string {
  return (
    getModelDefinition(modelId)?.label ??
    RETIRED_MODEL_META[modelId]?.label ??
    modelId
  );
}

export function getModelProvider(modelId: string): ModelProvider | undefined {
  return (
    getModelDefinition(modelId)?.provider ??
    RETIRED_MODEL_META[modelId]?.provider
  );
}

export function getModelReleasedAt(modelId: string): string {
  return (
    getModelDefinition(modelId)?.releasedAt ??
    RETIRED_MODEL_META[modelId]?.releasedAt ??
    "1970-01-01"
  );
}

/** Newest release first. */
export function compareModelsByReleaseDesc(aId: string, bId: string): number {
  const byDate = getModelReleasedAt(bId).localeCompare(getModelReleasedAt(aId));
  if (byDate !== 0) return byDate;
  return aId.localeCompare(bId);
}

export function isAllowedModelId(modelId: string): boolean {
  return MODEL_REGISTRY.some((m) => m.id === modelId);
}

export function modelsForProvider(provider: ModelProvider): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

export function resolveModelId(modelId?: string | null): string {
  if (modelId && isAllowedModelId(modelId)) return modelId;
  if (isAllowedModelId(DEFAULT_MODEL_ID)) return DEFAULT_MODEL_ID;
  return MODEL_REGISTRY[0]!.id;
}

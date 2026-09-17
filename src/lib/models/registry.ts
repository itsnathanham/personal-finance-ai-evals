export type ModelProvider = "anthropic";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  /** Standard list price ($/MTok). */
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * Current Claude API lineup for the app + admin eval dashboard.
 * Source: https://platform.claude.com/docs/en/about-claude/models/overview
 * Provider-pluggable later; Anthropic-only for now.
 *
 * Order: cheapest → most capable so admin defaults stay cost-safe.
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest / cheapest — cost and latency baseline",
    inputPerMTok: 1,
    outputPerMTok: 5,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    description: "Best balance of speed and intelligence",
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    provider: "anthropic",
    description: "Strong default for complex agentic and enterprise work",
    inputPerMTok: 5,
    outputPerMTok: 25,
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    provider: "anthropic",
    description: "Highest ceiling — long-horizon reasoning and hard evals",
    inputPerMTok: 10,
    outputPerMTok: 50,
  },
];

export const DEFAULT_MODEL_ID =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

export function isAllowedModelId(modelId: string): boolean {
  return MODEL_REGISTRY.some((m) => m.id === modelId);
}

export function resolveModelId(modelId?: string | null): string {
  if (modelId && isAllowedModelId(modelId)) return modelId;
  if (isAllowedModelId(DEFAULT_MODEL_ID)) return DEFAULT_MODEL_ID;
  return MODEL_REGISTRY[0]!.id;
}

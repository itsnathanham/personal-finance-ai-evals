export type ModelProvider = "anthropic";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  /** Standard list price ($/MTok). Sonnet 5 may use intro rates via pricing helper. */
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * Curated Claude models for the app + admin eval dashboard.
 * Provider-pluggable later; Anthropic-only for now.
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
    description: "Default balance of quality, speed, and cost",
    inputPerMTok: 3,
    outputPerMTok: 15,
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    provider: "anthropic",
    description: "Highest quality ceiling in the current stack",
    inputPerMTok: 5,
    outputPerMTok: 25,
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

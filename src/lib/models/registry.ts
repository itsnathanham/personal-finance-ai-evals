export type ModelProvider = "anthropic";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
};

/**
 * Curated Claude models for the copilot + admin eval dashboard.
 * Provider-pluggable later; Anthropic-only for now.
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: "claude-sonnet-4-5-20250929",
    label: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Strong default for grounded Q&A and refusals",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Faster / cheaper — useful for eval cost comparisons",
  },
  {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    provider: "anthropic",
    description: "Highest capability Anthropic model in this registry",
  },
];

export const DEFAULT_MODEL_ID =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";

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

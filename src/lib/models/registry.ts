export type ModelProvider = "anthropic" | "openai" | "google";

export type ModelDefinition = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  /** Standard list price ($/MTok). Cache/batch discounts ignored. */
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * Current text/chat models for the app + admin eval dashboard.
 * Specialized audio/image/video/embedding models are intentionally omitted.
 *
 * Sources:
 * - https://platform.claude.com/docs/en/about-claude/models/overview
 * - https://developers.openai.com/api/docs/models
 * - https://ai.google.dev/gemini-api/docs/models
 *
 * Within each provider: cheaper → more capable so defaults stay cost-safe.
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  // Anthropic — current Claude lineup
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest / cheapest Claude — cost and latency baseline",
    inputPerMTok: 1,
    outputPerMTok: 5,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    description: "Best Claude balance of speed and intelligence",
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
    description: "Highest Claude ceiling — long-horizon reasoning and hard evals",
    inputPerMTok: 10,
    outputPerMTok: 50,
  },

  // OpenAI — current flagship text models
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    provider: "openai",
    description: "Cost-sensitive high-volume OpenAI workloads",
    inputPerMTok: 0.2,
    outputPerMTok: 1.2,
  },
  {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    provider: "openai",
    description: "OpenAI balance of intelligence and cost",
    inputPerMTok: 2,
    outputPerMTok: 12,
  },
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    provider: "openai",
    description: "OpenAI flagship for complex professional work",
    inputPerMTok: 4,
    outputPerMTok: 20,
  },
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    provider: "openai",
    description: "Most capable OpenAI model for hardest end-to-end work",
    inputPerMTok: 10,
    outputPerMTok: 50,
  },

  // Google — current Gemini text/chat models (stable + still-listed preview chat)
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    provider: "google",
    description: "Fastest / cheapest Gemini 2.5 for high-throughput tasks",
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    description: "Gemini 2.5 price-performance with reasoning",
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    provider: "google",
    description: "Cost-efficient Gemini 3.x for high-volume agentic tasks",
    inputPerMTok: 0.25,
    outputPerMTok: 1.5,
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    provider: "google",
    description: "Fast Gemini 3.5 for high-throughput execution",
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (preview)",
    provider: "google",
    description: "Legacy Gemini 3 Flash preview baseline",
    inputPerMTok: 0.5,
    outputPerMTok: 3,
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    provider: "google",
    description: "Gemini 3.6 balance of speed and multimodal agentic work",
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    provider: "google",
    description: "Gemini 3.7 for coding, tool use, and multi-step execution",
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "google",
    description: "Most intelligent Gemini Flash — long-horizon agents",
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    description: "Gemini 2.5 advanced reasoning and coding",
    inputPerMTok: 1.25,
    outputPerMTok: 10,
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "google",
    description: "Gemini 3.5 Flash for routine high-throughput workloads",
    inputPerMTok: 1.5,
    outputPerMTok: 9,
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    provider: "google",
    description: "Gemini 3.1 Pro — complex problem-solving and agentic coding",
    inputPerMTok: 2,
    outputPerMTok: 12,
  },
];

export const DEFAULT_MODEL_ID =
  process.env.DEFAULT_MODEL ??
  process.env.ANTHROPIC_MODEL ??
  process.env.OPENAI_MODEL ??
  process.env.GOOGLE_MODEL ??
  "claude-sonnet-5";

export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
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

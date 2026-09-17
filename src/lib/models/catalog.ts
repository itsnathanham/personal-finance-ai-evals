import {
  isProviderConfigured,
  listConfiguredModels,
  resolveAvailableModelId,
} from "@/lib/model";
import {
  MODEL_REGISTRY,
  type ModelDefinition,
  type ModelProvider,
} from "@/lib/models/registry";

export type CatalogModel = {
  id: string;
  label: string;
  description: string;
  provider: ModelProvider;
  configured: boolean;
};

const PROVIDER_LABEL: Record<ModelProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

export function providerLabel(provider: ModelProvider): string {
  return PROVIDER_LABEL[provider];
}

export function toCatalogModel(m: ModelDefinition): CatalogModel {
  return {
    id: m.id,
    label: m.label,
    description: m.description,
    provider: m.provider,
    configured: isProviderConfigured(m.provider),
  };
}

/** Full registry with configured flags (admin shows all; disables missing keys). */
export function catalogModels(): CatalogModel[] {
  return MODEL_REGISTRY.map(toCatalogModel);
}

/** Only models whose provider API key is present (copilot dropdown). */
export function availableCatalogModels(): CatalogModel[] {
  return listConfiguredModels().map(toCatalogModel);
}

export function defaultAvailableModelId(): string {
  return resolveAvailableModelId(undefined);
}

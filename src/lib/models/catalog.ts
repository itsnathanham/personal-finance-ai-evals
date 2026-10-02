import {
  isProviderConfigured,
  listConfiguredModels,
  resolveAvailableModelId,
} from "@/lib/model";
import {
  compareModelsByReleaseDesc,
  MODEL_REGISTRY,
  PROVIDER_ORDER,
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

export function toCatalogModel(m: ModelDefinition): CatalogModel {
  return {
    id: m.id,
    label: m.label,
    description: m.description,
    provider: m.provider,
    configured: isProviderConfigured(m.provider),
  };
}

function byProviderThenReleaseDesc(a: ModelDefinition, b: ModelDefinition) {
  const pi = PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider);
  if (pi !== 0) return pi;
  return compareModelsByReleaseDesc(a.id, b.id);
}

/** Full registry with configured flags (admin shows all; disables missing keys). */
export function catalogModels(): CatalogModel[] {
  return [...MODEL_REGISTRY].sort(byProviderThenReleaseDesc).map(toCatalogModel);
}

/** Only models whose provider API key is present (copilot dropdown). */
export function availableCatalogModels(): CatalogModel[] {
  return listConfiguredModels()
    .sort(byProviderThenReleaseDesc)
    .map(toCatalogModel);
}

export function defaultAvailableModelId(): string {
  return resolveAvailableModelId(undefined);
}

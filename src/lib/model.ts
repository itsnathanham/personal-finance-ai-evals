import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  getModelDefinition,
  MODEL_REGISTRY,
  resolveModelId,
  type ModelDefinition,
  type ModelProvider,
} from "@/lib/models/registry";

/**
 * Vercel CLI / paste flows can sneak non-ASCII (e.g. dotenv’s ◇ tip) into env
 * values when keys are captured via shell command substitution. HTTP headers
 * must be ByteString — recover a real provider key when possible.
 *
 * Secrets live only in env (`.env.local` / Vercel env) — never in the repo.
 */

export function sanitizeAnthropicApiKey(
  raw: string | undefined | null,
): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/sk-ant-[A-Za-z0-9\-_]+/);
  if (match) return match[0];
  const cleaned = raw.replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function sanitizeOpenAIApiKey(
  raw: string | undefined | null,
): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/sk-[A-Za-z0-9\-_]{20,}/);
  if (match) return match[0];
  const cleaned = raw.replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Google AI Studio / Gemini Developer API key (AIza… or newer AQ.… forms). */
export function sanitizeGoogleApiKey(
  raw: string | undefined | null,
): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(?:AIza[0-9A-Za-z\-_]{20,}|AQ\.[0-9A-Za-z\-_]{20,})/);
  if (match) return match[0];
  const cleaned = raw.replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function applySanitizedEnv(
  name: string,
  value: string | undefined,
): string | undefined {
  if (value) process.env[name] = value;
  return value;
}

const anthropicKey = applySanitizedEnv(
  "ANTHROPIC_API_KEY",
  sanitizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY),
);

const openaiKey = applySanitizedEnv(
  "OPENAI_API_KEY",
  sanitizeOpenAIApiKey(process.env.OPENAI_API_KEY),
);

/** Prefer GOOGLE_GENERATIVE_AI_API_KEY (AI SDK default); accept GEMINI_API_KEY. */
const googleKeyRaw =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
const googleKey = sanitizeGoogleApiKey(googleKeyRaw);
if (googleKey) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = googleKey;
}

const PROVIDER_ENV: Record<
  ModelProvider,
  { configured: boolean; missingMessage: string }
> = {
  anthropic: {
    configured: Boolean(anthropicKey),
    missingMessage:
      "ANTHROPIC_API_KEY is not configured. Add it to .env.local (or Vercel env) to use Claude models.",
  },
  openai: {
    configured: Boolean(openaiKey),
    missingMessage:
      "OPENAI_API_KEY is not configured. Add it to .env.local (or Vercel env) to use OpenAI models.",
  },
  google: {
    configured: Boolean(googleKey),
    missingMessage:
      "GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not configured. Add it to .env.local (or Vercel env) to use Gemini models.",
  },
};

export function isProviderConfigured(provider: ModelProvider): boolean {
  return PROVIDER_ENV[provider].configured;
}

export function requireProviderKey(provider: ModelProvider): string | null {
  const entry = PROVIDER_ENV[provider];
  return entry.configured ? null : entry.missingMessage;
}

export function requireKeyForModel(modelId?: string | null): string | null {
  const resolved = resolveAvailableModelId(modelId);
  const def = getModelDefinition(resolved);
  if (!def) return `Unknown modelId: ${resolved}`;
  return requireProviderKey(def.provider);
}

export function listConfiguredModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => isProviderConfigured(m.provider));
}

export function resolveAvailableModelId(modelId?: string | null): string {
  if (modelId) {
    const def = getModelDefinition(modelId);
    if (def && isProviderConfigured(def.provider)) return modelId;
  }
  const preferred = resolveModelId(undefined);
  const preferredDef = getModelDefinition(preferred);
  if (preferredDef && isProviderConfigured(preferredDef.provider)) {
    return preferred;
  }
  return listConfiguredModels()[0]?.id ?? preferred;
}

export function getModel(modelId?: string | null) {
  const id = resolveAvailableModelId(modelId);
  const def = getModelDefinition(id);
  if (!def) {
    throw new Error(`Unknown modelId: ${id}`);
  }

  switch (def.provider) {
    case "anthropic":
      return anthropic(id);
    case "openai":
      return openai(id);
    case "google":
      return google(id);
    default: {
      const _exhaustive: never = def.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

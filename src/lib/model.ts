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
 *
 * Keys are read lazily at call time (not module init). Next/Vercel can inline
 * missing `process.env.FOO` at build time; dynamic access keeps runtime env
 * (e.g. keys added after the first deploy) visible to admin + chat.
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

function readEnv(name: string): string | undefined {
  // Dynamic lookup — avoids build-time inlining of undefined secrets.
  const value = process.env[name];
  return typeof value === "string" ? value : undefined;
}

function anthropicKey(): string | undefined {
  const key = sanitizeAnthropicApiKey(readEnv("ANTHROPIC_API_KEY"));
  if (key) process.env.ANTHROPIC_API_KEY = key;
  return key;
}

function openaiKey(): string | undefined {
  const key = sanitizeOpenAIApiKey(readEnv("OPENAI_API_KEY"));
  if (key) process.env.OPENAI_API_KEY = key;
  return key;
}

function googleKey(): string | undefined {
  const raw =
    readEnv("GOOGLE_GENERATIVE_AI_API_KEY") ?? readEnv("GEMINI_API_KEY");
  const key = sanitizeGoogleApiKey(raw);
  if (key) process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  return key;
}

const PROVIDER_MISSING: Record<ModelProvider, string> = {
  anthropic:
    "ANTHROPIC_API_KEY is not configured. Add it to .env.local (or Vercel env) to use Claude models.",
  openai:
    "OPENAI_API_KEY is not configured. Add it to .env.local (or Vercel env) to use OpenAI models.",
  google:
    "GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) is not configured. Add it to .env.local (or Vercel env) to use Gemini models.",
};

export function isProviderConfigured(provider: ModelProvider): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(anthropicKey());
    case "openai":
      return Boolean(openaiKey());
    case "google":
      return Boolean(googleKey());
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function requireProviderKey(provider: ModelProvider): string | null {
  return isProviderConfigured(provider) ? null : PROVIDER_MISSING[provider];
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

  // Ensure sanitized keys are on process.env before the SDK reads them.
  switch (def.provider) {
    case "anthropic":
      anthropicKey();
      return anthropic(id);
    case "openai":
      openaiKey();
      return openai(id);
    case "google":
      googleKey();
      return google(id);
    default: {
      const _exhaustive: never = def.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

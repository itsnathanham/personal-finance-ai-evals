import { anthropic } from "@ai-sdk/anthropic";
import { resolveModelId } from "@/lib/models/registry";

/**
 * Vercel CLI / paste flows can sneak non-ASCII (e.g. dotenv’s ◇ tip) into env
 * values when keys are captured via shell command substitution. HTTP headers
 * must be ByteString — recover a real Anthropic key when possible.
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

const cleanedKey = sanitizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY);
if (cleanedKey) {
  process.env.ANTHROPIC_API_KEY = cleanedKey;
}

export function getModel(modelId?: string | null) {
  return anthropic(resolveModelId(modelId));
}

export function requireAnthropicKey(): string | null {
  if (!sanitizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY)) {
    return "ANTHROPIC_API_KEY is not configured. Add it to .env.local to use the app.";
  }
  return null;
}

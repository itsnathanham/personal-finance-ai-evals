import { anthropic } from "@ai-sdk/anthropic";
import { resolveModelId } from "@/lib/models/registry";

export function getModel(modelId?: string | null) {
  return anthropic(resolveModelId(modelId));
}

export function requireAnthropicKey(): string | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "ANTHROPIC_API_KEY is not configured. Add it to .env.local to use the copilot.";
  }
  return null;
}

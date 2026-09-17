import { runCopilotEval } from "@/lib/evals/run-copilot";
import { requireKeyForModel } from "@/lib/model";
import { isAllowedModelId } from "@/lib/models/registry";
import { DEMO_HOUSEHOLD_ID } from "@/db/seed-data";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Non-streaming endpoint for Promptfoo / CI / admin evals.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`eval:${clientKey(req)}`, 100);
  if (!rl.ok) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json();
  const prompt =
    typeof body.prompt === "string"
      ? body.prompt
      : typeof body.message === "string"
        ? body.message
        : null;

  if (!prompt) {
    return Response.json(
      { error: "Expected { prompt: string }" },
      { status: 400 },
    );
  }

  const modelId =
    typeof body.modelId === "string" ? body.modelId : undefined;
  if (modelId && !isAllowedModelId(modelId)) {
    return Response.json({ error: "Unknown modelId" }, { status: 400 });
  }

  const missingKey = requireKeyForModel(modelId);
  if (missingKey) {
    return Response.json({ error: missingKey }, { status: 503 });
  }

  const householdId =
    typeof body.householdId === "string"
      ? body.householdId
      : DEMO_HOUSEHOLD_ID;

  const result = await runCopilotEval({ prompt, modelId, householdId });
  return Response.json(result);
}

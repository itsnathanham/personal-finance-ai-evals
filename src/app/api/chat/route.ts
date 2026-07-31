import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createFinanceTools } from "@/lib/finance-tools";
import { getModel, requireAnthropicKey } from "@/lib/model";
import { isAllowedModelId } from "@/lib/models/registry";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { DEMO_HOUSEHOLD_ID } from "@/db/seed-data";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const missingKey = requireAnthropicKey();
  if (missingKey) {
    return Response.json({ error: missingKey }, { status: 503 });
  }

  const rl = rateLimit(clientKey(req));
  if (!rl.ok) {
    return Response.json(
      {
        error: "Rate limit exceeded. Try again later.",
        resetAt: rl.resetAt,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      },
    );
  }

  const body = await req.json();
  const messages = body.messages as UIMessage[];
  const householdId =
    typeof body.householdId === "string" && body.householdId.length > 0
      ? body.householdId
      : DEMO_HOUSEHOLD_ID;

  if (householdId !== DEMO_HOUSEHOLD_ID) {
    return Response.json(
      { error: "Only the demo household is available in this environment." },
      { status: 403 },
    );
  }

  const modelId =
    typeof body.modelId === "string" ? body.modelId : undefined;
  if (modelId && !isAllowedModelId(modelId)) {
    return Response.json({ error: "Unknown modelId" }, { status: 400 });
  }

  const result = streamText({
    model: getModel(modelId),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: createFinanceTools(householdId),
    stopWhen: stepCountIs(Number(process.env.CHAT_MAX_STEPS ?? 6)),
    temperature: 0.2,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
    headers: {
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(rl.resetAt),
    },
  });
}

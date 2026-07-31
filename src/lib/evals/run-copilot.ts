import { generateText, stepCountIs, type ToolSet } from "ai";
import { createFinanceTools } from "@/lib/finance-tools";
import { getModel } from "@/lib/model";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { DEMO_HOUSEHOLD_ID } from "@/db/seed-data";
import { resolveModelId } from "@/lib/models/registry";

export type EvalCoreResult = {
  output: string;
  toolsUsed: string[];
  toolResults: unknown[];
  finishReason: string;
  modelId: string;
  refused?: boolean;
  latencyMs: number;
};

export async function runCopilotEval(options: {
  prompt: string;
  modelId?: string | null;
  householdId?: string;
}): Promise<EvalCoreResult> {
  const modelId = resolveModelId(options.modelId);
  const householdId = options.householdId ?? DEMO_HOUSEHOLD_ID;
  const started = Date.now();

  if (householdId !== DEMO_HOUSEHOLD_ID) {
    return {
      output:
        "I can only access The Jetski Household in this demo. I will not retrieve another household's data.",
      toolsUsed: [],
      toolResults: [],
      finishReason: "stop",
      modelId,
      refused: true,
      latencyMs: Date.now() - started,
    };
  }

  const tools = createFinanceTools(householdId) as ToolSet;
  const toolsUsed: string[] = [];
  const toolResults: unknown[] = [];

  const result = await generateText({
    model: getModel(modelId),
    system: SYSTEM_PROMPT,
    prompt: options.prompt,
    tools,
    stopWhen: stepCountIs(Number(process.env.CHAT_MAX_STEPS ?? 6)),
    temperature: 0,
    onStepFinish: ({ toolCalls, toolResults: stepResults }) => {
      for (const call of toolCalls ?? []) {
        toolsUsed.push(call.toolName);
      }
      for (const tr of stepResults ?? []) {
        toolResults.push({
          toolName: tr.toolName,
          output: "output" in tr ? tr.output : undefined,
        });
      }
    },
  });

  return {
    output: result.text,
    toolsUsed,
    toolResults,
    finishReason: result.finishReason,
    modelId,
    latencyMs: Date.now() - started,
  };
}

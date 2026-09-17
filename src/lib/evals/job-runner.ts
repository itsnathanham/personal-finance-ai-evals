import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evalCaseResults, evalRuns } from "@/db/schema";
import { gradeCase } from "@/lib/evals/graders";
import {
  getSuitesByIds,
  type SuiteId,
} from "@/lib/evals/load-suites";
import type { EvalCoreResult } from "@/lib/evals/run-copilot";
import { buildRunSummary } from "@/lib/models/pricing";
import { isAllowedModelId } from "@/lib/models/registry";

export type EvalJobItem = {
  suiteId: SuiteId;
  suiteName: string;
  caseId: string;
  description: string;
  prompt: string;
  modelId: string;
};

export type PersistedCaseResult = {
  suiteId: string;
  caseId: string;
  description: string;
  modelId: string;
  prompt: string;
  output: string | null;
  toolsUsed: string[];
  pass: boolean;
  failReasons: string[];
  latencyMs: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  errorMessage?: string | null;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildEvalJobs(input: {
  suiteIds: SuiteId[];
  modelIds: string[];
}): EvalJobItem[] {
  const suites = getSuitesByIds(input.suiteIds);
  const jobs: EvalJobItem[] = [];
  for (const modelId of input.modelIds) {
    if (!isAllowedModelId(modelId)) continue;
    for (const suite of suites) {
      for (const evalCase of suite.cases) {
        jobs.push({
          suiteId: suite.id,
          suiteName: suite.name,
          caseId: evalCase.id,
          description: evalCase.description,
          prompt: evalCase.prompt,
          modelId,
        });
      }
    }
  }
  return jobs;
}

export async function persistCompletedRun(input: {
  suiteIds: SuiteId[];
  modelIds: string[];
  results: PersistedCaseResult[];
}): Promise<string> {
  const runId = newId("run");
  const db = await getDb();
  const passed = input.results.filter((r) => r.pass).length;
  const failed = input.results.filter((r) => !r.pass && !r.errorMessage).length;
  const errors = input.results.filter((r) => Boolean(r.errorMessage)).length;
  const completed = input.results.length;
  const summary = buildRunSummary(input.results);

  const now = new Date();
  await db.insert(evalRuns).values({
    id: runId,
    status: "completed",
    suiteIdsJson: JSON.stringify(input.suiteIds),
    modelIdsJson: JSON.stringify(input.modelIds),
    totalCases: completed,
    completedCases: completed,
    passedCases: passed,
    failedCases: failed,
    errorCases: errors,
    currentLabel: "Completed",
    summaryJson: JSON.stringify(summary),
    startedAt: now,
    finishedAt: now,
  });

  if (input.results.length > 0) {
    await db.insert(evalCaseResults).values(
      input.results.map((row) => ({
        id: newId("case"),
        runId,
        suiteId: row.suiteId,
        caseId: row.caseId,
        caseDescription: row.description,
        modelId: row.modelId,
        prompt: row.prompt,
        output: row.output,
        toolsUsedJson: JSON.stringify(row.toolsUsed),
        pass: row.pass,
        failReasonsJson: JSON.stringify(row.failReasons),
        latencyMs: row.latencyMs,
        inputTokens: row.inputTokens ?? null,
        outputTokens: row.outputTokens ?? null,
        totalTokens: row.totalTokens ?? null,
        estimatedCostUsd:
          row.estimatedCostUsd == null ? null : String(row.estimatedCostUsd),
        errorMessage: row.errorMessage ?? null,
      })),
    );
  }

  return runId;
}

export async function listPersistedRuns(limit = 50) {
  const db = await getDb();
  return db.select().from(evalRuns).orderBy(desc(evalRuns.startedAt)).limit(limit);
}

export async function getPersistedRun(id: string) {
  const db = await getDb();
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, id))
    .limit(1);
  if (!run) return null;
  const cases = await db
    .select()
    .from(evalCaseResults)
    .where(eq(evalCaseResults.runId, id));
  return { run, cases };
}

export async function deletePersistedRun(id: string): Promise<boolean> {
  const db = await getDb();
  const [run] = await db
    .select({ id: evalRuns.id })
    .from(evalRuns)
    .where(eq(evalRuns.id, id))
    .limit(1);
  if (!run) return false;
  await db.delete(evalCaseResults).where(eq(evalCaseResults.runId, id));
  await db.delete(evalRuns).where(eq(evalRuns.id, id));
  return true;
}

export function gradeEvalResult(caseId: string, result: EvalCoreResult) {
  return gradeCase({ caseId, result });
}

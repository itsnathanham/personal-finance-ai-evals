import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evalCaseResults, evalRuns } from "@/db/schema";
import { gradeCase } from "@/lib/evals/graders";
import {
  getSuitesByIds,
  listSuites,
  type SuiteId,
} from "@/lib/evals/load-suites";
import type { EvalCoreResult } from "@/lib/evals/run-copilot";
import { isAllowedModelId } from "@/lib/models/registry";

export type EvalJobItem = {
  suiteId: SuiteId;
  suiteName: string;
  caseId: string;
  description: string;
  prompt: string;
  modelId: string;
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

export function getCatalogPayload() {
  return {
    models: undefined as undefined,
    suites: listSuites().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      caseCount: s.cases.length,
      cases: s.cases.map((c) => ({
        id: c.id,
        description: c.description,
        prompt: c.prompt,
      })),
    })),
  };
}

export async function persistCompletedRun(input: {
  suiteIds: SuiteId[];
  modelIds: string[];
  results: Array<{
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
    errorMessage?: string | null;
  }>;
}): Promise<string> {
  const runId = newId("run");
  const db = await getDb();
  const passed = input.results.filter((r) => r.pass).length;
  const failed = input.results.filter((r) => !r.pass && !r.errorMessage).length;
  const errors = input.results.filter((r) => Boolean(r.errorMessage)).length;
  const completed = input.results.length;
  const passRate =
    completed === 0 ? 0 : Number(((passed / completed) * 100).toFixed(1));

  const perModel: Record<string, { passed: number; total: number }> = {};
  for (const row of input.results) {
    const bucket = perModel[row.modelId] ?? { passed: 0, total: 0 };
    bucket.total += 1;
    if (row.pass) bucket.passed += 1;
    perModel[row.modelId] = bucket;
  }

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
    summaryJson: JSON.stringify({
      passRate,
      perModel: Object.fromEntries(
        Object.entries(perModel).map(([id, v]) => [
          id,
          {
            passed: v.passed,
            total: v.total,
            passRate:
              v.total === 0
                ? 0
                : Number(((v.passed / v.total) * 100).toFixed(1)),
          },
        ]),
      ),
    }),
    startedAt: now,
    finishedAt: now,
  });

  for (const row of input.results) {
    await db.insert(evalCaseResults).values({
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
      errorMessage: row.errorMessage ?? null,
    });
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

export function gradeEvalResult(caseId: string, result: EvalCoreResult) {
  return gradeCase({ caseId, result });
}

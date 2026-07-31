import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evalCaseResults, evalRuns } from "@/db/schema";
import { gradeCase } from "@/lib/evals/graders";
import { getSuitesByIds, type SuiteId } from "@/lib/evals/load-suites";
import { runCopilotEval } from "@/lib/evals/run-copilot";

const globalJobs = globalThis as unknown as {
  __evalJobs?: Set<string>;
};

function activeJobs() {
  if (!globalJobs.__evalJobs) globalJobs.__evalJobs = new Set();
  return globalJobs.__evalJobs;
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function createAndStartEvalRun(input: {
  suiteIds: SuiteId[];
  modelIds: string[];
}): Promise<string> {
  const suites = getSuitesByIds(input.suiteIds);
  const workItems = [];
  for (const modelId of input.modelIds) {
    for (const suite of suites) {
      for (const evalCase of suite.cases) {
        workItems.push({ modelId, suite, evalCase });
      }
    }
  }

  const runId = newId("run");
  const db = await getDb();
  await db.insert(evalRuns).values({
    id: runId,
    status: "queued",
    suiteIdsJson: JSON.stringify(input.suiteIds),
    modelIdsJson: JSON.stringify(input.modelIds),
    totalCases: workItems.length,
    completedCases: 0,
    passedCases: 0,
    failedCases: 0,
    errorCases: 0,
    currentLabel: "Starting…",
  });

  // Fire-and-forget in this Node process
  void executeEvalRun(runId, workItems);
  return runId;
}

async function executeEvalRun(
  runId: string,
  workItems: Array<{
    modelId: string;
    suite: { id: SuiteId; name: string };
    evalCase: { id: string; description: string; prompt: string; suiteId: SuiteId };
  }>,
) {
  if (activeJobs().has(runId)) return;
  activeJobs().add(runId);
  const db = await getDb();
  const concurrency = Number(process.env.EVAL_CONCURRENCY ?? 2);

  try {
    await db
      .update(evalRuns)
      .set({ status: "running", currentLabel: "Running cases…" })
      .where(eq(evalRuns.id, runId));

    let completed = 0;
    let passed = 0;
    let failed = 0;
    let errors = 0;

    await mapPool(workItems, concurrency, async (item) => {
      const label = `${item.suite.name} · ${item.evalCase.description} · ${item.modelId}`;
      await db
        .update(evalRuns)
        .set({ currentLabel: label })
        .where(eq(evalRuns.id, runId));

      try {
        const result = await runCopilotEval({
          prompt: item.evalCase.prompt,
          modelId: item.modelId,
        });
        const grade = gradeCase({
          caseId: item.evalCase.id,
          result,
        });

        await db.insert(evalCaseResults).values({
          id: newId("case"),
          runId,
          suiteId: item.suite.id,
          caseId: item.evalCase.id,
          caseDescription: item.evalCase.description,
          modelId: item.modelId,
          prompt: item.evalCase.prompt,
          output: result.output,
          toolsUsedJson: JSON.stringify(result.toolsUsed),
          pass: grade.pass,
          failReasonsJson: JSON.stringify(grade.failReasons),
          latencyMs: result.latencyMs,
        });

        completed += 1;
        if (grade.pass) passed += 1;
        else failed += 1;
      } catch (err) {
        completed += 1;
        errors += 1;
        await db.insert(evalCaseResults).values({
          id: newId("case"),
          runId,
          suiteId: item.suite.id,
          caseId: item.evalCase.id,
          caseDescription: item.evalCase.description,
          modelId: item.modelId,
          prompt: item.evalCase.prompt,
          output: null,
          toolsUsedJson: "[]",
          pass: false,
          failReasonsJson: JSON.stringify(["Runtime error"]),
          latencyMs: null,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }

      await db
        .update(evalRuns)
        .set({
          completedCases: completed,
          passedCases: passed,
          failedCases: failed,
          errorCases: errors,
        })
        .where(eq(evalRuns.id, runId));
    });

    const passRate =
      completed === 0 ? 0 : Number(((passed / completed) * 100).toFixed(1));

    const perModel: Record<string, { passed: number; total: number }> = {};
    const rows = await db
      .select()
      .from(evalCaseResults)
      .where(eq(evalCaseResults.runId, runId));
    for (const row of rows) {
      const bucket = perModel[row.modelId] ?? { passed: 0, total: 0 };
      bucket.total += 1;
      if (row.pass) bucket.passed += 1;
      perModel[row.modelId] = bucket;
    }

    await db
      .update(evalRuns)
      .set({
        status: "completed",
        currentLabel: "Completed",
        finishedAt: new Date(),
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
      })
      .where(eq(evalRuns.id, runId));
  } catch (err) {
    await db
      .update(evalRuns)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
        currentLabel: "Failed",
      })
      .where(eq(evalRuns.id, runId));
  } finally {
    activeJobs().delete(runId);
  }
}

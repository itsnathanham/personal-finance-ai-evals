import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { evalCaseResults, evalRuns } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await getDb();
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, id))
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cases = await db
    .select()
    .from(evalCaseResults)
    .where(eq(evalCaseResults.runId, id))
    .orderBy(asc(evalCaseResults.createdAt));

  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      suiteIds: JSON.parse(run.suiteIdsJson) as string[],
      modelIds: JSON.parse(run.modelIdsJson) as string[],
      totalCases: run.totalCases,
      completedCases: run.completedCases,
      passedCases: run.passedCases,
      failedCases: run.failedCases,
      errorCases: run.errorCases,
      currentLabel: run.currentLabel,
      summary: run.summaryJson ? JSON.parse(run.summaryJson) : null,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      passRate:
        run.completedCases > 0
          ? Number(((run.passedCases / run.completedCases) * 100).toFixed(1))
          : null,
    },
    cases: cases.map((c) => ({
      id: c.id,
      suiteId: c.suiteId,
      caseId: c.caseId,
      description: c.caseDescription,
      modelId: c.modelId,
      prompt: c.prompt,
      output: c.output,
      toolsUsed: c.toolsUsedJson ? JSON.parse(c.toolsUsedJson) : [],
      pass: c.pass,
      failReasons: c.failReasonsJson ? JSON.parse(c.failReasonsJson) : [],
      latencyMs: c.latencyMs,
      errorMessage: c.errorMessage,
      createdAt: c.createdAt,
    })),
  });
}

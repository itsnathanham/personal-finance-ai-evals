import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  deletePersistedRun,
  getPersistedRun,
} from "@/lib/evals/job-runner";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  // Client-local runs (not yet / never persisted)
  if (id.startsWith("local_")) {
    return NextResponse.json({
      run: null,
      cases: [],
      localOnly: true,
    });
  }

  try {
    const data = await getPersistedRun(id);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { run, cases } = data;
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
        inputTokens: c.inputTokens,
        outputTokens: c.outputTokens,
        totalTokens: c.totalTokens,
        estimatedCostUsd:
          c.estimatedCostUsd == null ? null : Number(c.estimatedCostUsd),
        errorMessage: c.errorMessage,
        createdAt: c.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || id.startsWith("local_")) {
    return NextResponse.json({ ok: true, localOnly: true });
  }

  try {
    const deleted = await deletePersistedRun(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 },
    );
  }
}

import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { evalRuns } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createAndStartEvalRun } from "@/lib/evals/job-runner";
import { isSuiteId, type SuiteId } from "@/lib/evals/load-suites";
import { isAllowedModelId } from "@/lib/models/registry";
import { requireAnthropicKey } from "@/lib/model";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(evalRuns)
    .orderBy(desc(evalRuns.startedAt))
    .limit(50);

  return NextResponse.json({
    runs: rows.map((r) => ({
      id: r.id,
      status: r.status,
      suiteIds: JSON.parse(r.suiteIdsJson) as string[],
      modelIds: JSON.parse(r.modelIdsJson) as string[],
      totalCases: r.totalCases,
      completedCases: r.completedCases,
      passedCases: r.passedCases,
      failedCases: r.failedCases,
      errorCases: r.errorCases,
      currentLabel: r.currentLabel,
      summary: r.summaryJson ? JSON.parse(r.summaryJson) : null,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      passRate:
        r.completedCases > 0
          ? Number(((r.passedCases / r.completedCases) * 100).toFixed(1))
          : null,
    })),
  });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missingKey = requireAnthropicKey();
  if (missingKey) {
    return NextResponse.json({ error: missingKey }, { status: 503 });
  }

  const body = await req.json();
  const suiteIdsRaw = Array.isArray(body.suiteIds) ? body.suiteIds : [];
  const modelIdsRaw = Array.isArray(body.modelIds) ? body.modelIds : [];

  const suiteIds = suiteIdsRaw.filter(
    (id: unknown): id is SuiteId =>
      typeof id === "string" && isSuiteId(id),
  );
  const modelIds = modelIdsRaw.filter(
    (id: unknown): id is string =>
      typeof id === "string" && isAllowedModelId(id),
  );

  if (suiteIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one suite" },
      { status: 400 },
    );
  }
  if (modelIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one model" },
      { status: 400 },
    );
  }

  const runId = await createAndStartEvalRun({ suiteIds, modelIds });
  return NextResponse.json({ runId }, { status: 201 });
}

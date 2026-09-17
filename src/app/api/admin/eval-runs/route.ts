import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  listPersistedRuns,
  persistCompletedRun,
} from "@/lib/evals/job-runner";
import { isSuiteId, type SuiteId } from "@/lib/evals/load-suites";
import { mapPersistedRun } from "@/lib/evals/map-run";
import { isAllowedModelId } from "@/lib/models/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const rows = await listPersistedRuns(50);
    return NextResponse.json({ runs: rows.map(mapPersistedRun) });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}

/**
 * Persist a completed client-orchestrated run.
 * Cases are executed by the browser via /api/eval so Vercel serverless
 * does not rely on fire-and-forget background work.
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const suiteIdsRaw = Array.isArray(body.suiteIds) ? body.suiteIds : [];
  const modelIdsRaw = Array.isArray(body.modelIds) ? body.modelIds : [];
  const resultsRaw = Array.isArray(body.results) ? body.results : [];

  const suiteIds = suiteIdsRaw.filter(
    (id: unknown): id is SuiteId => typeof id === "string" && isSuiteId(id),
  );
  const modelIds = modelIdsRaw.filter(
    (id: unknown): id is string =>
      typeof id === "string" && isAllowedModelId(id),
  );

  if (suiteIds.length === 0 || modelIds.length === 0 || resultsRaw.length === 0) {
    return NextResponse.json(
      { error: "suiteIds, modelIds, and results are required" },
      { status: 400 },
    );
  }

  try {
    const runId = await persistCompletedRun({
      suiteIds,
      modelIds,
      results: resultsRaw,
    });
    return NextResponse.json({ runId }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        runId: null,
        warning:
          "Run finished in the browser but could not be persisted on this server isolate. Add a Neon DATABASE_URL for durable history on Vercel.",
        error: err instanceof Error ? err.message : String(err),
        results: resultsRaw,
      },
      { status: 200 },
    );
  }
}

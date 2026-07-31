import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { gradeEvalResult } from "@/lib/evals/job-runner";
import type { EvalCoreResult } from "@/lib/evals/run-copilot";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const result = body.result as EvalCoreResult | undefined;
  if (!caseId || !result || typeof result.output !== "string") {
    return NextResponse.json(
      { error: "Expected { caseId, result }" },
      { status: 400 },
    );
  }

  return NextResponse.json(gradeEvalResult(caseId, result));
}

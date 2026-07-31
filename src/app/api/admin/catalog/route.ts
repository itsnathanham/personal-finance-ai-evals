import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { MODEL_REGISTRY } from "@/lib/models/registry";
import { listSuites } from "@/lib/evals/load-suites";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    models: MODEL_REGISTRY,
    suites: listSuites().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      caseCount: s.cases.length,
    })),
  });
}

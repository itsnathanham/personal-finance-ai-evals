import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listSuites } from "@/lib/evals/load-suites";
import { catalogModels } from "@/lib/models/catalog";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    models: catalogModels(),
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
  });
}

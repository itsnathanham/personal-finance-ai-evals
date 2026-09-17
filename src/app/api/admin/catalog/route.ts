import { NextResponse } from "next/server";
import { listSuites } from "@/lib/evals/load-suites";
import { catalogModels } from "@/lib/models/catalog";

/** Public catalog for browsing the evals UI without signing in. */
export async function GET() {
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

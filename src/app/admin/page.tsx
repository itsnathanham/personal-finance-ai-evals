import { AdminDashboard } from "@/components/admin-dashboard";
import { listPersistedRuns } from "@/lib/evals/job-runner";
import { listSuites } from "@/lib/evals/load-suites";
import { mapPersistedRun } from "@/lib/evals/map-run";
import { catalogModels } from "@/lib/models/catalog";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const catalog = {
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
  };

  let initialRuns: ReturnType<typeof mapPersistedRun>[] = [];
  try {
    initialRuns = (await listPersistedRuns(50)).map(mapPersistedRun);
  } catch {
    initialRuns = [];
  }

  return (
    <AdminDashboard initialCatalog={catalog} initialRuns={initialRuns} />
  );
}

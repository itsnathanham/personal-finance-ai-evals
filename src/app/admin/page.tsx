import { AdminDashboard } from "@/components/admin-dashboard";
import { listSuites } from "@/lib/evals/load-suites";
import { catalogModels } from "@/lib/models/catalog";

/**
 * Catalog is sync (YAML + registry). Run history loads client-side so first
 * paint is not blocked on Neon/PGlite.
 */
export default function AdminPage() {
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

  return <AdminDashboard initialCatalog={catalog} initialRuns={[]} />;
}

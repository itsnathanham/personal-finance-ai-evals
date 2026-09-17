import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { listPersistedRuns } from "@/lib/evals/job-runner";
import { listSuites } from "@/lib/evals/load-suites";
import { mapPersistedRun } from "@/lib/evals/map-run";
import { catalogModels } from "@/lib/models/catalog";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAdminConfigured()) {
    return (
      <div className="admin-shell">
        <div className="admin-login">
          <h1>Admin not configured</h1>
          <p>
            Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code> and
            restart the app.
          </p>
        </div>
      </div>
    );
  }

  const authed = await isAdminAuthenticated();
  if (!authed) return <AdminLoginForm />;

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

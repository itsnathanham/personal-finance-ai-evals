import { AdminTrends } from "@/components/admin-trends";
import { listPersistedRuns } from "@/lib/evals/job-runner";
import { mapPersistedRun } from "@/lib/evals/map-run";
import { normalizeSummary } from "@/lib/evals/trends";
import { catalogModels } from "@/lib/models/catalog";

export const dynamic = "force-dynamic";

export default async function AdminTrendsPage() {
  let initialRuns: ReturnType<typeof mapPersistedRun>[] = [];
  try {
    initialRuns = (await listPersistedRuns(80)).map((r) => {
      const mapped = mapPersistedRun(r);
      return {
        ...mapped,
        summary: normalizeSummary(mapped.summary),
      };
    });
  } catch {
    initialRuns = [];
  }

  return (
    <AdminTrends
      models={catalogModels().map((m) => ({
        id: m.id,
        label: `${m.label}`,
        provider: m.provider,
        configured: m.configured,
      }))}
      initialRuns={initialRuns}
    />
  );
}

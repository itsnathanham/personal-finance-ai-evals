import { AdminTrends } from "@/components/admin-trends";
import { catalogModels } from "@/lib/models/catalog";

/**
 * Model catalog is sync. Trend history loads client-side from localStorage +
 * /api/admin/eval-runs so the page shell renders without waiting on the DB.
 */
export default function AdminTrendsPage() {
  return (
    <AdminTrends
      models={catalogModels().map((m) => ({
        id: m.id,
        label: `${m.label}`,
        provider: m.provider,
        configured: m.configured,
      }))}
      initialRuns={[]}
    />
  );
}

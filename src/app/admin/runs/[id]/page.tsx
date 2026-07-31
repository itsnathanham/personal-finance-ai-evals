import { AdminLoginForm } from "@/components/admin-login-form";
import { AdminRunDetail } from "@/components/admin-run-detail";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isAdminConfigured()) {
    return (
      <div className="admin-shell">
        <div className="admin-login">
          <h1>Admin not configured</h1>
          <p>
            Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code>.
          </p>
        </div>
      </div>
    );
  }

  const authed = await isAdminAuthenticated();
  if (!authed) return <AdminLoginForm />;
  return <AdminRunDetail runId={id} />;
}

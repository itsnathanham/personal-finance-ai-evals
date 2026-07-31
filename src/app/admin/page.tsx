import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";

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
  return authed ? <AdminDashboard /> : <AdminLoginForm />;
}

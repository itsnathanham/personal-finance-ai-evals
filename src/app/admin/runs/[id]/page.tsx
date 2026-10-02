import { AdminRunDetail } from "@/components/admin-run-detail";

export default async function AdminRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminRunDetail runId={id} />;
}

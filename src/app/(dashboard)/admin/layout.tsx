import { requireAdmin } from "@/lib/auth/session";

// Toda a área /admin exige ADMIN no servidor; esconder o menu é só conveniência.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}

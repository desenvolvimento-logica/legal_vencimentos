import { Suspense } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Reminders } from "@/components/reminders/reminders";
import { requireProfile } from "@/lib/auth/session";

// Referência visual: docs/mockups/02-dashboard.png (shell autenticado único).
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Suspense fallback={<ContentSkeleton />}>
            <RequireActiveProfile>{children}</RequireActiveProfile>
          </Suspense>
        </main>
      </div>
      {/* Lembretes do responsável: popup ao abrir o app (legal_020). */}
      <Suspense fallback={null}>
        <Reminders />
      </Suspense>
    </div>
  );
}

// Nenhuma página privada renderiza sem perfil ativo, mesmo que o proxy falhe.
async function RequireActiveProfile({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireProfile();
  return children;
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

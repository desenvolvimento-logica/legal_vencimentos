import { Suspense } from "react";

import { AppHeader, AppHeaderSkeleton } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { requireProfile } from "@/lib/auth/session";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<AppHeaderSkeleton />}>
          <AppHeader />
        </Suspense>
        <main className="flex-1 p-6">
          <Suspense fallback={<ContentSkeleton />}>
            <RequireActiveProfile>{children}</RequireActiveProfile>
          </Suspense>
        </main>
      </div>
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
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

import { Suspense } from "react";

import { HIERARCHY_LABELS } from "@/lib/auth/labels";
import { requireProfile } from "@/lib/auth/session";

import { AdminNavSlot } from "./admin-nav-slot";
import { Breadcrumb, BreadcrumbFallback } from "./breadcrumb";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

// O cabeçalho aparece na hora; só o menu do usuário espera a sessão.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 sm:px-8">
      <MobileNav adminSlot={<AdminNavSlot mobile />} />
      <div className="min-w-0 flex-1">
        <Suspense fallback={<BreadcrumbFallback />}>
          <Breadcrumb />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="size-9 animate-pulse rounded-full bg-muted" />
        }
      >
        <CurrentUserMenu />
      </Suspense>
    </header>
  );
}

async function CurrentUserMenu() {
  const profile = await requireProfile();
  return (
    <UserMenu
      name={profile.name}
      email={profile.email}
      roleLabel={HIERARCHY_LABELS[profile.hierarchyLevel]}
    />
  );
}

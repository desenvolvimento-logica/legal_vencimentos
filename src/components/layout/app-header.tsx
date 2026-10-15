import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { HIERARCHY_LABELS } from "@/lib/auth/labels";
import { requireProfile } from "@/lib/auth/session";

export async function AppHeader() {
  const profile = await requireProfile();

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b px-6">
      <div className="text-right leading-tight">
        <p className="text-sm font-medium">{profile.name}</p>
        <p className="text-xs text-muted-foreground">
          {HIERARCHY_LABELS[profile.hierarchyLevel]}
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut aria-hidden />
          Sair
        </Button>
      </form>
    </header>
  );
}

export function AppHeaderSkeleton() {
  return (
    <header
      className="flex h-14 items-center justify-end border-b px-6"
      aria-busy="true"
    >
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
    </header>
  );
}

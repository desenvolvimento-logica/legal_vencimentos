import { Suspense } from "react";

import { getSessionState } from "@/lib/auth/session";

import { AdminNavList } from "./admin-nav";

/**
 * Mostra o grupo Administração só para ADMIN. É conveniência visual: as
 * rotas /admin e as funções do banco exigem ADMIN por conta própria.
 */
export function AdminNavSlot({ mobile }: { mobile?: boolean }) {
  return (
    <Suspense fallback={null}>
      <AdminNav mobile={mobile} />
    </Suspense>
  );
}

async function AdminNav({ mobile }: { mobile?: boolean }) {
  const session = await getSessionState();
  if (session.status !== "active" || !session.profile.isAdmin) return null;
  return <AdminNavList key={mobile ? "mobile" : "desktop"} />;
}

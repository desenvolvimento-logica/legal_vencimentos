import type { Metadata } from "next";

import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard — Controle de Vencimentos",
};

export default async function DashboardPage() {
  const profile = await requireProfile();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Olá, {profile.name}. Os indicadores de vencimentos serão exibidos aqui.
      </p>
    </div>
  );
}

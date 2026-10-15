import type { Metadata } from "next";
import { Suspense } from "react";

import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard — Controle de Vencimentos",
};

// O título é estático e aparece na hora; só o trecho que depende do usuário
// espera a sessão, para a navegação não bloquear a página inteira.
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense
        fallback={<div className="h-6 w-96 animate-pulse rounded bg-muted" />}
      >
        <Greeting />
      </Suspense>
    </div>
  );
}

async function Greeting() {
  const profile = await requireProfile();
  return (
    <p className="text-muted-foreground">
      Olá, {profile.name}. Os indicadores de vencimentos serão exibidos aqui.
    </p>
  );
}

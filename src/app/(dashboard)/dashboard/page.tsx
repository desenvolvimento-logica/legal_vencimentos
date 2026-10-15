import { ChartNoAxesColumn } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatLongDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Dashboard — Controle de Vencimentos",
};

// Referência visual: docs/mockups/02-dashboard.png. Métricas, tabela de
// próximos vencimentos e gráfico entram na Fase 9, quando houver dados.
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua carteira"
        aside={
          <Suspense fallback={<div className="h-6 w-48" />}>
            <OperationalDate />
          </Suspense>
        }
      />

      <Card className="items-center gap-3 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <ChartNoAxesColumn
            className="size-6 text-muted-foreground"
            aria-hidden
          />
        </span>
        <p className="text-base font-semibold">Indicadores em preparação</p>
        <p className="max-w-md text-muted-foreground">
          Os números da sua carteira aparecerão aqui depois da integração com o
          Acessórias e do cadastro dos primeiros vencimentos.
        </p>
      </Card>
    </div>
  );
}

async function OperationalDate() {
  // Data do dia no fuso de negócio, calculada na requisição.
  await connection();
  const today = new Date();
  return (
    <time
      dateTime={today.toISOString()}
      className="text-lg text-muted-foreground tabular-nums"
    >
      {formatLongDate(today)}
    </time>
  );
}

import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  PieChart,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { TypeDistribution } from "@/components/dashboard/type-distribution";
import { ExpirationStatusBadge } from "@/components/expirations/expiration-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  formatCivilDate,
  formatLongDate,
  toBusinessCivilDate,
} from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  getDashboard,
  UPCOMING_WINDOWS,
  type DashboardMetrics,
  type UpcomingWindow,
} from "@/services/dashboard/get-dashboard";
import { listVisibleProfileNames } from "@/services/expirations/responsibles";

export const metadata: Metadata = {
  title: "Dashboard — Controle de Vencimentos",
};

// Referência visual: docs/mockups/02-dashboard.png (SRS RF-11).
export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
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
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
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

type Tone = "neutral" | "danger" | "orange" | "warning" | "info" | "success";

const TONES: Record<Tone, { chip: string; value: string }> = {
  neutral: { chip: "bg-muted text-foreground", value: "text-foreground" },
  danger: { chip: "bg-danger/10 text-danger", value: "text-danger" },
  orange: {
    chip: "bg-orange-600/10 text-orange-700",
    value: "text-orange-700",
  },
  warning: { chip: "bg-warning/10 text-warning", value: "text-warning" },
  info: { chip: "bg-info/10 text-info", value: "text-info" },
  success: { chip: "bg-success/10 text-success", value: "text-success" },
};

function metricCards(metrics: DashboardMetrics): {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: Tone;
  href: string;
}[] {
  return [
    {
      label: "Total de clientes",
      value: metrics.clients,
      icon: Users,
      tone: "neutral",
      href: "/clients",
    },
    {
      label: "Vencidos",
      value: metrics.overdue,
      icon: CircleAlert,
      tone: "danger",
      href: "/expirations?situacao=vencidos",
    },
    {
      label: "Próximos 7 dias",
      value: metrics.next7,
      icon: Clock,
      tone: "orange",
      href: "/expirations?periodo=7",
    },
    {
      label: "Próximos 15 dias",
      value: metrics.next15,
      icon: CalendarClock,
      tone: "warning",
      href: "/expirations?periodo=15",
    },
    {
      label: "Próximos 30 dias",
      value: metrics.next30,
      icon: CalendarDays,
      tone: "info",
      href: "/expirations?periodo=30",
    },
    {
      label: "Em renovação",
      value: metrics.renewing,
      icon: RefreshCw,
      tone: "info",
      href: "/expirations?situacao=em-renovacao",
    },
    {
      label: "Renovados no mês",
      value: metrics.renewedThisMonth,
      icon: CircleCheck,
      tone: "success",
      href: "/expirations?situacao=renovados",
    },
  ];
}

async function DashboardContent({
  searchParams,
}: Pick<PageProps<"/dashboard">, "searchParams">) {
  const query = await searchParams;
  const window: UpcomingWindow =
    UPCOMING_WINDOWS.find((days) => String(days) === query.janela) ?? 7;

  await connection();
  const today = toBusinessCivilDate(new Date());
  const [{ metrics, upcoming, distribution }, profiles] = await Promise.all([
    getDashboard(today, window),
    listVisibleProfileNames(),
  ]);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));

  return (
    <>
      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7"
      >
        {metricCards(metrics).map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Card className="h-full gap-3 px-5 py-5 transition-shadow group-hover:shadow-md">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg",
                  TONES[card.tone].chip,
                )}
              >
                <card.icon className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p
                className={cn(
                  "text-[2.25rem] leading-none font-bold tabular-nums",
                  TONES[card.tone].value,
                )}
              >
                {card.value}
              </p>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="gap-5 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="size-5" aria-hidden />
              Próximos vencimentos
            </h2>
            <Link
              href={`/expirations?periodo=${window}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline"
            >
              Ver todos
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <nav
            aria-label="Janela de dias"
            className="flex w-fit rounded-lg border bg-muted/40 p-1"
          >
            {UPCOMING_WINDOWS.map((days) => (
              <Link
                key={days}
                href={`/dashboard?janela=${days}`}
                aria-current={days === window ? "true" : undefined}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm transition-colors",
                  days === window
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {days} dias
              </Link>
            ))}
          </nav>

          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum vencimento vigente nos próximos {window} dias.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    {[
                      "Cliente",
                      "Documento",
                      "Tipo",
                      "Vencimento",
                      "Dias",
                      "Responsável",
                      "Situação",
                    ].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="px-4 py-3 font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((item) => {
                    const status = displayStatus(
                      item.status,
                      item.expirationDate,
                      today,
                    );
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/clients/${item.clientId}?aba=vencimentos`}
                            className="hover:underline"
                          >
                            {item.clientName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{item.documentName}</td>
                        <td className="px-4 py-3">
                          {EXPIRATION_TYPE_LABELS[item.type]}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatCivilDate(item.expirationDate)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 font-semibold tabular-nums",
                            status.daysLeft < 0
                              ? "text-danger"
                              : "text-warning",
                          )}
                        >
                          {status.daysLeft}
                        </td>
                        <td className="px-4 py-3">
                          {(item.responsibleUserId &&
                            names.get(item.responsibleUserId)) ??
                            "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ExpirationStatusBadge status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="gap-5 px-5 py-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <PieChart className="size-5" aria-hidden />
            Distribuição por tipo
          </h2>
          <TypeDistribution data={distribution} />
        </Card>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando indicadores…</span>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="h-80 animate-pulse rounded-xl bg-muted/70" />
        <div className="h-80 animate-pulse rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}

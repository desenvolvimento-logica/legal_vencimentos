"use client";

import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  ExternalLink,
  RefreshCw,
  RotateCw,
  Send,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ExpirationStatusBadge } from "@/components/expirations/expiration-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCivilDate } from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  getMetricItems,
  type MetricItemsResult,
} from "@/services/dashboard/actions";
import {
  METRIC_LABELS,
  METRIC_LIST_HREF,
  type ExpirationMetric,
} from "@/services/dashboard/metrics";

import { MetricCardBody, type MetricTone } from "./metric-card";

const METRIC_STYLE: Record<
  ExpirationMetric,
  { icon: LucideIcon; tone: MetricTone }
> = {
  overdue: { icon: CircleAlert, tone: "danger" },
  next7: { icon: Clock, tone: "orange" },
  next15: { icon: CalendarClock, tone: "warning" },
  next30: { icon: CalendarDays, tone: "info" },
  quoteSent: { icon: Send, tone: "quote" },
  renewing: { icon: RefreshCw, tone: "info" },
  renewedThisMonth: { icon: CircleCheck, tone: "success" },
};

/** Card do Dashboard que abre, em popup, os vencimentos que compõem o número. */
export function MetricDialogCard({
  metric,
  value,
}: {
  metric: ExpirationMetric;
  value: number;
}) {
  const [result, setResult] = useState<MetricItemsResult | null>(null);
  const [pending, startTransition] = useTransition();
  const { icon, tone } = METRIC_STYLE[metric];
  const label = METRIC_LABELS[metric];

  function load() {
    startTransition(async () => {
      setResult(await getMetricItems(metric));
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        // Recarrega a cada abertura para refletir alterações recentes.
        if (open) load();
      }}
    >
      <DialogTrigger
        className="group rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`${label}: ${value}. Ver vencimentos`}
      >
        <MetricCardBody label={label} value={value} icon={icon} tone={tone} />
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{label}</DialogTitle>
          <DialogDescription>
            {pending || !result
              ? "Carregando…"
              : result.ok
                ? result.total === 1
                  ? "1 vencimento"
                  : `${result.total} vencimentos${result.total > result.items.length ? `, exibindo os ${result.items.length} primeiros` : ""}`
                : "Não foi possível carregar"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {pending || !result ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="h-11 animate-pulse rounded bg-muted/70"
                />
              ))}
            </div>
          ) : !result.ok ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-destructive" role="alert">
                {result.error}
              </p>
              <button
                type="button"
                onClick={load}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <RotateCw aria-hidden />
                Tentar novamente
              </button>
            </div>
          ) : result.items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              Nenhum vencimento neste indicador.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  {[
                    "Cliente",
                    "Documento",
                    "Tipo",
                    "Vencimento",
                    "Dias",
                    "Situação",
                  ].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-3 py-2.5 font-semibold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => {
                  const status = displayStatus(
                    item.status,
                    item.expirationDate,
                    result.today,
                  );
                  const current =
                    item.status === "ACTIVE" ||
                    item.status === "QUOTE_SENT" ||
                    item.status === "RENEWING";
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2.5 font-medium">
                        <Link
                          href={`/clients/${item.clientId}?aba=vencimentos`}
                          className="hover:underline"
                        >
                          {item.clientName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{item.documentName}</td>
                      <td className="px-3 py-2.5">
                        {EXPIRATION_TYPE_LABELS[item.type]}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatCivilDate(item.expirationDate)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 font-semibold tabular-nums",
                          current && status.daysLeft < 0 && "text-danger",
                        )}
                      >
                        {current ? status.daysLeft : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <ExpirationStatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-0">
          <Link
            href={METRIC_LIST_HREF[metric]}
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink aria-hidden />
            Abrir na tela Vencimentos
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

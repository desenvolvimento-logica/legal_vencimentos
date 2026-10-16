"use client";

import { BellRing, ExternalLink, History, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  use,
  useCallback,
  useState,
  useTransition,
} from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addCivilDays,
  formatCivilDate,
  toBusinessCivilDate,
} from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { RENEWAL_PERIOD_LABELS } from "@/lib/expirations/period";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  getExpirationDetail,
  type ExpirationDetailResult,
} from "@/services/expirations/detail";
import type { ExpirationRecord } from "@/services/expirations/get-expiration";

import { ExpirationStatusBadge } from "./expiration-status-badge";

const OpenDetailContext = createContext<(() => void) | null>(null);

/** Elementos que têm ação própria: clicar neles não abre o detalhe. */
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role=menuitem]";

/**
 * Linha da tabela Vencimentos que abre o detalhe da renovação ao ser
 * clicada. Pelo teclado, o nome do documento (ExpirationDetailTrigger) é o
 * botão equivalente.
 */
export function ExpirationRow({
  expirationId,
  responsibleName,
  className,
  children,
}: {
  expirationId: string;
  responsibleName: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ExpirationDetailResult | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setResult(await getExpirationDetail(expirationId));
    });
  }, [expirationId]);

  const openDetail = useCallback(() => {
    setOpen(true);
    // Recarrega a cada abertura para refletir alterações recentes.
    load();
  }, [load]);

  return (
    <OpenDetailContext value={openDetail}>
      <tr
        className={cn("cursor-pointer", className)}
        onClick={(event) => {
          const target = event.target as Element;
          // Eventos de portais (menus, diálogos) também sobem pela árvore React.
          if (!event.currentTarget.contains(target)) return;
          if (target.closest(INTERACTIVE)) return;
          openDetail();
        }}
      >
        {children}
      </tr>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
          <DetailBody
            result={pending ? null : result}
            responsibleName={responsibleName}
            onRetry={load}
          />
        </DialogContent>
      </Dialog>
    </OpenDetailContext>
  );
}

/** Botão acessível pelo teclado que abre o detalhe da linha. */
export function ExpirationDetailTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  const open = use(OpenDetailContext);
  return (
    <button
      type="button"
      onClick={() => open?.()}
      className="text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function DetailBody({
  result,
  responsibleName,
  onRetry,
}: {
  result: ExpirationDetailResult | null;
  responsibleName: string | null;
  onRetry: () => void;
}) {
  if (!result) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Detalhes do vencimento
          </DialogTitle>
          <DialogDescription>Carregando…</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-9 animate-pulse rounded bg-muted/70"
            />
          ))}
        </div>
      </>
    );
  }

  if (!result.ok) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Detalhes do vencimento
          </DialogTitle>
          <DialogDescription>Não foi possível carregar</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-destructive" role="alert">
            {result.error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Tentar novamente
          </button>
        </div>
      </>
    );
  }

  const { detail, today } = result;
  const { expiration, client, chain, next } = detail;
  const status = displayStatus(
    expiration.status,
    expiration.expirationDate,
    today,
  );
  const current =
    expiration.status === "ACTIVE" ||
    expiration.status === "QUOTE_SENT" ||
    expiration.status === "RENEWING";
  const history = chain.slice(1);

  const rows: [string, React.ReactNode][] = [
    ["Tipo", EXPIRATION_TYPE_LABELS[expiration.type]],
    ["Número", expiration.documentNumber],
    ["Órgão emissor", expiration.issuer],
    ["Emissão", formatCivilDate(expiration.issueDate)],
    [
      "Vencimento",
      <>
        {formatCivilDate(expiration.expirationDate)}
        {current && (
          <span className="ml-2 text-muted-foreground">
            ({daysText(status.daysLeft)})
          </span>
        )}
      </>,
    ],
    [
      "Periodicidade",
      expiration.renewalPeriod
        ? RENEWAL_PERIOD_LABELS[expiration.renewalPeriod]
        : "Sem periodicidade",
    ],
    [
      "Lembrete",
      expiration.reminderDays ? (
        <span className="inline-flex items-center gap-1.5">
          <BellRing className="size-4 text-muted-foreground" aria-hidden />
          {expiration.reminderDays}{" "}
          {expiration.reminderDays === 1 ? "dia" : "dias"} antes (a partir de{" "}
          {formatCivilDate(
            addCivilDays(expiration.expirationDate, -expiration.reminderDays),
          )}
          )
        </span>
      ) : (
        "Sem lembrete"
      ),
    ],
    ["Responsável", current ? responsibleName : null],
    [
      "Orçamento enviado em",
      expiration.quoteSentAt && formatInstantDate(expiration.quoteSentAt),
    ],
    ["Observações", expiration.notes],
  ];
  if (expiration.status === "RENEWED") {
    rows.push([
      "Renovado em",
      expiration.renewedAt &&
        formatCivilDate(expiration.renewedAt.slice(0, 10)),
    ]);
    rows.push([
      "Novo vencimento",
      next &&
        `${formatCivilDate(next.expirationDate)} (emissão ${formatCivilDate(next.issueDate) || "—"})`,
    ]);
  }
  if (expiration.status === "CANCELLED") {
    rows.push(["Motivo do cancelamento", expiration.cancellationReason]);
  }

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <DialogTitle className="text-xl font-bold">
            {expiration.documentName}
          </DialogTitle>
          <ExpirationStatusBadge status={status} />
        </div>
        <DialogDescription>{client.name}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        <dl className="divide-y rounded-lg border px-4">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[140px_1fr] gap-3 py-2.5 text-sm"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value || "—"}</dd>
            </div>
          ))}
        </dl>

        <section
          aria-labelledby="renewal-history"
          className="flex flex-col gap-3"
        >
          <h3
            id="renewal-history"
            className="flex items-center gap-2 font-semibold"
          >
            <History className="size-4" aria-hidden />
            Renovações anteriores
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este é o primeiro registro deste documento.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {history.map((item) => (
                <HistoryItem key={item.id} item={item} today={today} />
              ))}
            </ol>
          )}
        </section>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Link
          href={`/clients/${client.id}?aba=vencimentos`}
          className={buttonVariants({ variant: "outline" })}
        >
          <ExternalLink aria-hidden />
          Ver no cliente
        </Link>
        {current && (
          <Link
            href={`/expirations/${expiration.id}/renew`}
            className={buttonVariants()}
          >
            <RefreshCw aria-hidden />
            {expiration.status === "RENEWING"
              ? "Ir para a renovação"
              : "Abrir renovação"}
          </Link>
        )}
      </DialogFooter>
    </>
  );
}

function HistoryItem({
  item,
  today,
}: {
  item: ExpirationRecord;
  today: string;
}) {
  const status = displayStatus(item.status, item.expirationDate, today);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="tabular-nums">
        {formatCivilDate(item.issueDate) || "—"} –{" "}
        {formatCivilDate(item.expirationDate)}
        {item.documentNumber && (
          <span className="ml-2 text-muted-foreground">
            nº {item.documentNumber}
          </span>
        )}
      </span>
      <ExpirationStatusBadge status={status} />
    </li>
  );
}

/** Instante (timestamptz) → data em Brasília. */
function formatInstantDate(value: string): string {
  return formatCivilDate(toBusinessCivilDate(new Date(value)));
}

function daysText(daysLeft: number): string {
  if (daysLeft === 0) return "vence hoje";
  if (daysLeft < 0)
    return `vencido há ${-daysLeft} ${daysLeft === -1 ? "dia" : "dias"}`;
  return `faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
}

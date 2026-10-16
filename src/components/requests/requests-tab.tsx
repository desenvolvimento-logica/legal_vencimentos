import { Inbox, Lock, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Pagination } from "@/components/data/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { displayPersonName } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import {
  getRequestFilterOptions,
  listClientRequests,
  REQUEST_PERIODS,
  REQUESTS_PAGE_SIZE,
  type RequestFilters,
} from "@/services/requests/list-client-requests";

import { RequestDetailPanel } from "./request-detail-panel";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const formatDate = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : "—";

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none";

// Referência visual: docs/mockups/08-client-requests.png (SRS RF-10).
export async function RequestsTab({
  clientId,
  acessoriasCompanyId,
  filters,
}: {
  clientId: string;
  acessoriasCompanyId: string;
  filters: RequestFilters;
}) {
  const [{ items, total }, options] = await Promise.all([
    listClientRequests(acessoriasCompanyId, filters),
    getRequestFilterOptions(acessoriasCompanyId),
  ]);

  const basePath = `/clients/${clientId}`;
  const current = {
    aba: "solicitacoes",
    status: filters.status,
    tipo: filters.tipo,
    resp: filters.resp,
    periodo: filters.periodo,
    pagina: filters.pagina,
  };
  const hasFilters = Boolean(
    filters.status || filters.tipo || filters.resp || filters.periodo,
  );

  return (
    <div
      className={cn(
        "grid gap-6",
        filters.sol && "xl:grid-cols-[1fr_420px] xl:items-start",
      )}
    >
      <Card className="gap-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">
            Solicitações do Acessórias{" "}
            <span className="font-normal text-muted-foreground tabular-nums">
              ({total})
            </span>
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Somente leitura
          </span>
        </div>

        <form
          method="get"
          action={basePath}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        >
          <input type="hidden" name="aba" value="solicitacoes" />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            aria-label="Status"
            className={selectClassName}
          >
            <option value="">Status: Todos</option>
            {options.statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            name="tipo"
            defaultValue={filters.tipo ?? ""}
            aria-label="Tipo"
            className={selectClassName}
          >
            <option value="">Tipo: Todos</option>
            {options.types.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            name="periodo"
            defaultValue={filters.periodo ? String(filters.periodo) : ""}
            aria-label="Período de abertura"
            className={selectClassName}
          >
            <option value="">Período: Todos</option>
            {REQUEST_PERIODS.map((days) => (
              <option key={days} value={days}>
                Abertas nos últimos {days} dias
              </option>
            ))}
          </select>
          <select
            name="resp"
            defaultValue={filters.resp ?? ""}
            aria-label="Responsável"
            className={selectClassName}
          >
            <option value="">Responsável: Todos</option>
            {options.responsibles.map((value) => (
              <option key={value} value={value}>
                {displayPersonName(value)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              <Search aria-hidden />
              Filtrar
            </Button>
            {hasFilters && (
              <Link
                href={hrefWith(basePath, { aba: "solicitacoes" })}
                className={buttonVariants({ variant: "ghost" })}
              >
                Limpar
              </Link>
            )}
          </div>
        </form>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Inbox className="size-6 text-muted-foreground" aria-hidden />
            </span>
            <p className="font-semibold">
              {hasFilters
                ? "Nenhuma solicitação com esses filtros"
                : "Nenhuma solicitação sincronizada"}
            </p>
            <p className="max-w-md text-muted-foreground">
              {hasFilters
                ? "Ajuste ou limpe os filtros."
                : "Aparecem as solicitações da Legalização atualizadas a partir de 90 dias antes da primeira sincronização."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    {[
                      "ID",
                      "Assunto",
                      "Tipo",
                      "Prioridade",
                      "Status",
                      "Responsável",
                      "Abertura",
                      "Prazo",
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
                  {items.map((request) => {
                    const selected =
                      filters.sol === request.acessoriasRequestId;
                    return (
                      <tr
                        key={request.id}
                        className={cn(
                          "border-t transition-colors hover:bg-muted/40",
                          selected && "bg-info/5",
                        )}
                      >
                        <td className="px-4 py-3 font-semibold tabular-nums">
                          <Link
                            href={hrefWith(basePath, current, {
                              sol: request.acessoriasRequestId,
                            })}
                            scroll={false}
                            aria-current={selected ? "true" : undefined}
                            className="hover:underline"
                          >
                            {request.acessoriasRequestId}
                          </Link>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <Link
                            href={hrefWith(basePath, current, {
                              sol: request.acessoriasRequestId,
                            })}
                            scroll={false}
                            className="hover:underline"
                          >
                            {request.subject ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{request.type ?? "—"}</td>
                        <td className="px-4 py-3">{request.priority ?? "—"}</td>
                        <td className="px-4 py-3">{request.status ?? "—"}</td>
                        <td className="px-4 py-3">
                          {request.officeResponsibles
                            .map(displayPersonName)
                            .join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatDate(request.openedAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatDate(request.dueAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={filters.pagina}
              pageSize={REQUESTS_PAGE_SIZE}
              total={total}
              pageSizes={[REQUESTS_PAGE_SIZE]}
              hrefFor={(page) => hrefWith(basePath, current, { pagina: page })}
            />
          </>
        )}
      </Card>

      {filters.sol && (
        <Suspense
          key={filters.sol}
          fallback={
            <div
              className="h-96 animate-pulse rounded-xl bg-muted"
              aria-busy="true"
            />
          }
        >
          <RequestDetailPanel
            solId={filters.sol}
            closeHref={hrefWith(basePath, current)}
          />
        </Suspense>
      )}
    </div>
  );
}

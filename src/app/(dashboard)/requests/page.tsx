import { Inbox, Lock, Search, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { RequestDetailPanel } from "@/components/requests/request-detail-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { displayPersonName } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import { REQUEST_PERIODS } from "@/services/requests/list-client-requests";
import {
  getRequestListFilterOptions,
  listRequests,
  REQUEST_PAGE_SIZES,
  REQUEST_SITUATIONS,
  REQUEST_SORT_LABELS,
  requestListParamsSchema,
  type RequestListParams,
} from "@/services/requests/list-requests";

export const metadata: Metadata = {
  title: "Solicitações — Controle de Vencimentos",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const formatDate = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : "—";

const fieldClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none";

// Central de solicitações de todos os clientes visíveis (SRS RF-10). Mesmo
// visual da aba Solicitações do cliente (docs/mockups/08-client-requests.png).
export default function RequestsPage({ searchParams }: PageProps<"/requests">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Solicitações"
        description="Solicitações da Legalização de todos os clientes da sua carteira"
      />
      <Suspense fallback={<ListSkeleton />}>
        <RequestsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RequestsContent({
  searchParams,
}: Pick<PageProps<"/requests">, "searchParams">) {
  const params = requestListParamsSchema.parse(await searchParams);
  await connection();
  const [result, options] = await Promise.all([
    listRequests(params),
    getRequestListFilterOptions(),
  ]);

  const current: Record<string, string | number | undefined> = {
    q: params.q,
    situacao: params.situacao,
    status: params.status,
    tipo: params.tipo,
    resp: params.resp,
    periodo: params.periodo,
    ordem: params.ordem,
    porPagina: params.porPagina,
    pagina: params.pagina,
  };
  const href = (overrides: Record<string, string | number | undefined>) =>
    hrefWith("/requests", current, overrides);
  const filtered = Boolean(
    params.q ||
    params.status ||
    params.tipo ||
    params.resp ||
    params.periodo ||
    params.situacao !== "abertas",
  );

  return (
    <div
      className={cn(
        "grid gap-6",
        params.sol && "xl:grid-cols-[1fr_420px] xl:items-start",
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <Filters
          params={params}
          options={options}
          counts={result.counts}
          href={href}
        />

        <Card className="gap-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tabular-nums">
              {result.total}{" "}
              {result.total === 1
                ? "solicitação encontrada"
                : "solicitações encontradas"}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              Somente leitura
            </span>
          </div>

          {result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
                <Inbox className="size-6 text-muted-foreground" aria-hidden />
              </span>
              <p className="font-semibold">
                {filtered
                  ? "Nenhuma solicitação com esses filtros"
                  : "Nenhuma solicitação em aberto"}
              </p>
              <p className="max-w-md text-muted-foreground">
                {filtered
                  ? "Ajuste ou limpe os filtros para ver outras solicitações."
                  : "As solicitações da Legalização são sincronizadas do Acessórias uma vez por dia."}
              </p>
              {filtered && (
                <Link
                  href="/requests"
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Limpar filtros
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      {[
                        "ID",
                        "Cliente",
                        "Assunto",
                        "Tipo",
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
                    {result.items.map((request) => {
                      const selected =
                        params.sol === request.acessoriasRequestId;
                      const detailHref = href({
                        sol: request.acessoriasRequestId,
                      });
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
                              href={detailHref}
                              scroll={false}
                              aria-current={selected ? "true" : undefined}
                              className="hover:underline"
                            >
                              {request.acessoriasRequestId}
                            </Link>
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <Link
                              href={`/clients/${request.clientId}?aba=solicitacoes`}
                              className="font-medium hover:underline"
                            >
                              {request.clientName}
                            </Link>
                            {request.clientDocument && (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {request.clientDocument}
                              </p>
                            )}
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            <Link
                              href={detailHref}
                              scroll={false}
                              className="hover:underline"
                            >
                              {request.subject ?? "—"}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{request.type ?? "—"}</td>
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
                            {request.overdue ? (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-danger">
                                <TriangleAlert className="size-4" aria-hidden />
                                {formatDate(request.dueAt)}
                                <span className="sr-only">(atrasada)</span>
                              </span>
                            ) : (
                              formatDate(request.dueAt)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={params.pagina}
                pageSize={params.porPagina}
                total={result.total}
                pageSizes={REQUEST_PAGE_SIZES}
                hrefFor={(page, pageSize) =>
                  href({
                    pagina: page,
                    porPagina: pageSize ?? params.porPagina,
                    sol: undefined,
                  })
                }
              />
            </>
          )}
        </Card>
      </div>

      {params.sol && (
        <Suspense
          key={params.sol}
          fallback={
            <div
              className="h-96 animate-pulse rounded-xl bg-muted"
              aria-busy="true"
            />
          }
        >
          <RequestDetailPanel
            solId={params.sol}
            closeHref={href({ sol: undefined })}
          />
        </Suspense>
      )}
    </div>
  );
}

function Filters({
  params,
  options,
  counts,
  href,
}: {
  params: RequestListParams;
  options: { statuses: string[]; types: string[]; responsibles: string[] };
  counts: { abertas: number; atrasadas: number };
  href: (overrides: Record<string, string | number | undefined>) => string;
}) {
  // Formulário GET: tudo vai para a URL e é filtrado no servidor.
  return (
    <Card className="gap-4 px-5 py-5">
      <form
        method="get"
        action="/requests"
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        <input type="hidden" name="porPagina" value={params.porPagina} />
        <div className="relative md:col-span-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar por cliente, CNPJ, assunto ou ID"
            aria-label="Buscar solicitações"
            className="pl-9"
          />
        </div>
        <select
          name="situacao"
          defaultValue={params.situacao}
          aria-label="Situação"
          className={fieldClassName}
        >
          {Object.entries(REQUEST_SITUATIONS).map(([value, label]) => (
            <option key={value} value={value}>
              Situação: {label}
            </option>
          ))}
        </select>
        <select
          name="ordem"
          defaultValue={params.ordem}
          aria-label="Ordenação"
          className={fieldClassName}
        >
          {Object.entries(REQUEST_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              Ordem: {label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          aria-label="Status no Acessórias"
          className={fieldClassName}
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
          defaultValue={params.tipo ?? ""}
          aria-label="Tipo"
          className={fieldClassName}
        >
          <option value="">Tipo: Todos</option>
          {options.types.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          name="resp"
          defaultValue={params.resp ?? ""}
          aria-label="Responsável"
          className={fieldClassName}
        >
          <option value="">Responsável: Todos</option>
          {options.responsibles.map((value) => (
            <option key={value} value={value}>
              {displayPersonName(value)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            name="periodo"
            defaultValue={params.periodo ? String(params.periodo) : ""}
            aria-label="Período de abertura"
            className={fieldClassName}
          >
            <option value="">Período: Todos</option>
            {REQUEST_PERIODS.map((days) => (
              <option key={days} value={days}>
                Últimos {days} dias
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            <Search aria-hidden />
            Filtrar
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <QuickLink
          href={href({ situacao: "abertas", pagina: 1, sol: undefined })}
          active={params.situacao === "abertas"}
        >
          Em aberto
          <span className="tabular-nums">({counts.abertas})</span>
        </QuickLink>
        <QuickLink
          href={href({ situacao: "atrasadas", pagina: 1, sol: undefined })}
          active={params.situacao === "atrasadas"}
          danger
        >
          <TriangleAlert className="size-4" aria-hidden />
          Atrasadas
          <span className="tabular-nums">({counts.atrasadas})</span>
        </QuickLink>
        <Link href="/requests" className={buttonVariants({ variant: "ghost" })}>
          Limpar filtros
        </Link>
      </div>
    </Card>
  );
}

function QuickLink({
  href,
  active,
  danger,
  children,
}: {
  href: string;
  active: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "border-foreground bg-muted",
        danger && "text-danger",
      )}
    >
      {children}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando solicitações…</span>
      <div className="h-[168px] animate-pulse rounded-xl bg-muted" />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="h-6 w-56 animate-pulse rounded bg-muted" />
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-muted/70" />
        ))}
      </div>
    </div>
  );
}

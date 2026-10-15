import { SearchX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ClientFilters } from "@/components/clients/client-filters";
import { ClientsTable } from "@/components/clients/clients-table";
import { Pagination } from "@/components/data/pagination";
import { RefreshButton } from "@/components/data/refresh-button";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { hrefWith } from "@/lib/url";
import {
  clientListParamsSchema,
  listClients,
  PAGE_SIZES,
  type ClientListParams,
} from "@/services/clients/list-clients";

export const metadata: Metadata = {
  title: "Meus Clientes — Controle de Vencimentos",
};

// Referência visual: docs/mockups/03-clients.png (SRS RF-04).
export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meus Clientes"
        description="Clientes sob sua responsabilidade"
        aside={<RefreshButton />}
      />
      <Suspense fallback={<ClientsSkeleton />}>
        <ClientsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ClientsContent({
  searchParams,
}: Pick<PageProps<"/clients">, "searchParams">) {
  const params = clientListParamsSchema.parse(await searchParams);
  const result = await listClients(params);
  const hasFilters = Boolean(params.razao || params.fantasia || params.cnpj);

  const current = { ...params };
  const href = (
    overrides: Partial<Record<keyof ClientListParams, string | number>>,
  ) => hrefWith("/clients", current, overrides);

  return (
    <>
      <ClientFilters
        razao={params.razao}
        fantasia={params.fantasia}
        cnpj={params.cnpj}
        porPagina={params.porPagina}
      />
      <Card className="gap-5 px-5 py-5">
        <h2 className="text-lg font-semibold tabular-nums">
          {result.total} {result.total === 1 ? "cliente" : "clientes"}
        </h2>
        {result.items.length === 0 ? (
          <EmptyState filtered={hasFilters} />
        ) : (
          <>
            <ClientsTable
              items={result.items}
              sort={params.ordem}
              direction={params.direcao}
              sortHref={(column) =>
                href({
                  ordem: column,
                  direcao:
                    column === params.ordem && params.direcao === "asc"
                      ? "desc"
                      : "asc",
                  pagina: 1,
                })
              }
            />
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              pageSizes={PAGE_SIZES}
              hrefFor={(page, pageSize) =>
                href({ pagina: page, porPagina: pageSize ?? params.porPagina })
              }
            />
          </>
        )}
      </Card>
    </>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const Icon = filtered ? SearchX : Users;
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <p className="font-semibold">
        {filtered
          ? "Nenhum cliente encontrado"
          : "Nenhum cliente na sua carteira"}
      </p>
      <p className="max-w-md text-muted-foreground">
        {filtered
          ? "Revise os filtros ou limpe a busca para ver toda a carteira."
          : "Sua carteira é definida pelo responsável da Legalização no Acessórias."}
      </p>
      {filtered && (
        <Link
          href="/clients"
          className="text-sm font-medium underline underline-offset-4"
        >
          Limpar filtros
        </Link>
      )}
    </div>
  );
}

function ClientsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando clientes…</span>
      <div className="h-[106px] animate-pulse rounded-xl bg-muted" />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-muted/70" />
        ))}
      </div>
    </div>
  );
}

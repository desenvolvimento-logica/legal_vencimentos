import { ArrowDown, ArrowUp, ArrowUpDown, CalendarX2, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Pagination } from "@/components/data/pagination";
import { ExpirationFilters } from "@/components/expirations/expiration-filters";
import { ExpirationRowActions } from "@/components/expirations/expiration-row-actions";
import { ExpirationStatusBadge } from "@/components/expirations/expiration-status-badge";
import { NewExpirationButton } from "@/components/expirations/new-expiration-button";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatCivilDate, toBusinessCivilDate } from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { EXPIRATION_TYPE_LABELS, initials } from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import {
  expirationListParamsSchema,
  listExpirations,
  PAGE_SIZES,
  type ExpirationListParams,
  type ExpirationSortKey,
} from "@/services/expirations/list-expirations";

export const metadata: Metadata = {
  title: "Vencimentos — Controle de Vencimentos",
};

// Referência visual: docs/mockups/05-expirations.png (SRS RF-06).
export default function ExpirationsPage({
  searchParams,
}: PageProps<"/expirations">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vencimentos"
        description="Acompanhe documentos vencidos e próximos do vencimento"
        aside={<NewExpirationButton />}
      />
      <Suspense fallback={<ListSkeleton />}>
        <ExpirationsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const COLUMNS: { key?: ExpirationSortKey; label: string }[] = [
  { key: "cliente", label: "Cliente" },
  { key: "documento", label: "Documento" },
  { key: "tipo", label: "Tipo" },
  { key: "vencimento", label: "Vencimento" },
  { key: "vencimento", label: "Dias" },
  { label: "Responsável" },
  { key: "situacao", label: "Situação" },
  { label: "Ações" },
];

async function ExpirationsContent({
  searchParams,
}: Pick<PageProps<"/expirations">, "searchParams">) {
  const params = expirationListParamsSchema.parse(await searchParams);
  await connection();
  const today = toBusinessCivilDate(new Date());
  const [result, profiles] = await Promise.all([
    listExpirations(params, today),
    loadProfiles(),
  ]);

  const href = (
    overrides: Partial<Record<keyof ExpirationListParams, string | number>>,
  ) => hrefWith("/expirations", { ...params }, overrides);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const filtered = Boolean(
    params.q ||
    params.tipo ||
    params.periodo ||
    params.de ||
    params.ate ||
    params.situacao !== "vigentes",
  );

  return (
    <>
      <ExpirationFilters params={params} />
      <Card className="gap-5 px-5 py-5">
        <h2 className="text-lg font-semibold tabular-nums">
          {result.total}{" "}
          {result.total === 1
            ? "vencimento encontrado"
            : "vencimentos encontrados"}
        </h2>
        {result.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <CalendarX2
                className="size-6 text-muted-foreground"
                aria-hidden
              />
            </span>
            <p className="font-semibold">
              {filtered
                ? "Nenhum vencimento com esses filtros"
                : "Nenhum vencimento vigente"}
            </p>
            <p className="max-w-md text-muted-foreground">
              {filtered
                ? "Ajuste ou limpe os filtros para ver outros vencimentos."
                : "Cadastre vencimentos pelo botão “Novo vencimento” ou a partir do cliente."}
            </p>
            {filtered && (
              <Link
                href="/expirations"
                className="text-sm font-medium underline underline-offset-4"
              >
                Limpar filtros
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    {COLUMNS.map((column) => (
                      <SortableHeader
                        key={column.label}
                        column={column}
                        params={params}
                        href={href}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => {
                    const status = displayStatus(
                      item.status,
                      item.expirationDate,
                      today,
                    );
                    const responsible =
                      item.responsibleUserId &&
                      names.get(item.responsibleUserId);
                    return (
                      <tr
                        key={item.id}
                        className="border-t transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/clients/${item.clientId}?aba=vencimentos`}
                            className="font-medium hover:underline"
                          >
                            {item.clientName}
                          </Link>
                          {item.clientDocument && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {item.clientDocument}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {item.documentName}
                        </td>
                        <td className="px-4 py-3">
                          {EXPIRATION_TYPE_LABELS[item.type]}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatCivilDate(item.expirationDate)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 font-semibold tabular-nums",
                            item.status === "ACTIVE" &&
                              status.daysLeft < 0 &&
                              "text-danger",
                            item.status === "ACTIVE" &&
                              status.daysLeft >= 0 &&
                              status.daysLeft <= 15 &&
                              "text-warning",
                          )}
                        >
                          {item.status === "ACTIVE" ||
                          item.status === "RENEWING"
                            ? status.daysLeft
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {responsible ? (
                            <span className="flex items-center gap-2">
                              <span
                                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                                aria-hidden
                              >
                                {initials(responsible)}
                              </span>
                              {responsible}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ExpirationStatusBadge status={status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/clients/${item.clientId}?aba=vencimentos`}
                              className="inline-flex size-8 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              aria-label={`Ver ${item.documentName} no cliente ${item.clientName}`}
                            >
                              <Eye className="size-4" aria-hidden />
                            </Link>
                            <ExpirationRowActions
                              client={{
                                id: item.clientId,
                                name: item.clientName,
                              }}
                              responsibles={profiles}
                              expiration={{
                                id: item.id,
                                documentName: item.documentName,
                                status: item.status,
                                values: {
                                  expirationType: item.type,
                                  documentName: item.documentName,
                                  documentNumber: item.documentNumber ?? "",
                                  issuer: item.issuer ?? "",
                                  issueDate: item.issueDate ?? "",
                                  expirationDate: item.expirationDate,
                                  responsibleUserId:
                                    item.responsibleUserId ?? "",
                                  notes: item.notes ?? "",
                                },
                              }}
                            />
                          </div>
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

/** Nomes dos perfis relevantes ao usuário (legal_visible_profiles), sem ADMIN. */
async function loadProfiles(): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("legal_visible_profiles");
  if (error) throw new Error("Não foi possível carregar os responsáveis.");
  return data
    .filter((profile) => profile.active && profile.hierarchy_level !== "ADMIN")
    .map((profile) => ({ id: profile.id, name: profile.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function SortableHeader({
  column,
  params,
  href,
}: {
  column: { key?: ExpirationSortKey; label: string };
  params: ExpirationListParams;
  href: (
    overrides: Partial<Record<keyof ExpirationListParams, string | number>>,
  ) => string;
}) {
  if (!column.key) {
    return (
      <th scope="col" className="px-4 py-3 font-semibold">
        {column.label}
      </th>
    );
  }
  const active = column.key === params.ordem;
  const Icon = !active
    ? ArrowUpDown
    : params.direcao === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={
        active
          ? params.direcao === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className="px-4 py-3 font-semibold"
    >
      <Link
        href={href({
          ordem: column.key,
          direcao: active && params.direcao === "asc" ? "desc" : "asc",
          pagina: 1,
        })}
        className="inline-flex items-center gap-1.5 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {column.label}
        <Icon
          className={cn(
            "size-3.5",
            active ? "text-foreground" : "text-muted-foreground",
          )}
          aria-hidden
        />
      </Link>
    </th>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando vencimentos…</span>
      <div className="h-[124px] animate-pulse rounded-xl bg-muted" />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-muted/70" />
        ))}
      </div>
    </div>
  );
}

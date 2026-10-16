import {
  FileText,
  Landmark,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ConnectionTest,
  SyncButton,
} from "@/components/admin/integration-actions";
import { SyncStatusBadge } from "@/components/admin/sync-status-badge";
import { Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getServerEnv } from "@/config/env.server";
import { requireAdmin } from "@/lib/auth/session";
import { hrefWith } from "@/lib/url";
import {
  latestSyncByType,
  listSyncLogs,
  SYNC_LOG_PAGE_SIZE,
  type SyncLog,
} from "@/services/admin/sync-logs";

export const metadata: Metadata = {
  title: "Integrações — Controle de Vencimentos",
};

// A sincronização manual roda dentro de uma Server Action desta página.
export const maxDuration = 300;

const TYPES: {
  type: "companies" | "users" | "requests";
  label: string;
  icon: LucideIcon;
}[] = [
  { type: "companies", label: "Clientes", icon: Users },
  { type: "users", label: "Usuários", icon: UserCog },
  { type: "requests", label: "Solicitações", icon: FileText },
];
const TYPE_LABELS = Object.fromEntries(
  TYPES.map((item) => [item.type, item.label]),
);

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const numberFormatter = new Intl.NumberFormat("pt-BR");

function duration(log: SyncLog): string {
  if (!log.finishedAt) return "—";
  const seconds = Math.max(
    0,
    Math.round((Date.parse(log.finishedAt) - Date.parse(log.startedAt)) / 1000),
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

// Referência visual: docs/mockups/06-admin-integrations.png (SRS RF-13).
export default function IntegrationsPage({
  searchParams,
}: PageProps<"/admin/integrations">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrações"
        description="Monitore e execute sincronizações com o Acessórias"
        aside={
          <SyncButton
            types={["companies", "users", "requests"]}
            label="Sincronizar tudo"
            variant="default"
          />
        }
      />
      <Suspense
        fallback={
          <div
            className="h-96 animate-pulse rounded-xl bg-muted"
            aria-busy="true"
          />
        }
      >
        <IntegrationsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function IntegrationsContent({
  searchParams,
}: Pick<PageProps<"/admin/integrations">, "searchParams">) {
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number(query.pagina) || 1);
  const [latest, history] = await Promise.all([
    latestSyncByType(TYPES.map((item) => item.type)),
    listSyncLogs(page),
  ]);

  return (
    <>
      <Card className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold-500/15 text-foreground">
            <Landmark className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Sistema Acessórias</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Endpoint da API
            </p>
            <code className="mt-1 block truncate rounded-md bg-muted px-3 py-1.5 text-sm">
              {getServerEnv().ACESSORIAS_API_URL}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Sincronização automática diária às 06:00 (Brasília). A carga
              completa é feita pelo comando <code>npm run sync</code>.
            </p>
          </div>
        </div>
        <ConnectionTest />
      </Card>

      <section
        aria-label="Sincronizações"
        className="grid gap-4 md:grid-cols-3"
      >
        {TYPES.map(({ type, label, icon: Icon }) => {
          const log = latest.get(type);
          return (
            <Card key={type} className="gap-4 px-5 py-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{label}</h3>
                  {log ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Última sincronização
                      </p>
                      <p className="text-sm font-medium tabular-nums">
                        {dateTimeFormatter.format(new Date(log.startedAt))}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {numberFormatter.format(log.received)} recebidos ·{" "}
                        {numberFormatter.format(log.created)} novos ·{" "}
                        {numberFormatter.format(log.updated)} atualizados
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma execução registrada.
                    </p>
                  )}
                </div>
              </div>
              {log && (
                <SyncStatusBadge status={log.status} failed={log.failed} />
              )}
              <SyncButton
                types={[type]}
                label={`Sincronizar ${label.toLowerCase()}`}
              />
            </Card>
          );
        })}
      </section>

      <Card className="gap-4 px-5 py-5">
        <h2 className="text-lg font-semibold">Histórico de sincronizações</h2>
        {history.items.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhuma execução registrada.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    {[
                      "Início",
                      "Integração",
                      "Modo",
                      "Recebidos",
                      "Criados",
                      "Atualizados",
                      "Falhos",
                      "Situação",
                      "Duração",
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
                  {history.items.map((log) => {
                    const mode =
                      log.metadata &&
                      typeof log.metadata === "object" &&
                      !Array.isArray(log.metadata)
                        ? (log.metadata as { mode?: string }).mode
                        : undefined;
                    return (
                      <tr key={log.id} className="border-t align-top">
                        <td className="px-4 py-3 tabular-nums">
                          {dateTimeFormatter.format(new Date(log.startedAt))}
                        </td>
                        <td className="px-4 py-3">
                          {TYPE_LABELS[log.type] ?? log.type}
                        </td>
                        <td className="px-4 py-3">
                          {mode === "full"
                            ? "Carga completa"
                            : mode === "incremental"
                              ? "Incremental"
                              : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {numberFormatter.format(log.received)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {numberFormatter.format(log.created)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {numberFormatter.format(log.updated)}
                        </td>
                        <td
                          className={
                            log.failed > 0
                              ? "px-4 py-3 font-semibold text-danger tabular-nums"
                              : "px-4 py-3 tabular-nums"
                          }
                        >
                          {numberFormatter.format(log.failed)}
                        </td>
                        <td className="px-4 py-3">
                          <SyncStatusBadge status={log.status} />
                          {log.errorMessage && (
                            <details className="mt-1 max-w-xs text-xs text-muted-foreground">
                              <summary className="cursor-pointer">
                                Detalhes
                              </summary>
                              <p className="mt-1 break-words">
                                {log.errorMessage}
                              </p>
                            </details>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {duration(log)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={SYNC_LOG_PAGE_SIZE}
              total={history.total}
              pageSizes={[SYNC_LOG_PAGE_SIZE]}
              hrefFor={(target) =>
                hrefWith("/admin/integrations", {}, { pagina: target })
              }
            />
          </>
        )}
      </Card>
    </>
  );
}

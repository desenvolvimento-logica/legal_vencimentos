import {
  CalendarDays,
  CircleMinus,
  CirclePlus,
  FileText,
  Pencil,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  auditChanges,
  auditRecordLabel,
  auditTone,
  type AuditTone,
} from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import { listAllProfiles } from "@/services/admin/profiles";
import {
  AUDIT_PAGE_SIZE,
  auditParamsSchema,
  getAuditEvent,
  listAuditEvents,
  type AuditEvent,
} from "@/services/admin/audit";

export const metadata: Metadata = {
  title: "Auditoria — Controle de Vencimentos",
};

const TONES: Record<AuditTone, { icon: typeof Pencil; className: string }> = {
  create: { icon: CirclePlus, className: "bg-success/10 text-success" },
  update: { icon: Pencil, className: "bg-info/10 text-info" },
  renewal: { icon: RefreshCw, className: "bg-violet-600/10 text-violet-700" },
  danger: { icon: CircleMinus, className: "bg-danger/10 text-danger" },
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none";

// Referência visual: docs/mockups/11-admin-audit.png (SRS RF-14). Somente
// leitura: sem editar, excluir ou exportar. IP/origem não são registrados.
export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoria"
        description="Consulte o histórico de alterações do sistema"
      />
      <Suspense
        fallback={
          <div
            className="h-96 animate-pulse rounded-xl bg-muted"
            aria-busy="true"
          />
        }
      >
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AuditContent({
  searchParams,
}: Pick<PageProps<"/admin/audit">, "searchParams">) {
  await requireAdmin();
  const params = auditParamsSchema.parse(await searchParams);
  const [{ items, total }, profiles, selected] = await Promise.all([
    listAuditEvents(params),
    listAllProfiles(),
    params.evento ? getAuditEvent(params.evento) : Promise.resolve(null),
  ]);
  const people = new Map(profiles.map((profile) => [profile.id, profile]));
  const current = { ...params, evento: undefined };
  const hasFilters = Boolean(
    params.usuario || params.acao || params.entidade || params.de || params.ate,
  );

  return (
    <>
      <Card className="px-5 py-5">
        <form
          method="get"
          action="/admin/audit"
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto]"
        >
          <select
            name="usuario"
            defaultValue={params.usuario ?? ""}
            aria-label="Usuário"
            className={selectClassName}
          >
            <option value="">Usuário: Todos</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <select
            name="acao"
            defaultValue={params.acao ?? ""}
            aria-label="Ação"
            className={selectClassName}
          >
            <option value="">Ação: Todas</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="entidade"
            defaultValue={params.entidade ?? ""}
            aria-label="Entidade"
            className={selectClassName}
          >
            <option value="">Entidade: Todas</option>
            {Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            type="date"
            name="de"
            defaultValue={params.de}
            aria-label="De"
            title="De"
          />
          <Input
            type="date"
            name="ate"
            defaultValue={params.ate}
            aria-label="Até"
            title="Até"
          />
          <div className="flex gap-2">
            <Button type="submit">
              <Search aria-hidden />
              Buscar
            </Button>
            {hasFilters && (
              <Link
                href="/admin/audit"
                className={buttonVariants({ variant: "ghost" })}
              >
                Limpar
              </Link>
            )}
          </div>
        </form>
      </Card>

      <div
        className={cn(
          "grid gap-6",
          selected && "xl:grid-cols-[1fr_420px] xl:items-start",
        )}
      >
        <Card className="gap-5 px-5 py-5">
          <h2 className="text-lg font-semibold tabular-nums">
            {new Intl.NumberFormat("pt-BR").format(total)}{" "}
            {total === 1 ? "evento" : "eventos"}
          </h2>
          {items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {hasFilters
                ? "Nenhum evento com esses filtros."
                : "Nenhum evento registrado."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      {[
                        "Data/Hora",
                        "Usuário",
                        "Ação",
                        "Entidade",
                        "Registro",
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
                    {items.map((event) => {
                      const isSelected = event.id === selected?.id;
                      return (
                        <tr
                          key={event.id}
                          className={cn(
                            "border-t",
                            isSelected && "bg-brand-gold-500/5",
                          )}
                        >
                          <td className="px-4 py-3 tabular-nums">
                            <Link
                              href={hrefWith("/admin/audit", current, {
                                evento: event.id,
                              })}
                              scroll={false}
                              aria-current={isSelected ? "true" : undefined}
                              className="hover:underline"
                            >
                              {dateTimeFormatter.format(
                                new Date(event.createdAt),
                              )}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {people.get(event.userId)?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <ActionBadge action={event.action} />
                          </td>
                          <td className="px-4 py-3">
                            {AUDIT_ENTITY_LABELS[event.entityType] ??
                              event.entityType}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3">
                            {auditRecordLabel(
                              event.entityType,
                              event.oldData,
                              event.newData,
                            ) ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={params.pagina}
                pageSize={AUDIT_PAGE_SIZE}
                total={total}
                pageSizes={[AUDIT_PAGE_SIZE]}
                hrefFor={(page) =>
                  hrefWith("/admin/audit", current, { pagina: page })
                }
              />
            </>
          )}
        </Card>

        {selected && (
          <EventDetail
            event={selected}
            userLabel={(() => {
              const person = people.get(selected.userId);
              return person ? `${person.name} (${person.email})` : "—";
            })()}
            closeHref={hrefWith("/admin/audit", current)}
          />
        )}
      </div>
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  const { icon: Icon, className } = TONES[auditTone(action)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {AUDIT_ACTION_LABELS[action] ?? action}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function EventDetail({
  event,
  userLabel,
  closeHref,
}: {
  event: AuditEvent;
  userLabel: string;
  closeHref: string;
}) {
  const changes = auditChanges(event.oldData, event.newData);
  const creating = event.oldData === null;

  return (
    <aside
      aria-label="Detalhes do evento"
      className="flex flex-col gap-5 rounded-xl border bg-card px-5 py-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold">Detalhes do evento</h2>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Fechar detalhes"
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </Link>
      </div>

      <dl className="flex flex-col gap-3 border-b pb-5 text-sm">
        {[
          {
            icon: CalendarDays,
            label: "Data/Hora",
            value: dateTimeFormatter.format(new Date(event.createdAt)),
          },
          { icon: User, label: "Usuário", value: userLabel },
          {
            icon: FileText,
            label: "Entidade",
            value: AUDIT_ENTITY_LABELS[event.entityType] ?? event.entityType,
          },
          {
            icon: FileText,
            label: "Registro",
            value:
              auditRecordLabel(
                event.entityType,
                event.oldData,
                event.newData,
              ) ?? event.entityId,
          },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="grid grid-cols-[24px_90px_1fr] items-start gap-2"
          >
            <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[24px_90px_1fr] items-center gap-2">
          <span />
          <dt className="text-muted-foreground">Ação</dt>
          <dd>
            <ActionBadge action={event.action} />
          </dd>
        </div>
      </dl>

      <section aria-labelledby="changes-title" className="flex flex-col gap-3">
        <h3 id="changes-title" className="font-semibold">
          {creating ? "Dados registrados" : "Campos alterados"}
        </h3>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma diferença nos dados.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.map((change) => (
              <li key={change.field} className="rounded-lg border p-3 text-sm">
                <p className="font-mono text-xs text-muted-foreground">
                  {change.field}
                </p>
                {creating ? (
                  <p className="mt-1 rounded bg-success/10 px-2 py-1 font-mono text-xs break-words text-success">
                    {formatValue(change.after)}
                  </p>
                ) : (
                  <div className="mt-1 grid gap-1">
                    <p className="rounded bg-danger/10 px-2 py-1 font-mono text-xs break-words text-danger">
                      <span className="sr-only">Antes: </span>−{" "}
                      {formatValue(change.before)}
                    </p>
                    <p className="rounded bg-success/10 px-2 py-1 font-mono text-xs break-words text-success">
                      <span className="sr-only">Depois: </span>+{" "}
                      {formatValue(change.after)}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

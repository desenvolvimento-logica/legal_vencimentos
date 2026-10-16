import {
  CircleAlert,
  Clock,
  FileText,
  History,
  Inbox,
  Lock,
  Plus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Pagination } from "@/components/data/pagination";
import { ExpirationFormSheet } from "@/components/expirations/expiration-form-sheet";
import { ExpirationRowActions } from "@/components/expirations/expiration-row-actions";
import { ExpirationStatusBadge } from "@/components/expirations/expiration-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCivilDate, toBusinessCivilDate } from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { displayPersonName, EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import {
  getClientDetail,
  listClientExpirations,
  listClientRequests,
  REQUESTS_PAGE_SIZE,
  type ClientDetail,
  type ClientExpiration,
} from "@/services/clients/get-client";
import {
  getResponsibleChoices,
  type ResponsibleOption,
} from "@/services/expirations/responsibles";

export const metadata: Metadata = {
  title: "Cliente — Controle de Vencimentos",
};

const TABS = [
  { key: "visao-geral", label: "Visão Geral" },
  { key: "vencimentos", label: "Vencimentos" },
  { key: "solicitacoes", label: "Solicitações" },
  { key: "historico", label: "Histórico" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// Referência visual: docs/mockups/04-client-detail-new-expiration.png (SRS RF-04).
// O cadastro de vencimento (drawer) entra na Fase 6.
export default function ClientPage(props: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ClientContent {...props} />
    </Suspense>
  );
}

async function ClientContent({
  params,
  searchParams,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const client = await getClientDetail(id);
  if (!client) notFound();

  const tab: TabKey = TABS.some((item) => item.key === query.aba)
    ? (query.aba as TabKey)
    : "visao-geral";
  const page = Math.max(1, Number(query.pagina) || 1);
  const responsibles = await getResponsibleChoices(client);
  const clientRef = { id: client.id, name: client.corporateName };

  return (
    <div className="flex flex-col gap-6">
      <ClientHeader
        client={client}
        action={
          <ExpirationFormSheet
            client={clientRef}
            responsibles={responsibles.options}
            defaultResponsibleId={responsibles.defaultId}
            trigger={
              <Button>
                <Plus aria-hidden />
                Novo vencimento
              </Button>
            }
          />
        }
      />
      <nav
        aria-label="Seções do cliente"
        className="flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={hrefWith(`/clients/${client.id}`, {}, { aba: item.key })}
            aria-current={item.key === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-[3px] px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              item.key === tab
                ? "border-brand-gold-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Suspense key={`${tab}-${page}`} fallback={<TabSkeleton />}>
        {tab === "visao-geral" && <OverviewTab client={client} />}
        {tab === "vencimentos" && (
          <ExpirationsTab
            client={clientRef}
            responsibles={responsibles.options}
            scope="current"
          />
        )}
        {tab === "solicitacoes" && <RequestsTab client={client} page={page} />}
        {tab === "historico" && (
          <ExpirationsTab
            client={clientRef}
            responsibles={responsibles.options}
            scope="history"
          />
        )}
      </Suspense>
    </div>
  );
}

function ClientHeader({
  client,
  action,
}: {
  client: ClientDetail;
  action: React.ReactNode;
}) {
  const active = client.status?.toLowerCase().startsWith("ativ");
  const primary = client.responsibles.find((r) => r.departmentId === "5");
  const certificate = client.responsibles.find((r) => r.departmentId !== "5");

  const fields = [
    { label: "Nome fantasia", value: client.tradeName },
    { label: "CNPJ", value: client.documentNumber },
    { label: "ID Acessórias", value: client.acessoriasCompanyId },
    {
      label: "Responsável Legalização",
      value: primary?.name && displayPersonName(primary.name),
    },
    ...(certificate
      ? [
          {
            label: "Responsável Cert. Digital",
            value: certificate.name && displayPersonName(certificate.name),
          },
        ]
      : []),
  ];

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">
          {client.corporateName}
        </h1>
        {client.status && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold",
              active
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                active ? "bg-success" : "bg-muted-foreground",
              )}
              aria-hidden
            />
            {client.status}
          </span>
        )}
        <div className="ml-auto">{action}</div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{field.label}</dt>
            <dd className="font-medium tabular-nums">{field.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

async function OverviewTab({ client }: { client: ClientDetail }) {
  const expirations = await listClientExpirations(client.id, "current");
  return (
    <div className="flex flex-col gap-6">
      <SummaryCards expirations={expirations} />
      <Card className="gap-4 px-5 py-5">
        <h2 className="text-lg font-semibold">Responsáveis no Acessórias</h2>
        {client.responsibles.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhum responsável da Legalização cadastrado para este cliente no
            Acessórias.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {client.responsibles.map((responsible) => (
              <li
                key={responsible.departmentId}
                className="rounded-lg border px-4 py-3"
              >
                <p className="text-sm text-muted-foreground">
                  {responsible.departmentName ??
                    `Departamento ${responsible.departmentId}`}
                </p>
                <p className="font-medium">
                  {responsible.name
                    ? displayPersonName(responsible.name)
                    : "Sem responsável"}
                </p>
                {responsible.email && (
                  <p className="text-sm text-muted-foreground">
                    {responsible.email}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function SummaryCards({
  expirations,
}: {
  expirations: ClientExpiration[];
}) {
  await connection();
  const today = toBusinessCivilDate(new Date());
  const statuses = expirations.map((item) => ({
    item,
    display: displayStatus(item.status, item.expirationDate, today),
  }));
  const active = expirations.filter((item) => item.status !== "EXPIRED").length;
  const overdue = statuses.filter(
    ({ display }) => display.label === "Vencido",
  ).length;
  const next = statuses
    .filter(
      ({ display, item }) => display.daysLeft >= 0 && item.status !== "EXPIRED",
    )
    .sort((a, b) => a.display.daysLeft - b.display.daysLeft)[0];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SummaryCard
        icon={FileText}
        tone="success"
        value={String(active)}
        label={active === 1 ? "vencimento ativo" : "vencimentos ativos"}
      />
      <SummaryCard
        icon={CircleAlert}
        tone="danger"
        value={String(overdue)}
        label={overdue === 1 ? "vencimento vencido" : "vencimentos vencidos"}
      />
      <SummaryCard
        icon={Clock}
        tone="warning"
        value={
          next
            ? next.display.daysLeft === 0
              ? "Hoje"
              : `${next.display.daysLeft} ${next.display.daysLeft === 1 ? "dia" : "dias"}`
            : "—"
        }
        label={
          next
            ? `Próximo: ${next.item.documentName}`
            : "Nenhum vencimento futuro"
        }
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: typeof FileText;
  tone: "success" | "danger" | "warning";
  value: string;
  label: string;
}) {
  const tones = {
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <Card className="flex-row items-center gap-4 px-5 py-5">
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full",
          tones[tone],
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <p className="truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

async function ExpirationsTab({
  client,
  responsibles,
  scope,
}: {
  client: { id: string; name: string };
  responsibles: ResponsibleOption[];
  scope: "current" | "history";
}) {
  const expirations = await listClientExpirations(client.id, scope);
  await connection();
  const today = toBusinessCivilDate(new Date());
  const names = new Map(responsibles.map((option) => [option.id, option.name]));
  const headers = [
    "Tipo",
    "Documento",
    "Número",
    "Órgão emissor",
    "Vencimento",
    "Responsável",
    "Situação",
    scope === "current" ? "Ações" : "Motivo",
  ];

  return (
    <Card className="gap-4 px-5 py-5">
      <h2 className="text-lg font-semibold">
        {scope === "current" ? "Vencimentos" : "Histórico de vencimentos"}{" "}
        <span className="font-normal text-muted-foreground tabular-nums">
          ({expirations.length})
        </span>
      </h2>
      {expirations.length === 0 ? (
        <EmptyTab
          icon={scope === "current" ? FileText : History}
          title={
            scope === "current"
              ? "Nenhum vencimento cadastrado"
              : "Nenhum vencimento renovado ou cancelado"
          }
          description={
            scope === "current"
              ? "Use “Novo vencimento” para cadastrar certidões, licenças e certificados deste cliente."
              : "Renovações e cancelamentos aparecerão aqui, preservando a cadeia histórica."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                {headers.map((header) => (
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
              {expirations.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">
                    {EXPIRATION_TYPE_LABELS[item.type]}
                  </td>
                  <td className="px-4 py-3 font-medium">{item.documentName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.documentNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">{item.issuer ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCivilDate(item.expirationDate)}
                  </td>
                  <td className="px-4 py-3">
                    {(item.responsibleUserId &&
                      names.get(item.responsibleUserId)) ??
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ExpirationStatusBadge
                      status={displayStatus(
                        item.status,
                        item.expirationDate,
                        today,
                      )}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {scope === "current" ? (
                      <ExpirationRowActions
                        client={client}
                        responsibles={responsibles}
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
                            responsibleUserId: item.responsibleUserId ?? "",
                            notes: item.notes ?? "",
                          },
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {item.cancellationReason ?? "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatInstantDate(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

async function RequestsTab({
  client,
  page,
}: {
  client: ClientDetail;
  page: number;
}) {
  const { items, total } = await listClientRequests(
    client.acessoriasCompanyId,
    page,
  );

  return (
    <Card className="gap-4 px-5 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          Solicitações{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            ({total})
          </span>
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          Somente leitura
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Solicitações da Legalização no Acessórias, atualizadas diariamente.
      </p>
      {items.length === 0 ? (
        <EmptyTab
          icon={Inbox}
          title="Nenhuma solicitação sincronizada"
          description="Só aparecem solicitações da Legalização atualizadas a partir de 90 dias antes da primeira sincronização."
        />
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
                {items.map((request) => (
                  <tr key={request.id} className="border-t">
                    <td className="px-4 py-3 tabular-nums">
                      {request.acessoriasRequestId}
                    </td>
                    <td className="max-w-xs px-4 py-3 font-medium">
                      {request.subject ?? "—"}
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
                      {formatInstantDate(request.openedAt)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatInstantDate(request.dueAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={REQUESTS_PAGE_SIZE}
            total={total}
            pageSizes={[REQUESTS_PAGE_SIZE]}
            hrefFor={(target) =>
              hrefWith(
                `/clients/${client.id}`,
                {},
                { aba: "solicitacoes", pagina: target },
              )
            }
          />
        </>
      )}
    </Card>
  );
}

function EmptyTab({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="max-w-md text-muted-foreground">{description}</p>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted/70" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando cliente…</span>
      <div className="h-10 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="h-14 animate-pulse rounded-md bg-muted/70" />
      <div className="h-10 animate-pulse rounded-md bg-muted/70" />
      <TabSkeleton />
    </div>
  );
}

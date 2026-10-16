import { ArrowRight, FilePlus2, FileText, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ExpirationStatusBadge } from "@/components/expirations/expiration-status-badge";
import { RenewalForm } from "@/components/expirations/renewal-form";
import { StartRenewalButton } from "@/components/expirations/start-renewal-button";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatCivilDate, toBusinessCivilDate } from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { RENEWAL_PERIOD_LABELS } from "@/lib/expirations/period";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  getExpirationWithChain,
  type ExpirationRecord,
} from "@/services/expirations/get-expiration";

export const metadata: Metadata = {
  title: "Renovação de vencimento — Controle de Vencimentos",
};

// Referência visual: docs/mockups/07-expiration-renewal.png (SRS RF-08).
export default function RenewPage(props: PageProps<"/expirations/[id]/renew">) {
  return (
    <Suspense fallback={<RenewSkeleton />}>
      <RenewContent {...props} />
    </Suspense>
  );
}

async function RenewContent({ params }: PageProps<"/expirations/[id]/renew">) {
  const { id } = await params;
  const data = await getExpirationWithChain(id);
  if (!data) notFound();
  await connection();
  const today = toBusinessCivilDate(new Date());

  const { expiration, client, chain } = data;
  const returnHref = `/clients/${client.id}?aba=vencimentos`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Renovação de vencimento" description={client.name} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_auto_1fr]">
          <section
            aria-labelledby="current-title"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <FileText className="size-6" aria-hidden />
              <h2 id="current-title" className="text-xl font-semibold">
                Registro atual
              </h2>
              <ExpirationStatusBadge
                status={displayStatus(
                  expiration.status,
                  expiration.expirationDate,
                  today,
                )}
              />
            </div>
            <dl className="divide-y">
              {[
                ["Documento", expiration.documentName],
                ["Tipo", EXPIRATION_TYPE_LABELS[expiration.type]],
                ["Número", expiration.documentNumber],
                ["Emissão", formatCivilDate(expiration.issueDate)],
                ["Vencimento", formatCivilDate(expiration.expirationDate)],
                [
                  "Periodicidade",
                  expiration.renewalPeriod &&
                    RENEWAL_PERIOD_LABELS[expiration.renewalPeriod],
                ],
                ["Órgão", expiration.issuer],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[120px_1fr] gap-3 py-3"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="hidden items-center lg:flex" aria-hidden>
            <ArrowRight className="size-6 text-muted-foreground" />
          </div>

          <section aria-labelledby="new-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <FilePlus2 className="size-6" aria-hidden />
              <h2 id="new-title" className="text-xl font-semibold">
                Novo registro
              </h2>
              <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                Será criado como Ativo
              </span>
            </div>
            <NewRecordPanel
              expiration={expiration}
              today={today}
              returnHref={returnHref}
            />
          </section>
        </Card>

        <Card className="gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <History className="size-6" aria-hidden />
            <h2 className="text-xl font-semibold">Histórico do documento</h2>
          </div>
          <ChainTimeline chain={chain} today={today} />
        </Card>
      </div>
    </div>
  );
}

function NewRecordPanel({
  expiration,
  today,
  returnHref,
}: {
  expiration: ExpirationRecord;
  today: string;
  returnHref: string;
}) {
  if (expiration.status === "RENEWING") {
    return (
      <RenewalForm
        expirationId={expiration.id}
        currentExpirationDate={expiration.expirationDate}
        today={today}
        defaults={{
          documentNumber: "",
          issuer: expiration.issuer ?? "",
          renewalPeriod: expiration.renewalPeriod,
          reminderDays: expiration.reminderDays,
        }}
        returnHref={returnHref}
      />
    );
  }

  if (expiration.status === "ACTIVE" || expiration.status === "QUOTE_SENT") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
        <p className="text-muted-foreground">
          Para registrar o novo período, inicie a renovação. O vencimento atual
          passa a “Em renovação” até a conclusão.
        </p>
        <StartRenewalButton expirationId={expiration.id} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
      <p className="text-muted-foreground">
        Este vencimento já foi{" "}
        {expiration.status === "RENEWED" ? "renovado" : "cancelado"} e faz parte
        do histórico.
      </p>
      <Link
        href={returnHref}
        className="text-sm font-medium underline underline-offset-4"
      >
        Voltar ao cliente
      </Link>
    </div>
  );
}

function ChainTimeline({
  chain,
  today,
}: {
  chain: ExpirationRecord[];
  today: string;
}) {
  return (
    <ol className="flex flex-col">
      {chain.map((item, index) => {
        const current = index === 0;
        const last = index === chain.length - 1;
        return (
          <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                className="absolute top-4 left-[7px] h-full w-0.5 bg-border"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative mt-1 size-4 shrink-0 rounded-full border-2 border-card",
                current
                  ? "bg-info ring-2 ring-info/30"
                  : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatCivilDate(item.issueDate) || "—"} –{" "}
                  {formatCivilDate(item.expirationDate)}
                </p>
                <ExpirationStatusBadge
                  status={displayStatus(
                    item.status,
                    item.expirationDate,
                    today,
                  )}
                />
              </div>
              <p className="font-semibold">{item.documentName}</p>
              {item.documentNumber && (
                <p className="text-sm tabular-nums">{item.documentNumber}</p>
              )}
              {item.issuer && (
                <p className="text-sm text-muted-foreground">{item.issuer}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RenewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="h-12 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}

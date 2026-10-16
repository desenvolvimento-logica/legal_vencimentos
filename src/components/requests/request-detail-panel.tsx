import {
  Download,
  FileText,
  MessageSquareText,
  Paperclip,
  X,
} from "lucide-react";
import Link from "next/link";

import { displayPersonName, initials } from "@/lib/labels";
import {
  getRequestDetail,
  type RequestDetailView,
} from "@/services/requests/get-request-detail";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDateTime = (value: string | null) =>
  value ? dateTimeFormatter.format(new Date(value)) : "—";
const formatDate = (value: string | null) =>
  value ? dateFormatter.format(new Date(value)) : "—";

/**
 * Detalhe somente leitura de uma solicitação, buscado no Acessórias ao abrir
 * (docs/mockups/08-client-requests.png). Sem criar, editar, comentar,
 * concluir ou enviar anexos (SRS RF-10).
 */
export async function RequestDetailPanel({
  solId,
  closeHref,
}: {
  solId: string;
  closeHref: string;
}) {
  let detail: RequestDetailView | null;
  try {
    detail = await getRequestDetail(solId);
  } catch {
    return (
      <PanelShell title={`Solicitação #${solId}`} closeHref={closeHref}>
        <p className="text-destructive" role="alert">
          Não foi possível consultar a solicitação no Acessórias agora. Tente
          novamente em instantes.
        </p>
      </PanelShell>
    );
  }

  if (!detail) {
    return (
      <PanelShell title="Solicitação não encontrada" closeHref={closeHref}>
        <p className="text-muted-foreground">
          A solicitação não existe ou não pertence à sua carteira.
        </p>
      </PanelShell>
    );
  }

  const attachments = detail.interactions.flatMap(
    (interaction) => interaction.attachments,
  );
  const fields: [string, string][] = [
    ["Assunto", detail.subject || "—"],
    ["Departamento", detail.departmentName || "—"],
    [
      "Responsável",
      detail.officeResponsibles.map(displayPersonName).join(", ") || "—",
    ],
    ["Abertura", formatDate(detail.openedAt)],
    ["Prazo", formatDate(detail.dueAt)],
    ["Empresa", detail.companyName || "—"],
    ...(detail.completedAt
      ? ([["Conclusão", formatDateTime(detail.completedAt)]] as [
          string,
          string,
        ][])
      : []),
  ];

  return (
    <PanelShell title={`Solicitação #${detail.id}`} closeHref={closeHref}>
      <div className="flex flex-wrap gap-2">
        {[detail.status, detail.priority, detail.type]
          .filter(Boolean)
          .map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold"
            >
              {tag}
            </span>
          ))}
      </div>

      <dl className="flex flex-col gap-2 border-b pb-5 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_1fr] gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="interactions-title"
        className="flex flex-col gap-4"
      >
        <h3
          id="interactions-title"
          className="flex items-center gap-2 font-semibold"
        >
          <MessageSquareText className="size-5" aria-hidden />
          Interações
        </h3>
        {detail.interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma interação registrada.
          </p>
        ) : (
          <ol className="flex flex-col">
            {detail.interactions.map((interaction, index) => (
              <li key={index} className="relative flex gap-3 pb-5 last:pb-0">
                {index < detail.interactions.length - 1 && (
                  <span
                    className="absolute top-9 left-4 h-[calc(100%-2rem)] w-0.5 bg-border"
                    aria-hidden
                  />
                )}
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                  aria-hidden
                >
                  {initials(interaction.author)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">
                      {displayPersonName(interaction.author)}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(interaction.at)}
                    </span>
                    {interaction.kind && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {interaction.kind}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm break-words whitespace-pre-line text-muted-foreground">
                    {interaction.text || "—"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        aria-labelledby="attachments-title"
        className="flex flex-col gap-3"
      >
        <h3
          id="attachments-title"
          className="flex items-center gap-2 font-semibold"
        >
          <Paperclip className="size-5" aria-hidden />
          Anexos
        </h3>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <li key={attachment.key}>
                <a
                  href={`/api/requests/${detail.id}/attachments/${attachment.key}`}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  download
                >
                  <FileText className="size-5 shrink-0 text-info" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {attachment.name}
                  </span>
                  <Download
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="sr-only">Baixar</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PanelShell>
  );
}

function PanelShell({
  title,
  closeHref,
  children,
}: {
  title: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      aria-label="Detalhe da solicitação"
      className="flex flex-col gap-5 rounded-xl border bg-card px-5 py-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link
          href={closeHref}
          scroll={false}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Fechar detalhe"
        >
          <X className="size-4" aria-hidden />
        </Link>
      </div>
      {children}
    </aside>
  );
}

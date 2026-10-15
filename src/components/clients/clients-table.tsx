import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatCivilDate } from "@/lib/dates";
import { displayPersonName, initials } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type {
  ClientListItem,
  ClientSortKey,
} from "@/services/clients/list-clients";

type ClientsTableProps = {
  items: ClientListItem[];
  sort: ClientSortKey;
  direction: "asc" | "desc";
  /** href que ordena pela coluna (alterna a direção se já for a atual). */
  sortHref: (column: ClientSortKey) => string;
};

const COLUMNS: { key: ClientSortKey; label: string; align?: "center" }[] = [
  { key: "razao", label: "Razão Social" },
  { key: "fantasia", label: "Nome Fantasia" },
  { key: "cnpj", label: "CNPJ" },
  { key: "responsavel", label: "Responsável Legalização" },
  { key: "ativos", label: "Ativos", align: "center" },
  { key: "proximo", label: "Próximo vencimento" },
  { key: "vencidos", label: "Vencidos", align: "center" },
];

// Referência visual: docs/mockups/03-clients.png
export function ClientsTable({
  items,
  sort,
  direction,
  sortHref,
}: ClientsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {COLUMNS.map((column) => {
              const active = column.key === sort;
              const Icon = !active
                ? ArrowUpDown
                : direction === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={cn(
                    "px-4 py-3 font-semibold",
                    column.align === "center" && "text-center",
                  )}
                >
                  <Link
                    href={sortHref(column.key)}
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
            })}
            <th scope="col" className="px-4 py-3 text-center font-semibold">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((client) => (
            <tr
              key={client.id}
              className="border-t transition-colors hover:bg-muted/40"
            >
              <td className="px-4 py-3.5 font-medium">
                <Link
                  href={`/clients/${client.id}`}
                  className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {client.corporateName}
                </Link>
              </td>
              <td className="px-4 py-3.5 text-muted-foreground">
                {client.tradeName ?? "—"}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                {client.documentNumber ?? "—"}
              </td>
              <td className="px-4 py-3.5">
                <Responsible
                  name={client.responsibleName}
                  other={client.otherResponsibleName}
                />
              </td>
              <td className="px-4 py-3.5 text-center">
                <CountBadge
                  value={client.activeExpirations}
                  tone="success"
                  label="ativos"
                />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">
                {formatCivilDate(client.nextExpirationDate) || (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-center">
                <CountBadge
                  value={client.overdueExpirations}
                  tone="danger"
                  label="vencidos"
                />
              </td>
              <td className="px-4 py-3.5 text-center">
                <Link
                  href={`/clients/${client.id}`}
                  className="inline-flex size-8 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Ver detalhes de ${client.corporateName}`}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Responsible({
  name,
  other,
}: {
  name: string | null;
  other: string | null;
}) {
  if (!name && !other) {
    return <span className="text-muted-foreground">Sem responsável</span>;
  }
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
        aria-hidden
      >
        {initials(name ?? other ?? "")}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate">{displayPersonName(name ?? other!)}</p>
        {name && other && other !== name && (
          <p className="truncate text-xs text-muted-foreground">
            Cert. digital: {displayPersonName(other)}
          </p>
        )}
      </div>
    </div>
  );
}

function CountBadge({
  value,
  tone,
  label,
}: {
  value: number;
  tone: "success" | "danger";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
        value === 0
          ? "bg-muted text-muted-foreground"
          : tone === "success"
            ? "bg-success/10 text-success"
            : "bg-danger/10 text-danger",
      )}
    >
      {value}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

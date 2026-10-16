import { Clock, RotateCcw, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import {
  PERIODS,
  SITUATIONS,
  type ExpirationListParams,
} from "@/services/expirations/list-expirations";

const fieldClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none";

// Referência visual: docs/mockups/05-expirations.png. Formulário GET + atalhos
// como links: tudo vai para a URL e é filtrado no servidor.
export function ExpirationFilters({
  params,
}: {
  params: ExpirationListParams;
}) {
  const base = { q: params.q, tipo: params.tipo, porPagina: params.porPagina };
  const overdueActive = !params.periodo && params.situacao === "vencidos";

  return (
    <Card className="gap-4 px-5 py-5">
      <form
        method="get"
        action="/expirations"
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
      >
        <input type="hidden" name="porPagina" value={params.porPagina} />
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="Cliente, CNPJ ou documento"
            aria-label="Buscar por cliente, CNPJ ou documento"
            maxLength={100}
            className="pl-9"
          />
        </div>
        <select
          name="tipo"
          defaultValue={params.tipo ?? ""}
          aria-label="Tipo"
          className={fieldClassName}
        >
          <option value="">Tipo: Todos</option>
          {Object.entries(EXPIRATION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="situacao"
          defaultValue={params.periodo ? "vigentes" : params.situacao}
          aria-label="Situação"
          className={fieldClassName}
        >
          {Object.entries(SITUATIONS).map(([value, label]) => (
            <option key={value} value={value}>
              Situação: {label}
            </option>
          ))}
        </select>
        <Input
          type="date"
          name="de"
          defaultValue={params.de}
          aria-label="Vencimento a partir de"
          title="Vencimento a partir de"
        />
        <Input
          type="date"
          name="ate"
          defaultValue={params.ate}
          aria-label="Vencimento até"
          title="Vencimento até"
        />
        <Button type="submit">
          <Search aria-hidden />
          Filtrar
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Chip
          href={hrefWith("/expirations", base, { situacao: "vencidos" })}
          active={overdueActive}
          tone="danger"
          icon={TriangleAlert}
        >
          Vencidos
        </Chip>
        {PERIODS.map((days) => (
          <Chip
            key={days}
            href={hrefWith("/expirations", base, { periodo: days })}
            active={params.periodo === days}
            icon={Clock}
          >
            {days === 7 ? "Próximos 7 dias" : `${days} dias`}
          </Chip>
        ))}
        <Link
          href="/expirations"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "ml-auto text-muted-foreground",
          )}
        >
          <RotateCcw aria-hidden />
          Limpar filtros
        </Link>
      </div>
    </Card>
  );
}

function Chip({
  href,
  active,
  tone,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  tone?: "danger";
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? tone === "danger"
            ? "border-danger bg-danger/10 text-danger"
            : "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-muted",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

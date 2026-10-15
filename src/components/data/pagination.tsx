import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { PageSizeSelect } from "./page-size-select";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  pageSizes: readonly number[];
  /** href de uma página (e do tamanho de página) preservando os filtros. */
  hrefFor: (page: number, pageSize?: number) => string;
};

/** Páginas visíveis: primeira, última e vizinhas da atual, com reticências. */
export function visiblePages(
  page: number,
  totalPages: number,
): (number | "…")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  return sorted.flatMap((value, index) =>
    index > 0 && value - sorted[index - 1] > 1
      ? (["…", value] as const)
      : [value],
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  pageSizes,
  hrefFor,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground tabular-nums">
        Mostrando {first}–{last} de {total}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect
          value={pageSize}
          options={pageSizes}
          hrefs={Object.fromEntries(
            pageSizes.map((size) => [size, hrefFor(1, size)]),
          )}
        />
        <nav aria-label="Paginação" className="flex items-center gap-1">
          <PageLink
            href={page > 1 ? hrefFor(page - 1) : undefined}
            label="Página anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </PageLink>
          {visiblePages(page, totalPages).map((value, index) =>
            value === "…" ? (
              <span
                key={`gap-${index}`}
                className="px-2 text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <PageLink
                key={value}
                href={hrefFor(value)}
                label={`Página ${value}`}
                current={value === page}
              >
                {value}
              </PageLink>
            ),
          )}
          <PageLink
            href={page < totalPages ? hrefFor(page + 1) : undefined}
            label="Próxima página"
          >
            <ChevronRight className="size-4" aria-hidden />
          </PageLink>
        </nav>
      </div>
    </div>
  );
}

function PageLink({
  href,
  label,
  current,
  children,
}: {
  href?: string;
  label: string;
  current?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "flex size-9 items-center justify-center rounded-lg border text-sm tabular-nums transition-colors",
    current
      ? "border-primary bg-primary font-semibold text-primary-foreground"
      : "border-input bg-card hover:bg-muted",
  );
  if (!href) {
    return (
      <span
        className={cn(className, "pointer-events-none opacity-40")}
        aria-disabled
      >
        <span className="sr-only">{label}</span>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={className}
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

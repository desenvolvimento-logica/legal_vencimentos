"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SEGMENT_LABELS } from "./nav-items";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment in SEGMENT_LABELS);

  return (
    <nav aria-label="Trilha de navegação" className="min-w-0">
      <ol className="flex items-center gap-2 text-sm">
        <li className="hidden sm:block">
          <Link
            href="/dashboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Controle de Vencimentos
          </Link>
        </li>
        {segments.map((segment, index) => {
          const last = index === segments.length - 1;
          return (
            <li key={segment} className="flex items-center gap-2 truncate">
              <ChevronRight
                className="hidden size-4 text-muted-foreground sm:block"
                aria-hidden
              />
              <span
                className={last ? "font-semibold" : "text-muted-foreground"}
                aria-current={last ? "page" : undefined}
              >
                {SEGMENT_LABELS[segment]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Exibido até a URL ser conhecida (rotas dinâmicas sob cacheComponents). */
export function BreadcrumbFallback() {
  return (
    <p className="hidden text-sm text-muted-foreground sm:block">
      Controle de Vencimentos
    </p>
  );
}

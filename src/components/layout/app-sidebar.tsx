"use client";

import { LayoutDashboard, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Itens entram aqui conforme as fases implementam as rotas.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold">Controle de Vencimentos</span>
      </div>
      <nav aria-label="Navegação principal" className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

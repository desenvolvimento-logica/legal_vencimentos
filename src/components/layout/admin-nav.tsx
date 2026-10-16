"use client";

import { ShieldCheck, UserCog, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AdminItem = { href: string; label: string; icon: LucideIcon };

// Itens entram conforme as telas da Fase 8 existirem (docs/UI-MOCKUPS.md §6).
const ADMIN_ITEMS: AdminItem[] = [
  { href: "/admin/users", label: "Usuários", icon: UserCog },
];

/** Grupo Administração da sidebar; renderizado só para ADMIN (decidido no servidor). */
export function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="mt-6 flex flex-col gap-1 px-3">
      <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold tracking-wide text-sidebar-foreground/70 uppercase">
        <ShieldCheck className="size-4" aria-hidden />
        Administração
      </p>
      <nav aria-label="Administração" className="flex flex-col gap-1">
        {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:outline-none",
                active
                  ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./nav-items";

type SidebarContentProps = {
  /** Chamado ao navegar; usado para fechar o menu no mobile. */
  onNavigate?: () => void;
  /** Grupo Administração, já filtrado no servidor (só ADMIN recebe). */
  adminSlot?: React.ReactNode;
};

// Referência visual: docs/mockups/02-dashboard.png (sidebar navy).
export function SidebarContent({ onNavigate, adminSlot }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col gap-4 px-6 pt-7 pb-8">
        <Image
          src="/brand/logo-white-yellow.png"
          alt="Lógica Assessoria Contábil"
          width={2330}
          height={788}
          className="h-auto w-40 object-contain"
          priority
        />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">
            Controle de Vencimentos
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-brand-gold-500">
            <span className="h-0.5 w-4 rounded-full bg-brand-gold-500" />
            Legalização
          </p>
        </div>
      </div>

      {/* A URL de rotas dinâmicas só é conhecida na requisição; até lá a
          navegação aparece sem item ativo (exigência do cacheComponents). */}
      <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} />}>
        <ActiveNavList onNavigate={onNavigate} />
      </Suspense>
      {adminSlot}
    </div>
  );
}

function ActiveNavList({ onNavigate }: SidebarContentProps) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({
  pathname,
  onNavigate,
}: SidebarContentProps & { pathname: string | null }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          pathname !== null &&
          (pathname === href || pathname.startsWith(`${href}/`));
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
  );
}

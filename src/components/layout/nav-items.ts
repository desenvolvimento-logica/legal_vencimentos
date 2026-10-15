import { LayoutDashboard, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Clientes, Vencimentos e Administração entram quando as rotas existirem,
// para não levar a páginas inexistentes (ordem canônica: docs/UI-MOCKUPS.md §6).
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

/** Rótulos do breadcrumb por segmento de rota. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clientes",
  expirations: "Vencimentos",
  admin: "Administração",
  users: "Usuários",
  hierarchy: "Hierarquia",
  integrations: "Integrações",
  audit: "Auditoria",
};

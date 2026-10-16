import {
  Crown,
  Search,
  TriangleAlert,
  User,
  UserCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ManagerInspector } from "@/components/admin/manager-inspector";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HierarchyLevel } from "@/lib/admin/hierarchy";
import {
  buildTree,
  filterTree,
  withoutManager,
  type TreeNode,
} from "@/lib/admin/tree";
import { HIERARCHY_LABELS } from "@/lib/auth/labels";
import { requireAdmin } from "@/lib/auth/session";
import { initials } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import {
  clientCountsByEmail,
  listAllProfiles,
} from "@/services/admin/profiles";

export const metadata: Metadata = {
  title: "Hierarquia — Controle de Vencimentos",
};

/** Nível sempre com ícone e rótulo; a cor é só reforço. */
const LEVEL_STYLE: Record<
  HierarchyLevel,
  { icon: LucideIcon; className: string }
> = {
  DIRECTOR: { icon: Crown, className: "bg-danger/10 text-danger" },
  MANAGER: { icon: UsersRound, className: "bg-info/10 text-info" },
  COORDINATOR: { icon: Users, className: "bg-success/10 text-success" },
  LEADER: { icon: UserCheck, className: "bg-violet-600/10 text-violet-700" },
  USER: { icon: User, className: "bg-muted text-foreground" },
  ADMIN: { icon: Crown, className: "bg-muted text-foreground" },
};

// Referência visual: docs/mockups/10-admin-hierarchy.png (SRS RF-12).
// Árvore indentada em vez de organograma horizontal: funciona em qualquer
// largura e mostra a relação pela estrutura, não pela cor.
export default function HierarchyPage({
  searchParams,
}: PageProps<"/admin/hierarchy">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hierarquia"
        description="Visualize e organize a estrutura de responsabilidade"
      />
      <Suspense
        fallback={
          <div
            className="h-96 animate-pulse rounded-xl bg-muted"
            aria-busy="true"
          />
        }
      >
        <HierarchyContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function HierarchyContent({
  searchParams,
}: Pick<PageProps<"/admin/hierarchy">, "searchParams">) {
  await requireAdmin();
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const selectedId =
    typeof query.perfil === "string" ? query.perfil : undefined;

  const [profiles, counts] = await Promise.all([
    listAllProfiles(),
    clientCountsByEmail(),
  ]);
  const treeProfiles = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    level: profile.level,
    managerId: profile.managerId,
    active: profile.active,
  }));
  const tree = filterTree(buildTree(treeProfiles), q);
  const orphans = withoutManager(treeProfiles);
  const selected = treeProfiles.find((profile) => profile.id === selectedId);
  const hrefFor = (perfil?: string) =>
    hrefWith("/admin/hierarchy", { q }, { perfil });

  return (
    <div
      className={cn(
        "grid gap-6",
        selected && "xl:grid-cols-[1fr_400px] xl:items-start",
      )}
    >
      <Card className="gap-5 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">Estrutura organizacional</h2>
          {orphans.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
              <TriangleAlert
                className="mt-0.5 size-5 shrink-0 text-warning"
                aria-hidden
              />
              <div>
                <p className="font-semibold">
                  {orphans.length}{" "}
                  {orphans.length === 1
                    ? "usuário sem gestor"
                    : "usuários sem gestor"}
                </p>
                <p className="text-muted-foreground">
                  {orphans
                    .slice(0, 3)
                    .map((profile) => profile.name)
                    .join(", ")}
                  {orphans.length > 3 && ` e mais ${orphans.length - 3}`}
                </p>
              </div>
            </div>
          )}
        </div>

        <form
          method="get"
          action="/admin/hierarchy"
          className="relative max-w-md"
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar colaborador…"
            aria-label="Buscar colaborador por nome ou e-mail"
            className="pl-9"
          />
        </form>

        <ul className="flex flex-wrap gap-2" aria-label="Legenda de níveis">
          {(
            ["DIRECTOR", "MANAGER", "COORDINATOR", "LEADER", "USER"] as const
          ).map((level) => {
            const { icon: Icon, className } = LEVEL_STYLE[level];
            return (
              <li
                key={level}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                  className,
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {HIERARCHY_LABELS[level]}
              </li>
            );
          })}
        </ul>

        {tree.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {q
              ? "Ninguém encontrado com essa busca."
              : "Nenhum perfil na estrutura."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Árvore hierárquica">
            {tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                counts={counts}
                selectedId={selected?.id}
                hrefFor={hrefFor}
              />
            ))}
          </ul>
        )}
      </Card>

      {selected && (
        <ManagerInspector
          key={selected.id}
          person={{ ...selected, clients: counts.get(selected.email) ?? 0 }}
          profiles={treeProfiles}
          closeHref={hrefFor()}
        />
      )}
    </div>
  );
}

function TreeItem({
  node,
  counts,
  selectedId,
  hrefFor,
}: {
  node: TreeNode;
  counts: Map<string, number>;
  selectedId?: string;
  hrefFor: (perfil?: string) => string;
}) {
  const { icon: Icon, className } = LEVEL_STYLE[node.level];
  const clients = counts.get(node.email) ?? 0;
  const selected = node.id === selectedId;

  return (
    <li>
      <Link
        href={hrefFor(node.id)}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          selected && "border-brand-gold-500 bg-brand-gold-500/5",
          !node.active && "opacity-60",
        )}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
          aria-hidden
        >
          {initials(node.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {node.name}
            {!node.active && (
              <span className="ml-2 text-xs text-muted-foreground">
                (inativo)
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {node.email}
          </span>
        </span>
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
          {clients} {clients === 1 ? "cliente" : "clientes"}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
            className,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {HIERARCHY_LABELS[node.level]}
        </span>
      </Link>
      {node.children.length > 0 && (
        <ul className="mt-2 ml-5 flex flex-col gap-2 border-l-2 pl-4">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              counts={counts}
              selectedId={selectedId}
              hrefFor={hrefFor}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

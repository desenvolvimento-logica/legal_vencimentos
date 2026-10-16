import { Network, Search, UserCheck, UserX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  AddProfileButton,
  EditProfileButton,
} from "@/components/admin/profile-actions";
import { MetricCardBody } from "@/components/dashboard/metric-card";
import { Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LEVELS } from "@/lib/admin/hierarchy";
import { HIERARCHY_LABELS } from "@/lib/auth/labels";
import { requireAdmin } from "@/lib/auth/session";
import { initials } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import {
  filterProfiles,
  listAllProfiles,
  PAGE_SIZES,
  profileListParamsSchema,
  profileMetrics,
} from "@/services/admin/profiles";

export const metadata: Metadata = {
  title: "Usuários — Controle de Vencimentos",
};

const LEVEL_BADGES: Record<(typeof LEVELS)[number], string> = {
  USER: "bg-muted text-foreground",
  LEADER: "bg-success/10 text-success",
  COORDINATOR: "bg-info/10 text-info",
  MANAGER: "bg-violet-600/10 text-violet-700",
  DIRECTOR: "bg-warning/10 text-warning",
  ADMIN: "bg-danger/10 text-danger",
};

const updatedFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none";

// Referência visual: docs/mockups/09-admin-users.png (SRS RF-02/RF-12).
export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function UsersContent({
  searchParams,
}: Pick<PageProps<"/admin/users">, "searchParams">) {
  const admin = await requireAdmin();
  const params = profileListParamsSchema.parse(await searchParams);
  const profiles = await listAllProfiles();
  const metrics = profileMetrics(profiles);
  const { items, total } = filterProfiles(profiles, params);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const options = profiles.map(({ id, name, level, active }) => ({
    id,
    name,
    level,
    active,
  }));
  const hasFilters = Boolean(params.q || params.nivel || params.status);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerencie acesso, cargos e vínculos hierárquicos"
        aside={<AddProfileButton profiles={options} />}
      />

      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <MetricCardBody
          label="Usuários ativos"
          value={metrics.active}
          icon={UserCheck}
          tone="success"
        />
        <MetricCardBody
          label="Inativos"
          value={metrics.inactive}
          icon={UserX}
          tone="danger"
        />
        <MetricCardBody
          label="Gestores"
          value={metrics.managers}
          icon={Users}
          tone="info"
        />
        <MetricCardBody
          label="Sem gestor"
          value={metrics.withoutManager}
          icon={Network}
          tone="warning"
        />
      </section>

      <Card className="px-5 py-5">
        <form
          method="get"
          action="/admin/users"
          className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <input type="hidden" name="porPagina" value={params.porPagina} />
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Nome ou e-mail"
              aria-label="Buscar por nome ou e-mail"
              className="pl-9"
              maxLength={100}
            />
          </div>
          <select
            name="nivel"
            defaultValue={params.nivel ?? ""}
            aria-label="Nível"
            className={selectClassName}
          >
            <option value="">Nível: Todos</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {HIERARCHY_LABELS[level]}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            aria-label="Status"
            className={selectClassName}
          >
            <option value="">Status: Todos</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit">
              <Search aria-hidden />
              Buscar
            </Button>
            {hasFilters && (
              <Link
                href="/admin/users"
                className={buttonVariants({ variant: "ghost" })}
              >
                Limpar filtros
              </Link>
            )}
          </div>
        </form>
      </Card>

      <Card className="gap-5 px-5 py-5">
        <h2 className="text-lg font-semibold tabular-nums">
          {total} {total === 1 ? "usuário" : "usuários"}
        </h2>
        {items.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {hasFilters
              ? "Nenhum usuário com esses filtros."
              : "Nenhum usuário cadastrado."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    {[
                      "Usuário",
                      "Cargo",
                      "Nível",
                      "Gestor",
                      "Status",
                      "Última atualização",
                      "Ações",
                    ].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="px-4 py-3 font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((profile) => (
                    <tr key={profile.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                            aria-hidden
                          >
                            {initials(profile.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {profile.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {profile.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{profile.jobTitle ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            LEVEL_BADGES[profile.level],
                          )}
                        >
                          {HIERARCHY_LABELS[profile.level]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(profile.managerId && names.get(profile.managerId)) ??
                          "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold",
                            profile.active
                              ? "bg-success/10 text-success"
                              : "bg-danger/10 text-danger",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              profile.active ? "bg-success" : "bg-danger",
                            )}
                            aria-hidden
                          />
                          {profile.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {updatedFormatter.format(new Date(profile.updatedAt))}
                      </td>
                      <td className="px-4 py-3">
                        <EditProfileButton
                          profiles={options}
                          profile={profile}
                          isSelf={profile.id === admin.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={params.pagina}
              pageSize={params.porPagina}
              total={total}
              pageSizes={PAGE_SIZES}
              hrefFor={(page, pageSize) =>
                hrefWith(
                  "/admin/users",
                  { ...params },
                  { pagina: page, porPagina: pageSize ?? params.porPagina },
                )
              }
            />
          </>
        )}
      </Card>
    </>
  );
}

function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando usuários…</span>
      <div className="h-12 w-72 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted/70" />
    </div>
  );
}

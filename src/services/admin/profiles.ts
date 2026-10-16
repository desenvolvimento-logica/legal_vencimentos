import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEVELS, type HierarchyLevel } from "@/lib/admin/hierarchy";

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  level: HierarchyLevel;
  managerId: string | null;
  active: boolean;
  updatedAt: string;
};

export const PAGE_SIZES = [10, 20, 50] as const;

export const profileListParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  nivel: z
    .enum(LEVELS as [HierarchyLevel, ...HierarchyLevel[]])
    .optional()
    .catch(undefined),
  status: z.enum(["ativos", "inativos"]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).catch(1),
  porPagina: z.coerce
    .number()
    .refine((value) => (PAGE_SIZES as readonly number[]).includes(value))
    .catch(20),
});

export type ProfileListParams = z.infer<typeof profileListParamsSchema>;

/** Todos os perfis (visíveis ao ADMIN pelo RLS de legal_profiles). */
export async function listAllProfiles(): Promise<AdminProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("legal_profiles")
    .select(
      "id, name, email, job_title, hierarchy_level, manager_id, active, updated_at",
    )
    .order("name");
  if (error) throw new Error("Não foi possível carregar os usuários.");
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title,
    level: row.hierarchy_level,
    managerId: row.manager_id,
    active: row.active,
    updatedAt: row.updated_at,
  }));
}

export type ProfileMetrics = {
  active: number;
  inactive: number;
  managers: number;
  withoutManager: number;
};

/** Indicadores do mockup 09. "Sem gestor" ignora DIRECTOR e ADMIN (topo da árvore). */
export function profileMetrics(profiles: AdminProfile[]): ProfileMetrics {
  const active = profiles.filter((profile) => profile.active);
  return {
    active: active.length,
    inactive: profiles.length - active.length,
    managers: active.filter((profile) =>
      ["LEADER", "COORDINATOR", "MANAGER", "DIRECTOR"].includes(profile.level),
    ).length,
    withoutManager: active.filter(
      (profile) =>
        !profile.managerId && !["DIRECTOR", "ADMIN"].includes(profile.level),
    ).length,
  };
}

/** Filtra e pagina no servidor (a tabela de perfis é pequena). */
export function filterProfiles(
  profiles: AdminProfile[],
  params: ProfileListParams,
): { items: AdminProfile[]; total: number } {
  const term = params.q?.toLocaleLowerCase("pt-BR");
  const filtered = profiles.filter(
    (profile) =>
      (!term ||
        profile.name.toLocaleLowerCase("pt-BR").includes(term) ||
        profile.email.includes(term)) &&
      (!params.nivel || profile.level === params.nivel) &&
      (!params.status || profile.active === (params.status === "ativos")),
  );
  const from = (params.pagina - 1) * params.porPagina;
  return {
    total: filtered.length,
    items: filtered.slice(from, from + params.porPagina),
  };
}

/**
 * Quantos clientes ativos cada e-mail tem na carteira (departamentos 5/13),
 * contados uma vez por cliente. Usado na árvore de hierarquia.
 */
export async function clientCountsByEmail(): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();
  const clientsByEmail = new Map<string, Set<string>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("legal_client_responsibles")
      .select("client_id, responsible_email")
      .not("responsible_email", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Não foi possível contar as carteiras.");
    for (const row of data) {
      const set = clientsByEmail.get(row.responsible_email!) ?? new Set();
      set.add(row.client_id);
      clientsByEmail.set(row.responsible_email!, set);
    }
    if (data.length < PAGE) break;
  }
  return new Map([...clientsByEmail].map(([email, set]) => [email, set.size]));
}

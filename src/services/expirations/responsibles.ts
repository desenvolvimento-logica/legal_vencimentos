import "server-only";

import { getSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientDetail } from "@/services/clients/get-client";

export type ResponsibleOption = { id: string; name: string };

export type ResponsibleChoices = {
  options: ResponsibleOption[];
  /** Padrão: responsável da Legalização do cliente; depois Cert. Digital; depois o próprio usuário. */
  defaultId: string | null;
};

/**
 * Perfis que podem ser responsáveis por um vencimento do cliente. A regra
 * definitiva é do banco (legal_can_assign_responsible); aqui só se monta a
 * lista exibida.
 */
export async function getResponsibleChoices(
  client: ClientDetail,
): Promise<ResponsibleChoices> {
  const supabase = await createSupabaseServerClient();
  const session = await getSessionState();

  const { data, error } = await supabase.rpc("legal_visible_profiles");
  if (error) throw new Error("Não foi possível carregar os responsáveis.");

  const clientEmails = new Map(
    client.responsibles
      .filter((r) => r.email)
      .map((r) => [r.email!, r.departmentId]),
  );
  const options = data
    .filter((profile) => profile.active && profile.hierarchy_level !== "ADMIN")
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      email: profile.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const byDepartment = (departmentId: string) =>
    options.find((option) => clientEmails.get(option.email) === departmentId);
  const current =
    session.status === "active"
      ? options.find((option) => option.id === session.profile.id)
      : undefined;

  const fallback = byDepartment("5") ?? byDepartment("13") ?? current;

  return {
    options: options.map(({ id, name }) => ({ id, name })),
    defaultId: fallback?.id ?? null,
  };
}

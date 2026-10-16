import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type CurrentProfile = {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  hierarchyLevel: Enums<"legal_hierarchy_level">;
  isAdmin: boolean;
};

type SessionState =
  | { status: "anonymous" }
  | { status: "no-active-profile" }
  | { status: "active"; profile: CurrentProfile };

/**
 * Data Access Layer da sessão. A identidade vem do JWT validado (getClaims) e a
 * autorização de `legal_current_profile()`, que só retorna perfil ativo.
 * Memoizado por requisição.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createSupabaseServerClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { status: "anonymous" };
  }

  const { data, error } = await supabase
    .rpc("legal_current_profile")
    .maybeSingle();
  if (error) {
    throw new Error("Não foi possível carregar o perfil do usuário.");
  }
  if (!data) {
    return { status: "no-active-profile" };
  }

  return {
    status: "active",
    profile: {
      id: data.id,
      name: data.name,
      email: data.email,
      jobTitle: data.job_title,
      hierarchyLevel: data.hierarchy_level,
      isAdmin: data.is_admin || data.hierarchy_level === "ADMIN",
    },
  };
});

/** Exige sessão com perfil ativo; caso contrário, redireciona. */
export async function requireProfile(): Promise<CurrentProfile> {
  const state = await getSessionState();
  if (state.status === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (state.status === "no-active-profile") {
    // Server Components não apagam cookies; o route handler encerra a sessão.
    redirect("/auth/signout?erro=sem-acesso");
  }
  return state.profile;
}

/**
 * Exige perfil ADMIN. Para os demais a rota "não existe" (404), sem revelar
 * a área administrativa. A autorização real das operações está no banco
 * (funções legal_admin_*).
 */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!profile.isAdmin) notFound();
  return profile;
}

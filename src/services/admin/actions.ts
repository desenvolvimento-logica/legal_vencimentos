"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { userMessageFromDbError } from "@/lib/db-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createProfileSchema,
  updateProfileSchema,
} from "@/lib/validators/profile";

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ProfileCandidate = {
  userId: string;
  email: string;
  name: string;
  lastSignInAt: string | null;
};

async function adminClient() {
  const session = await getSessionState();
  if (session.status !== "active" || !session.profile.isAdmin) return null;
  return createSupabaseServerClient();
}

const DENIED: AdminActionResult = {
  ok: false,
  error: "Você não tem permissão para esta operação.",
};

function invalid(error: z.ZodError): AdminActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues)
    fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false, error: "Revise os campos destacados.", fieldErrors };
}

/** Contas Microsoft sem perfil, para adicionar ao sistema. */
export async function searchProfileCandidates(
  input: unknown,
): Promise<ProfileCandidate[]> {
  const search = z.string().trim().max(100).safeParse(input);
  const supabase = await adminClient();
  if (!supabase || !search.success) return [];
  const { data, error } = await supabase.rpc(
    "legal_admin_list_profile_candidates",
    {
      search: search.data,
    },
  );
  if (error) return [];
  return data.map((row) => ({
    userId: row.user_id,
    email: row.email,
    name: row.name,
    lastSignInAt: row.last_sign_in_at,
  }));
}

export async function createProfile(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = createProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return DENIED;

  const value = parsed.data;
  const { error } = await supabase.rpc("legal_admin_create_profile", {
    target_user_id: value.userId,
    profile_name: value.name,
    profile_job_title: value.jobTitle,
    profile_level: value.level,
    // Os tipos gerados não marcam argumentos de RPC como anuláveis; null = sem gestor.
    profile_manager_id: value.managerId || (null as unknown as string),
  });
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  refresh();
  return { ok: true };
}

export async function updateProfile(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return DENIED;

  const value = parsed.data;
  const { error } = await supabase.rpc("legal_admin_update_profile", {
    target_profile_id: value.profileId,
    profile_name: value.name,
    profile_job_title: value.jobTitle,
    profile_level: value.level,
    // Os tipos gerados não marcam argumentos de RPC como anuláveis; null = sem gestor.
    profile_manager_id: value.managerId || (null as unknown as string),
    profile_active: value.active,
  });
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  refresh();
  return { ok: true };
}

/** Troca só o gestor (tela Hierarquia), mantendo os demais campos do perfil. */
export async function changeManager(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = z
    .object({
      profileId: z.uuid(),
      managerId: z.union([z.literal(""), z.uuid()]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await adminClient();
  if (!supabase) return DENIED;

  const { data: current, error: readError } = await supabase
    .from("legal_profiles")
    .select("name, job_title, hierarchy_level, active")
    .eq("id", parsed.data.profileId)
    .maybeSingle();
  if (readError || !current)
    return { ok: false, error: "Perfil não encontrado." };

  const { error } = await supabase.rpc("legal_admin_update_profile", {
    target_profile_id: parsed.data.profileId,
    profile_name: current.name,
    profile_job_title: current.job_title ?? "",
    profile_level: current.hierarchy_level,
    // Os tipos gerados não marcam argumentos de RPC como anuláveis; null = sem gestor.
    profile_manager_id: parsed.data.managerId || (null as unknown as string),
    profile_active: current.active,
  });
  if (error) return { ok: false, error: userMessageFromDbError(error) };
  refresh();
  return { ok: true };
}

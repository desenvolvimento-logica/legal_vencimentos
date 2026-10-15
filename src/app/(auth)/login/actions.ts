"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators/auth";

export type LoginState = {
  email?: string;
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      email: rawEmail,
      fieldErrors: { email: errors.email?.[0], password: errors.password?.[0] },
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensagem única para não revelar se o e-mail existe.
    return {
      email,
      error:
        error.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          : "E-mail ou senha inválidos.",
    };
  }

  // Autenticado no Auth não significa autorizado: exige perfil ativo.
  const { data: profile, error: profileError } = await supabase
    .rpc("legal_current_profile")
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return {
      email,
      error: profileError
        ? "Não foi possível verificar seu acesso. Tente novamente."
        : "Seu usuário não tem acesso ativo a este sistema.",
    };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

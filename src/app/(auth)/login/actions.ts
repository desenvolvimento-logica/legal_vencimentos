"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_CALLBACK_PATH,
  NEXT_PATH_COOKIE,
  safeNextPath,
} from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Inicia o login com a conta Microsoft (Azure/Entra ID, tenant do escritório).
 * O Supabase valida `redirectTo` contra a lista de Redirect URLs permitidas.
 */
export async function signInWithMicrosoft(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host")}`;

  // Sem query string: precisa bater exatamente com a Redirect URL cadastrada.
  const callbackUrl = new URL(AUTH_CALLBACK_PATH, origin);

  (await cookies()).set(
    NEXT_PATH_COOKIE,
    safeNextPath(String(formData.get("next") ?? "")),
    {
      httpOnly: true,
      secure: callbackUrl.protocol === "https:",
      sameSite: "lax",
      path: AUTH_CALLBACK_PATH,
      maxAge: 600,
    },
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: "email",
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    redirect("/login?erro=falha-microsoft");
  }
  redirect(data.url);
}

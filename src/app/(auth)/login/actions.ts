"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/paths";
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

  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set(
    "next",
    safeNextPath(String(formData.get("next") ?? "")),
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

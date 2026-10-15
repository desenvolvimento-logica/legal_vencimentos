import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_CALLBACK_PATH,
  LOGIN_PATH,
  NEXT_PATH_COOKIE,
  safeNextPath,
  type LoginErrorCode,
} from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Retorno do login Microsoft: troca o código (PKCE) pela sessão e só deixa
// entrar quem tem perfil ativo neste sistema.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  // O cookie vale para uma única tentativa e é descartado em qualquer saída.
  const next = safeNextPath(request.cookies.get(NEXT_PATH_COOKIE)?.value);
  const redirectTo = (url: URL) => {
    const response = NextResponse.redirect(url);
    response.cookies.delete({
      name: NEXT_PATH_COOKIE,
      path: AUTH_CALLBACK_PATH,
    });
    return response;
  };

  const toLogin = (erro: LoginErrorCode) => {
    const url = new URL(LOGIN_PATH, origin);
    url.searchParams.set("erro", erro);
    return redirectTo(url);
  };

  if (!code || searchParams.has("error")) {
    return toLogin("falha-microsoft");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );
  if (error) {
    return toLogin("falha-microsoft");
  }

  const { data: profile, error: profileError } = await supabase
    .rpc("legal_current_profile")
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return toLogin(profileError ? "falha-verificacao" : "sem-acesso");
  }

  return redirectTo(new URL(next, origin));
}

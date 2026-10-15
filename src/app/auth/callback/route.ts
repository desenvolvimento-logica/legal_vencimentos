import { NextResponse, type NextRequest } from "next/server";

import {
  LOGIN_PATH,
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
  const next = safeNextPath(searchParams.get("next"));

  const toLogin = (erro: LoginErrorCode) => {
    const url = new URL(LOGIN_PATH, origin);
    url.searchParams.set("erro", erro);
    return NextResponse.redirect(url);
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

  return NextResponse.redirect(new URL(next, origin));
}

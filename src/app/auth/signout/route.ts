import { NextResponse, type NextRequest } from "next/server";

import { isLoginErrorCode, LOGIN_PATH } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Encerra a sessão de quem está autenticado mas sem perfil ativo (ver requireProfile).
// Aceita GET porque é alvo de redirect; só remove a própria sessão.
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const loginUrl = new URL(LOGIN_PATH, request.url);
  const erro = request.nextUrl.searchParams.get("erro");
  if (isLoginErrorCode(erro)) {
    loginUrl.searchParams.set("erro", erro);
  }
  return NextResponse.redirect(loginUrl);
}

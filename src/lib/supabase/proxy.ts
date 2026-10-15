import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Renova a sessão Supabase a cada requisição e devolve a resposta com os
 * cookies atualizados. A verificação aqui é otimista (assinatura do JWT);
 * a autorização efetiva acontece no DAL e no RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Não inserir código entre a criação do cliente e getClaims: a renovação
  // do token acontece aqui.
  const { data } = await supabase.auth.getClaims();

  return { response, isAuthenticated: Boolean(data?.claims) };
}

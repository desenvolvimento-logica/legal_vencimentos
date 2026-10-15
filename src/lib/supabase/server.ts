import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getPublicEnv } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase da requisição atual, autenticado pelos cookies de sessão e
 * sujeito ao RLS. Criar um por requisição; nunca compartilhar entre usuários.
 */
export async function createSupabaseServerClient() {
  // A sessão é sempre dado da requisição. Sem isso, o Next acusa o Date.now()
  // usado pelo getClaims() ao validar a expiração do token durante o prerender.
  await connection();
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components não podem gravar cookies; o proxy renova a sessão.
          }
        },
      },
    },
  );
}

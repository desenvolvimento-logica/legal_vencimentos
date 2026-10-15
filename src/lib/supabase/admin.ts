import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/config/env";
import { getServerEnv } from "@/config/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente com a chave secret (papel service_role): ignora o RLS. Uso restrito
 * à sincronização e ao provisionamento no servidor (DEVELOPMENT.md §3); o
 * `server-only` impede que chegue a um bundle do browser.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

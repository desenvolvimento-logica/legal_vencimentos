import "server-only";

import { getServerEnv } from "@/config/env.server";
import { AcessoriasApiClient } from "@/lib/acessorias/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  syncCompanies,
  syncRequests,
  syncUsers,
  type SyncDeps,
} from "./run-sync";
import { SupabaseSyncStore } from "./supabase-store";
import {
  SyncAlreadyRunningError,
  type SyncMode,
  type SyncProgress,
  type SyncResult,
  type SyncType,
} from "./types";

export type SyncOutcome =
  SyncResult | { type: SyncType; status: "SKIPPED"; errorMessage: string };

/** Ordem importa: solicitações e carteira dependem dos clientes. */
export const SYNC_ORDER: SyncType[] = ["companies", "users", "requests"];

/**
 * Executa as sincronizações pedidas em sequência, com um único cliente HTTP
 * (o limite de requisições por minuto vale para o conjunto).
 */
export async function runAcessoriasSync(
  types: SyncType[],
  mode: SyncMode,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncOutcome[]> {
  const env = getServerEnv();
  const deps: SyncDeps = {
    api: new AcessoriasApiClient({
      baseUrl: env.ACESSORIAS_API_URL,
      token: env.ACESSORIAS_API_TOKEN,
    }),
    store: new SupabaseSyncStore(createSupabaseAdminClient()),
    onProgress,
  };

  const outcomes: SyncOutcome[] = [];
  for (const type of SYNC_ORDER.filter((item) => types.includes(item))) {
    try {
      outcomes.push(
        type === "companies"
          ? await syncCompanies(deps, mode)
          : type === "users"
            ? await syncUsers(deps)
            : await syncRequests(deps, mode),
      );
    } catch (error) {
      if (!(error instanceof SyncAlreadyRunningError)) throw error;
      outcomes.push({ type, status: "SKIPPED", errorMessage: error.message });
    }
  }
  return outcomes;
}

export type { SyncMode, SyncProgress, SyncType };

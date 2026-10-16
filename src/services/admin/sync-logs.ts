import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums, Json } from "@/types/database";

export type SyncLog = {
  id: string;
  type: string;
  status: Enums<"legal_sync_status">;
  startedAt: string;
  finishedAt: string | null;
  received: number;
  created: number;
  updated: number;
  failed: number;
  errorMessage: string | null;
  metadata: Json | null;
};

export const SYNC_LOG_PAGE_SIZE = 20;

const SELECT =
  "id, sync_type, status, started_at, finished_at, records_received, records_created, records_updated, records_failed, error_message, metadata";

type Row = {
  id: string;
  sync_type: string;
  status: Enums<"legal_sync_status">;
  started_at: string;
  finished_at: string | null;
  records_received: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  metadata: Json | null;
};

const toLog = (row: Row): SyncLog => ({
  id: row.id,
  type: row.sync_type,
  status: row.status,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  received: row.records_received,
  created: row.records_created,
  updated: row.records_updated,
  failed: row.records_failed,
  errorMessage: row.error_message,
  metadata: row.metadata,
});

/** Histórico de execuções (legal_sync_logs: leitura só para ADMIN pelo RLS). */
export async function listSyncLogs(page: number) {
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * SYNC_LOG_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("legal_sync_logs")
    .select(SELECT, { count: "exact" })
    .eq("integration", "acessorias")
    .order("started_at", { ascending: false })
    .range(from, from + SYNC_LOG_PAGE_SIZE - 1);
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return { items: data.map(toLog), total: count ?? 0 };
}

/** Última execução de cada tipo. */
export async function latestSyncByType(types: string[]) {
  const supabase = await createSupabaseServerClient();
  const entries = await Promise.all(
    types.map(async (type) => {
      const { data, error } = await supabase
        .from("legal_sync_logs")
        .select(SELECT)
        .eq("integration", "acessorias")
        .eq("sync_type", type)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error)
        throw new Error("Não foi possível carregar as sincronizações.");
      return [type, data ? toLog(data) : null] as const;
    }),
  );
  return new Map(entries);
}

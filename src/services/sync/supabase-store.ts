import type { SupabaseClient } from "@supabase/supabase-js";

import type { MappedCompany } from "@/lib/acessorias/mappers";
import type { Database, Json, TablesInsert } from "@/types/database";

import {
  SyncAlreadyRunningError,
  type SyncStore,
  type SyncType,
  type UpsertOutcome,
} from "./types";

const INTEGRATION = "acessorias";
/** Execução RUNNING mais antiga que isso é considerada interrompida. */
const STALE_RUN_MS = 2 * 60 * 60 * 1000;

type Db = SupabaseClient<Database>;

/**
 * Persistência da sincronização com o cliente service role (ignora RLS).
 * Usar somente no servidor, a partir da rota de sincronização.
 */
export class SupabaseSyncStore implements SyncStore {
  constructor(private readonly db: Db) {}

  async getSetting(key: string): Promise<unknown> {
    const { data, error } = await this.db
      .from("legal_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw dbError("ler configuração", error);
    return data?.value ?? null;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const { error } = await this.db
      .from("legal_settings")
      .upsert({ key, value: value as Json }, { onConflict: "key" });
    if (error) throw dbError("gravar configuração", error);
  }

  async startRun(type: SyncType, startedAt: string): Promise<string> {
    const staleBefore = new Date(
      Date.parse(startedAt) - STALE_RUN_MS,
    ).toISOString();
    const { error: staleError } = await this.db
      .from("legal_sync_logs")
      .update({
        status: "FAILED",
        finished_at: startedAt,
        error_message: "Execução interrompida sem conclusão registrada.",
      })
      .eq("integration", INTEGRATION)
      .eq("sync_type", type)
      .eq("status", "RUNNING")
      .lt("started_at", staleBefore);
    if (staleError)
      throw dbError("encerrar execuções interrompidas", staleError);

    const { data, error } = await this.db
      .from("legal_sync_logs")
      .insert({
        integration: INTEGRATION,
        sync_type: type,
        started_at: startedAt,
        status: "RUNNING",
      })
      .select("id")
      .single();
    // 23505: o índice legal_sync_logs_one_running_idx impede execução paralela.
    if (error?.code === "23505") throw new SyncAlreadyRunningError(type);
    if (error) throw dbError("abrir log de sincronização", error);
    return data.id;
  }

  async finishRun(
    runId: string,
    result: Parameters<SyncStore["finishRun"]>[1],
  ): Promise<void> {
    const { error } = await this.db
      .from("legal_sync_logs")
      .update({
        status: result.status,
        finished_at: result.finishedAt,
        records_received: result.counters.received,
        records_created: result.counters.created,
        records_updated: result.counters.updated,
        records_failed: result.counters.failed,
        error_message: result.errorMessage,
        metadata: result.metadata as Json,
      })
      .eq("id", runId);
    if (error) throw dbError("fechar log de sincronização", error);
  }

  async upsertCompanies(page: MappedCompany[]): Promise<UpsertOutcome> {
    const companies = dedupeBy(
      page,
      ({ client }) => client.acessorias_company_id,
    );
    const ids = companies.map(({ client }) => client.acessorias_company_id);
    const existing = await this.existingKeys(
      "legal_clients",
      "acessorias_company_id",
      ids,
    );

    const { data: clients, error } = await this.db
      .from("legal_clients")
      .upsert(
        companies.map(({ client }) => client),
        { onConflict: "acessorias_company_id" },
      )
      .select("id, acessorias_company_id");
    if (error) throw dbError("gravar clientes", error);

    const clientIdByCompany = new Map(
      clients.map((row) => [row.acessorias_company_id, row.id]),
    );
    const responsibles: TablesInsert<"legal_client_responsibles">[] =
      companies.flatMap(({ client, responsibles }) =>
        responsibles.map((responsible) => ({
          ...responsible,
          client_id: clientIdByCompany.get(client.acessorias_company_id)!,
        })),
      );

    // Remove responsáveis de departamentos que deixaram de existir na origem.
    const clientIds = [...clientIdByCompany.values()];
    const { data: current, error: currentError } = await this.db
      .from("legal_client_responsibles")
      .select("id, client_id, department_id")
      .in("client_id", clientIds);
    if (currentError) throw dbError("ler responsáveis", currentError);

    const keep = new Set(
      responsibles.map((r) => `${r.client_id}:${r.department_id}`),
    );
    const stale = current
      .filter((row) => !keep.has(`${row.client_id}:${row.department_id}`))
      .map((row) => row.id);
    if (stale.length > 0) {
      const { error: deleteError } = await this.db
        .from("legal_client_responsibles")
        .delete()
        .in("id", stale);
      if (deleteError) throw dbError("remover responsáveis", deleteError);
    }

    if (responsibles.length > 0) {
      const { error: upsertError } = await this.db
        .from("legal_client_responsibles")
        .upsert(responsibles, { onConflict: "client_id,department_id" });
      if (upsertError) throw dbError("gravar responsáveis", upsertError);
    }

    return outcome(ids, existing);
  }

  async upsertUsers(
    page: TablesInsert<"legal_acessorias_users">[],
  ): Promise<UpsertOutcome> {
    const users = dedupeBy(page, (user) => user.acessorias_user_id);
    const ids = users.map((user) => user.acessorias_user_id);
    const existing = await this.existingKeys(
      "legal_acessorias_users",
      "acessorias_user_id",
      ids,
    );
    const { error } = await this.db
      .from("legal_acessorias_users")
      .upsert(users, { onConflict: "acessorias_user_id" });
    if (error) throw dbError("gravar usuários", error);
    return outcome(ids, existing);
  }

  async upsertRequests(
    page: TablesInsert<"legal_acessorias_requests">[],
  ): Promise<UpsertOutcome> {
    const requests = dedupeBy(page, (request) => request.acessorias_request_id);
    const ids = requests.map((request) => request.acessorias_request_id);
    const existing = await this.existingKeys(
      "legal_acessorias_requests",
      "acessorias_request_id",
      ids,
    );
    const { error } = await this.db
      .from("legal_acessorias_requests")
      .upsert(requests, { onConflict: "acessorias_request_id" });
    if (error) throw dbError("gravar solicitações", error);
    return outcome(ids, existing);
  }

  private async existingKeys(
    table:
      "legal_clients" | "legal_acessorias_users" | "legal_acessorias_requests",
    column:
      "acessorias_company_id" | "acessorias_user_id" | "acessorias_request_id",
    keys: string[],
  ): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const { data, error } = await this.db
      .from(table)
      .select(column)
      .in(column, keys)
      .returns<Record<string, string>[]>();
    if (error) throw dbError(`ler ${table}`, error);
    return new Set(data.map((row) => row[column]));
  }
}

/**
 * Um upsert não pode tocar a mesma linha duas vezes; se a API repetir um
 * registro na página, vale a última ocorrência.
 */
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function outcome(keys: string[], existing: Set<string>): UpsertOutcome {
  const unique = new Set(keys);
  const updated = [...unique].filter((key) => existing.has(key)).length;
  return { created: unique.size - updated, updated };
}

/** Erro sem detalhes da linha (que podem conter dados do cliente). */
function dbError(
  action: string,
  error: { code?: string; message: string },
): Error {
  return new Error(`Falha ao ${action} (${error.code ?? "sem código"}).`);
}

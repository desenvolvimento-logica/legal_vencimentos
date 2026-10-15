import type { MappedCompany } from "@/lib/acessorias/mappers";
import type { TablesInsert } from "@/types/database";

export type SyncType = "companies" | "users" | "requests";
export type SyncMode = "full" | "incremental";
export type SyncStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export type SyncCounters = {
  received: number;
  created: number;
  updated: number;
  failed: number;
};

export type SyncResult = {
  type: SyncType;
  mode: SyncMode;
  status: SyncStatus;
  counters: SyncCounters;
  pages: number;
  cursor: string | null;
  errorMessage: string | null;
};

export type SyncProgress = {
  type: SyncType;
  page: number;
  counters: SyncCounters;
};

export type UpsertOutcome = { created: number; updated: number };

export class SyncAlreadyRunningError extends Error {
  constructor(type: SyncType) {
    super(`Já existe uma sincronização de ${type} em execução.`);
    this.name = "SyncAlreadyRunningError";
  }
}

/** Persistência usada pela sincronização (implementação real: Supabase). */
export interface SyncStore {
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<void>;
  /** Abre o log RUNNING; lança SyncAlreadyRunningError se houver outro. */
  startRun(type: SyncType, startedAt: string): Promise<string>;
  finishRun(
    runId: string,
    result: {
      status: SyncStatus;
      finishedAt: string;
      counters: SyncCounters;
      errorMessage: string | null;
      metadata: Record<string, unknown>;
    },
  ): Promise<void>;
  upsertCompanies(companies: MappedCompany[]): Promise<UpsertOutcome>;
  upsertUsers(
    users: TablesInsert<"legal_acessorias_users">[],
  ): Promise<UpsertOutcome>;
  upsertRequests(
    requests: TablesInsert<"legal_acessorias_requests">[],
  ): Promise<UpsertOutcome>;
}

export const SETTINGS = {
  departmentId: "acessorias_legalization_department_id",
  subdepartmentIds: "acessorias_legalization_subdepartment_ids",
  requestWindowDays: "acessorias_request_initial_window_days",
  cursor: {
    companies: "last_successful_company_sync",
    users: "last_successful_user_sync",
    requests: "last_successful_request_sync",
  },
} as const;

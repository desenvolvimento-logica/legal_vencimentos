import type { AcessoriasApiClient } from "@/lib/acessorias/client";
import {
  formatAcessoriasDate,
  formatAcessoriasDateTime,
} from "@/lib/acessorias/dates";
import { AcessoriasApiError } from "@/lib/acessorias/errors";
import {
  mapCompany,
  mapRequest,
  mapUser,
  type LegalizationDepartments,
} from "@/lib/acessorias/mappers";
import { paginateAcessorias } from "@/lib/acessorias/paginate";
import {
  acessoriasCompanySchema,
  acessoriasRequestSchema,
  acessoriasUserSchema,
} from "@/lib/acessorias/schemas";

import {
  SETTINGS,
  type SyncCounters,
  type SyncMode,
  type SyncProgress,
  type SyncResult,
  type SyncStatus,
  type SyncStore,
  type SyncType,
} from "./types";

export type SyncDeps = {
  api: AcessoriasApiClient;
  store: SyncStore;
  now?: () => Date;
  onProgress?: (progress: SyncProgress) => void;
};

/** Margem ao reutilizar o cursor de empresas: o reprocessamento é idempotente. */
const CURSOR_OVERLAP_MS = 60_000;
const DEFAULT_REQUEST_WINDOW_DAYS = 90;

type Context = {
  counters: SyncCounters;
  pages: number;
  /** Processa uma página; falha de gravação conta como registros com falha. */
  persistPage: (
    received: number,
    write: () => Promise<{ created: number; updated: number }>,
  ) => Promise<void>;
};

/**
 * Executa uma sincronização registrando-a em legal_sync_logs. O cursor só
 * avança quando a execução termina em SUCCESS (DATABASE.md §8).
 */
async function runSync(
  deps: SyncDeps,
  type: SyncType,
  mode: SyncMode,
  body: (context: Context) => Promise<{ cursor: string | null }>,
): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const runId = await deps.store.startRun(type, startedAt);

  const counters: SyncCounters = {
    received: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };
  const failures: string[] = [];
  const context: Context = {
    counters,
    pages: 0,
    persistPage: async (received, write) => {
      context.pages++;
      counters.received += received;
      try {
        const outcome = await write();
        counters.created += outcome.created;
        counters.updated += outcome.updated;
      } catch (error) {
        counters.failed += received;
        failures.push(`página ${context.pages}: ${describeError(error)}`);
      }
      deps.onProgress?.({
        type,
        page: context.pages,
        counters: { ...counters },
      });
    },
  };

  let status: SyncStatus;
  let cursor: string | null = null;
  let errorMessage: string | null = null;
  try {
    ({ cursor } = await body(context));
    // PARTIAL só quando parte foi gravada; nada gravado com falhas é FAILED.
    const persisted = counters.created + counters.updated;
    status =
      counters.failed === 0 ? "SUCCESS" : persisted > 0 ? "PARTIAL" : "FAILED";
    if (failures.length > 0) errorMessage = failures.slice(0, 5).join("; ");
  } catch (error) {
    status = "FAILED";
    errorMessage = describeError(error);
  }

  if (status === "SUCCESS" && cursor) {
    await deps.store.setSetting(SETTINGS.cursor[type], cursor);
  }

  await deps.store.finishRun(runId, {
    status,
    finishedAt: now().toISOString(),
    counters,
    errorMessage,
    metadata: {
      mode,
      pages: context.pages,
      cursor: status === "SUCCESS" ? cursor : null,
    },
  });

  return {
    type,
    mode,
    status,
    counters,
    pages: context.pages,
    cursor: status === "SUCCESS" ? cursor : null,
    errorMessage,
  };
}

export async function syncCompanies(
  deps: SyncDeps,
  requestedMode: SyncMode,
): Promise<SyncResult> {
  const previous = asIsoString(
    await deps.store.getSetting(SETTINGS.cursor.companies),
  );
  const mode: SyncMode =
    requestedMode === "incremental" && previous ? "incremental" : "full";

  return runSync(deps, "companies", mode, async ({ persistPage }) => {
    const departments = await readDepartments(deps.store);
    const syncedAt = (deps.now ?? (() => new Date()))().toISOString();
    let maxSourceUpdate = previous;

    const query = {
      departments: [
        departments.primaryId,
        ...departments.subdepartmentIds,
      ].join(","),
      DtLastDH:
        mode === "incremental"
          ? formatAcessoriasDateTime(
              new Date(Date.parse(previous!) - CURSOR_OVERLAP_MS),
            )
          : undefined,
    };

    for await (const { items } of paginateAcessorias(
      deps.api,
      "/companies/ListAll",
      query,
      acessoriasCompanySchema,
    )) {
      const mapped = items.map((company) =>
        mapCompany(company, departments, syncedAt),
      );
      for (const { client } of mapped) {
        if (
          client.acessorias_updated_at &&
          (!maxSourceUpdate || client.acessorias_updated_at > maxSourceUpdate)
        ) {
          maxSourceUpdate = client.acessorias_updated_at;
        }
      }
      await persistPage(items.length, () => deps.store.upsertCompanies(mapped));
    }

    // Cursor = maior data de alteração na origem já processada (ACESSORIAS.md §6).
    return { cursor: maxSourceUpdate };
  });
}

export async function syncUsers(deps: SyncDeps): Promise<SyncResult> {
  // A API de usuários não tem filtro incremental: sempre carga completa (~18 páginas).
  return runSync(deps, "users", "full", async ({ persistPage }) => {
    const startedAt = (deps.now ?? (() => new Date()))().toISOString();
    for await (const { items } of paginateAcessorias(
      deps.api,
      "/users/ListAll",
      {},
      acessoriasUserSchema,
    )) {
      const rows = items.map((user) => mapUser(user, startedAt));
      await persistPage(items.length, () => deps.store.upsertUsers(rows));
    }
    return { cursor: startedAt };
  });
}

export async function syncRequests(
  deps: SyncDeps,
  requestedMode: SyncMode,
): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const previous = asIsoString(
    await deps.store.getSetting(SETTINGS.cursor.requests),
  );
  const mode: SyncMode =
    requestedMode === "incremental" && previous ? "incremental" : "full";

  return runSync(deps, "requests", mode, async ({ persistPage }) => {
    const departments = await readDepartments(deps.store);
    const relevant = new Set([
      departments.primaryId,
      ...departments.subdepartmentIds,
    ]);
    const startedAt = now().toISOString();

    // A API filtra só por data (sem departamento nem empresa). A carga completa
    // é limitada a uma janela; a incremental reprocessa desde o dia do cursor.
    const windowDays =
      Number(await deps.store.getSetting(SETTINGS.requestWindowDays)) ||
      DEFAULT_REQUEST_WINDOW_DAYS;
    const since =
      mode === "incremental"
        ? new Date(previous!)
        : new Date(now().getTime() - windowDays * 86_400_000);

    for await (const { items } of paginateAcessorias(
      deps.api,
      "/requests/ListAll",
      { SolUltAtIni: formatAcessoriasDate(since) },
      acessoriasRequestSchema,
    )) {
      const rows = items
        .filter((request) => relevant.has(request.DptoID))
        .map((request) => mapRequest(request, startedAt));
      await persistPage(rows.length, () =>
        rows.length > 0
          ? deps.store.upsertRequests(rows)
          : Promise.resolve({ created: 0, updated: 0 }),
      );
    }
    return { cursor: startedAt };
  });
}

async function readDepartments(
  store: SyncStore,
): Promise<LegalizationDepartments> {
  const primary = await store.getSetting(SETTINGS.departmentId);
  if (typeof primary !== "string" && typeof primary !== "number") {
    throw new Error(
      "Departamento da Legalização não configurado em legal_settings.",
    );
  }
  const subs = await store.getSetting(SETTINGS.subdepartmentIds);
  return {
    primaryId: String(primary),
    subdepartmentIds: Array.isArray(subs) ? subs.map(String) : [],
  };
}

function asIsoString(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

/** Mensagem segura para log: sem token, sem payload bruto. */
function describeError(error: unknown): string {
  if (error instanceof AcessoriasApiError) {
    return [error.message, error.businessError, error.endpoint]
      .filter(Boolean)
      .join(" — ");
  }
  return error instanceof Error ? error.message : "Erro desconhecido.";
}

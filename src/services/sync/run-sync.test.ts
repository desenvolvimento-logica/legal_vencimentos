import { describe, expect, it } from "vitest";

import { AcessoriasApiClient } from "@/lib/acessorias/client";
import {
  companyFixture,
  requestFixture,
  userFixture,
} from "@/lib/acessorias/fixtures";
import type { MappedCompany } from "@/lib/acessorias/mappers";
import type { TablesInsert } from "@/types/database";

import { syncCompanies, syncRequests, syncUsers } from "./run-sync";
import {
  SETTINGS,
  SyncAlreadyRunningError,
  type SyncStore,
  type SyncType,
} from "./types";

const NOW = new Date("2026-10-15T18:00:00.000Z"); // 15:00 em Brasília

/** Store em memória que imita SupabaseSyncStore. */
class MemoryStore implements SyncStore {
  settings = new Map<string, unknown>([
    [SETTINGS.departmentId, "5"],
    [SETTINGS.subdepartmentIds, ["13"]],
    [SETTINGS.requestWindowDays, 90],
  ]);
  runs: { id: string; type: SyncType; status: string; result?: unknown }[] = [];
  clients = new Map<string, MappedCompany>();
  users = new Map<string, TablesInsert<"legal_acessorias_users">>();
  requests = new Map<string, TablesInsert<"legal_acessorias_requests">>();
  failCompanyWrites = false;

  async getSetting(key: string) {
    return this.settings.get(key) ?? null;
  }
  async setSetting(key: string, value: unknown) {
    this.settings.set(key, value);
  }
  async startRun(type: SyncType) {
    if (
      this.runs.some((run) => run.type === type && run.status === "RUNNING")
    ) {
      throw new SyncAlreadyRunningError(type);
    }
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ id, type, status: "RUNNING" });
    return id;
  }
  async finishRun(id: string, result: Parameters<SyncStore["finishRun"]>[1]) {
    const run = this.runs.find((item) => item.id === id)!;
    run.status = result.status;
    run.result = result;
  }
  private upsert<T>(map: Map<string, T>, rows: T[], key: (row: T) => string) {
    let created = 0;
    for (const row of rows) {
      if (!map.has(key(row))) created++;
      map.set(key(row), row);
    }
    return { created, updated: rows.length - created };
  }
  async upsertCompanies(companies: MappedCompany[]) {
    if (this.failCompanyWrites)
      throw new Error("Falha ao gravar clientes (XX000).");
    return this.upsert(
      this.clients,
      companies,
      (c) => c.client.acessorias_company_id,
    );
  }
  async upsertUsers(rows: TablesInsert<"legal_acessorias_users">[]) {
    return this.upsert(this.users, rows, (u) => u.acessorias_user_id);
  }
  async upsertRequests(rows: TablesInsert<"legal_acessorias_requests">[]) {
    return this.upsert(this.requests, rows, (r) => r.acessorias_request_id);
  }
}

type Route = (url: URL) => { status: number; body?: unknown };

/** Cliente real sobre um fetch falso que responde por rota. */
function makeApi(route: Route) {
  const urls: URL[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url);
    const reply = route(url);
    return new Response(
      reply.body === undefined ? null : JSON.stringify(reply.body),
      {
        status: reply.status,
      },
    );
  }) as typeof fetch;
  const api = new AcessoriasApiClient({
    baseUrl: "https://api.acessorias.example",
    token: "token",
    fetch: fetchImpl,
    maxRetries: 0,
    clock: { now: () => 0, sleep: async () => {} },
  });
  return { api, urls };
}

/** Lista paginada de 20 em 20 a partir de `items`. */
function paged(items: unknown[]): Route {
  return (url) => {
    const page = Number(url.searchParams.get("Pagina") ?? 1);
    return { status: 200, body: items.slice((page - 1) * 20, page * 20) };
  };
}

const companies = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...companyFixture,
    ID: String(1000 + i),
    // A última empresa tem a alteração mais recente na origem.
    DtLastDH: i === count - 1 ? "14/10/2026 10:00:00" : "01/10/2026 08:00:00",
  }));

describe("syncCompanies", () => {
  it("carga completa grava clientes, fecha o log e avança o cursor", async () => {
    const store = new MemoryStore();
    const { api, urls } = makeApi(paged(companies(25)));

    const result = await syncCompanies({ api, store, now: () => NOW }, "full");

    expect(result).toMatchObject({
      status: "SUCCESS",
      mode: "full",
      pages: 2,
      counters: { received: 25, created: 25, updated: 0, failed: 0 },
    });
    expect(store.clients.size).toBe(25);
    // Cursor = maior DtLastDH da origem (14/10 10:00 em Brasília).
    expect(store.settings.get(SETTINGS.cursor.companies)).toBe(
      "2026-10-14T13:00:00.000Z",
    );
    expect(urls[0].searchParams.get("departments")).toBe("5,13");
    expect(urls[0].searchParams.has("DtLastDH")).toBe(false);
    expect(store.runs[0].status).toBe("SUCCESS");
  });

  it("incremental usa o cursor com margem, no horário de Brasília", async () => {
    const store = new MemoryStore();
    store.settings.set(SETTINGS.cursor.companies, "2026-10-14T13:00:00.000Z");
    const { api, urls } = makeApi(paged(companies(3)));

    const result = await syncCompanies(
      { api, store, now: () => NOW },
      "incremental",
    );

    expect(result.mode).toBe("incremental");
    expect(urls[0].searchParams.get("DtLastDH")).toBe("2026-10-14 09:59:00");
  });

  it("incremental sem cursor vira carga completa", async () => {
    const store = new MemoryStore();
    const { api, urls } = makeApi(paged([]));
    const result = await syncCompanies(
      { api, store, now: () => NOW },
      "incremental",
    );
    expect(result.mode).toBe("full");
    expect(urls[0].searchParams.has("DtLastDH")).toBe(false);
  });

  it("falha em todas as páginas vira FAILED e não avança o cursor", async () => {
    const store = new MemoryStore();
    store.settings.set(SETTINGS.cursor.companies, "2026-10-01T00:00:00.000Z");
    store.failCompanyWrites = true;
    const { api } = makeApi(paged(companies(5)));

    const result = await syncCompanies({ api, store, now: () => NOW }, "full");

    expect(result.status).toBe("FAILED");
    expect(result.counters.failed).toBe(5);
    expect(result.errorMessage).toMatch(/Falha ao gravar clientes/);
    expect(store.settings.get(SETTINGS.cursor.companies)).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("falha em parte das páginas vira PARTIAL e não avança o cursor", async () => {
    const store = new MemoryStore();
    const original = store.upsertCompanies.bind(store);
    let calls = 0;
    // Primeira página grava; a segunda falha.
    store.upsertCompanies = async (page) => {
      if (++calls === 2) throw new Error("Falha ao gravar clientes (XX000).");
      return original(page);
    };
    const { api } = makeApi(paged(companies(25)));

    const result = await syncCompanies({ api, store, now: () => NOW }, "full");

    expect(result.status).toBe("PARTIAL");
    expect(result.counters).toMatchObject({ created: 20, failed: 5 });
    expect(store.settings.has(SETTINGS.cursor.companies)).toBe(false);
  });

  it("erro da API encerra como FAILED, sem expor o token", async () => {
    const store = new MemoryStore();
    const { api } = makeApi(() => ({ status: 401 }));

    const result = await syncCompanies({ api, store, now: () => NOW }, "full");

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toMatch(/HTTP 401/);
    expect(result.errorMessage).not.toContain("token");
    expect(store.settings.has(SETTINGS.cursor.companies)).toBe(false);
  });

  it("sem departamento configurado não chama a API", async () => {
    const store = new MemoryStore();
    store.settings.set(SETTINGS.departmentId, null);
    const { api, urls } = makeApi(paged(companies(1)));

    const result = await syncCompanies({ api, store, now: () => NOW }, "full");

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toMatch(/não configurado/);
    expect(urls).toHaveLength(0);
  });

  it("recusa execução paralela do mesmo tipo", async () => {
    const store = new MemoryStore();
    await store.startRun("companies");
    const { api } = makeApi(paged([]));
    await expect(
      syncCompanies({ api, store, now: () => NOW }, "full"),
    ).rejects.toBeInstanceOf(SyncAlreadyRunningError);
  });

  it("segunda execução conta atualizações, não criações (idempotente)", async () => {
    const store = new MemoryStore();
    const { api } = makeApi(paged(companies(4)));
    await syncCompanies({ api, store, now: () => NOW }, "full");
    const second = await syncCompanies({ api, store, now: () => NOW }, "full");
    expect(second.counters).toMatchObject({ created: 0, updated: 4 });
    expect(store.clients.size).toBe(4);
  });
});

describe("syncUsers", () => {
  it("sempre carga completa; cursor = início da execução", async () => {
    const store = new MemoryStore();
    const { api } = makeApi(paged([userFixture, { ...userFixture, id: "2" }]));
    const result = await syncUsers({ api, store, now: () => NOW });
    expect(result).toMatchObject({
      status: "SUCCESS",
      counters: { created: 2 },
    });
    expect(store.settings.get(SETTINGS.cursor.users)).toBe(NOW.toISOString());
  });
});

describe("syncRequests", () => {
  const requests = [
    { ...requestFixture, SolID: "1", DptoID: "5" },
    { ...requestFixture, SolID: "2", DptoID: "13" },
    { ...requestFixture, SolID: "3", DptoID: "2" }, // Fiscal: ignorada
  ];

  it("carga completa usa a janela configurada e grava só a Legalização", async () => {
    const store = new MemoryStore();
    const { api, urls } = makeApi(paged(requests));

    const result = await syncRequests({ api, store, now: () => NOW }, "full");

    expect(urls[0].searchParams.get("SolUltAtIni")).toBe("2026-07-17");
    expect([...store.requests.keys()].sort()).toEqual(["1", "2"]);
    expect(result.counters).toMatchObject({ received: 2, created: 2 });
    expect(store.settings.get(SETTINGS.cursor.requests)).toBe(
      NOW.toISOString(),
    );
  });

  it("incremental reprocessa desde o dia do cursor (Brasília)", async () => {
    const store = new MemoryStore();
    // 01:30 UTC de 15/10 ainda é dia 14 em Brasília.
    store.settings.set(SETTINGS.cursor.requests, "2026-10-15T01:30:00.000Z");
    const { api, urls } = makeApi(paged(requests));

    await syncRequests({ api, store, now: () => NOW }, "incremental");

    expect(urls[0].searchParams.get("SolUltAtIni")).toBe("2026-10-14");
  });
});

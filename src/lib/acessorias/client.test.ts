import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AcessoriasApiClient } from "./client";
import { AcessoriasApiError } from "./errors";
import { companyFixture } from "./fixtures";
import { paginateAcessorias } from "./paginate";
import type { Clock } from "./rate-limiter";
import { acessoriasCompanySchema } from "./schemas";

const TOKEN = "token-super-secreto";

type Reply = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

/** fetch falso que responde em sequência e registra as chamadas. */
function fakeFetch(replies: (Reply | Error)[]) {
  const calls: { url: string; headers: Headers }[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    const reply = replies.shift();
    if (!reply) throw new Error("Chamada inesperada");
    if (reply instanceof Error) throw reply;
    return new Response(
      reply.body === undefined ? null : JSON.stringify(reply.body),
      { status: reply.status, headers: reply.headers },
    );
  };
  return { fetch: impl as typeof fetch, calls };
}

/** Relógio falso: sleep avança o tempo na hora, sem esperar. */
function fakeClock() {
  let now = 0;
  const sleeps: number[] = [];
  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  };
  return { clock, sleeps };
}

function makeClient(replies: (Reply | Error)[], requestsPerMinute = 90) {
  const fetchMock = fakeFetch(replies);
  const time = fakeClock();
  const client = new AcessoriasApiClient({
    baseUrl: "https://api.acessorias.example",
    token: TOKEN,
    fetch: fetchMock.fetch,
    clock: time.clock,
    random: () => 0,
    requestsPerMinute,
  });
  return { client, ...fetchMock, ...time };
}

const listSchema = z.array(acessoriasCompanySchema);

describe("AcessoriasApiClient", () => {
  it("envia Bearer, monta flags de presença e omite parâmetros indefinidos", async () => {
    const { client, calls } = makeClient([{ status: 200, body: [] }]);
    await client.get(
      "/companies/ListAll",
      { departments: "5,13", obligations: undefined, ativa: true, Pagina: 2 },
      listSchema,
    );
    expect(calls[0].url).toBe(
      "https://api.acessorias.example/companies/ListAll?departments=5%2C13&ativa&Pagina=2",
    );
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("valida e normaliza a resposta", async () => {
    const { client } = makeClient([{ status: 200, body: [companyFixture] }]);
    const [company] = await client.get("/companies/ListAll", {}, listSchema);
    expect(company.ID).toBe("1234");
    expect(company.Departamentos).toHaveLength(3);
  });

  it("HTTP 200 com { Erro } vira erro de negócio sem nova tentativa", async () => {
    const { client, calls } = makeClient([
      {
        status: 200,
        body: { Erro: "O parâmetro DtLastDH não pode ser vazio." },
      },
    ]);
    const error = await client
      .get("/companies/ListAll", {}, listSchema)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AcessoriasApiError);
    expect(error).toMatchObject({
      retryable: false,
      businessError: "O parâmetro DtLastDH não pode ser vazio.",
    });
    expect(calls).toHaveLength(1);
  });

  it("HTTP 204 é lista vazia", async () => {
    const { client } = makeClient([{ status: 204 }]);
    expect(await client.get("/companies/ListAll", {}, listSchema)).toEqual([]);
  });

  it("repete 429 respeitando Retry-After e depois tem sucesso", async () => {
    const { client, calls, sleeps } = makeClient([
      { status: 429, headers: { "Retry-After": "7" } },
      { status: 200, body: [] },
    ]);
    await client.get("/companies/ListAll", {}, listSchema);
    expect(calls).toHaveLength(2);
    expect(sleeps).toContain(7000);
  });

  it("repete 5xx e falha de rede com backoff exponencial", async () => {
    const { client, calls, sleeps } = makeClient([
      { status: 503 },
      new TypeError("fetch failed"),
      { status: 200, body: [] },
    ]);
    await client.get("/companies/ListAll", {}, listSchema);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("não repete 401 nem 404", async () => {
    for (const status of [401, 404]) {
      const { client, calls } = makeClient([{ status }]);
      const error = await client
        .get("/companies/ListAll", {}, listSchema)
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ status, retryable: false });
      expect(calls).toHaveLength(1);
    }
  });

  it("desiste após o limite de tentativas", async () => {
    const { client, calls } = makeClient(
      Array.from({ length: 5 }, () => ({ status: 500 })),
    );
    await expect(
      client.get("/companies/ListAll", {}, listSchema),
    ).rejects.toMatchObject({ status: 500, retryable: true });
    expect(calls).toHaveLength(5);
  });

  it("rejeita payload fora do formato sem nova tentativa", async () => {
    const { client, calls } = makeClient([
      { status: 200, body: [{ Razao: "sem ID" }] },
    ]);
    await expect(
      client.get("/companies/ListAll", {}, listSchema),
    ).rejects.toThrow(/fora do formato esperado/);
    expect(calls).toHaveLength(1);
  });

  it("nunca expõe o token em mensagens de erro", async () => {
    const { client } = makeClient([{ status: 401 }]);
    const error = (await client
      .get("/companies/ListAll", {}, listSchema)
      .catch((e: unknown) => e)) as AcessoriasApiError;
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
      TOKEN,
    );
    expect(error.endpoint).toBe("/companies/ListAll");
  });

  it("respeita o limite de requisições por minuto", async () => {
    const { client, sleeps } = makeClient(
      Array.from({ length: 3 }, () => ({ status: 200, body: [] })),
      2,
    );
    for (let i = 0; i < 3; i++) {
      await client.get("/users/ListAll", {}, z.array(z.unknown()));
    }
    // A terceira chamada espera a janela de 60 s liberar um espaço.
    expect(sleeps).toEqual([60_000]);
  });
});

describe("paginateAcessorias", () => {
  const page = (start: number, size: number) =>
    Array.from({ length: size }, (_, i) => ({
      ...companyFixture,
      ID: String(start + i),
    }));

  it("percorre as páginas até uma página incompleta", async () => {
    const { client, calls } = makeClient([
      { status: 200, body: page(1, 20) },
      { status: 200, body: page(21, 20) },
      { status: 200, body: page(41, 3) },
    ]);
    const ids: string[] = [];
    for await (const { items } of paginateAcessorias(
      client,
      "/companies/ListAll",
      {},
      acessoriasCompanySchema,
    )) {
      ids.push(...items.map((item) => item.ID));
    }
    expect(ids).toHaveLength(43);
    expect(new Set(ids).size).toBe(43);
    expect(
      calls.map((call) => new URL(call.url).searchParams.get("Pagina")),
    ).toEqual(["1", "2", "3"]);
  });

  it("termina na lista vazia", async () => {
    const { client, calls } = makeClient([
      { status: 200, body: page(1, 20) },
      { status: 200, body: [] },
    ]);
    const pages = [];
    for await (const result of paginateAcessorias(
      client,
      "/companies/ListAll",
      {},
      acessoriasCompanySchema,
    )) {
      pages.push(result);
    }
    expect(pages).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it("interrompe se a API repetir a mesma página", async () => {
    const { client } = makeClient([
      { status: 200, body: page(1, 20) },
      { status: 200, body: page(1, 20) },
    ]);
    const run = async () => {
      for await (const _ of paginateAcessorias(
        client,
        "/companies/ListAll",
        {},
        acessoriasCompanySchema,
      )) {
        // consome
      }
    };
    await expect(run()).rejects.toThrow(/repetiu a página/);
  });
});

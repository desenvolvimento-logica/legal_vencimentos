import { z } from "zod";

import { AcessoriasApiError, isRetryableStatus } from "./errors";
import {
  SlidingWindowRateLimiter,
  systemClock,
  type Clock,
} from "./rate-limiter";

export type QueryValue = string | number | true | undefined;

export type AcessoriasClientOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
  requestsPerMinute?: number;
  fetch?: typeof fetch;
  clock?: Clock;
  random?: () => number;
};

const DEFAULTS = {
  timeoutMs: 30_000,
  maxRetries: 4,
  requestsPerMinute: 90,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

const businessErrorSchema = z.object({ Erro: z.string() });

/**
 * Único ponto de acesso HTTP ao Acessórias (ACESSORIAS.md §2). Somente
 * leitura: esta versão não envia mutações à API. Uso exclusivo no servidor.
 */
export class AcessoriasApiClient {
  private readonly options: Required<Omit<AcessoriasClientOptions, "fetch">> & {
    fetch: typeof fetch;
  };
  private readonly limiter: SlidingWindowRateLimiter;

  constructor(options: AcessoriasClientOptions) {
    if (!options.token) {
      throw new Error("Token do Acessórias não configurado.");
    }
    this.options = {
      timeoutMs: DEFAULTS.timeoutMs,
      maxRetries: DEFAULTS.maxRetries,
      requestsPerMinute: DEFAULTS.requestsPerMinute,
      clock: systemClock,
      random: Math.random,
      ...options,
      fetch: options.fetch ?? fetch,
    };
    this.limiter = new SlidingWindowRateLimiter(
      this.options.requestsPerMinute,
      60_000,
      this.options.clock,
    );
  }

  /** GET validado por `schema`. HTTP 204 é tratado como lista vazia. */
  async get<T>(
    path: string,
    query: Record<string, QueryValue>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const endpoint = `${url.pathname}${url.search}`;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request(url, endpoint, schema);
      } catch (error) {
        const apiError =
          error instanceof AcessoriasApiError
            ? error
            : new AcessoriasApiError({
                message: "Falha de comunicação com o Acessórias.",
                endpoint,
                retryable: true,
                cause: error,
              });
        if (!apiError.retryable || attempt >= this.options.maxRetries) {
          throw apiError;
        }
        await this.options.clock.sleep(
          this.retryDelay(attempt, apiError.retryAfterMs),
        );
      }
    }
  }

  private async request<T>(
    url: URL,
    endpoint: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    await this.limiter.acquire();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );
    let response: Response;
    try {
      response = await this.options.fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      throw new AcessoriasApiError({
        message: controller.signal.aborted
          ? "Tempo limite excedido ao consultar o Acessórias."
          : "Falha de rede ao consultar o Acessórias.",
        endpoint,
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 204) {
      return this.parse([], schema, endpoint, response.status);
    }

    if (!response.ok) {
      throw new AcessoriasApiError({
        message: `Acessórias respondeu HTTP ${response.status}.`,
        endpoint,
        status: response.status,
        retryable: isRetryableStatus(response.status),
        retryAfterMs: parseRetryAfter(
          response.headers.get("retry-after"),
          this.options.clock.now(),
        ),
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new AcessoriasApiError({
        message: "Resposta do Acessórias não é um JSON válido.",
        endpoint,
        status: response.status,
        retryable: false,
        cause: error,
      });
    }

    // A API sinaliza erros de negócio com HTTP 200 e a chave `Erro`.
    const businessError = businessErrorSchema.safeParse(body);
    if (businessError.success) {
      throw new AcessoriasApiError({
        message: "Acessórias recusou a requisição.",
        endpoint,
        status: response.status,
        retryable: false,
        businessError: businessError.data.Erro,
      });
    }

    return this.parse(body, schema, endpoint, response.status);
  }

  private parse<T>(
    body: unknown,
    schema: z.ZodType<T>,
    endpoint: string,
    status: number,
  ): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new AcessoriasApiError({
        message: `Resposta do Acessórias fora do formato esperado (${result.error.issues
          .slice(0, 3)
          .map((issue) => issue.path.join(".") || "(raiz)")
          .join(", ")}).`,
        endpoint,
        status,
        retryable: false,
        cause: result.error,
      });
    }
    return result.data;
  }

  private buildUrl(path: string, query: Record<string, QueryValue>): URL {
    const url = new URL(path, this.options.baseUrl);
    // Flags de presença (ex.: ?departments) não têm valor; os demais são omitidos
    // quando indefinidos, como recomenda a documentação.
    const parts: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      parts.push(
        value === true
          ? encodeURIComponent(key)
          : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      );
    }
    url.search = parts.join("&");
    return url;
  }

  private retryDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined)
      return Math.min(retryAfterMs, DEFAULTS.maxDelayMs);
    const exponential = DEFAULTS.baseDelayMs * 2 ** attempt;
    const jitter = this.options.random() * DEFAULTS.baseDelayMs;
    return Math.min(exponential + jitter, DEFAULTS.maxDelayMs);
  }
}

function parseRetryAfter(
  value: string | null,
  now: number,
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

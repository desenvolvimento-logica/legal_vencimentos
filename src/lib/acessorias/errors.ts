/**
 * Erro tipado da integração com o Acessórias. A mensagem nunca contém o token
 * nem o corpo bruto da resposta.
 */
export class AcessoriasApiError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  /** Caminho e query da requisição, sem credenciais. */
  readonly endpoint: string;
  /** Mensagem de negócio retornada pela API na chave `Erro`, quando houver. */
  readonly businessError?: string;
  /** Atraso sugerido pelo header Retry-After, em ms. */
  readonly retryAfterMs?: number;

  constructor(options: {
    message: string;
    endpoint: string;
    retryable: boolean;
    status?: number;
    businessError?: string;
    retryAfterMs?: number;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "AcessoriasApiError";
    this.status = options.status;
    this.retryable = options.retryable;
    this.endpoint = options.endpoint;
    this.businessError = options.businessError;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** Status HTTP que justificam nova tentativa (ACESSORIAS.md §4). */
export function isRetryableStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}
